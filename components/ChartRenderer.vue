<template>
  <div class="chart-renderer my-3 rounded-lg border border-default bg-elevated overflow-hidden">
    <div class="flex items-center justify-between px-4 py-1.5 border-b border-default bg-muted/50">
      <span class="text-[11px] font-medium text-dimmed uppercase tracking-wider">Chart</span>
    </div>
    <div v-if="showChart" class="p-4 flex items-center justify-center">
      <div v-if="chartType === 'bar'" class="w-full max-w-2xl">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
      <div v-else-if="chartType === 'line'" class="w-full max-w-2xl">
        <Line :data="chartData" :options="chartOptions" />
      </div>
      <div v-else-if="chartType === 'pie'" class="w-full max-w-lg">
        <Pie :data="chartData" :options="chartOptions" />
      </div>
      <div v-else-if="chartType === 'doughnut'" class="w-full max-w-lg">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
      <div v-else-if="chartType === 'radar'" class="w-full max-w-lg">
        <Radar :data="chartData" :options="chartOptions" />
      </div>
      <div v-else-if="chartType === 'polarArea'" class="w-full max-w-lg">
        <PolarArea :data="chartData" :options="chartOptions" />
      </div>
      <div v-else-if="chartType === 'scatter'" class="w-full max-w-2xl">
        <Scatter :data="chartData" :options="chartOptions" />
      </div>
      <div v-else class="text-sm text-dimmed">
        {{ `Unknown chart type: ${chartType}` }}
      </div>
    </div>
    <div v-else class="p-4 text-sm text-dimmed">
      {{ parseError || 'No chart to display' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Bar, Line, Pie, Doughnut, Radar, PolarArea, Scatter,
} from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title, Tooltip, Legend, BarElement, CategoryScale,
  LinearScale, PointElement, LineElement, ArcElement,
  RadialLinearScale, Filler,
} from 'chart.js'

ChartJS.register(
  Title, Tooltip, Legend, BarElement, CategoryScale,
  LinearScale, PointElement, LineElement, ArcElement,
  RadialLinearScale, Filler,
)

const props = defineProps<{
  code: string
}>()

interface ChartConfig {
  type: string
  data: Record<string, unknown>
  options?: Record<string, unknown>
}

const parsed = computed(() => {
  if (!props.code.trim()) return { config: null as ChartConfig | null, isEmpty: true }
  try {
    return { config: JSON.parse(props.code) as ChartConfig, isEmpty: false }
  } catch (e) {
    if (import.meta.dev) console.warn('[ChartRenderer] parse failed:', (e as Error).message)
    return { config: null, isEmpty: false }
  }
})

const showChart = computed(() => parsed.value.config && !parsed.value.isEmpty && !parseError.value)
const chartType = computed(() => parsed.value.config?.type || 'bar')
const chartData = computed(() => parsed.value.config?.data || {})
const chartOptions = computed(() => parsed.value.config?.options || { responsive: true, maintainAspectRatio: true })

const KNOWN_CHART_TYPES = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter']

const parseError = computed<string | null>(() => {
  if (parsed.value.isEmpty) return 'Chart config is empty'
  const cfg = parsed.value.config
  if (!cfg) return 'Invalid chart JSON'
  if (typeof cfg.type !== 'string' || !KNOWN_CHART_TYPES.includes(cfg.type)) {
    return `Unknown chart type: ${cfg.type ?? 'undefined'}`
  }
  if (!cfg.data || typeof cfg.data !== 'object') {
    return 'Chart config is missing a "data" object'
  }
  return null
})
</script>

<style scoped>
.chart-renderer canvas {
  max-width: 100%;
}
</style>
