// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownRenderer from '~/components/MarkdownRenderer.vue'

describe('MarkdownRenderer', () => {
  it('renders plain text unchanged', () => {
    const wrapper = mount(MarkdownRenderer, { props: { content: 'Hello world' } })
    expect(wrapper.text()).toContain('Hello world')
  })

  it('renders code fences as CodeBlock components', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '```js\nconsole.log("hi")\n```' },
    })
    expect(wrapper.findComponent({ name: 'CodeBlock' }).exists()).toBe(true)
  })

  it('renders inline code as plain html', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: 'Use `code` inline' },
    })
    expect(wrapper.html()).toContain('<code>')
  })

  it('mixes prose and code blocks correctly', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: 'Some text\n\n```py\nx = 1\n```\n\nMore text' },
    })
    expect(wrapper.text()).toContain('Some text')
    expect(wrapper.findComponent({ name: 'CodeBlock' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('More text')
  })

  it('renders empty string as empty', () => {
    const wrapper = mount(MarkdownRenderer, { props: { content: '' } })
    expect(wrapper.text()).toBe('')
  })
})
