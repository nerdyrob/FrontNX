// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatSettings from '~/components/ChatSettings.vue'

function mountSettings(props: Record<string, unknown> = {}) {
  return mount(ChatSettings, {
    props: {
      temperature: null,
      maxTokens: null,
      topP: null,
      systemPrompt: '',
      ...props,
    },
    global: { stubs: { UIcon: true, UButton: true } },
  })
}

describe('ChatSettings', () => {
  it('emits update:temperature with a parsed number', async () => {
    const wrapper = mountSettings()
    const temperature = wrapper.find('input[type="range"]')
    await temperature.setValue('0.5')
    expect(wrapper.emitted('update:temperature')).toBeTruthy()
    expect(wrapper.emitted('update:temperature')![0]).toEqual([0.5])
  })

  it('emits update:topP with a parsed number', async () => {
    const wrapper = mountSettings()
    const ranges = wrapper.findAll('input[type="range"]')
    // Second range is top-p.
    await ranges[1].setValue('0.25')
    expect(wrapper.emitted('update:topP')).toBeTruthy()
    expect(wrapper.emitted('update:topP')![0]).toEqual([0.25])
  })

  it('emits update:maxTokens and null when cleared', async () => {
    const wrapper = mountSettings({ maxTokens: 512 })
    const input = wrapper.find('input[type="number"]')
    await input.setValue('2048')
    expect(wrapper.emitted('update:maxTokens')![0]).toEqual([2048])

    await input.setValue('')
    expect(wrapper.emitted('update:maxTokens')![1]).toEqual([null])
  })

  it('emits update:systemPrompt as the raw text', async () => {
    const wrapper = mountSettings()
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Be concise')
    expect(wrapper.emitted('update:systemPrompt')).toBeTruthy()
    expect(wrapper.emitted('update:systemPrompt')![0]).toEqual(['Be concise'])
  })

  it('reset buttons emit null for the parameter', async () => {
    const wrapper = mountSettings({ temperature: 0.7, topP: 0.9 })
    const resetButtons = wrapper.findAll('button')
    const tempReset = resetButtons.find(b => b.attributes('title') === 'Reset to default')
    expect(tempReset).toBeTruthy()
    await tempReset!.trigger('click')
    expect(wrapper.emitted('update:temperature')).toBeTruthy()
    expect(wrapper.emitted('update:temperature')![0]).toEqual([null])
  })
})
