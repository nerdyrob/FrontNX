<template>
  <div class="pdf-attachment my-2 rounded-lg border border-default bg-elevated/60 overflow-hidden">
    <button
      type="button"
      class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50"
      :aria-expanded="open"
      :title="open ? 'Hide extracted text' : 'Show extracted text'"
      @click="open = !open"
    >
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
        <UIcon name="i-lucide-file-text" class="h-4 w-4 text-red-500" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-medium text-highlighted">{{ attachment.name }}</p>
        <p class="text-[11px] text-dimmed">
          {{ pagesLabel }} · {{ charactersLabel }}
          <span v-if="attachment.truncated" class="text-amber-600"> · text truncated</span>
        </p>
      </div>
      <UIcon
        :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="h-4 w-4 shrink-0 text-dimmed"
      />
    </button>

    <div v-if="open" class="border-t border-default">
      <div class="flex items-center justify-between gap-2 px-3 py-1.5">
        <span class="text-[10px] uppercase tracking-wide text-dimmed">Extracted text</span>
        <div class="flex items-center gap-1">
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            size="xs"
            color="neutral"
            variant="ghost"
            :title="copied ? 'Copied' : 'Copy extracted text'"
            @click.stop="copy(attachment.text)"
          />
          <UButton
            icon="i-lucide-download"
            size="xs"
            color="neutral"
            variant="ghost"
            title="Download extracted text"
            @click.stop="download"
          />
        </div>
      </div>
      <pre class="max-h-80 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">{{ attachment.text }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PdfAttachment } from '~/types'
import { downloadTextFile } from '~/utils/download'

const props = defineProps<{
  attachment: PdfAttachment
}>()

const open = ref(false)
const { copied, copy } = useClipboard()

const pagesLabel = computed(() => {
  const pages = props.attachment.pages
  if (!pages) return 'PDF'
  return pages === 1 ? '1 page' : `${pages} pages`
})

const charactersLabel = computed(() => {
  const characters = props.attachment.characters || props.attachment.text.length
  return `${characters.toLocaleString()} chars`
})

function download() {
  const base = props.attachment.name
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim() || 'document'
  downloadTextFile(props.attachment.text, `${base}-extracted.txt`, 'text/plain')
}
</script>
