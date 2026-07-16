<template>
  <div class="group relative animate-in">
    <!-- User message -->
    <div v-if="message.role === 'user'" class="flex gap-3">
      <div class="flex-1 max-w-none">
        <div class="flex items-center gap-2.5 mb-2">
          <div class="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <UIcon name="i-lucide-user" class="w-3.5 h-3.5 text-primary" />
          </div>
          <span class="text-xs font-medium text-highlighted">You</span>
          <span v-if="message.model" class="text-[11px] text-dimmed bg-muted px-1.5 py-0.5 rounded">{{ message.model }}</span>
          <span class="text-[11px] text-dimmed">{{ timestamp }}</span>
        </div>
        <div class="pl-9">
          <MarkdownRenderer :content="message.content" />
        </div>
      </div>
    </div>

    <!-- Assistant message -->
    <div v-else class="flex gap-3">
      <div class="flex-1 max-w-none">
        <div class="flex items-center gap-2.5 mb-2">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
            <UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5 text-white" />
          </div>
          <span class="text-xs font-medium text-highlighted">Assistant</span>
          <span class="text-[11px] text-dimmed">{{ timestamp }}</span>
          <span v-if="isLast && isStreaming" class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        </div>
        <div class="pl-9 text-sm leading-relaxed prose-message">
          <MarkdownRenderer v-if="message.content" :content="message.content" />
          <span v-else-if="isStreaming" class="text-muted italic">Thinking…</span>
        </div>
      </div>
    </div>

    <!-- Delete button -->
    <UButton
      v-if="!hideActions && message.content"
      size="2xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-trash-2"
      class="absolute -top-0.5 -right-1 opacity-0 group-hover:opacity-100 transition-opacity"
      @click="$emit('delete', index)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/types'

const props = defineProps<{
  message: ChatMessage
  index: number
  isLast?: boolean
  hideActions?: boolean
}>()

defineEmits<{
  delete: [index: number]
}>()

const timestamp = computed(() => {
  const d = new Date(props.message.createdAt)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})
</script>
