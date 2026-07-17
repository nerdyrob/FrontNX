import type { ChatMessage, ModelOption } from '~/types'
import { LmStudioService } from '~/services/lm-studio.service'
import { SessionService } from '~/services/session.service'
import { createMd } from '~/utils/markdown'

function uid(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function estimateTokens(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  // Rough local estimate when provider usage stats are unavailable.
  return Math.max(1, Math.round(trimmed.length / 4))
}

export function useChatState() {
  const config = useRuntimeConfig()
  const lmStudio = new LmStudioService('/api/lm')
  const sessionService = new SessionService()

  const messages = ref<ChatMessage[]>([])
  const selectedModel = ref<string>('')
  const availableModels = ref<ModelOption[]>([])
  const isStreaming = ref(false)
  const currentSessionPath = ref<string | null>(null)
  const loadError = ref<string | null>(null)
  const sessionRefreshTick = ref(0)

  async function exportToPDF() {
    if (!currentSessionPath.value) return

    try {
      const sessionRes = await $fetch<{ content: string }>('/api/session/read', {
        params: { path: currentSessionPath.value },
      })
      const content = sessionRes.content

      // Strip HTML comments (metrics metadata)
      let clean = content.replace(/<!--[\s\S]*?-->/g, '')

      // Convert YAML front matter to a readable header
      clean = clean.replace(
        /^---\nmodel: (.+)\nservice: (.+)\ncreated: (.+)\n---\n*/,
        (_match, model, _service, created) => {
          const date = new Date(created).toLocaleString()
          return `# Chat Session  \n*Model: ${model} — ${date}*\n\n`
        },
      )

      const md = createMd()
      const bodyHtml = md.render(clean)

      const fileName = currentSessionPath.value.replace(/\\/g, '/')
        .split('/')
        .pop()
        ?.replace(/\.md$/, '.pdf') || 'chat-session.pdf'

      const title = `session-${fileName.replace(/\.pdf$/, '')}`

      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        console.error('Popup blocked — allow popups to export PDF')
        return
      }

      printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 25mm 20mm; }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 0;
      margin: 0;
    }
    .content {
      max-width: 170mm;
      margin: 0 auto;
      padding: 20mm 0;
    }
    h1 { font-size: 20pt; margin: 0 0 4pt; color: #111; }
    h1 + p { color: #666; font-size: 10pt; margin-top: 0; }
    h2 {
      font-size: 13pt;
      color: #333;
      margin: 20pt 0 8pt;
      padding-bottom: 4pt;
      border-bottom: 1px solid #e5e7eb;
    }
    p { margin: 8pt 0; }
    pre {
      background: #f6f8fa;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px 16px;
      overflow-x: auto;
      font-size: 9pt;
      line-height: 1.45;
    }
    code {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
      background: #f1f3f5;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 9pt;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      margin: 8pt 0;
      padding: 4pt 16pt;
      border-left: 4px solid #d0d7de;
      color: #57606a;
    }
    a { color: #2563eb; }
    img { max-width: 100%; }
    ul, ol { padding-left: 24pt; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 16pt 0; }
  </style>
</head>
<body>
  <div class="content">${bodyHtml}</div>
</body>
</html>`)
      printWindow.document.close()
      printWindow.focus()
      printWindow.onafterprint = () => printWindow.close()
      printWindow.print()
    } catch (error) {
      console.error('Failed to export to PDF:', error)
    }
  }

  async function loadModels() {
    loadError.value = null
    try {
      availableModels.value = await lmStudio.getModels()
      if (!selectedModel.value && availableModels.value.length > 0) {
        selectedModel.value = availableModels.value[0].id
      }
    } catch (err: any) {
      loadError.value = `Could not connect to LM Studio at ${config.public.lmStudioBaseUrl}. Make sure it's running.`
      availableModels.value = []
    }
  }

  async function sendMessage(text: string) {
    if (!selectedModel.value) return

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: text,
      model: selectedModel.value,
      createdAt: new Date().toISOString(),
    }
    messages.value.push(userMsg)

    try {
      await saveSession()
    } catch (err) {
      console.error('Failed to persist user prompt:', err)
    }

    isStreaming.value = true

    const assistantMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      createdAt: '',
    }
    messages.value.push(assistantMsg)
    const startedAt = Date.now()
    const timeoutMs = Number(config.public.chatRequestTimeoutMs ?? 0)
    const requestController = new AbortController()
    const timeoutHandle = timeoutMs > 0
      ? setTimeout(() => requestController.abort(), timeoutMs)
      : null

    try {
      const response = await lmStudio.sendChat(
        messages.value.slice(0, -1),
        selectedModel.value,
        (delta) => {
          const last = messages.value[messages.value.length - 1]
          if (last.role === 'assistant') {
            if (!last.createdAt) {
              last.createdAt = new Date().toISOString()
            }
            last.content += delta
          }
        },
        requestController.signal,
      )

      const last = messages.value[messages.value.length - 1]
      if (last.role === 'assistant') {
        if (!last.createdAt) {
          last.createdAt = new Date().toISOString()
        }
        last.content = response.content
        const elapsedMs = Math.max(0, Date.now() - startedAt)
        const providerProcessingMs = response.metrics?.processingTimeMs ?? 0
        const providerTokens = response.metrics?.tokensUsed ?? 0
        const providerTps = response.metrics?.tokensPerSecond ?? 0
        const contentForEstimate = (last.content || response.content || '').trim()
        const fallbackProcessingMs = Math.max(1, elapsedMs)
        const fallbackTokens = Math.max(1, estimateTokens(contentForEstimate))

        const processingTimeMs = providerProcessingMs > 0 ? providerProcessingMs : fallbackProcessingMs
        const tokensUsed = providerTokens > 0 ? providerTokens : fallbackTokens
        const tokensPerSecond = providerTps > 0
          ? providerTps
          : (tokensUsed > 0 && processingTimeMs > 0
              ? Number((tokensUsed / (processingTimeMs / 1000)).toFixed(2))
              : 0)
        last.metrics = {
          processingTimeMs,
          tokensUsed,
          tokensPerSecond,
        }
        last.responseStatus = response.status
        last.stopReason = response.stopReason
      }

      await saveSession()
    } catch (err: any) {
      const last = messages.value[messages.value.length - 1]
      const isTimeout = err?.name === 'AbortError' && timeoutMs > 0
      if (last.role === 'assistant') {
        if (!last.createdAt) {
          last.createdAt = new Date().toISOString()
        }
        last.content = isTimeout
          ? `Error: Request timed out after ${Math.round(timeoutMs / 1000)}s`
          : `Error: ${err.message ?? 'Request failed'}`
        last.responseStatus = 'incomplete'
        last.stopReason = isTimeout ? 'timeout' : undefined
      }

      try {
        await saveSession()
      } catch (saveErr) {
        console.error('Failed to save errored session:', saveErr)
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      isStreaming.value = false
    }
  }

  async function loadSession(path: string) {
    try {
      const res = await $fetch<{ content: string }>('/api/session/read', {
        params: { path },
      })
      const { meta, messages: loaded } = sessionService.parseMarkdown(res.content)
      messages.value = loaded
      currentSessionPath.value = path
      if (meta.model) selectedModel.value = meta.model
    } catch (err) {
      console.error('Failed to load session:', err)
    }
  }

  async function newSession() {
    messages.value = []
    currentSessionPath.value = null
  }

  function deleteMessage(index: number) {
    messages.value.splice(index, 1)
    if (currentSessionPath.value) {
      rewriteSessionFile()
    }
  }

  function deleteRange(start: number, end: number) {
    messages.value.splice(start, end - start)
    if (currentSessionPath.value) {
      rewriteSessionFile()
    }
  }

  async function saveSession() {
    if (!currentSessionPath.value) {
      const meta = {
        model: selectedModel.value,
        service: 'LM Studio',
        created: new Date().toISOString(),
      }
      const res = await $fetch<{ path: string }>('/api/session/create', {
        method: 'POST',
        body: { meta },
      })
      currentSessionPath.value = res.path
    }

    const content = sessionService.buildMarkdown(messages.value, {
      model: selectedModel.value,
      service: 'LM Studio',
      created: new Date().toISOString(),
    })

    await $fetch('/api/session/rewrite', {
      method: 'POST',
      body: { path: currentSessionPath.value, content },
    })
    sessionRefreshTick.value++
  }

  async function rewriteSessionFile() {
    if (!currentSessionPath.value) return
    const content = sessionService.buildMarkdown(messages.value, {
      model: selectedModel.value,
      service: 'LM Studio',
      created: new Date().toISOString(),
    })
    await $fetch('/api/session/rewrite', {
      method: 'POST',
      body: { path: currentSessionPath.value, content },
    })
    sessionRefreshTick.value++
  }

  return {
    messages,
    selectedModel,
    availableModels,
    isStreaming,
    currentSessionPath,
    loadError,
    sessionRefreshTick,
    loadModels,
    sendMessage,
    loadSession,
    newSession,
    deleteMessage,
    deleteRange,
    exportToPDF,
  }
}