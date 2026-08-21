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

describe('ChatMessage edit & regenerate', () => {
  it('emits edit with the new text when saved', async () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ content: 'Original' }),
        index: 0,
      },
      global: { stubs: { MarkdownRenderer: true, UIcon: true, UButton: true } },
    })

    // Enter edit mode via the pencil button.
    const editButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Edit message')
    expect(editButton).toBeTruthy()
    await editButton!.trigger('click')

    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue('Updated text')

    const saveButton = wrapper.findAll('button').find(b => b.text() === 'Save & regenerate')
    expect(saveButton).toBeTruthy()
    await saveButton!.trigger('click')

    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')![0]).toEqual([0, 'Updated text'])
  })

  it('emits regenerate for an assistant message', async () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: 'Hi' }),
        index: 1,
        streaming: false,
      },
      global: { stubs: { MarkdownRenderer: true, UIcon: true, UButton: true } },
    })

    const regenButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Regenerate response')
    expect(regenButton).toBeTruthy()
    await regenButton!.trigger('click')

    expect(wrapper.emitted('regenerate')).toBeTruthy()
    expect(wrapper.emitted('regenerate')![0]).toEqual([1])
  })

  it('does not show the regenerate button while the assistant is streaming', async () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: 'Hi' }),
        index: 1,
        streaming: true,
      },
      global: { stubs: { MarkdownRenderer: true, UIcon: true, UButton: true } },
    })

    const regenButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Regenerate response')
    expect(regenButton).toBeFalsy()
  })
})
