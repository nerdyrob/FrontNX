<template>
  <div v-if="!parseResult.isEmpty" class="structured-data-viewer rounded-lg border border-default bg-elevated overflow-hidden">
    <div class="flex items-center justify-between px-4 py-1.5 border-b border-default bg-muted/50">
      <div class="flex items-center gap-2">
        <span class="text-[11px] font-medium text-dimmed uppercase tracking-wider">{{ formatLabel }}</span>
        <span v-if="sizeWarning" class="text-[10px] text-amber-500 font-medium">Large file</span>
      </div>
      <div class="flex items-center gap-1">
        <div class="flex rounded-md border border-default overflow-hidden text-xs mr-2" role="tablist">
          <button
            v-for="mode in viewModes"
            :key="mode.value"
            :class="[
              'px-2 py-0.5 font-medium transition-colors',
              viewMode === mode.value
                ? 'bg-primary text-white'
                : 'bg-transparent text-dimmed hover:text-highlighted',
            ]"
            :aria-selected="viewMode === mode.value"
            role="tab"
            @click="viewMode = mode.value"
          >{{ mode.label }}</button>
        </div>
        <UButton
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          size="2xs"
          color="neutral"
          variant="ghost"
          class="text-dimmed hover:text-highlighted"
          :title="copied ? 'Copied' : 'Copy'"
          aria-label="Copy formatted"
          @click="copyFormatted"
        />
      </div>
    </div>
    <div class="overflow-x-auto">
      <div v-if="viewMode === 'raw'" class="p-4">
        <pre class="!m-0 !border-0 !bg-transparent !rounded-none text-sm font-mono leading-relaxed"><code>{{ code }}</code></pre>
      </div>
      <div v-else-if="viewMode === 'pretty'" class="p-4">
        <pre class="!m-0 !border-0 !bg-transparent !rounded-none text-sm font-mono leading-relaxed"><code>{{ prettyFormatted }}</code></pre>
      </div>
      <div v-else class="py-2 px-1" role="tree">
        <TreeNode
          v-for="(root, idx) in rootNodes"
          :key="idx"
          :label="root.label"
          :value="root.value"
          :depth="0"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { parse as parseYaml } from 'yaml'
import { parse as parseToml } from '@iarna/toml'
import { XMLParser } from 'fast-xml-parser'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item' || name.endsWith('s'),
})

const props = defineProps<{
  code: string
  lang: string
}>()

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

type ViewMode = 'raw' | 'pretty' | 'tree'
const viewMode = ref<ViewMode>('raw')

const viewModes = [
  { label: 'Raw', value: 'raw' as const },
  { label: 'Pretty', value: 'pretty' as const },
  { label: 'Tree', value: 'tree' as const },
]

const formatLabel = computed(() => {
  const map: Record<string, string> = {
    json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML',
  }
  return map[props.lang] || props.lang.toUpperCase()
})

const sizeWarning = computed(() => {
  return new Blob([props.code]).size > 500 * 1024
})

const parseResult = computed(() => {
  let parsed: unknown = null
  let parseError: string | null = null
  const trimmed = props.code.trim()
  if (!trimmed) return { parsed: null, parseError: null, isEmpty: true }
  try {
    switch (props.lang) {
      case 'json':
        parsed = JSON.parse(props.code)
        break
      case 'yaml':
      case 'yml':
        parsed = parseYaml(props.code)
        break
      case 'toml':
        parsed = parseToml(props.code)
        break
      case 'xml': {
        parsed = xmlParser.parse(props.code)
        break
      }
    }
  } catch (e) {
    parseError = `Failed to parse ${formatLabel.value}: ${(e as Error).message}`
    if (import.meta.dev) console.warn('[StructuredDataViewer]', parseError)
  }
  return { parsed, parseError, isEmpty: false }
})

const prettyFormatted = computed(() => {
  const { parsed } = parseResult.value
  if (!parsed) return props.code
  return JSON.stringify(parsed, null, 2)
})

const rootNodes = computed(() => {
  const { parsed } = parseResult.value
  if (!parsed || typeof parsed !== 'object') return []
  if (Array.isArray(parsed)) {
    return [{ label: `Array(${parsed.length})`, value: parsed }]
  }
  const keys = Object.keys(parsed as Record<string, unknown>)
  if (keys.length === 1) {
    return [{ label: keys[0], value: (parsed as Record<string, unknown>)[keys[0]] }]
  }
  return keys.map(k => ({ label: k, value: (parsed as Record<string, unknown>)[k] }))
})

async function copyFormatted() {
  const text = viewMode.value === 'raw' ? props.code : prettyFormatted.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = false }, 1500)
  } catch {
    copied.value = false
  }
}
</script>
