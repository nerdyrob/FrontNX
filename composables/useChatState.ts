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
      createdAt: new Date().toISOString(),
    }
    messages.value.push(userMsg)
    isStreaming.value = true

    const assistantMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      model: selectedModel.value,
      createdAt: new Date().toISOString(),
    }
    messages.value.push(assistantMsg)

    try {
      const fullContent = await lmStudio.sendChat(
        messages.value.slice(0, -1),
        selectedModel.value,
        (delta) => {
          const last = messages.value[messages.value.length - 1]
          if (last.role === 'assistant') {
            last.content += delta
          }
        },
      )

      const last = messages.value[messages.value.length - 1]
      if (last.role === 'assistant') {
        last.content = fullContent
      }

      await saveSession()
    } catch (err: any) {
      const last = messages.value[messages.value.length - 1]
      if (last.role === 'assistant') {
        last.content = `Error: ${err.message ?? 'Request failed'}`
      }
    } finally {
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
  }

  return {
    messages,
    selectedModel,
    availableModels,
    isStreaming,
    currentSessionPath,
    loadError,
    loadModels,
    sendMessage,
    loadSession,
    newSession,
    deleteMessage,
    deleteRange,
  }
}
