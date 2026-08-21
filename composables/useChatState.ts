import type { ChatMessage, ModelOption, ModelParams } from '~/types'
import { uid } from '~/utils/uid'
import { LmStudioService } from '~/services/lm-studio.service'
import { SessionService } from '~/services/session.service'
import { downloadTextFile } from '~/utils/download'

export type ExportFormat = 'markdown' | 'json' | 'text'

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
  // Captured once when a session is first created so subsequent saves
  // don't rewrite the original creation timestamp (see #4 in code-review.md).
  const sessionCreatedAt = ref<string | null>(null)
  // Session-level model parameters (new-features #4), persisted in front-matter.
  const sessionTitle = ref<string | null>(null)
  const temperature = ref<number | null>(null)
  const maxTokens = ref<number | null>(null)
  const topP = ref<number | null>(null)
  const systemPromptOverride = ref<string>('')

  const thinkingSupported = computed(() => !!selectedModel.value)

  watch(selectedModel, (_new, old) => {
    // Default thinking on for the first model selection, but don't override the
    // user's explicit preference when switching between models (code-review Minor/UX).
    if (!old && _new) thinkingEnabled.value = true
  })

  function setThinkingEnabled(value: boolean) {
    thinkingEnabled.value = value
  }

  function setSessionTitle(value: string) {
    sessionTitle.value = value
  }

  function setTemperature(value: number | null) {
    temperature.value = value
  }

  function setMaxTokens(value: number | null) {
    maxTokens.value = value
  }

  function setTopP(value: number | null) {
    topP.value = value
  }

  function setSystemPromptOverride(value: string) {
    systemPromptOverride.value = value
  }

  async function exportToPDF() {
    if (!currentSessionPath.value) return

    const fileName = currentSessionPath.value.replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.replace(/\.md$/, '') || 'chat-session'

    const previousTitle = document.title
    document.title = `session-${fileName}`
    const restore = () => {
      document.title = previousTitle
    }
    // Restore after the print dialog settles, even if the user cancels.
    setTimeout(restore, 1000)
    window.addEventListener('afterprint', restore, { once: true })
    setTimeout(() => window.print(), 50)
  }

  function exportSession(format: ExportFormat) {
    const baseName = currentSessionPath.value
      ? (currentSessionPath.value.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/, '') || 'chat-session')
      : `chat-session-${new Date().toISOString().replace(/[:.]/g, '-')}`
    const meta = buildMeta()

    let content: string
    let mime: string
    let ext: string
    if (format === 'json') {
      content = _sessionService.exportAsJson(messages.value, meta)
      mime = 'application/json'
      ext = 'json'
    } else if (format === 'text') {
      content = _sessionService.exportAsText(messages.value)
      mime = 'text/plain'
      ext = 'txt'
    } else {
      content = _sessionService.exportAsMarkdown(messages.value, meta)
      mime = 'text/markdown'
      ext = 'md'
    }

    downloadTextFile(content, `${baseName}.${ext}`, mime)
  }

  async function loadModels() {
    loadError.value = null
    try {
      const allModels = await _lmStudio.getModels()
      availableModels.value = allModels.filter((m) => !m.id.toLowerCase().includes('embedding'))
      if (!selectedModel.value && availableModels.value.length > 0) {
        selectedModel.value = availableModels.value[0].id
      }
    } catch {
      loadError.value = `Could not connect to ${config.public.llmServerName} at ${config.public.llmServerBaseURL}. Make sure it's running.`
      availableModels.value = []
    }
  }

  function setSelectedModel(model: string) {
    selectedModel.value = model
  }

  let activeController: AbortController | null = null
  let stoppedManually = false

  function stopStreaming() {
    stoppedManually = true
    activeController?.abort()
  }

  async function sendMessage(text: string, images?: string[]) {
    if (!selectedModel.value) return

    // Embed attached images as markdown image links so they render in the chat
    // and persist in the session file (new-features #5).
    let content = text
    const safeImages = (images ?? []).filter((src) => /^data:image\/[a-zA-Z0-9/+]+;base64,/.test(src))
    if (safeImages.length > 0) {
      const imageMarkdown = safeImages.map(src => `\n![image](${src})`).join('')
      content = text ? `${text}${imageMarkdown}` : imageMarkdown.trim()
    }

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content,
      model: selectedModel.value,
      createdAt: new Date().toISOString(),
    }
    messages.value.push(userMsg)

    try {
      await saveSession()
    } catch (err) {
      console.error('Failed to persist user prompt:', err)
    }

    await streamAssistantReply()
  }

  // Generates a fresh assistant reply for the user message currently at the
  // end of the conversation. Shared by `sendMessage`, `editMessage`, and
  // `regenerate` (new-features #1) so the streaming pipeline lives in one place.
  async function streamAssistantReply() {
    if (!selectedModel.value) return
    if (messages.value.length === 0) return
    // The message immediately preceding the reply must be a user turn.
    if (messages.value[messages.value.length - 1].role !== 'user') return
    // Guard against overlapping streams (e.g. double-triggering regenerate).
    if (isStreaming.value) return

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
    activeController = requestController
    stoppedManually = false
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
        systemPromptOverride.value.trim() || (config.public.llmSystemPrompt as string | undefined),
        {
          temperature: temperature.value ?? undefined,
          maxTokens: maxTokens.value ?? undefined,
          topP: topP.value ?? undefined,
          includeImages: messages.value.slice(0, -1).some((m: ChatMessage) => /data:image\/[a-zA-Z0-9/+]+;base64,/.test(m.content)),
        },
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
      const isManualStop = stoppedManually
      const isTimeout = errObject?.name === 'AbortError' && timeoutMs > 0 && !isManualStop
      if (last) {
        if (!last.createdAt) {
          last.createdAt = new Date().toISOString()
        }
        const errMsg = errObject && typeof errObject.message === 'string' ? errObject.message : null
        const isPayloadTooLarge = errMsg && /413|too large|payload size/i.test(errMsg)
        last.content = isManualStop
          ? 'Stopped by user.'
          : isTimeout
            ? `Error: Request timed out after ${Math.round(timeoutMs / 1000)}s`
            : isPayloadTooLarge
              ? 'The message is too large to send. Try reducing the number of attached images or shortening the conversation.'
              : `Error: ${errMsg ?? 'Request failed'}`
        last.responseStatus = 'incomplete'
        last.stopReason = isManualStop ? 'userStopped' : (isTimeout ? 'timeout' : undefined)
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
      activeController = null
      stoppedManually = false
      isStreaming.value = false
    }
  }

  // Edits a previously sent user message in place, drops every message that
  // followed it, and regenerates the assistant reply from that point
  // (new-features #1).
  async function editMessage(index: number, newText: string) {
    if (index < 0 || index >= messages.value.length) return
    const target = messages.value[index]
    if (target.role !== 'user') return
    const trimmed = newText.trim()
    if (!trimmed) return

    target.content = trimmed
    // Splice away everything after the edited turn, then re-run the pipeline.
    messages.value.splice(index + 1)

    if (currentSessionPath.value) {
      try {
        await rewriteSessionFile()
      } catch (err) {
        console.error('Failed to persist edited message:', err)
      }
    }

    await streamAssistantReply()
  }

  // Regenerates the assistant reply at `index` by removing it (and any later
  // messages) and re-running the streaming pipeline for the preceding user turn.
  async function regenerate(index: number) {
    if (!selectedModel.value) return
    if (index <= 0 || index >= messages.value.length) return
    const previous = messages.value[index - 1]
    if (previous.role !== 'user') return

    // Drop the assistant message (and anything after it) so a fresh reply
    // can be generated for the user turn at `index - 1`.
    messages.value.splice(index)

    if (currentSessionPath.value) {
      try {
        await rewriteSessionFile()
      } catch (err) {
        console.error('Failed to persist before regenerate:', err)
      }
    }

    await streamAssistantReply()
  }

  async function loadSession(path: string) {
    try {
      const res = await persistence.read(path)
      const { meta, messages: loaded } = _sessionService.parseMarkdown(res.content)
      messages.value = loaded
      currentSessionPath.value = path
      if (meta.model) selectedModel.value = meta.model
      if (meta.created) sessionCreatedAt.value = meta.created
      sessionTitle.value = meta.title ?? null
      temperature.value = meta.params?.temperature ?? null
      maxTokens.value = meta.params?.maxTokens ?? null
      topP.value = meta.params?.topP ?? null
      systemPromptOverride.value = meta.params?.systemPrompt ?? ''
    } catch (err) {
      console.error('Failed to load session:', err)
    }
  }

  async function newSession() {
    messages.value = []
    currentSessionPath.value = null
    sessionCreatedAt.value = null
    sessionTitle.value = null
    temperature.value = null
    maxTokens.value = null
    topP.value = null
    systemPromptOverride.value = ''
  }

  function deleteMessage(index: number) {
    messages.value.splice(index, 1)
    if (currentSessionPath.value) {
      rewriteSessionFile()
    }
  }

  function buildMeta(): SessionMeta {
    // Preserve the original creation timestamp across saves (code-review #4).
    const created = sessionCreatedAt.value ?? new Date().toISOString()
    sessionCreatedAt.value = created

    const params: ModelParams = {}
    if (temperature.value !== null && !Number.isNaN(temperature.value)) params.temperature = temperature.value
    if (maxTokens.value !== null && !Number.isNaN(maxTokens.value)) params.maxTokens = maxTokens.value
    if (topP.value !== null && !Number.isNaN(topP.value)) params.topP = topP.value
    const systemPrompt = systemPromptOverride.value.trim()
    if (systemPrompt) params.systemPrompt = systemPrompt

    return {
      model: selectedModel.value,
      service: config.public.llmServerName,
      created,
      ...(sessionTitle.value ? { title: sessionTitle.value } : {}),
      ...(Object.keys(params).length > 0 ? { params } : {}),
    }
  }

  async function saveSession() {
    const meta = buildMeta()
    const content = _sessionService.buildMarkdown(messages.value, meta)

    const path = currentSessionPath.value
    if (path) {
      await persistence.write(path, content)
    } else {
      const res = await persistence.create(meta)
      // Only store the path after the content rewrite succeeds
      await persistence.write(res.path, content)
      currentSessionPath.value = res.path
    }
    sessionRefreshTick.value++
  }

  async function rewriteSessionFile() {
    if (!currentSessionPath.value) return
    const meta = buildMeta()
    const content = _sessionService.buildMarkdown(messages.value, meta)
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
    sessionTitle: readonly(sessionTitle),
    temperature: readonly(temperature),
    maxTokens: readonly(maxTokens),
    topP: readonly(topP),
    systemPromptOverride: readonly(systemPromptOverride),
    thinkingSupported,
    loadModels,
    sendMessage,
    loadSession,
    newSession,
    deleteMessage,
    exportToPDF,
    exportSession,
    setSelectedModel,
    setThinkingEnabled,
    setSessionTitle,
    setTemperature,
    setMaxTokens,
    setTopP,
    setSystemPromptOverride,
    stopStreaming,
    editMessage,
    regenerate,
  }
}