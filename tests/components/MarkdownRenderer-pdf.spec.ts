// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownRenderer from '~/components/MarkdownRenderer.vue'
import { buildPdfAttachmentBlock } from '~/utils/pdf-attachment'

const block = buildPdfAttachmentBlock({
  name: 'report.pdf',
  pages: 2,
  characters: 20,
  truncated: false,
  text: 'First page\nSecond page',
})

describe('MarkdownRenderer PDF attachments', () => {
  it('renders a PDF block as an attachment card', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: `Summarize this:\n\n${block}` },
    })
    const card = wrapper.findComponent({ name: 'PdfAttachment' })
    expect(card.exists()).toBe(true)
    expect(card.props('attachment')).toMatchObject({ name: 'report.pdf', pages: 2 })
    expect(wrapper.text()).toContain('Summarize this')
    expect(wrapper.findComponent({ name: 'CodeBlock' }).exists()).toBe(false)
  })

  it('renders the card for backtick-heavy PDF text', () => {
    const tricky = buildPdfAttachmentBlock({
      name: 'code.pdf',
      pages: 1,
      characters: 20,
      truncated: false,
      text: '```js\nconst x = 1\n```',
    })
    const wrapper = mount(MarkdownRenderer, { props: { content: tricky } })
    const card = wrapper.findComponent({ name: 'PdfAttachment' })
    expect(card.exists()).toBe(true)
    expect(card.props('attachment').text).toContain('const x = 1')
  })

  it('falls back to a code block for malformed attachment fences', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '```pdf-attachment not-json\nsome text\n```' },
    })
    expect(wrapper.findComponent({ name: 'PdfAttachment' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'CodeBlock' }).exists()).toBe(true)
  })
})
