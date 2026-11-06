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
      <div v-if="pdfs.length > 0 || pendingPdfNames.length > 0" class="flex flex-wrap gap-2 mb-2">
        <div
          v-for="(pdf, i) in pdfs"
          :key="`${pdf.name}-${i}`"
          class="flex items-center gap-2 rounded-lg border border-default bg-elevated px-2.5 py-1.5"
        >
          <UIcon name="i-lucide-file-text" class="h-4 w-4 shrink-0 text-red-500" />
          <span class="max-w-[200px] truncate text-xs font-medium">{{ pdf.name }}</span>
          <span class="text-[10px] text-dimmed">
            {{ pdf.pages ? `${pdf.pages}p` : 'PDF' }}<span v-if="pdf.truncated"> · truncated</span>
          </span>
          <button
            type="button"
            class="text-dimmed hover:text-foreground"
            title="Remove PDF"
            @click="removePdf(i)"
          >
            ✕
          </button>
        </div>
        <div
          v-for="name in pendingPdfNames"
          :key="`pending-${name}`"
          class="flex items-center gap-2 rounded-lg border border-default bg-elevated px-2.5 py-1.5"
        >
          <UIcon name="i-lucide-loader-circle" class="h-4 w-4 shrink-0 animate-spin text-primary" />
          <span class="max-w-[200px] truncate text-xs text-muted">{{ name }}</span>
          <span class="text-[10px] text-dimmed">extracting…</span>
        </div>
      </div>
      <div v-if="pdfErrors.length > 0" class="mb-2 space-y-1">
        <div
          v-for="(error, i) in pdfErrors"
          :key="i"
          class="flex items-start gap-1.5 text-[11px] text-red-500"
        >
          <UIcon name="i-lucide-alert-circle" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span class="flex-1">{{ error }}</span>
          <button type="button" class="text-dimmed hover:text-foreground" title="Dismiss" @click="dismissError(i)">
            ✕
          </button>
        </div>
      </div>
      <div class="relative flex items-center gap-2 bg-elevated rounded-2xl border border-default px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary focus-within:shadow-md transition-all">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="onFilesSelected"
        >
        <input
          ref="pdfInputRef"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          class="hidden"
          @change="onPdfSelected"
        >
        <div class="flex items-center gap-0 shrink-0">
          <button
            type="button"
            class="flex items-center justify-center w-7 h-8 rounded-lg text-muted hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Attach image"
            @click="fileInputRef?.click()"
          >
            <UIcon name="i-lucide-image" class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="flex items-center justify-center w-7 h-8 rounded-lg text-muted hover:text-foreground hover:bg-muted transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Attach PDF"
            :disabled="extracting"
            @click="pdfInputRef?.click()"
          >
            <UIcon name="i-lucide-file-text" class="w-4 h-4" />
          </button>
        </div>
        <textarea
          ref="textareaRef"
          v-model="text"
          rows="1"
          placeholder="Type a message…"
          class="flex-1 min-h-8 px-0 py-[5px] bg-transparent border-0 outline-none ring-0 text-sm resize-none placeholder:text-muted leading-snug max-h-[7.5rem] overflow-y-auto scrollbar-hide"
          :disabled="disabled"
          @input="resizeTextarea"
          @keydown.enter.exact.prevent="send"
          @paste="onPaste"
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
            :disabled="(!text.trim() && images.length === 0 && pdfs.length === 0) || disabled || extracting"
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
        <kbd class="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Shift+Enter</kbd> for new line ·
        Attach images or PDFs · Paste images with <kbd class="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+V</kbd>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PdfAttachment } from '~/types'

const props = defineProps<{
  streaming: boolean
  disabled?: boolean
  thinking?: boolean
  thinkingSupported?: boolean
}>()

const emit = defineEmits<{
  send: [payload: { text: string; images: string[]; pdfs: PdfAttachment[] }]
  stop: []
  'update:thinking': [value: boolean]
}>()

const MAX_PDF_ATTACHMENTS = 5

const config = useRuntimeConfig()
const maxPdfBytes = Number(config.public.maxPdfFileBytes) || 20 * 1024 * 1024

const text = ref('')
const images = ref<string[]>([])
const pdfs = ref<PdfAttachment[]>([])
const pendingPdfNames = ref<string[]>([])
const pdfErrors = ref<string[]>([])
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const pdfInputRef = ref<HTMLInputElement | null>(null)

const extracting = computed(() => pendingPdfNames.value.length > 0)

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function pushError(message: string) {
  pdfErrors.value.push(message)
  if (pdfErrors.value.length > 3) pdfErrors.value.shift()
}

function dismissError(index: number) {
  pdfErrors.value.splice(index, 1)
}

function uploadErrorMessage(err: unknown, fileName: string): string {
  const error = err as { data?: { message?: string; statusMessage?: string }; message?: string }
  const detail = error?.data?.message || error?.data?.statusMessage || error?.message
  return `Could not add "${fileName}"${detail ? `: ${detail}` : '.'}`
}

async function uploadPdf(file: File) {
  if (!isPdfFile(file)) {
    pushError(`"${file.name}" is not a PDF.`)
    return
  }
  if (file.size > maxPdfBytes) {
    pushError(`"${file.name}" is larger than the ${formatBytes(maxPdfBytes)} limit.`)
    return
  }
  if (pdfs.value.length + pendingPdfNames.value.length >= MAX_PDF_ATTACHMENTS) {
    pushError(`You can attach up to ${MAX_PDF_ATTACHMENTS} PDFs per message.`)
    return
  }

  // Serialize uploads so the attachment cap is applied deterministically when
  // several files are selected at once.
  pendingPdfNames.value.push(file.name)
  try {
    const result = await $fetch<PdfAttachment>('/api/pdf/extract', {
      method: 'POST',
      params: { name: file.name },
      body: file,
      headers: { 'Content-Type': 'application/pdf' },
    })
    if (!result || typeof result.text !== 'string' || !result.text.trim()) {
      throw new Error('the server returned no extracted text')
    }
    pdfs.value.push({
      name: typeof result.name === 'string' && result.name ? result.name : file.name,
      pages: Number(result.pages) || 0,
      characters: Number(result.characters) || result.text.length,
      truncated: result.truncated === true,
      text: result.text,
    })
  } catch (err) {
    pushError(uploadErrorMessage(err, file.name))
  } finally {
    const index = pendingPdfNames.value.indexOf(file.name)
    if (index !== -1) pendingPdfNames.value.splice(index, 1)
  }
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

async function onPdfSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  for (const file of files) {
    await uploadPdf(file)
  }
  input.value = ''
}

async function onPaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  const imageFiles: File[] = []
  const pdfFiles: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (!file) continue
    if (item.type.startsWith('image/')) imageFiles.push(file)
    else if (isPdfFile(file)) pdfFiles.push(file)
  }

  if (imageFiles.length === 0 && pdfFiles.length === 0) return
  event.preventDefault()

  for (const file of imageFiles) {
    try {
      const dataUrl = await readImageAsDataUrl(file)
      images.value.push(dataUrl)
    } catch {
      // Ignore unreadable images.
    }
  }

  for (const file of pdfFiles) {
    await uploadPdf(file)
  }
}

function removeImage(index: number) {
  images.value.splice(index, 1)
}

function removePdf(index: number) {
  pdfs.value.splice(index, 1)
}

function resizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

function send() {
  const msg = text.value.trim()
  if (!msg && images.value.length === 0 && pdfs.value.length === 0) return
  if (props.streaming || props.disabled || extracting.value) return
  const payload = {
    text: msg,
    images: [...images.value],
    pdfs: [...pdfs.value],
  }
  text.value = ''
  images.value = []
  pdfs.value = []
  pdfErrors.value = []
  resizeTextarea()
  emit('send', payload)
}

onMounted(() => {
  resizeTextarea()
})

watch(text, () => {
  nextTick(() => resizeTextarea())
})

// Expose handlers for testing (clipboard events can't carry clipboardData in
// happy-dom's Event constructor, so tests invoke the handler directly).
defineExpose({ onPaste, onPdfSelected, uploadPdf })
</script>
