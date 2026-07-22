import type { ChatMessage, ModelOption } from '~/types'
import { uid } from '~/utils/uid'
import { LmStudioService } from '~/services/lm-studio.service'
import { SessionService } from '~/services/session.service'

function estimateTokens(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  // Rough local estimate when provider usage stats are unavailable.
  return Math.max(1, Math.round(trimmed.length / 4))
}

const _lmStudio = new LmStudioService('/api/lm')
const _sessionService = new SessionService()

export function useChatState() {
  const config = useRuntimeConfig()
  const persistence = useSessionPersistence()

  const messages = ref<ChatMessage[]>([])
  const selectedModel = ref<string>('')
  const availableModels = ref<ModelOption[]>([])
  const isStreaming = ref(false)
  const currentSessionPath = ref<string | null>(null)
  const loadError = ref<string | null>(null)
  const sessionRefreshTick = ref(0)
  const thinkingEnabled = ref(true)

  const thinkingSupported = computed(() => !!selectedModel.value)

  watch(selectedModel, (_new, old) => {
    if (old && _new !== old) thinkingEnabled.value = true
  })

  async function exportToPDF() {
    if (!currentSessionPath.value) return

    const fileName = currentSessionPath.value.replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.replace(/\.md$/, '') || 'chat-session'

    document.title = `session-${fileName}`
    setTimeout(() => window.print(), 50)
  }

  async function loadModels() {
    loadError.value = null
    try {
      availableModels.value = await _lmStudio.getModels()
      if (!selectedModel.value && availableModels.value.length > 0) {
        selectedModel.value = availableModels.value[0].id
      }
    } catch {
      loadError.value = `Could not connect to ${config.public.llmServerName} at ${config.public.llmServerBaseURL}. Make sure it's running.`
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

    const assistantId = uid()
    const now = new Date().toISOString()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: now,
    }
    messages.value.push(assistantMsg)
    const startedAt = Date.now()

    function findAssistant(): ChatMessage | undefined {
      return messages.value.find((m) => m.id === assistantId)
    }
    const timeoutMs = Number(config.public.chatRequestTimeoutMs ?? 0)
    const requestController = new AbortController()
    const timeoutHandle = timeoutMs > 0
      ? setTimeout(() => requestController.abort(), timeoutMs)
      : null

    // Accumulate streaming deltas and flush at display refresh rate
    let accContent = ''
    let accReasoning = ''
    let flushScheduled = false

    function flushAccumulator() {
      flushScheduled = false
      const msg = findAssistant()
      if (!msg) return
      if (accContent) {
        msg.content += accContent
        accContent = ''
      }
      if (accReasoning) {
        msg.thinking = (msg.thinking ?? '') + accReasoning
        accReasoning = ''
      }
    }

    function scheduleFlush() {
      if (flushScheduled) return
      flushScheduled = true
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(flushAccumulator)
      } else {
        setTimeout(flushAccumulator, 50)
      }
    }

    try {
      const response = await _lmStudio.sendChat(
        messages.value.slice(0, -1),
        selectedModel.value,
        (delta) => {
          accContent += delta
          scheduleFlush()
        },
        requestController.signal,
        thinkingEnabled.value,
        (reasoningDelta) => {
          accReasoning += reasoningDelta
          scheduleFlush()
        },
        config.public.llmSystemPrompt as string | undefined,
      )

      // Flush any remaining accumulated content
      flushAccumulator()

      const last = findAssistant()
      if (last) {
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
    } catch (err: unknown) {
      flushScheduled = false
      accContent = ''
      accReasoning = ''
      const last = findAssistant()
      const errObject = err instanceof Error ? err : (typeof err === 'object' && err !== null ? err as Record<string, unknown> : null)
      const isTimeout = errObject?.name === 'AbortError' && timeoutMs > 0
      if (last) {
        if (!last.createdAt) {
          last.createdAt = new Date().toISOString()
        }
        last.content = isTimeout
          ? `Error: Request timed out after ${Math.round(timeoutMs / 1000)}s`
          : `Error: ${(errObject && typeof errObject.message === 'string' ? errObject.message : null) ?? 'Request failed'}`
        last.responseStatus = 'incomplete'
        last.stopReason = isTimeout ? 'timeout' : undefined
      }

      // Only persist if a session already exists (avoid creating orphaned error-only files)
      if (currentSessionPath.value) {
        try {
          await saveSession()
        } catch (saveErr) {
          console.error('Failed to save errored session:', saveErr)
        }
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      isStreaming.value = false
    }
  }

  async function loadSession(path: string) {
    try {
      const res = await persistence.read(path)
      const { meta, messages: loaded } = _sessionService.parseMarkdown(res.content)
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
    const content = _sessionService.buildMarkdown(messages.value, {
      model: selectedModel.value,
      service: config.public.llmServerName,
      created: new Date().toISOString(),
    })

    const path = currentSessionPath.value
    if (path) {
      await persistence.write(path, content)
    } else {
      const meta = {
        model: selectedModel.value,
        service: config.public.llmServerName,
        created: new Date().toISOString(),
      }
      const res = await persistence.create(meta)
      // Only store the path after the content rewrite succeeds
      await persistence.write(res.path, content)
      currentSessionPath.value = res.path
    }
    sessionRefreshTick.value++
  }

  async function rewriteSessionFile() {
    if (!currentSessionPath.value) return
    const content = _sessionService.buildMarkdown(messages.value, {
      model: selectedModel.value,
      service: config.public.llmServerName,
      created: new Date().toISOString(),
    })
    await persistence.write(currentSessionPath.value, content)
    sessionRefreshTick.value++
  }

  return {
    messages: readonly(messages),
    selectedModel: readonly(selectedModel),
    availableModels: readonly(availableModels),
    isStreaming: readonly(isStreaming),
    currentSessionPath: readonly(currentSessionPath),
    loadError: readonly(loadError),
    sessionRefreshTick: readonly(sessionRefreshTick),
    thinkingEnabled: readonly(thinkingEnabled),
    thinkingSupported,
    loadModels,
    sendMessage,
    loadSession,
    newSession,
    deleteMessage,
    deleteRange,
    exportToPDF,
  }
}