<template>
  <aside
    :class="[
      'flex flex-col border-r border-default bg-elevated shrink-0 transition-all duration-200',
      'lg:relative lg:translate-x-0',
      open ? 'w-64' : 'w-0 lg:w-0 overflow-hidden',
    ]"
    :style="open ? '' : 'width: 0'"
  >
    <div class="flex items-center justify-between px-4 h-[57px] border-b border-default shrink-0">
      <span class="text-sm font-semibold">Sessions</span>
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
            ? 'bg-accented text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        ]"
        @click="$emit('select', session.id)"
      >
        <div class="truncate font-medium leading-tight">{{ session.preview || session.title }}</div>
        <div class="text-[10px] text-dimmed mt-1">{{ session.timestamp }}</div>
        <UButton
          icon="i-lucide-trash-2"
          size="2xs"
          color="neutral"
          variant="ghost"
          class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="$emit('delete', session.id)"
        />
      </div>
      <div v-if="sessions.length === 0" class="px-3 py-8 text-center">
        <p class="text-xs text-muted-foreground">No sessions yet</p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  sessions: { id: string; title: string; preview: string; timestamp: string }[]
  currentSessionId: string | null
  open?: boolean
}>(), { open: true })

defineEmits<{
  select: [id: string]
  delete: [id: string]
  new: []
}>()
</script>
