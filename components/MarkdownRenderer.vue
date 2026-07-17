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

function looksLikeLatexMathBlock(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false

  const hasLatexCommand = /\\[a-zA-Z]+/.test(trimmed)
  if (!hasLatexCommand) return false

  const hasMathSignals = /\\(frac|approx|times|cdot|sqrt|sum|int|leq|geq|left|right)|[=^_{}]/.test(trimmed)
  if (!hasMathSignals) return false

  return true
}

function normalizeBracketedLatex(input: string): string {
  const protectedChunks: string[] = []
  let safeInput = input

  // Protect fenced and inline code from LaTeX normalization.
  safeInput = safeInput.replace(/```[\s\S]*?```/g, (chunk) => {
    protectedChunks.push(chunk)
    return `%%PROTECTED${protectedChunks.length - 1}%%`
  })

  safeInput = safeInput.replace(/`[^`\n]*`/g, (chunk) => {
    protectedChunks.push(chunk)
    return `%%PROTECTED${protectedChunks.length - 1}%%`
  })

  // Normalize standard LaTeX delimiters into forms handled by our KaTeX pass.
  safeInput = safeInput.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, body: string) => {
    if (!body.trim()) return _
    return `$$\n${body.trim()}\n$$`
  })

  safeInput = safeInput.replace(/\\\(([^\n]*?)\\\)/g, (_, body: string) => {
    if (!body.trim()) return _
    return `$${body.trim()}$`
  })

  safeInput = safeInput.replace(/(^|\n)([ \t]*)\[\s*\n?([\s\S]*?)\n?[ \t]*\](?=\n|$)/g, (match, prefix: string, indent: string, body: string) => {
    if (!looksLikeLatexMathBlock(body)) return match
    return `${prefix}${indent}$$\n${body.trim()}\n${indent}$$`
  })

  return safeInput.replace(/%%PROTECTED(\d+)%%/g, (_, idx: string) => protectedChunks[Number(idx)] || '')
}

const rendered = computed(() => {
  if (!props.content) return ''
  const blocks: string[] = []
  let processed = normalizeBracketedLatex(props.content)

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
