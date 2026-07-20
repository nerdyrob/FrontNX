// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeBlock from '~/components/CodeBlock.vue'

vi.mock('~/utils/highlighter', () => ({
  highlightCode: vi.fn((code: string, lang: string) => {
    if (lang === 'js') {
      return { html: '<pre class="shiki"><code class="language-js">console.log("hi")</code></pre>' }
    }
    return { html: '' }
  }),
  ensureHighlighter: vi.fn(() => Promise.resolve({})),
}))

describe('CodeBlock', () => {
  it('renders code and displays language badge', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'console.log("hi")', lang: 'js' },
    })
    expect(wrapper.text()).toContain('JavaScript')
    expect(wrapper.html()).toContain('console.log')
  })

  it('renders copy button', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'test', lang: '' },
    })
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
  })

  it('falls back to plain pre when highlighting unavailable', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'plain text', lang: 'unknown' },
    })
    const pre = wrapper.find('pre')
    expect(pre.exists()).toBe(true)
    expect(pre.text()).toBe('plain text')
  })

  it('renders empty string for empty code', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: '', lang: '' },
    })
    expect(wrapper.find('.code-block-wrapper').exists()).toBe(true)
  })

  it('shows generic label when lang is empty', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'hello', lang: '' },
    })
    const badge = wrapper.find('.uppercase')
    expect(badge.text()).toBe('')
  })
})
