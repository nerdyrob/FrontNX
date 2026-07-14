<template>
  <div class="border-t border-default bg-background">
    <div class="max-w-3xl mx-auto px-4 py-4">
      <div class="relative flex items-end gap-2 bg-elevated rounded-xl border border-default px-4 py-3 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
        <ClientOnly>
          <UTextarea
            v-model="text"
            :rows="1"
            :max-rows="6"
            placeholder="Type a message…"
            class="flex-1 bg-transparent border-0 outline-none ring-0 p-0 text-sm resize-none placeholder:text-dimmed"
            :disabled="disabled"
            @keydown.enter.exact="send"
            @keydown.shift.enter=""
          />
        </ClientOnly>
        <div class="flex items-center gap-1 shrink-0">
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
}>()

const emit = defineEmits<{
  send: [text: string]
  stop: []
}>()

const text = ref('')

function send() {
  const msg = text.value.trim()
  if (!msg || props.streaming) return
  text.value = ''
  emit('send', msg)
}
</script>
