<template>
  <aside
    :class="[
      'flex flex-col border-r border-default bg-primary/10 shrink-0 transition-all duration-200',
      open ? 'w-64' : 'w-8',
    ]"
  >
    <template v-if="open">
      <!-- Header -->
      <div class="flex items-center justify-between pl-6 pr-3 h-[57px] shrink-0">
        <span class="text-sm font-semibold text-dimmed">
          {{ deleteMode ? `${selectedIds.size} selected` : 'Sessions' }}
        </span>
        <div class="flex items-center gap-3">
          <template v-if="deleteMode">
            <UButton
              icon="i-lucide-trash-2"
              size="2xs"
              color="error"
              variant="ghost"
              class="text-error"
              title="Delete selected"
              :disabled="selectedIds.size === 0"
              @click="confirmDeleteSelected"
            />
            <UButton
              icon="i-lucide-x"
              size="2xs"
              color="neutral"
              variant="ghost"
              class="text-dimmed"
              title="Cancel"
              @click="exitDeleteMode"
            />
          </template>
          <template v-else>
            <UButton
              icon="i-lucide-message-square-plus"
              size="2xs"
              color="neutral"
              variant="ghost"
              class="text-dimmed"
              title="New session"
              @click.stop="$emit('new')"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="2xs"
              color="neutral"
              variant="ghost"
              class="text-dimmed"
              title="Delete sessions"
              @click="enterDeleteMode"
            />
            <UButton
              icon="i-lucide-panel-left-close"
              size="2xs"
              color="neutral"
              variant="ghost"
              class="text-dimmed"
              title="Collapse sidebar"
              @click="$emit('toggle')"
            />
          </template>
        </div>
      </div>

      <!-- Search -->
      <div v-if="!deleteMode" class="px-3 pb-2 shrink-0">
        <input
          :value="searchQuery"
          type="search"
          placeholder="Search conversations…"
          class="w-full bg-elevated border border-default rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          @input="$emit('search', ($event.target as HTMLInputElement).value)"
        >
      </div>

      <!-- Session list -->
      <div class="flex-1 overflow-y-auto px-2 pb-2 mt-2 space-y-0.5">
        <div
          v-for="session in sessions"
          :key="session.id"
          :class="[
            'group relative w-full text-left pl-4 pr-3 py-2.5 rounded-lg text-sm transition-all',
            deleteMode ? 'cursor-pointer select-none' : 'cursor-pointer',
            !deleteMode && session.id === currentSessionId
              ? 'bg-accented text-highlighted shadow-sm'
              : selectedIds.has(session.id)
                ? 'bg-error/10 text-error'
                : !deleteMode
                  ? 'text-muted hover:bg-muted hover:text-highlighted'
                  : 'text-muted hover:bg-muted hover:text-highlighted',
          ]"
          @click="onSessionClick(session)"
        >
          <!-- Rename mode -->
          <div v-if="renamingId === session.id" class="flex items-center gap-1" @click.stop>
            <input
              ref="renameInputRef"
              v-model="renameText"
              type="text"
              class="flex-1 min-w-0 bg-elevated border border-default rounded px-1.5 py-0.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              @keydown.enter.prevent="submitRename(session)"
              @keydown.esc.prevent="cancelRename"
              @blur="submitRename(session)"
            >
          </div>

          <!-- Normal view -->
          <div v-else class="flex items-center gap-1.5">
            <!-- Delete-mode checkbox -->
            <div
              v-if="deleteMode"
              class="w-4 h-4 rounded border border-default flex items-center justify-center shrink-0"
              :class="selectedIds.has(session.id) ? 'bg-error border-error' : 'bg-elevated'"
            >
              <UIcon
                v-if="selectedIds.has(session.id)"
                name="i-lucide-check"
                class="w-3 h-3 text-white"
              />
            </div>

            <div class="truncate font-medium leading-tight flex-1 min-w-0">{{ session.title || session.preview || session.id }}</div>

            <!-- Rename button (only in normal mode) -->
            <UButton
              v-if="!deleteMode"
              icon="i-lucide-pencil"
              size="2xs"
              color="neutral"
              variant="ghost"
              class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              title="Rename conversation"
              @click.stop="startRename(session)"
            />
          </div>

          <!-- Metadata row -->
          <div v-if="!deleteMode" class="mt-1 flex items-center gap-2 text-[10px] text-dimmed">
            <div class="truncate">{{ formatTimestamp(session.timestamp) }}</div>
            <div class="ml-auto whitespace-nowrap text-right">{{ formatTotals(session.totalProcessingTimeMs, session.totalTokens) }}</div>
            <UButton
              icon="i-lucide-trash-2"
              size="2xs"
              color="neutral"
              variant="ghost"
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="$emit('delete', session.id)"
            />
          </div>
        </div>

        <div v-if="sessions.length === 0" class="px-3 py-8 text-center">
          <p class="text-xs text-muted">No sessions yet</p>
        </div>
      </div>
    </template>

    <!-- Collapsed state -->
    <template v-else>
      <div class="flex flex-col items-center pt-2">
        <UButton
          icon="i-lucide-panel-left-open"
          size="xs"
          color="neutral"
          variant="ghost"
          class="text-dimmed"
          title="Expand sidebar"
          @click="$emit('toggle')"
        />
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import type { SessionListItem } from '~/repositories/session.repository'

const props = withDefaults(defineProps<{
  sessions: SessionListItem[]
  currentSessionId: string | null
  open?: boolean
  searchQuery?: string
}>(), { open: true, searchQuery: '' })

const renamingId = ref<string | null>(null)
const renameText = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

// --- Delete mode state ---
const deleteMode = ref(false)
const selectedIds = ref(new Set<string>())

function enterDeleteMode() {
  deleteMode.value = true
  selectedIds.value = new Set()
}

function exitDeleteMode() {
  deleteMode.value = false
  selectedIds.value = new Set()
}

function onSessionClick(session: SessionListItem) {
  if (deleteMode.value) {
    toggleSelect(session.id)
  } else {
    emit('select', session.id)
  }
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function confirmDeleteSelected() {
  if (selectedIds.value.size === 0) return
  const count = selectedIds.value.size
  if (!window.confirm(`Delete ${count} session${count > 1 ? 's' : ''}? This cannot be undone.`)) return
  emit('deleteBatch', [...selectedIds.value])
  exitDeleteMode()
}

// --- Rename ---
function startRename(session: SessionListItem) {
  renamingId.value = session.id
  renameText.value = session.title || session.preview || session.id
  nextTick(() => renameInputRef.value?.focus?.())
}

function submitRename(session: SessionListItem) {
  if (renamingId.value !== session.id) return
  const title = renameText.value.trim()
  renamingId.value = null
  renameText.value = ''
  if (title && title !== (session.title || session.preview || session.id)) {
    emit('rename', session.id, title)
  }
}

function cancelRename() {
  renamingId.value = null
  renameText.value = ''
}

// --- Formatting ---
function formatTotals(totalProcessingTimeMs: number, totalTokens: number): string {
  const seconds = totalProcessingTimeMs / 1000
  if (seconds >= 60) return `${totalTokens} tokens, ${(seconds / 60).toFixed(1)}m`
  return `${totalTokens} tokens, ${seconds.toFixed(1)}s`
}

function formatTimestamp(value: string): string {
  if (/^\d{8}-\d{6}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
  deleteBatch: [ids: string[]]
  new: []
  toggle: []
  search: [query: string]
  rename: [id: string, title: string]
}>()
</script>
