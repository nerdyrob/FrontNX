<template>
  <div class="group relative animate-in">
    <!-- User message -->
    <div v-if="message.role === 'user'" class="flex gap-3">
      <div class="flex-1 max-w-none">
        <div class="flex items-center gap-2.5 mb-2">
          <div class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <UIcon name="i-lucide-user" class="w-3.5 h-3.5 text-white" />
          </div>
          <span class="text-xs font-medium text-highlighted">You</span>
          <span v-if="message.model" class="text-[11px] text-dimmed bg-muted px-1.5 py-0.5 rounded">{{ message.model }}</span>
          <span class="text-[11px] text-dimmed">{{ timestamp }}</span>
          <UButton
            v-if="!hideActions && message.content"
            icon="i-lucide-trash-2"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="text-dimmed hover:text-highlighted active:text-highlighted"
            @click="$emit('delete', index)"
          />
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
          <div class="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <UIcon name="i-lucide-bot-message-square" class="w-3.5 h-3.5 text-primary" />
          </div>
          <span class="text-xs font-medium text-highlighted">Assistant</span>
          <span v-if="showProgressDots" class="inline-flex items-end gap-1">
            <span class="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style="animation-delay: 0ms; animation-duration: 900ms" />
            <span class="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style="animation-delay: 150ms; animation-duration: 900ms" />
            <span class="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style="animation-delay: 300ms; animation-duration: 900ms" />
          </span>
          <span v-else-if="timestamp" class="text-[11px] text-dimmed">{{ timestamp }}</span>
          <UButton
            v-if="!hideActions && !showProgressDots && message.content"
            icon="i-lucide-trash-2"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="text-dimmed hover:text-highlighted active:text-highlighted"
            @click="$emit('delete', index)"
          />
          <UButton
            v-if="!showProgressDots && copyableContent"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="-ml-1 text-dimmed hover:text-highlighted active:text-highlighted"
            @click="copyMessage"
          />
        </div>
        <details v-if="thinkingContent" class="pl-9 mb-2 rounded-lg transition-colors [&[open]]:border [&[open]]:border-default [&[open]]:bg-elevated/60 [&[open]]:p-3" :open="!!streaming">
          <summary class="text-[11px] text-dimmed cursor-pointer select-none hover:text-highlighted">Thought process</summary>
          <div class="mt-2 text-sm leading-relaxed prose-message overflow-x-auto max-w-full">
            <MarkdownRenderer :content="thinkingContent" />
          </div>
        </details>
        <div class="pl-9 text-sm leading-relaxed prose-message">
          <MarkdownRenderer v-if="displayContent" :content="displayContent" />
          <span v-else-if="showProgressDots" class="text-muted italic">Thinking…</span>
        </div>
        <div v-if="showIncompleteNotice" class="pl-9 mt-2 text-[11px] text-amber-600">
          Response may be incomplete
        </div>
        <div v-if="message.role === 'assistant' && message.metrics && !showProgressDots" class="pl-9 mt-2 text-[11px] text-dimmed flex flex-wrap gap-x-3 gap-y-1">
          <span>{{ processingTimeLabel }}</span>
          <span>Tokens used: {{ tokensUsedLabel }}</span>
          <span>Tokens/sec: {{ tokensPerSecondLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/types'

const props = defineProps<{
  message: ChatMessage
  index: number
  isLast?: boolean
  hideActions?: boolean
  streaming?: boolean
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

const showIncompleteNotice = computed(() => {
  return Boolean(
    props.message.role === 'assistant'
    && !showProgressDots.value
    && props.message.responseStatus === 'incomplete',
  )
})

const thinkingContent = computed(() => {
  if (props.message.role !== 'assistant') return ''
  if (props.message.thinking) return props.message.thinking
  const match = props.message.content.match(/<thinking>\s*([\s\S]*?)\s*<\/thinking>/i)
  return match?.[1]?.trim() ?? ''
})

const displayContent = computed(() => {
  if (props.message.role !== 'assistant') return props.message.content
  return props.message.content
    .replace(/<thinking>\s*[\s\S]*?\s*<\/thinking>\s*/i, '')
    .trim()
})

const copyableContent = computed(() => {
  return props.message.role === 'assistant' ? displayContent.value : props.message.content
})

const copied = ref(false)
let copiedResetTimer: ReturnType<typeof setTimeout> | null = null

async function copyMessage() {
  if (!copyableContent.value) return

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyableContent.value)
    } else {
      const el = document.createElement('textarea')
      el.value = copyableContent.value
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
