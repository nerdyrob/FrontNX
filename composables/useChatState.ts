import type { ChatMessage, ModelOption, ModelParams, SessionMeta } from '~/types'
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

// Per-session in-memory message buffer. Each session keeps its own reactive
// array so a stream that is still running in the background can keep writing
// to its originating session's buffer even after the user has switched to a
// different session. `null` is the key for an as-yet-unsaved ("new") session.
interface SessionBuffer {
  messages: Ref<ChatMessage[]>
  meta: {
    model?: string
    created?: string | null
    title?: string | null
    temperature?: number | null
    maxTokens?: number | null
    topP?: number | null
    systemPrompt?: string
  }
}

export function useChatState() {
  const config = useRuntimeConfig()
  const persistence = useSessionPersistence()

  // Keyed buffers. `activeKey` is the session currently shown in the UI.
  const buffers = new Map<string | null, SessionBuffer>()
  const activeKey = ref<string | null>(null)
  // Path of the session whose stream is currently in flight (or null).
  const streamingKey = ref<string | null>(null)

  const selectedModel = ref<string>('')
  const availableModels = ref<ModelOption[]>([])
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

  const currentSessionPath = ref<string | null>(null)

  function ensureBuffer(key: string | null): SessionBuffer {
    let entry = buffers.get(key)
    if (!entry) {
      entry = { messages: ref<ChatMessage[]>([]), meta: {} }
      buffers.set(key, entry)
    }
    return entry
  }

  // The messages shown in the UI: the active session's buffer.
  const messages = computed<ChatMessage[]>(() => {
    const entry = buffers.get(activeKey.value)
    return entry ? entry.messages.value : []
  })

  // Streaming indicator for the *currently displayed* session. A background
  // stream on another session must not make the visible session look busy.
  const isStreaming = computed(() => streamingKey.value !== null && streamingKey.value === activeKey.value)

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

  function snapshotMeta() {
    return {
      model: selectedModel.value,
      created: sessionCreatedAt.value,
      title: sessionTitle.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      topP: topP.value,
      systemPrompt: systemPromptOverride.value,
    }
  }

  function applyMeta(m: SessionBuffer['meta']) {
    if (m.model) selectedModel.value = m.model
    sessionCreatedAt.value = m.created ?? null
    sessionTitle.value = m.title ?? null
    temperature.value = m.temperature ?? null
    maxTokens.value = m.maxTokens ?? null
    topP.value = m.topP ?? null
    systemPromptOverride.value = m.systemPrompt ?? ''
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

  async function exportSession(format: ExportFormat) {
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
    if (activeController) {
      activeController.abort()
      activeController = null
    }
  }

  // Persist a single session's buffer to its path.
  async function saveBufferToPath(key: string) {
    const entry = ensureBuffer(key)
    const meta = buildMeta()
    const content = _sessionService.buildMarkdown(entry.messages.value, meta)
    await persistence.write(key, content)
    sessionRefreshTick.value++
    // Keep the cached meta in sync so switching back restores these values.
    entry.meta = snapshotMeta()
  }

  async function sendMessage(text: string, images?: string[]) {
    if (!selectedModel.value) return
    // Only one stream may run at a time; don't enqueue an orphaned user turn
    // behind a background stream on another session.
    if (streamingKey.value !== null) return

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
    ensureBuffer(activeKey.value).messages.value.push(userMsg)

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
    const key = currentSessionPath.value
    if (!key) return
    // Only one stream may run at a time (it is bound to a specific session).
    if (streamingKey.value !== null) return

    const entry = ensureBuffer(key)
    const msgs = entry.messages
    if (msgs.value.length === 0) return
    // The message immediately preceding the reply must be a user turn.
    if (msgs.value[msgs.value.length - 1].role !== 'user') return
    // Guard against overlapping streams (e.g. double-triggering regenerate).
    if (streamingKey.value !== null) return

    streamingKey.value = key

    const assistantId = uid()
    const now = new Date().toISOString()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: now,
    }
    msgs.value.push(assistantMsg)
    const startedAt = Date.now()

    function findAssistant(): ChatMessage | undefined {
      return msgs.value.find((m) => m.id === assistantId)
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
        msgs.value.slice(0, -1),
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
          includeImages: msgs.value.slice(0, -1).some((m: ChatMessage) => /data:image\/[a-zA-Z0-9/+]+;base64,/.test(m.content)),
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

      await saveBufferToPath(key)
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

      // Persist the errored/stopped reply so it survives a session switch.
      try {
        await saveBufferToPath(key)
      } catch (saveErr) {
        console.error('Failed to save errored session:', saveErr)
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      activeController = null
      stoppedManually = false
      streamingKey.value = null
    }
  }

  // Edits a previously sent user message in place, drops every message that
  // followed it, and regenerates the assistant reply from that point
  // (new-features #1).
  async function editMessage(index: number, newText: string) {
    if (streamingKey.value !== null) return
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
        await saveBufferToPath(currentSessionPath.value)
      } catch (err) {
        console.error('Failed to persist edited message:', err)
      }
    }

    await streamAssistantReply()
  }

  // Regenerates the assistant reply at `index` by removing it (and any later
  // messages) and re-running the streaming pipeline for the preceding user turn.
  async function regenerate(index: number) {
    if (streamingKey.value !== null) return
    if (!selectedModel.value) return
    if (index <= 0 || index >= messages.value.length) return
    const previous = messages.value[index - 1]
    if (previous.role !== 'user') return

    // Drop the assistant message (and anything after it) so a fresh reply
    // can be generated for the user turn at `index - 1`.
    messages.value.splice(index)

    if (currentSessionPath.value) {
      try {
        await saveBufferToPath(currentSessionPath.value)
      } catch (err) {
        console.error('Failed to persist before regenerate:', err)
      }
    }

    await streamAssistantReply()
  }

  async function loadSession(path: string) {
    let entry = buffers.get(path)

    // If the session is already in memory, reuse it so an in-flight (or
    // previously interrupted) stream keeps its live content instead of being
    // clobbered by a stale on-disk copy.
    if (!entry) {
      try {
        const res = await persistence.read(path)
        const { meta, messages: loaded } = _sessionService.parseMarkdown(res.content)
        entry = ensureBuffer(path)
        entry.messages.value = loaded
        entry.meta = {
          model: meta.model,
          created: meta.created,
          title: meta.title ?? null,
          temperature: meta.params?.temperature ?? null,
          maxTokens: meta.params?.maxTokens ?? null,
          topP: meta.params?.topP ?? null,
          systemPrompt: meta.params?.systemPrompt ?? '',
        }
      } catch (err) {
        console.error('Failed to load session:', err)
        return
      }
    }

    activeKey.value = path
    currentSessionPath.value = path
    applyMeta(entry.meta)
  }

  function resetStreamingState() {
    if (activeController) {
      activeController.abort()
      activeController = null
    }
    stoppedManually = false
    streamingKey.value = null
  }

  async function newSession() {
    const entry = ensureBuffer(null)
    entry.messages.value = []
    entry.meta = {}
    activeKey.value = null
    currentSessionPath.value = null
    sessionCreatedAt.value = null
    sessionTitle.value = null
    temperature.value = null
    maxTokens.value = null
    topP.value = null
    systemPromptOverride.value = ''
  }

  function deleteMessage(index: number) {
    const entry = buffers.get(activeKey.value)
    if (!entry) return
    entry.messages.value.splice(index, 1)
    if (currentSessionPath.value) {
      saveBufferToPath(currentSessionPath.value)
    }
  }

  async function saveSession() {
    const key = activeKey.value
    const entry = ensureBuffer(key)
    const meta = buildMeta()
    const content = _sessionService.buildMarkdown(entry.messages.value, meta)

    if (currentSessionPath.value) {
      await persistence.write(currentSessionPath.value, content)
      sessionRefreshTick.value++
      entry.meta = snapshotMeta()
    } else {
      const res = await persistence.create(meta)
      // Only store the path after the content rewrite succeeds
      const newKey = res.path
      buffers.set(newKey, entry)
      if (key !== null) buffers.delete(key)
      entry.meta = snapshotMeta()
      activeKey.value = newKey
      currentSessionPath.value = newKey
      await persistence.write(newKey, content)
      sessionRefreshTick.value++
    }
  }

  async function rewriteSessionFile() {
    if (!currentSessionPath.value) return
    await saveBufferToPath(currentSessionPath.value)
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
    resetStreamingState,
  }
}
