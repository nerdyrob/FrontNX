<template>
  <div class="data-table-wrapper my-3 rounded-lg border border-default bg-elevated overflow-hidden">
    <div class="flex items-center gap-3 px-4 py-2 border-b border-default bg-muted/50">
      <div class="relative flex-1 max-w-xs">
        <UIcon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dimmed" />
        <input
          v-model="globalFilter"
          type="text"
          placeholder="Filter rows…"
          class="w-full pl-8 pr-3 py-1 text-xs rounded-md border border-default bg-transparent text-highlighted placeholder-dimmed outline-none focus:border-primary transition-colors"
          aria-label="Filter results"
        />
      </div>
      <div class="flex items-center gap-2 text-xs text-dimmed">
        <span>{{ table.getFilteredRowModel().rows.length }} rows</span>
        <span class="w-px h-3 bg-default" />
        <select
          :value="pagination.pageSize"
          class="bg-transparent border border-default rounded px-1.5 py-1 text-xs text-highlighted outline-none"
          aria-label="Rows per page"
          @change="pagination = { pageIndex: 0, pageSize: Number(($event.target as HTMLSelectElement).value) }"
        >
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
        <UButton
          icon="i-lucide-download"
          size="2xs"
          color="neutral"
          variant="ghost"
          class="text-dimmed hover:text-highlighted"
          title="Export CSV"
          aria-label="Export CSV"
          @click="exportCsv"
        />
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id" class="border-b border-default">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="px-3 py-2 text-left text-[11px] font-semibold text-dimmed uppercase tracking-wider cursor-pointer select-none hover:text-highlighted whitespace-nowrap"
              :class="{ 'text-primary': header.column.getIsSorted() }"
              @click="header.column.getToggleSortingHandler()?.()"
              :aria-sort="header.column.getIsSorted() ? (header.column.getIsSorted() === 'asc' ? 'ascending' : 'descending') : undefined"
            >
              <div class="flex items-center gap-1">
                <span>{{ header.column.columnDef.header as string }}</span>
                <UIcon
                  v-if="header.column.getIsSorted() === 'asc'"
                  name="i-lucide-arrow-up"
                  class="w-3 h-3"
                />
                <UIcon
                  v-else-if="header.column.getIsSorted() === 'desc'"
                  name="i-lucide-arrow-down"
                  class="w-3 h-3"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="border-b border-default/50 last:border-0 hover:bg-muted/30 transition-colors"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-3 py-2 text-xs text-highlighted whitespace-nowrap"
            >
              {{ cell.getValue() }}
            </td>
          </tr>
          <tr v-if="table.getRowModel().rows.length === 0">
            <td :colspan="columns.length" class="px-3 py-8 text-center text-xs text-dimmed">
              No matching rows
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-2 border-t border-default bg-muted/50">
      <button
        class="text-xs text-dimmed hover:text-highlighted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        :disabled="!table.getCanPreviousPage()"
        aria-label="Previous page"
        @click="table.previousPage()"
      >Previous</button>
      <div class="flex items-center gap-1 text-xs text-dimmed">
        <template v-for="p in visiblePageNumbers" :key="p">
          <button
            v-if="p === '...'"
            class="px-1"
            disabled
          >…</button>
          <button
            v-else
            :class="[
              'w-6 h-6 rounded text-xs font-medium transition-colors',
              p === currentPage
                ? 'bg-primary text-white'
                : 'text-dimmed hover:text-highlighted hover:bg-muted',
            ]"
            @click="table.setPageIndex(p - 1)"
          >{{ p }}</button>
        </template>
      </div>
      <button
        class="text-xs text-dimmed hover:text-highlighted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        :disabled="!table.getCanNextPage()"
        aria-label="Next page"
        @click="table.nextPage()"
      >Next</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { parse as parseCsv, unparse as unparseCsv } from 'papaparse'
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  type SortingState,
} from '@tanstack/vue-table'

const props = defineProps<{
  code: string
  lang: string
}>()

const separator = computed(() => props.lang === 'tsv' ? '\t' : ',')

interface Row {
  [key: string]: string
}

const parsed = computed(() => {
  const result = parseCsv<Row>(props.code, {
    header: true,
    skipEmptyLines: true,
    delimiter: separator.value,
  })
  return result
})

const columnHelper = createColumnHelper<Row>()

const columns = computed(() => {
  if (!parsed.value.meta.fields) return []
  return parsed.value.meta.fields.map((field) =>
    columnHelper.accessor(field, {
      header: field,
      enableSorting: true,
    }),
  )
})

const data = computed(() => parsed.value.data)

const sorting = ref<SortingState>([])
const globalFilter = ref('')
const pagination = ref({ pageIndex: 0, pageSize: 25 })

watch([data, globalFilter], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
})

const table = useVueTable({
  get data() { return data.value },
  get columns() { return columns.value },
  state: {
    get sorting() { return sorting.value },
    get globalFilter() { return globalFilter.value },
    get pagination() { return pagination.value },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },
  onGlobalFilterChange: (updater) => {
    globalFilter.value = typeof updater === 'function' ? updater(globalFilter.value) : updater
  },
  onPaginationChange: (updater) => {
    pagination.value = typeof updater === 'function' ? updater(pagination.value) : updater
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  globalFilterFn: 'includesString',
})

const currentPage = computed(() => table.getState().pagination.pageIndex + 1)
const totalPages = computed(() => table.getPageCount())

const visiblePageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | string)[] = []
  pages.push(1)
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

function exportCsv() {
  const csv = unparseCsv(data.value)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'export.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>
