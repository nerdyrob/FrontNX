<template>
  <div class="border-t border-default bg-background">
    <div class="max-w-3xl mx-auto px-4 py-3">
      <div class="relative flex items-end gap-2 bg-elevated rounded-2xl border border-default px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary focus-within:shadow-md transition-all">
        <textarea
          ref="textareaRef"
          v-model="text"
          rows="1"
          placeholder="Type a message…"
          class="flex-1 bg-transparent border-0 outline-none ring-0 p-0 text-sm resize-none placeholder:text-muted leading-5 max-h-[7.5rem] overflow-y-auto"
          :disabled="disabled"
          @input="resizeTextarea"
          @keydown.enter.exact.prevent="send"
        />
        <div class="flex items-center gap-1 shrink-0">
          <button
            v-if="thinkingSupported"
            class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
            :class="[
              thinking ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground',
              streaming && 'opacity-50 cursor-not-allowed',
            ]"
            :title="thinking ? 'Thinking enabled' : 'Enable thinking'"
            :disabled="streaming"
            @click="$emit('update:thinking', !thinking)"
          >
            <UIcon name="i-lucide-brain" class="w-3.5 h-3.5" />
            <span>Think</span>
          </button>
          <UButton
            v-if="!streaming"
            icon="i-lucide-arrow-up"
            size="sm"
            color="primary"
            variant="solid"
            class="rounded-lg"
            :disabled="!text.trim() || disabled"
            @click="send"
          />
          <UButton
            v-else
            icon="i-lucide-square"
            size="sm"
            color="neutral"
            variant="soft"
            class="rounded-lg"
            @click="$emit('stop')"
          />
        </div>
      </div>
      <p class="text-[10px] text-center text-dimmed mt-2">
        Press <kbd class="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> to send ·
        <kbd class="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Shift+Enter</kbd> for new line
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  streaming: boolean
  disabled?: boolean
  thinking?: boolean
  thinkingSupported?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  stop: []
  'update:thinking': [value: boolean]
}>()

const text = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function resizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

function send() {
  const msg = text.value.trim()
  if (!msg || props.streaming) return
  text.value = ''
  resizeTextarea()
  emit('send', msg)
}

onMounted(() => {
  resizeTextarea()
})

watch(text, () => {
  nextTick(() => resizeTextarea())
})
</script>
