<template>
  <aside
    :class="[
      'flex flex-col border-r border-default bg-primary/10 shrink-0 transition-all duration-200',
      'lg:relative lg:translate-x-0',
      open ? 'w-64' : 'w-0 lg:w-0 overflow-hidden',
    ]"
    :style="open ? '' : 'width: 0'"
  >
    <div class="flex items-center justify-between px-4 h-[57px] border-b border-default shrink-0">
      <span class="text-sm font-semibold text-dimmed">Sessions</span>
      <UButton
        icon="i-lucide-plus"
        size="2xs"
        color="neutral"
        variant="ghost"
        @click="$emit('new')"
      />
    </div>
    <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
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
}>()
</script>
