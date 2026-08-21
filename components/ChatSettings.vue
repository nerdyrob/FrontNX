<template>
  <div class="w-72 space-y-4 p-3 text-sm">
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="font-medium">Temperature</span>
        <span class="text-[11px] text-dimmed">{{ displayValue(temperature, '1.0') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          :value="temperature ?? 1"
          class="flex-1"
          @input="emit('update:temperature', parseNumber(($event.target as HTMLInputElement).value))"
        >
        <UButton size="2xs" color="neutral" variant="ghost" title="Reset to default" @click="emit('update:temperature', null)">
          Reset
        </UButton>
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="font-medium">Max tokens</span>
        <span class="text-[11px] text-dimmed">{{ maxTokens ?? 'unset' }}</span>
      </div>
      <input
        type="number"
        min="1"
        :value="maxTokens ?? ''"
        placeholder="unset"
        class="w-full bg-elevated border border-default rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30"
        @input="emit('update:maxTokens', parseNullableNumber(($event.target as HTMLInputElement).value))"
      >
    </div>

    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="font-medium">Top-p</span>
        <span class="text-[11px] text-dimmed">{{ displayValue(topP, '1.0') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="topP ?? 1"
          class="flex-1"
          @input="emit('update:topP', parseNumber(($event.target as HTMLInputElement).value))"
        >
        <UButton size="2xs" color="neutral" variant="ghost" title="Reset to default" @click="emit('update:topP', null)">
          Reset
        </UButton>
      </div>
    </div>

    <div>
      <div class="mb-1 font-medium">System prompt override</div>
      <textarea
        :value="systemPrompt"
        rows="3"
        placeholder="Override the default system instructions…"
        class="w-full bg-elevated border border-default rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 resize-y text-xs"
        @input="emit('update:systemPrompt', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  temperature: number | null
  maxTokens: number | null
  topP: number | null
  systemPrompt: string
}>()

const emit = defineEmits<{
  'update:temperature': [value: number | null]
  'update:maxTokens': [value: number | null]
  'update:topP': [value: number | null]
  'update:systemPrompt': [value: string]
}>()

function parseNumber(value: string): number {
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isNaN(n) ? null : n
}

function displayValue(value: number | null, fallback: string): string {
  return value === null || Number.isNaN(value) ? fallback : String(value)
}
</script>
