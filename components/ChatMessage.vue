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
          <UButton
            v-if="message.content"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="-ml-1 text-dimmed hover:text-highlighted active:text-highlighted"
            @click="copyMessage"
          />
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
          <span v-if="showProgressDots" class="inline-flex items-end gap-1">
            <span class="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style="animation-delay: 0ms; animation-duration: 900ms" />
            <span class="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style="animation-delay: 150ms; animation-duration: 900ms" />
            <span class="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style="animation-delay: 300ms; animation-duration: 900ms" />
          </span>
          <span v-else-if="timestamp" class="text-[11px] text-dimmed">{{ timestamp }}</span>
          <UButton
            v-if="!showProgressDots && message.content"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="-ml-1 text-dimmed hover:text-highlighted active:text-highlighted"
            @click="copyMessage"
          />
        </div>
        <div class="pl-9 text-sm leading-relaxed prose-message">
          <MarkdownRenderer v-if="message.content" :content="message.content" />
          <span v-else-if="showProgressDots" class="text-muted italic">Thinking…</span>
        </div>
        <div v-if="message.role === 'assistant' && message.metrics && !showProgressDots" class="pl-9 mt-2 text-[11px] text-dimmed flex flex-wrap gap-x-3 gap-y-1">
          <span>{{ processingTimeLabel }}</span>
          <span>Tokens used: {{ tokensUsedLabel }}</span>
          <span>Tokens/sec: {{ tokensPerSecondLabel }}</span>
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
      class="absolute -top-0.5 -right-1 text-dimmed hover:text-highlighted active:text-highlighted transition-colors"
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
  if (!props.message.createdAt) return ''
  const d = new Date(props.message.createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const showProgressDots = computed(() => {
  return Boolean(props.isLast && props.message.role === 'assistant' && !props.message.createdAt)
})

const copied = ref(false)
let copiedResetTimer: ReturnType<typeof setTimeout> | null = null

async function copyMessage() {
  if (!props.message.content) return

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.message.content)
    } else {
      const el = document.createElement('textarea')
      el.value = props.message.content
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }

    copied.value = true
    if (copiedResetTimer) clearTimeout(copiedResetTimer)
    copiedResetTimer = setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    copied.value = false
  }
}

onBeforeUnmount(() => {
  if (copiedResetTimer) clearTimeout(copiedResetTimer)
})

const processingTimeLabel = computed(() => {
  const ms = props.message.metrics?.processingTimeMs ?? 0
  if (!ms) return 'Processing time: -'
  if (ms < 1000) return `Processing time: ${ms} ms`
  return `Processing time: ${(ms / 1000).toFixed(2)} s`
})

const tokensUsedLabel = computed(() => {
  const tokens = props.message.metrics?.tokensUsed ?? 0
  return tokens > 0 ? String(tokens) : '-'
})

const tokensPerSecondLabel = computed(() => {
  const tokensPerSecond = props.message.metrics?.tokensPerSecond ?? 0
  return tokensPerSecond > 0 ? tokensPerSecond.toFixed(2) : '-'
})
</script>
