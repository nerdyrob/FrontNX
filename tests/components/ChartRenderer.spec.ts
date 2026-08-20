// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChartRenderer from '~/components/ChartRenderer.vue'

describe('ChartRenderer malformed config (#14)', () => {
  it('shows a friendly error for non-JSON input', () => {
    const wrapper = mount(ChartRenderer, { props: { code: 'not json' } })
    expect(wrapper.text()).toContain('Invalid chart JSON')
  })

  it('shows a friendly error for an empty config', () => {
    const wrapper = mount(ChartRenderer, { props: { code: '' } })
    expect(wrapper.text()).toContain('Chart config is empty')
  })

  it('shows a friendly error for an unknown chart type', () => {
    const wrapper = mount(ChartRenderer, { props: { code: JSON.stringify({ type: 'bogus', data: {} }) } })
    expect(wrapper.text()).toContain('Unknown chart type: bogus')
  })

  it('shows a friendly error when data is missing', () => {
    const wrapper = mount(ChartRenderer, { props: { code: JSON.stringify({ type: 'bar' }) } })
    expect(wrapper.text()).toContain('missing a "data" object')
  })

  it('renders a valid bar chart without error', () => {
    const valid = JSON.stringify({
      type: 'bar',
      data: { labels: ['A', 'B'], datasets: [{ label: 'x', data: [1, 2] }] },
    })
    const wrapper = mount(ChartRenderer, { props: { code: valid } })
    expect(wrapper.text()).not.toContain('Invalid')
    expect(wrapper.text()).not.toContain('missing')
  })
})
