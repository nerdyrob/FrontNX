<template>
  <div class="border-t border-default bg-background">
    <div class="max-w-3xl mx-auto px-4 py-3">
      <div
        v-if="images.length > 0"
        class="flex flex-wrap gap-2 mb-2"
      >
        <div
          v-for="(src, i) in images"
          :key="i"
          class="relative w-16 h-16 rounded-lg overflow-hidden border border-default bg-elevated"
        >
          <img :src="src" alt="attachment" class="w-full h-full object-cover" />
          <button
            type="button"
            class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px]"
            title="Remove image"
            @click="removeImage(i)"
          >
            ✕
          </button>
        </div>
      </div>
      <div class="relative flex items-end gap-2 bg-elevated rounded-2xl border border-default px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary focus-within:shadow-md transition-all">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="onFilesSelected"
        >
        <button
          type="button"
          class="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-muted transition-colors shrink-0"
          title="Attach image"
          @click="fileInputRef?.click()"
        >
          <UIcon name="i-lucide-image" class="w-4 h-4" />
        </button>
        <textarea
          ref="textareaRef"
          v-model="text"
          rows="1"
          placeholder="Type a message…"
          class="flex-1 min-h-8 self-end bg-transparent border-0 outline-none ring-0 p-0 text-sm resize-none placeholder:text-muted leading-[2rem] max-h-[7.5rem] overflow-y-auto"
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
            :disabled="(!text.trim() && images.length === 0) || disabled"
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
  send: [payload: { text: string; images: string[] }]
  stop: []
  'update:thinking': [value: boolean]
}>()

const text = ref('')
const images = ref<string[]>([])
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    try {
      const dataUrl = await readImageAsDataUrl(file)
      images.value.push(dataUrl)
    } catch {
      // Ignore unreadable files.
    }
  }
  input.value = ''
}

function removeImage(index: number) {
  images.value.splice(index, 1)
}

function resizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

function send() {
  const msg = text.value.trim()
  if (!msg && images.value.length === 0) return
  if (props.streaming || props.disabled) return
  const payload = { text: msg, images: [...images.value] }
  text.value = ''
  images.value = []
  resizeTextarea()
  emit('send', payload)
}

onMounted(() => {
  resizeTextarea()
})

watch(text, () => {
  nextTick(() => resizeTextarea())
})
</script>
