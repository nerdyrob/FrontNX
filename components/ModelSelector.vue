<template>
  <div class="flex items-center gap-1.5">
    <select
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      class="min-w-[180px] rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-1.5 text-sm text-(--ui-text) outline-none focus:border-(--ui-border-accented)"
      :disabled="loading"
    >
      <option value="" disabled>{{ loading ? 'Loading…' : 'Select model' }}</option>
      <option v-for="m in models" :key="m.id" :value="m.id">{{ m.id }}</option>
    </select>
    <UButton
      icon="i-lucide-refresh-cw"
      size="2xs"
      color="neutral"
      variant="ghost"
      :loading="loading"
      @click="$emit('refresh')"
    />
  </div>
</template>

<script setup lang="ts">
import type { ModelOption } from '~/types'

const props = defineProps<{
  models: ModelOption[]
  modelValue: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  refresh: []
}>()
</script>
