// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Base64Image from '~/components/Base64Image.vue'

function makeBase64(bytes: number, mime: string = 'image/png'): string {
  const raw = 'A'.repeat(bytes)
  const b64 = btoa(raw)
  return `data:${mime};base64,${b64}`
}

describe('Base64Image', () => {
  it('renders valid base64 image with correct src', () => {
    const src = makeBase64(100)
    const wrapper = mount(Base64Image, { props: { src, alt: 'test' } })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(src)
    expect(img.attributes('alt')).toBe('test')
  })

  it('adds loading="lazy" attribute', () => {
    const src = makeBase64(100)
    const wrapper = mount(Base64Image, { props: { src } })
    expect(wrapper.find('img').attributes('loading')).toBe('lazy')
  })

  it('shows size warning for oversized images (>10 MB)', () => {
    const src = makeBase64(11 * 1024 * 1024)
    const wrapper = mount(Base64Image, { props: { src } })
    expect(wrapper.text()).toContain('too large')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('shows error for invalid base64 string', () => {
    const wrapper = mount(Base64Image, { props: { src: 'data:image/png;base64,!!!invalid' } })
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('renders empty for empty src', () => {
    const wrapper = mount(Base64Image, { props: { src: '' } })
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('download button exists', () => {
    const src = makeBase64(100, 'image/webp')
    const wrapper = mount(Base64Image, { props: { src } })
    const btn = wrapper.find('button[aria-label*="Download"]')
    expect(btn.exists()).toBe(true)
  })
})
