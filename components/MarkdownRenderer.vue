<template>
  <div class="prose-message" v-html="rendered" />
</template>

<script setup lang="ts">
import { createMd } from '~/utils/markdown'
import katex from 'katex'

const props = defineProps<{
  content: string
}>()

const md = createMd()

function renderLatex(code: string, displayMode: boolean): string {
  try {
    return katex.renderToString(code, { displayMode, throwOnError: false })
  } catch {
    return `<code>${escapeHtml(code)}</code>`
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const rendered = computed(() => {
  if (!props.content) return ''
  const blocks: string[] = []
  let processed = props.content

  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, code: string) => {
    blocks.push(renderLatex(code.trim(), true))
    return `%%BLOCK${blocks.length - 1}%%`
  })

  processed = processed.replace(/\$([^\s$](?:[^$]*[^\s$])?)\$/g, (_, code: string) => {
    blocks.push(renderLatex(code.trim(), false))
    return `%%BLOCK${blocks.length - 1}%%`
  })

  let html = md.render(processed)
  html = html.replace(/%%BLOCK(\d+)%%/g, (_, idx: string) => blocks[Number(idx)] || '')
  return html
})
</script>
