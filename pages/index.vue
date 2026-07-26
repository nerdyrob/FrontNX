<template>
  <div class="flex flex-col h-dvh">
    <!-- Full-width header -->
    <header class="no-print flex items-center justify-between px-6 h-[57px] border-b border-default shrink-0 bg-background/80 backdrop-blur-sm">
      <div class="flex items-center gap-1">
        <span class="font-bold text-xl text-primary">Frontnx</span>
        <UIcon name="i-lucide-bot-message-square" class="w-5 h-5 text-primary" />
      </div>

      <div class="flex items-center gap-3">
        <UButton
          v-if="chat.currentSessionPath.value && chat.availableModels.value.length > 0"
          icon="i-lucide-file-text"
          size="sm"
          color="neutral"
          variant="ghost"
          title="Export to PDF"
          @click="chat.exportToPDF"
        />
        <ModelSelector
          v-if="chat.availableModels.value.length > 0"
          :model-value="chat.selectedModel.value"
          :models="chat.availableModels.value"
          @update:model-value="chat.setSelectedModel"
        />
      </div>
    </header>

    <!-- Content area: sidebar + chat -->
    <div class="flex flex-1 min-h-0">
      <!-- Sidebar -->
      <AppSidebar class="no-print"
        :sessions="sessions"
        :current-session-id="currentSessionId"
        :open="sidebarOpen"
        @select="loadSession"
        @new="newSession"
        @delete="deleteSession"
        @toggle="sidebarOpen = !sidebarOpen"
      />

      <!-- Main chat area -->
      <div class="flex flex-col flex-1 min-w-0 bg-gradient-to-b from-transparent to-elevated/40">
        <!-- Messages -->
        <main ref="messagesContainer" class="flex-1 overflow-y-auto">
          <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
            <!-- Empty state -->
            <div
              v-if="chat.messages.value.length === 0"
              class="flex flex-col items-center justify-center h-full min-h-[60vh]"
            >
              <div class="text-center space-y-5 max-w-md">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center">
                  <UIcon name="i-lucide-bot-message-square" class="w-8 h-8 text-primary" />
                </div>
                <div v-if="chat.loadError.value" class="space-y-2">
                  <h2 class="text-lg font-semibold">Connection Error</h2>
                  <p class="text-sm text-muted">{{ chat.loadError.value }}</p>
                </div>
                <div v-else-if="!chat.availableModels.value.length" class="space-y-2">
                  <h2 class="text-lg font-semibold">Connecting to {{ serverName }}</h2>
                  <p class="text-sm text-muted">Fetching available models…</p>
                  <UButton
                    loading
                    color="neutral"
                    variant="ghost"
                    size="sm"
                  />
                </div>
                <div v-else class="space-y-2">
                  <h2 class="text-lg font-semibold">Start a conversation</h2>
                  <p class="text-sm text-muted">
                    Send a message to begin chatting with
                    <span class="font-medium text-highlighted">{{ chat.selectedModel.value }}</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Message list -->
            <ChatMessage
              v-for="(msg, i) in chat.messages.value"
              :key="msg.id"
              :message="msg"
              :index="i"
              :is-last="i === chat.messages.value.length - 1"
              :streaming="chat.isStreaming.value && i === chat.messages.value.length - 1"
              @delete="confirmDeleteMessage(i)"
            />
          </div>
        </main>

        <!-- Input area -->
        <ChatInput class="no-print"
          :streaming="chat.isStreaming.value"
          :disabled="!chat.selectedModel.value || chat.availableModels.value.length === 0"
          :thinking="chat.thinkingEnabled.value"
          :thinking-supported="chat.thinkingSupported.value"
          @send="handleSend"
          @update:thinking="chat.thinkingEnabled.value = $event"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SessionListItem } from '~/repositories/session.repository'

const config = useRuntimeConfig()
const serverName = config.public.llmServerName
const chat = useChatState()
const messagesContainer = ref<HTMLElement | null>(null)
const sidebarOpen = ref(true)

const sessions = ref<SessionListItem[]>([])
const currentSessionId = ref<string | null>(null)

function handleSend(text: string) {
  chat.sendMessage(text)
}

function confirmDeleteMessage(index: number) {
  if (typeof window !== 'undefined' && !window.confirm('Delete this message?')) return
  chat.deleteMessage(index)
}

async function loadSession(id: string) {
  currentSessionId.value = id
  const session = sessions.value.find((s) => s.id === id)
  if (session) await chat.loadSession(session.path)
}

function newSession() {
  chat.newSession()
  currentSessionId.value = null
}

async function loadSessions() {
  sessions.value = await $fetch('/api/session/list')
}

async function deleteSession(id: string) {
  if (typeof window !== 'undefined' && !window.confirm('Delete this session? This cannot be undone.')) return
  const session = sessions.value.find((s) => s.id === id)
  if (!session) return
  await $fetch('/api/session/delete', {
    method: 'DELETE',
    body: { path: session.path },
  })
  if (currentSessionId.value === id) {
    chat.newSession()
    currentSessionId.value = null
  }
  await loadSessions()
}

onMounted(() => {
  chat.loadModels()
  loadSessions()
})

watch(
  [
    () => chat.messages.value.length,
    () => chat.messages.value[chat.messages.value.length - 1]?.content,
  ],
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  },
)

watch(() => chat.currentSessionPath.value, (path) => {
  if (path) loadSessions()
})

watch(() => chat.sessionRefreshTick.value, () => {
  loadSessions()
})
</script>
