import type { ChatMessage, ModelOption } from '~/types'
import { LmStudioService } from '~/services/lm-studio.service'
import { SessionService } from '~/services/session.service'

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

      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([595.28, 841.89])

      const { width, height } = page.getSize()

      const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

      const lines = content.split('\n')
      let y = height - 50
      const lineHeight = 20

      lines.forEach((line) => {
        if (line.startsWith('---')) {
          const titleText = line.replace(/---/g, '').trim()
          y -= lineHeight * 1.5
          page.drawText(titleText, {
            x: 50,
            y: y,
            size: 24,
            font: titleFont,
            color: rgb(0.2, 0.2, 0.5),
          })
          y -= lineHeight
        } else if (line.startsWith('##')) {
          const text = line.replace(/^#+\s*/, '')
          y -= lineHeight
          page.drawText(text, {
            x: 50,
            y: y,
            size: 14,
            font: bodyFont,
            color: rgb(0.3, 0.3, 0.3),
          })
          y -= lineHeight * 0.5
        } else if (line.includes('-->')) {
          return
        } else if (line.trim()) {
          const words = line.split(' ')
          let lineText = ''
          
          words.forEach((word) => {
            const testText = lineText + (lineText ? ' ' : '') + word
            const textWidth = bodyFont.widthOfTextAtSize(testText, 12)
            
            if (textWidth > width - 100) {
              page.drawText(lineText, {
                x: 50,
                y: y,
                size: 12,
                font: bodyFont,
                color: rgb(0, 0, 0),
              })
              y -= lineHeight
              lineText = word
            } else {
              lineText = testText
            }
          })
          
          if (lineText) {
            page.drawText(lineText, {
              x: 50,
              y: y,
              size: 12,
              font: bodyFont,
              color: rgb(0, 0, 0),
            })
            y -= lineHeight
          }
          y -= lineHeight * 0.5
        }
      })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fileName = currentSessionPath.value.replace(/\\/g, '/')
        .split('/')
        .pop()
        ?.replace(/\.md$/, '.pdf') || 'chat-session.pdf'
      a.download = `session-${fileName}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
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
      // Persist prompt immediately so a session file exists as soon as the user sends.
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