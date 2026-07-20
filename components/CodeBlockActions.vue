<template>
  <div v-if="showActions" class="flex items-center gap-0.5 ml-auto">
    <UButton
      v-if="canFormat"
      :icon="isFormatted ? 'i-lucide-undo-2' : 'i-lucide-arrow-left-right'"
      size="2xs"
      color="neutral"
      variant="ghost"
      class="text-dimmed hover:text-highlighted"
      :title="isFormatted ? 'Show raw' : 'Format'"
      :aria-label="isFormatted ? 'Show raw' : 'Format'"
      @click="toggleFormat"
    />
    <UButton
      icon="i-lucide-check-circle"
      size="2xs"
      color="neutral"
      variant="ghost"
      class="text-dimmed hover:text-highlighted"
      title="Validate"
      aria-label="Validate syntax"
      @click="validate"
    />
    <span v-if="validationMessage" class="flex items-center gap-1 text-[10px]" :class="validationClass">
      <UIcon :name="validationIcon" class="w-3 h-3" />
      <span class="hidden sm:inline">{{ validationMessage }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { format as formatSql } from 'sql-formatter'

const props = defineProps<{
  code: string
  lang: string
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const actionLangs = ['sql', 'graphql', 'openapi', 'oas']
const showActions = computed(() => actionLangs.includes(props.lang))
const canFormat = computed(() => ['sql', 'graphql'].includes(props.lang))

const isFormatted = ref(false)
const savedRaw = ref(props.code)
const validationMessage = ref<string | null>(null)
const validationType = ref<'error' | 'success' | null>(null)

const validationClass = computed(() => ({
  'text-red-500 dark:text-red-400': validationType.value === 'error',
  'text-green-600 dark:text-green-400': validationType.value === 'success',
}))

const validationIcon = computed(() => {
  return validationType.value === 'success' ? 'i-lucide-check-circle-2' : 'i-lucide-alert-circle'
})

function formatCode(): string {
  switch (props.lang) {
    case 'sql':
      try {
        return formatSql(props.code, { language: 'sql', keywordCase: 'upper' })
      } catch {
        return props.code
      }
    case 'graphql': {
      let result = ''
      let indent = 0
      const lines = props.code.split('\n')
      for (let line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('}') || trimmed.startsWith(')')) indent = Math.max(0, indent - 1)
        result += '  '.repeat(indent) + trimmed + '\n'
        const opens = (trimmed.match(/[{()]/g) || []).length
        const closes = (trimmed.match(/[})]/g) || []).length
        indent += opens - closes
      }
      return result.trimEnd()
    }
    default:
      return props.code
  }
}

function validateCode(): string | null {
  switch (props.lang) {
    case 'sql': {
      const open = (props.code.match(/\(/g) || []).length
      const close = (props.code.match(/\)/g) || []).length
      if (open !== close) return `Mismatched parentheses: ${open} open, ${close} close`
      const singleQuotes = (props.code.match(/'/g) || []).length
      if (singleQuotes % 2 !== 0) return 'Unclosed single quote'
      return null
    }
    case 'graphql': {
      const open = (props.code.match(/\{/g) || []).length
      const close = (props.code.match(/\}/g) || []).length
      if (open !== close) return `Mismatched braces: ${open} open, ${close} close`
      return null
    }
    case 'openapi':
    case 'oas':
      return null
    default:
      return null
  }
}

watch(() => props.code, (val) => {
  if (!isFormatted.value) {
    savedRaw.value = val
  }
})

function toggleFormat() {
  if (isFormatted.value) {
    emit('update:modelValue', savedRaw.value)
    isFormatted.value = false
  } else {
    savedRaw.value = props.code
    const formatted = formatCode()
    emit('update:modelValue', formatted)
    isFormatted.value = true
  }
}

function validate() {
  const msg = validateCode()
  if (msg) {
    validationMessage.value = msg
    validationType.value = 'error'
  } else {
    validationMessage.value = 'Valid syntax'
    validationType.value = 'success'
  }
  setTimeout(() => {
    validationMessage.value = null
    validationType.value = null
  }, 3000)
}
</script>
