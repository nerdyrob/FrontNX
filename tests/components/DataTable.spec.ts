// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTable from '~/components/DataTable.vue'

function buildCsv(rowCount: number): string {
  const header = 'id,value'
  const rows: string[] = []
  for (let i = 1; i <= rowCount; i++) rows.push(`${i},row-${i}`)
  return [header, ...rows].join('\n')
}

describe('DataTable CSV export (#3)', () => {
  let capturedBlob: Blob | null = null

  beforeEach(() => {
    capturedBlob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(((blob: Blob) => {
      capturedBlob = blob
      return 'blob:fake'
    }) as typeof URL.createObjectURL)
    if (typeof URL.revokeObjectURL === 'function') {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    } else {
      ;(URL as any).revokeObjectURL = () => {}
    }
  })

  it('exports the full dataset, not the truncated view', async () => {
    const rowCount = 5001 // exceeds MAX_ROWS (5000) so the view is truncated
    const wrapper = mount(DataTable, {
      props: { code: buildCsv(rowCount), lang: 'csv' },
    })

    const exportBtn = wrapper.find('[aria-label="Export CSV"]')
    expect(exportBtn.exists()).toBe(true)
    await exportBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(capturedBlob).not.toBeNull()
    const csv = await capturedBlob!.text()
    // The last row is only present in the full dataset, not the truncated view.
    expect(csv).toContain('5001,row-5001')
    expect(csv.split('\n').length).toBe(rowCount + 1)
  })

  it('exports the entire dataset when under the limit', async () => {
    const rowCount = 10
    const wrapper = mount(DataTable, {
      props: { code: buildCsv(rowCount), lang: 'csv' },
    })

    const exportBtn = wrapper.find('[aria-label="Export CSV"]')
    await exportBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const csv = await capturedBlob!.text()
    expect(csv).toContain('10,row-10')
  })
})
