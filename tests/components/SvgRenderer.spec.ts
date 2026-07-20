// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SvgRenderer from '~/components/SvgRenderer.vue'

describe('SvgRenderer', () => {
  const validSvg = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="green" /></svg>'

  it('renders valid SVG visually', () => {
    const wrapper = mount(SvgRenderer, { props: { code: validSvg } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('circle').exists()).toBe(true)
  })

  it('strips script tags', () => {
    const malicious = '<svg><script>alert("xss")</script><rect width="100" height="100" /></svg>'
    const wrapper = mount(SvgRenderer, { props: { code: malicious } })
    expect(wrapper.html()).not.toContain('script')
    expect(wrapper.find('rect').exists()).toBe(true)
  })

  it('does not render for empty string', () => {
    const wrapper = mount(SvgRenderer, { props: { code: '' } })
    expect(wrapper.text()).toContain('No SVG content')
  })

  it('shows download button', () => {
    const wrapper = mount(SvgRenderer, { props: { code: validSvg } })
    const btn = wrapper.find('button[aria-label="Download SVG"]')
    expect(btn.exists()).toBe(true)
  })
})
