<template>
  <div class="base64-image-wrapper inline-flex flex-col my-2">
    <div v-if="imageState.oversized" class="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
      <UIcon name="i-lucide-alert-triangle" class="w-4 h-4 text-amber-500 shrink-0" />
      <span class="text-xs text-amber-700 dark:text-amber-400">
        Image too large ({{ sizeLabel }}). Max 500 KB supported.
      </span>
    </div>
    <img
      v-else-if="validSrc"
      :src="validSrc"
      :alt="alt"
      loading="lazy"
      class="max-w-full rounded-lg"
      @click="openInTab"
    />
    <div v-else-if="imageState.error" class="text-xs text-red-500 dark:text-red-400">
      {{ imageState.error }}
    </div>
    <div v-if="validSrc" class="flex gap-2 mt-1">
      <UButton
        icon="i-lucide-download"
        size="2xs"
        color="neutral"
        variant="ghost"
        class="text-dimmed hover:text-highlighted"
        :title="`Download as .${fileExtension}`"
        :aria-label="`Download as .${fileExtension}`"
        @click="download"
      />
      <UButton
        icon="i-lucide-external-link"
        size="2xs"
        color="neutral"
        variant="ghost"
        class="text-dimmed hover:text-highlighted"
        title="Open in new tab"
        aria-label="Open image in new tab"
        @click="openInTab"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  src: string
  alt?: string
}>()

const MAX_SIZE = 500 * 1024

const imageState = computed(() => {
  const mimeMatch = props.src.match(/^data:image\/(\w+);base64,(.+)$/)

  if (!mimeMatch || !props.src) {
    return {
      valid: false,
      error: props.src ? 'Invalid base64 image data' : null,
      oversized: false,
      mimeType: '',
      rawBytes: 0,
    }
  }

  const mimeType = mimeMatch[1]
  const base64 = mimeMatch[2]

  try {
    atob(base64)
  } catch {
    return {
      valid: false,
      error: 'Invalid base64 encoding',
      oversized: false,
      mimeType,
      rawBytes: 0,
    }
  }

  const rawBytes = Math.ceil(base64.length * 3 / 4)
  const oversized = rawBytes > MAX_SIZE

  return {
    valid: !oversized,
    error: null,
    oversized,
    mimeType,
    rawBytes,
  }
})

const validSrc = computed(() => {
  if (!props.src || imageState.value.error || imageState.value.oversized) return null
  return props.src
})

const sizeLabel = computed(() => {
  const rawBytes = imageState.value.rawBytes
  if (rawBytes < 1024) return `${rawBytes} B`
  if (rawBytes < 1024 * 1024) return `${(rawBytes / 1024).toFixed(1)} KB`
  return `${(rawBytes / 1024 / 1024).toFixed(1)} MB`
})

const fileExtension = computed(() => {
  const extMap: Record<string, string> = {
    webp: 'webp', png: 'png', jpeg: 'jpg', jpg: 'jpg', gif: 'gif', svg: 'svg', bmp: 'bmp',
  }
  return extMap[imageState.value.mimeType] || 'png'
})

function download() {
  if (!props.src) return
  const a = document.createElement('a')
  a.href = props.src
  a.download = `image.${fileExtension.value}`
  a.click()
}

function openInTab() {
  if (!props.src) return
  window.open(props.src, '_blank')
}
</script>
