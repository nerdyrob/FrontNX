<template>
  <StructuredDataViewer
    v-if="isStructured"
    :code="code"
    :lang="lang"
  />
  <DataTable
    v-else-if="isTabular"
    :code="code"
    :lang="lang"
  />
  <SvgRenderer
    v-else-if="isSvg"
    :code="code"
  />
  <ChartRenderer
    v-else-if="isChart"
    :code="code"
  />
  <div v-else class="code-block-wrapper my-3 rounded-lg border border-default bg-elevated overflow-hidden" style="max-width: 700px;">
    <div class="flex items-center justify-between px-4 py-1.5 border-b border-default bg-muted/50">
      <span class="text-[11px] font-medium text-dimmed uppercase tracking-wider">{{ displayLang }}</span>
      <div class="flex items-center gap-0.5">
        <CodeBlockActions
          v-if="showActions"
          :code="code"
          :lang="lang"
          :model-value="displayCode"
          @update:model-value="displayCode = $event"
        />
        <UButton
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          size="2xs"
          color="neutral"
          variant="ghost"
          class="text-dimmed hover:text-highlighted"
          :title="copied ? 'Copied' : 'Copy code'"
          aria-label="Copy code"
          @click="copy"
        />
      </div>
    </div>
    <div class="overflow-x-auto">
      <div v-if="renderedHtml" class="code-block-content" style="overflow-x: auto; max-width: 100%;" v-html="renderedHtml" />
      <pre v-else class="!m-0 !border-0 !bg-transparent !rounded-none"><code class="text-sm">{{ displayCode }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { highlightCode, ensureHighlighter } from '~/utils/highlighter'

const props = defineProps<{
  code: string
  lang: string
}>()

const { copied, copy: clipCopy } = useClipboard()

function copy() {
  clipCopy(displayCode.value)
}

const structuredLangs = ['json', 'yaml', 'yml', 'toml', 'xml']
const isStructured = computed(() => structuredLangs.includes(props.lang))

const tabularLangs = ['csv', 'tsv']
const isTabular = computed(() => tabularLangs.includes(props.lang))

const svgLangs = ['svg']
const isSvg = computed(() => svgLangs.includes(props.lang))

const chartLangs = ['chart']
const isChart = computed(() => chartLangs.includes(props.lang))

const actionLangs = ['sql', 'graphql', 'openapi', 'oas']
const showActions = computed(() => actionLangs.includes(props.lang))

const displayCode = ref(props.code)

watch(() => props.code, (val) => {
  displayCode.value = val
})

const displayLang = computed(() => {
  if (!props.lang) return ''
  const map: Record<string, string> = {
    js: 'JavaScript', ts: 'TypeScript', py: 'Python', rb: 'Ruby',
    rs: 'Rust', go: 'Go', sh: 'Shell', bash: 'Bash',
    yml: 'YAML', toml: 'TOML', graphql: 'GraphQL', sql: 'SQL',
    json: 'JSON', xml: 'XML', css: 'CSS', html: 'HTML', md: 'Markdown', chart: 'Chart',
    latex: 'LaTeX', diff: 'Diff', dockerfile: 'Dockerfile', ini: 'INI',
    http: 'HTTP', java: 'Java', c: 'C', cpp: 'C++', cs: 'C#',
    swift: 'Swift', kt: 'Kotlin', scala: 'Scala', r: 'R',
    ps1: 'PowerShell', powershell: 'PowerShell', makefile: 'Makefile',
    php: 'PHP', rust: 'Rust', typescript: 'TypeScript', javascript: 'JavaScript',
    python: 'Python', ruby: 'Ruby',
  }
  return map[props.lang] || props.lang
})

const renderedHtml = ref<string | null>(null)

function render(): void {
  if (isStructured.value || isTabular.value || isSvg.value || isChart.value) return
  const result = highlightCode(displayCode.value, props.lang)
  renderedHtml.value = result.html || null
}

watch(displayCode, () => {
  render()
})

render()

if (!renderedHtml.value && import.meta.client) {
  ensureHighlighter().then(() => {
    render()
  })
}
</script>

<style scoped>
.code-block-content {
  font-size: 0.8125rem;
  line-height: 1.6;
  padding: 0.75rem 1rem;
}
:deep(.code-block-content pre) {
  overflow-x: auto;
  max-width: 100%;
}

.code-block-content code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: inherit;
  background: none;
  padding: 0;
}
</style>
