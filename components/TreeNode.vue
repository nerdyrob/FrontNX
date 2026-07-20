<template>
  <div class="tree-node" :style="{ paddingLeft: `${props.depth * 1.25}rem` }">
    <div
      v-if="isExpandable"
      class="tree-node-header flex items-center gap-1 cursor-pointer select-none rounded px-1 py-0.5 hover:bg-muted/50"
      role="treeitem"
      :aria-expanded="expanded"
      :tabindex="0"
      @click="toggle"
      @keydown.enter="toggle"
      @keydown.space.prevent="toggle"
    >
      <UIcon
        :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        class="w-3.5 h-3.5 text-dimmed shrink-0"
      />
      <span class="text-sm font-medium text-highlighted">{{ props.label }}</span>
      <span v-if="!expanded" class="text-xs text-dimmed ml-1">
        {{ Array.isArray(props.value) ? `[${props.value.length} items]` : `{${Object.keys(props.value).length} keys}` }}
      </span>
    </div>
    <div v-else class="tree-node-leaf flex items-baseline gap-1.5 px-1 py-0.5">
      <span class="text-sm font-medium text-highlighted shrink-0">{{ props.label }}:</span>
      <span v-if="props.value === null" class="text-sm text-amber-600">null</span>
      <span v-else-if="props.value === undefined" class="text-sm text-dimmed">undefined</span>
      <span v-else-if="typeof props.value === 'string'" class="text-sm text-green-600 dark:text-green-400 break-all">"{{ props.value }}"</span>
      <span v-else-if="typeof props.value === 'number'" class="text-sm text-blue-600 dark:text-blue-400">{{ props.value }}</span>
      <span v-else-if="typeof props.value === 'boolean'" class="text-sm text-purple-600 dark:text-purple-400">{{ props.value }}</span>
      <span v-else class="text-sm">{{ props.value }}</span>
    </div>
    <div v-if="expanded && isExpandable" class="tree-node-children" role="group">
      <template v-if="Array.isArray(props.value)">
        <TreeNode
          v-for="(item, idx) in props.value"
          :key="idx"
          :label="`[${idx}]`"
          :value="item"
          :depth="props.depth + 1"
        />
      </template>
      <template v-else>
        <TreeNode
          v-for="(val, key) in props.value"
          :key="key"
          :label="String(key)"
          :value="val"
          :depth="props.depth + 1"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  value: unknown
  depth: number
}>()

const expanded = ref(false)

const isExpandable = computed(() => {
  const v = props.value
  return v !== null && v !== undefined && typeof v === 'object'
})

function toggle() {
  expanded.value = !expanded.value
}
</script>
