// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatInput from '~/components/ChatInput.vue'

describe('ChatInput image attach', () => {
  const originalFileReader = globalThis.FileReader

  afterEach(() => {
    globalThis.FileReader = originalFileReader
  })

  function mockFileReader(dataUrl: string) {
    class MockFileReader {
      result = dataUrl
      onload: (() => void) | null = null
      readAsDataURL() {
        this.onload?.()
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader
  }

  it('renders an attach button and a hidden image file input', () => {
    const wrapper = mount(ChatInput, {
      global: { stubs: { UIcon: true, UButton: true } },
    })
    const attachButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Attach image')
    expect(attachButton).toBeTruthy()

    const fileInput = wrapper.find('input[type="file"]')
    expect(fileInput.exists()).toBe(true)
    expect(fileInput.attributes('accept')).toBe('image/*')
  })

  it('emits a send payload with images when an image is attached', async () => {
    const dataUrl = 'data:image/png;base64,AAAA'
    mockFileReader(dataUrl)

    const wrapper = mount(ChatInput, {
      global: { stubs: { UIcon: true, UButton: true } },
    })

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })
    await fileInput.trigger('change')
    await nextTick()

    // A preview thumbnail should appear.
    expect(wrapper.find('img').exists()).toBe(true)

    await wrapper.find('textarea').setValue('describe this')
    await wrapper.find('textarea').trigger('keydown.enter')

    const sent = wrapper.emitted('send')
    expect(sent).toBeTruthy()
    expect(sent![0][0]).toEqual({ text: 'describe this', images: [dataUrl] })
  })

  it('removes an attached image preview', async () => {
    const dataUrl = 'data:image/png;base64,AAAA'
    mockFileReader(dataUrl)

    const wrapper = mount(ChatInput, {
      global: { stubs: { UIcon: true, UButton: true } },
    })

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })
    await fileInput.trigger('change')
    await nextTick()
    expect(wrapper.find('img').exists()).toBe(true)

    const removeButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Remove image')
    expect(removeButton).toBeTruthy()
    await removeButton!.trigger('click')
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
