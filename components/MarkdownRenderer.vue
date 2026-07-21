<template>
  <div class="prose-message">
    <template v-for="(segment, i) in segments" :key="i">
      <span v-if="segment.type === 'html'" v-html="segment.html" />
      <CodeBlock
        v-else-if="segment.type === 'code'"
        :code="segment.code"
        :lang="segment.lang"
      />
      <Base64Image
        v-else-if="segment.type === 'image'"
        :src="segment.src"
        :alt="segment.alt"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { createMd, type MdEnv } from '~/utils/markdown'
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

  safeInput = safeInput.replace(/```[\s\S]*?```/g, (chunk) => {
    protectedChunks.push(chunk)
    return `%%PROTECTED${protectedChunks.length - 1}%%`
  })

  safeInput = safeInput.replace(/`[^`\n]*`/g, (chunk) => {
    protectedChunks.push(chunk)
    return `%%PROTECTED${protectedChunks.length - 1}%%`
  })

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

type Segment =
  | { type: 'html'; html: string }
  | { type: 'code'; code: string; lang: string }
  | { type: 'image'; src: string; alt: string }

function extractBase64Images(html: string): { text: string; images: { src: string; alt: string }[] } {
  const images: { src: string; alt: string }[] = []
  const text = html.replace(/<img\s+(?:[^>=]|='[^']*'|="[^"]*")*?src="(data:image\/[^"]+)"\s*(?:[^>=]|='[^']*'|="[^"]*")*\/?>/gi, (match) => {
    const srcMatch = match.match(/src="(data:image\/[^"]+)"/i)
    const altMatch = match.match(/alt="([^"]*)"/i)
    if (!srcMatch) return match
    images.push({ src: srcMatch[1], alt: altMatch ? altMatch[1] : '' })
    return `%%BASE64IMG_${images.length - 1}%%`
  })
  return { text, images }
}

const segments = computed<Segment[]>(() => {
  if (!props.content) return []

  const codeFenceChunks: string[] = []
  const afterLatexNorm = normalizeBracketedLatex(props.content)

  const protectedFromMath = afterLatexNorm
    .replace(/```[\s\S]*?```/g, (chunk) => {
      codeFenceChunks.push(chunk)
      return `%%CODEFENCE${codeFenceChunks.length - 1}%%`
    })
    .replace(/`[^`\n]*`/g, (chunk) => {
      codeFenceChunks.push(chunk)
      return `%%CODEFENCE${codeFenceChunks.length - 1}%%`
    })
    .replace(/<svg[\s\S]*?<\/svg>/g, (match) => {
      const idx = codeFenceChunks.length
      codeFenceChunks.push('```svg\n' + match + '\n```')
      return `%%CODEFENCE${idx}%%`
    })

  const blocks: string[] = []
  let processed = protectedFromMath
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, code: string) => {
      blocks.push(renderLatex(code.trim(), true))
      return `%%BLOCK${blocks.length - 1}%%`
    })
    .replace(/\$([^\s$](?:[^$]*[^\s$])?)\$/g, (_, code: string) => {
      blocks.push(renderLatex(code.trim(), false))
      return `%%BLOCK${blocks.length - 1}%%`
    })

  processed = processed.replace(/%%CODEFENCE(\d+)%%/g, (_, idx: string) => codeFenceChunks[Number(idx)] || '')

  const env: MdEnv = {}
  let html = md.render(processed, env)

  html = html.replace(/%%BLOCK(\d+)%%/g, (_, idx: string) => blocks[Number(idx)] || '')

  const { text: htmlWithImagePlaceholders, images } = extractBase64Images(html)

  const result: Segment[] = []
  let lastIndex = 0
  const segmentRegex = /%%(?:CODEBLOCK_(\d+)|BASE64IMG_(\d+))%%/g
  let match: RegExpExecArray | null

  while ((match = segmentRegex.exec(htmlWithImagePlaceholders)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'html', html: htmlWithImagePlaceholders.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      const cb = env.codeBlocks?.[Number(match[1])]
      if (cb) {
        result.push({ type: 'code', code: cb.code, lang: cb.lang })
      }
    } else if (match[2] !== undefined) {
      const img = images[Number(match[2])]
      if (img) {
        result.push({ type: 'image', src: img.src, alt: img.alt })
      }
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < htmlWithImagePlaceholders.length) {
    result.push({ type: 'html', html: htmlWithImagePlaceholders.slice(lastIndex) })
  }

  return result
})
</script>
