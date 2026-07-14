<template>
  <div class="group relative">
    <!-- User message -->
    <div v-if="message.role === 'user'" class="flex gap-3">
      <div class="flex-1 max-w-none">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UIcon name="i-lucide-user" class="w-3.5 h-3.5 text-primary" />
          </div>
          <span class="text-xs font-medium text-foreground">You</span>
          <span class="text-[10px] text-muted-foreground">{{ time }}</span>
        </div>
        <MarkdownRenderer :content="message.content" />
      </div>
    </div>

    <!-- Assistant message -->
    <div v-else class="flex gap-3">
      <div class="flex-1 max-w-none">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
            <UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span class="text-xs font-medium text-foreground">Assistant</span>
          <span v-if="message.model" class="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {{ message.model }}
          </span>
          <span class="text-[10px] text-muted-foreground">{{ time }}</span>
          <span v-if="isLast && isStreaming" class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        </div>
        <div class="text-sm leading-relaxed prose-message">
          <MarkdownRenderer v-if="message.content" :content="message.content" />
          <span v-else-if="isStreaming" class="text-muted-foreground italic">Thinking…</span>
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
      class="absolute -top-1 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
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

const time = computed(() => {
  const d = new Date(props.message.createdAt)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
})
</script>
