<template>
  <div class="flex h-dvh">
    <!-- Sidebar -->
    <AppSidebar
      :sessions="sessions"
      :current-session-id="currentSessionId"
      :open="sidebarOpen"
      @select="loadSession"
      @new="newSession"
    />

    <!-- Main chat area -->
    <div class="flex flex-col flex-1 min-w-0">
      <!-- Header -->
      <header class="flex items-center justify-between px-6 py-3 border-b border-default shrink-0">
        <div class="flex items-center gap-4">
          <UButton
            icon="i-lucide-panel-left-close"
            size="sm"
            color="neutral"
            variant="ghost"
            class="lg:hidden"
            @click="sidebarOpen = !sidebarOpen"
          />
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm">Chat</span>
            <span class="text-xs text-muted-foreground hidden sm:inline">with LM Studio</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <ModelSelector
            v-if="chat.availableModels.value.length > 0"
            v-model="chat.selectedModel.value"
            :models="chat.availableModels.value"
            @refresh="chat.loadModels()"
          />
          <UButton
            icon="i-lucide-plus"
            size="sm"
            color="neutral"
            variant="ghost"
            title="New chat"
            @click="newSession"
          />
        </div>
      </header>

      <!-- Messages -->
      <main ref="messagesContainer" class="flex-1 overflow-y-auto">
        <div class="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <!-- Empty state -->
          <div
            v-if="chat.messages.value.length === 0"
            class="flex flex-col items-center justify-center h-full min-h-[60vh]"
          >
            <div class="text-center space-y-4 max-w-md">
              <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <UIcon name="i-lucide-sparkles" class="w-8 h-8 text-primary" />
              </div>
              <div v-if="chat.loadError.value" class="space-y-2">
                <h2 class="text-lg font-semibold">Connection Error</h2>
                <p class="text-sm text-muted-foreground">{{ chat.loadError.value }}</p>
              </div>
              <div v-else-if="!chat.availableModels.value.length" class="space-y-2">
                <h2 class="text-lg font-semibold">Connecting to LM Studio</h2>
                <p class="text-sm text-muted-foreground">Fetching available models…</p>
                <UButton
                  loading
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
              </div>
              <div v-else class="space-y-2">
                <h2 class="text-lg font-semibold">Start a conversation</h2>
                <p class="text-sm text-muted-foreground">
                  Send a message to begin chatting with
                  <span class="font-medium text-foreground">{{ chat.selectedModel.value }}</span>
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
            :is-last="i === chat.messages.value.length - 1 && chat.isStreaming.value"
            @delete="chat.deleteMessage(i)"
          />
        </div>
      </main>

      <!-- Input area -->
      <ChatInput
        :streaming="chat.isStreaming.value"
        :disabled="!chat.selectedModel.value || chat.availableModels.value.length === 0"
        @send="handleSend"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const chat = useChatState()
const messagesContainer = ref<HTMLElement | null>(null)
const sidebarOpen = ref(true)

const sessions = ref<{ id: string; title: string }[]>([])
const currentSessionId = ref<string | null>(null)

function handleSend(text: string) {
  chat.sendMessage(text)
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

onMounted(() => {
  chat.loadModels()
  loadSessions()
})

watch(
  () => chat.messages.value.length,
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
</script>
