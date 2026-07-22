// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatInput from '~/components/ChatInput.vue'

describe('ChatInput', () => {
  it('renders the textarea', () => {
    const wrapper = mount(ChatInput, {
      global: { stubs: { UIcon: true, UButton: true } },
    })
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('shows the input placeholder', () => {
    const wrapper = mount(ChatInput, {
      global: { stubs: { UIcon: true, UButton: true } },
    })
    const textarea = wrapper.find('textarea')
    expect(textarea.attributes('placeholder')).toBe('Type a message…')
  })
})
