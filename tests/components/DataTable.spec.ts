// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTable from '~/components/DataTable.vue'

describe('DataTable', () => {
  const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF'

  it('renders correct number of rows and columns', () => {
    const wrapper = mount(DataTable, { props: { code: csv, lang: 'csv' } })
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).toContain('Charlie')
    expect(wrapper.text()).toContain('name')
    expect(wrapper.text()).toContain('age')
    expect(wrapper.text()).toContain('city')
  })

  it('parses TSV correctly', () => {
    const tsv = 'name\tage\nAlice\t30\nBob\t25'
    const wrapper = mount(DataTable, { props: { code: tsv, lang: 'tsv' } })
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('30')
  })

  it('shows empty state for empty CSV', () => {
    const wrapper = mount(DataTable, { props: { code: 'header', lang: 'csv' } })
    expect(wrapper.text()).toContain('No matching rows')
  })

  it('shows filter input', () => {
    const wrapper = mount(DataTable, { props: { code: csv, lang: 'csv' } })
    const input = wrapper.find('input[aria-label="Filter results"]')
    expect(input.exists()).toBe(true)
  })
})
