// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessage from '~/components/ChatMessage.vue'

function makeMsg(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    role: 'user',
    content: 'Hello',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('ChatMessage', () => {
  it('shows the user role label', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: makeMsg(), index: 0 },
      global: { stubs: { MarkdownRenderer: true, UIcon: true, UButton: true } },
    })
    expect(wrapper.text()).toContain('You')
  })

  it('shows assistant label for assistant messages', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: 'Hi' }),
        index: 0,
      },
      global: { stubs: { MarkdownRenderer: true, UIcon: true, UButton: true } },
    })
    expect(wrapper.text()).toContain('Assistant')
  })

  it('shows thought process when message has thinking content', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: 'Answer', thinking: 'Step by step' }),
        index: 0,
      },
      global: { stubs: { MarkdownRenderer: true, UIcon: true, UButton: true } },
    })
    expect(wrapper.text()).toContain('Thought process')
  })

  it('shows processing dots on streaming last message with empty content', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: '', createdAt: '' }),
        index: 0,
        isLast: true,
        streaming: true,
      },
      global: { stubs: { MarkdownRenderer: true, UIcon: true, UButton: true } },
    })
    expect(wrapper.text()).toContain('Thinking')
  })

  it('strips stray </thinking> tags from the displayed content', () => {
    const content = '<thinking>\nLet me think…\n</thinking>\n\nThe bird is a Common Loon.\n</thinking>'
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content }),
        index: 0,
      },
      global: { stubs: { MarkdownRenderer: true, UIcon: true, UButton: true } },
    })
    // The stray </thinking> should not leak into the rendered text.
    expect(wrapper.text()).not.toContain('</thinking>')
  })
})
