// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppSidebar from '~/components/AppSidebar.vue'

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    path: '/tmp/a.md',
    title: '',
    preview: 'Hello world',
    timestamp: '',
    totalTokens: 0,
    totalProcessingTimeMs: 0,
    ...overrides,
  }
}

describe('AppSidebar search & rename', () => {
  it('shows a custom title in preference to the preview', () => {
    const wrapper = mount(AppSidebar, {
      props: { sessions: [makeSession({ title: 'My Chat', preview: 'Hello world' })], open: true },
      global: { stubs: { UIcon: true, UButton: true } },
    })
    expect(wrapper.text()).toContain('My Chat')
  })

  it('emits search when typing in the search box', async () => {
    const wrapper = mount(AppSidebar, {
      props: { sessions: [makeSession()], open: true },
      global: { stubs: { UIcon: true, UButton: true } },
    })
    const input = wrapper.find('input[type="search"]')
    expect(input.exists()).toBe(true)
    await input.setValue('black holes')
    expect(wrapper.emitted('search')).toBeTruthy()
    expect(wrapper.emitted('search')![0]).toEqual(['black holes'])
  })

  it('enters inline rename mode and emits rename with the new title', async () => {
    const wrapper = mount(AppSidebar, {
      props: { sessions: [makeSession({ title: 'Old name' })], open: true },
      global: { stubs: { UIcon: true, UButton: true } },
    })

    const renameButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Rename conversation')
    expect(renameButton).toBeTruthy()
    await renameButton!.trigger('click')

    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)
    await input.setValue('Brand New Name')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('rename')).toBeTruthy()
    expect(wrapper.emitted('rename')![0]).toEqual(['1', 'Brand New Name'])
  })
})
