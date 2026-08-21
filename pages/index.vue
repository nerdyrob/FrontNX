<template>
  <div class="flex flex-col h-dvh">
    <!-- Full-width header -->
    <header class="no-print flex items-center justify-between px-6 h-[57px] border-b border-default shrink-0 bg-background/80 backdrop-blur-sm">
      <div class="flex items-center gap-1">
        <span class="font-bold text-xl text-primary">Frontnx</span>
        <UIcon name="i-lucide-bot-message-square" class="w-5 h-5 text-primary" />
      </div>

      <div class="flex items-center gap-3">
        <div v-if="chat.availableModels.value.length > 0">
          <span ref="settingsButtonRef" class="inline-flex">
            <UButton
              icon="i-lucide-settings-2"
              size="sm"
              color="neutral"
              variant="ghost"
              title="Model parameters"
              @click="toggleSettings"
            />
          </span>
          <Teleport to="body">
            <div v-if="settingsOpen" class="fixed inset-0 z-[60]" @click="closeSettings" />
            <div
              v-if="settingsOpen"
              class="fixed z-[70] rounded-lg border border-default bg-elevated shadow-lg"
              :style="{ top: `${settingsPos.top}px`, left: `${settingsPos.left}px` }"
            >
              <ChatSettings
                :temperature="chat.temperature.value"
                :max-tokens="chat.maxTokens.value"
                :top-p="chat.topP.value"
                :system-prompt="chat.systemPromptOverride.value"
                @update:temperature="chat.setTemperature"
                @update:max-tokens="chat.setMaxTokens"
                @update:top-p="chat.setTopP"
                @update:system-prompt="chat.setSystemPromptOverride"
              />
            </div>
          </Teleport>
        </div>
        <div v-if="chat.currentSessionPath.value && chat.availableModels.value.length > 0">
          <span ref="exportButtonRef" class="inline-flex">
            <UButton
              icon="i-lucide-download"
              size="sm"
              color="neutral"
              variant="ghost"
              title="Export conversation"
              @click="toggleExportMenu"
            />
          </span>
          <Teleport to="body">
            <div v-if="exportMenuOpen" class="fixed inset-0 z-[60]" @click="closeExportMenu" />
            <div
              v-if="exportMenuOpen"
              class="fixed z-[70] w-44 rounded-lg border border-default bg-elevated p-1 shadow-lg"
              :style="{ top: `${exportPos.top}px`, left: `${exportPos.left}px` }"
            >
              <button
                class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-left hover:bg-muted"
                @click="exportAs('markdown')"
              >
                <UIcon name="i-lucide-file-text" class="w-4 h-4" /> Markdown
              </button>
              <button
                class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted"
                @click="exportAsPdf"
              >
                <UIcon name="i-lucide-printer" class="w-4 h-4" /> PDF (print)
              </button>
            </div>
          </Teleport>
        </div>
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
        :search-query="searchQuery"
        @select="loadSession"
        @new="newSession"
        @delete="deleteSession"
        @toggle="sidebarOpen = !sidebarOpen"
        @search="onSearch"
        @rename="renameSession"
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
              @edit="handleEdit"
              @regenerate="handleRegenerate"
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
          @stop="chat.stopStreaming"
          @update:thinking="chat.setThinkingEnabled($event)"
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
const exportMenuOpen = ref(false)
const settingsOpen = ref(false)
const settingsButtonRef = ref<HTMLElement | null>(null)
const exportButtonRef = ref<HTMLElement | null>(null)
const settingsPos = ref<{ top: number; left: number }>({ top: 0, left: 0 })
const exportPos = ref<{ top: number; left: number }>({ top: 0, left: 0 })

// Position a popover below its trigger, right-aligned to the button. Computed
// from the live bounding rect so the menu escapes the header's stacking
// context (the header uses backdrop-blur, which otherwise traps fixed/absolute
// descendants and lets chat content paint over the panel).
function placeBelow(button: HTMLElement | null, width: number) {
  if (!button) return { top: 0, left: 0 }
  const rect = button.getBoundingClientRect()
  return {
    top: Math.round(rect.bottom + 8),
    left: Math.max(8, Math.round(rect.right - width)),
  }
}

const sessions = ref<SessionListItem[]>([])
const currentSessionId = ref<string | null>(null)
const searchQuery = ref('')

function handleSend(payload: { text: string; images: string[] }) {
  chat.sendMessage(payload.text, payload.images)
  scrollToBottom()
}

function exportAs(format: 'markdown' | 'json' | 'text') {
  chat.exportSession(format)
  exportMenuOpen.value = false
}

function exportAsPdf() {
  chat.exportToPDF()
  exportMenuOpen.value = false
}

function toggleExportMenu() {
  exportMenuOpen.value = !exportMenuOpen.value
  if (exportMenuOpen.value) exportPos.value = placeBelow(exportButtonRef.value, 176)
}

function closeExportMenu() {
  exportMenuOpen.value = false
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value
  if (settingsOpen.value) settingsPos.value = placeBelow(settingsButtonRef.value, 288)
}

function closeSettings() {
  settingsOpen.value = false
}

function handleEdit(index: number, newText: string) {
  chat.editMessage(index, newText)
  scrollToBottom()
}

function handleRegenerate(index: number) {
  chat.regenerate(index)
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
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
  const q = searchQuery.value.trim()
  if (q) {
    sessions.value = await $fetch('/api/session/search', { params: { query: q } })
  } else {
    sessions.value = await $fetch('/api/session/list')
  }
}

function onSearch(query: string) {
  searchQuery.value = query
  loadSessions()
}

async function renameSession(id: string, title: string) {
  const session = sessions.value.find((s) => s.id === id)
  if (!session) return
  await $fetch('/api/session/rename', {
    method: 'POST',
    body: { path: session.path, title },
  })
  if (id === currentSessionId.value) {
    chat.setSessionTitle(title)
  }
  await loadSessions()
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
    () => chat.isStreaming.value,
  ],
  () => {
    scrollToBottom()
  },
)

watch(() => chat.currentSessionPath.value, (path) => {
  if (path) loadSessions()
})

watch(() => chat.sessionRefreshTick.value, () => {
  loadSessions()
})
</script>
