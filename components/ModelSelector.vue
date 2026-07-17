<template>
  <div class="flex items-center gap-1.5">
    <select
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      class="min-w-[180px] rounded-md border border-default bg-default px-3 py-1.5 text-sm text-highlighted outline-none focus:border-primary"
    >
      <option value="" disabled>Select model</option>
      <option v-for="m in models" :key="m.id" :value="m.id">{{ m.id }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import type { ModelOption } from '~/types'

const props = defineProps<{
  models: ModelOption[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
