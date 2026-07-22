<template>
  <div class="svg-renderer-wrapper my-3 rounded-lg border border-default bg-elevated overflow-hidden">
    <div class="flex items-center justify-between px-4 py-1.5 border-b border-default bg-muted/50">
      <span class="text-[11px] font-medium text-dimmed uppercase tracking-wider">SVG</span>
      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-download'"
        size="2xs"
        color="neutral"
        variant="ghost"
        class="text-dimmed hover:text-highlighted"
        title="Download SVG"
        aria-label="Download SVG"
        @click="downloadSvg"
      />
    </div>
    <div v-if="svgState.sanitized" class="svg-content flex items-center justify-center p-4" v-html="svgState.sanitized" />
    <div v-else-if="svgState.error" class="p-4 text-sm text-red-500 dark:text-red-400">
      {{ svgState.error }}
    </div>
    <div v-else class="p-4 text-sm text-dimmed">
      No SVG content
    </div>
  </div>
</template>

<script setup lang="ts">
import DOMPurify from 'isomorphic-dompurify'

const props = defineProps<{
  code: string
}>()

const copied = ref(false)

const svgState = computed(() => {
  try {
    const cleaned = DOMPurify.sanitize(props.code, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_ATTR: ['viewBox', 'xmlns', 'xlink:href'],
      FORBID_TAGS: ['script'],
      FORBID_ATTR: ['on*'],
    })
    if (!cleaned || cleaned === '') {
      return { sanitized: null as string | null, error: null as string | null }
    }
    const svgMatch = cleaned.match(/<svg[\s\S]*<\/svg>/i)
    return {
      sanitized: svgMatch ? svgMatch[0] : `<div class="text-xs text-dimmed p-2">${cleaned}</div>`,
      error: null,
    }
  } catch (e) {
    return { sanitized: null, error: `SVG render error: ${(e as Error).message}` }
  }
})

function downloadSvg() {
  if (!svgState.value.sanitized) return
  const blob = new Blob([svgState.value.sanitized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'diagram.svg'
  a.click()
  URL.revokeObjectURL(url)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}
</script>

<style scoped>
.svg-content svg {
  max-width: 100%;
  height: auto;
}
</style>
