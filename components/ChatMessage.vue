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
            v-if="!hideActions && message.content && !isEditing"
            icon="i-lucide-pencil"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="text-dimmed hover:text-highlighted active:text-highlighted"
            title="Edit message"
            @click="startEdit"
          />
          <UButton
            v-if="!hideActions && message.content && !isEditing"
            icon="i-lucide-trash-2"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="text-dimmed hover:text-highlighted active:text-highlighted"
            title="Delete message"
            @click="$emit('delete', index)"
          />
          <UButton
            v-if="message.content && !isEditing"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="-ml-1 text-dimmed hover:text-highlighted active:text-highlighted"
            :title="copied ? 'Copied' : 'Copy'"
            @click="copyMessage(copyableContent)"
          />
        </div>
        <div v-if="isEditing" class="pl-9 space-y-2">
          <textarea
            ref="editTextareaRef"
            v-model="editText"
            rows="3"
            class="w-full bg-elevated border border-default rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            @keydown.esc.prevent="cancelEdit"
            @keydown.enter.exact.prevent="saveEdit"
          />
          <div class="flex items-center gap-2">
            <UButton size="2xs" color="primary" variant="solid" @click="saveEdit">Save & regenerate</UButton>
            <UButton size="2xs" color="neutral" variant="ghost" @click="cancelEdit">Cancel</UButton>
          </div>
        </div>
        <div v-else class="pl-9">
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
            v-if="!hideActions && !showProgressDots && message.content && !streaming"
            icon="i-lucide-refresh-cw"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="text-dimmed hover:text-highlighted active:text-highlighted"
            title="Regenerate response"
            @click="$emit('regenerate', index)"
          />
          <UButton
            v-if="!hideActions && !showProgressDots && message.content"
            icon="i-lucide-trash-2"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="text-dimmed hover:text-highlighted active:text-highlighted"
            title="Delete message"
            @click="$emit('delete', index)"
          />
          <UButton
            v-if="!showProgressDots && copyableContent"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            size="2xs"
            color="neutral"
            variant="ghost"
            class="-ml-1 text-dimmed hover:text-highlighted active:text-highlighted"
            :title="copied ? 'Copied' : 'Copy'"
            @click="copyMessage(copyableContent)"
          />
        </div>
        <details v-if="thinkingContent" :open="detailsOpen" class="ml-9 mb-2 rounded-lg transition-colors max-w-[750px] [&[open]]:border [&[open]]:border-default [&[open]]:bg-elevated/60">
          <summary class="text-[11px] text-dimmed cursor-pointer select-none hover:text-highlighted mt-3 mx-3" @click.prevent="detailsOpen = !detailsOpen">Thought process</summary>
          <div class="mx-3 mb-3 text-sm leading-relaxed prose-message break-words max-w-full">
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

const emit = defineEmits<{
  delete: [index: number]
  edit: [index: number, newText: string]
  regenerate: [index: number]
}>()

const isEditing = ref(false)
const editText = ref('')
const editTextareaRef = ref<HTMLTextAreaElement | null>(null)

function startEdit() {
  editText.value = props.message.content
  isEditing.value = true
  nextTick(() => editTextareaRef.value?.focus())
}

function saveEdit() {
  const text = editText.value.trim()
  if (!text) return
  isEditing.value = false
  editText.value = ''
  emit('edit', props.index, text)
}

function cancelEdit() {
  isEditing.value = false
  editText.value = ''
}

const detailsOpen = ref(false)

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
  return Boolean(props.isLast && props.message.role === 'assistant' && !props.message.content)
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
    .replace(/<thinking>\s*[\s\S]*?\s*<\/thinking>\s*/gi, '')   // remove full thinking blocks
    .replace(/<\/?thinking>\s*/gi, '')                           // strip any stray tags
    .trim()
})

const copyableContent = computed(() => {
  return props.message.role === 'assistant' ? displayContent.value : props.message.content
})

const { copied, copy: copyMessage } = useClipboard()

const processingTimeLabel = computed(() => {
  const ms = props.message.metrics?.processingTimeMs ?? 0
  if (!ms) return 'Processing time: -'
  if (ms < 1000) return `Processing time: ${ms} ms`
  const seconds = ms / 1000
  if (seconds >= 60) return `Processing time: ${(seconds / 60).toFixed(1)}m`
  return `Processing time: ${seconds.toFixed(2)}s`
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
