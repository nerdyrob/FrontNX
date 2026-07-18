<template>
  <aside
    :class="[
      'flex flex-col border-r border-default bg-primary/10 shrink-0 transition-all duration-200',
      open ? 'w-64' : 'w-8',
    ]"
  >
    <template v-if="open">
      <div class="flex items-center justify-between px-3 h-[57px] shrink-0">
        <span class="text-sm font-semibold text-dimmed">Sessions</span>
        <div class="flex items-center gap-3">
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
            icon="i-lucide-panel-left-close"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="text-dimmed"
            title="Collapse sidebar"
            @click="$emit('toggle')"
          />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto px-2 pb-2 -mt-2 space-y-0.5">
        <div
          v-for="session in sessions"
          :key="session.id"
          :class="[
            'group relative w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer',
            session.id === currentSessionId
              ? 'bg-accented text-highlighted shadow-sm'
              : 'text-muted hover:bg-muted hover:text-highlighted',
          ]"
          @click="$emit('select', session.id)"
        >
          <div class="truncate font-medium leading-tight">{{ session.preview || session.title }}</div>
          <div class="mt-1 flex items-center gap-2 text-[10px] text-dimmed">
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
const props = withDefaults(defineProps<{
  sessions: { id: string; title: string; preview: string; timestamp: string; totalTokens: number; totalProcessingTimeMs: number }[]
  currentSessionId: string | null
  open?: boolean
}>(), { open: true })

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

defineEmits<{
  select: [id: string]
  delete: [id: string]
  new: []
  toggle: []
}>()
</script>
