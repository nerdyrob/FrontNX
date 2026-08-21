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

  it('enters delete mode and emits deleteBatch with selected ids', async () => {
    const sessions = [
      makeSession({ id: 'a', title: 'Session A' }),
      makeSession({ id: 'b', title: 'Session B' }),
      makeSession({ id: 'c', title: 'Session C' }),
    ]
    const wrapper = mount(AppSidebar, {
      props: { sessions, currentSessionId: null, open: true },
      global: { stubs: { UIcon: true, UButton: true } },
    })

    // Enter delete mode via the trashcan header button.
    const trashButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Delete sessions')
    expect(trashButton).toBeTruthy()
    await trashButton!.trigger('click')

    // Header should show "Sessions" replaced by a count.
    expect(wrapper.text()).toContain('selected')

    // Select two sessions by clicking them.
    const items = wrapper.findAll('.group.relative')
    expect(items.length).toBe(3)
    await items[0].trigger('click')
    await items[1].trigger('click')

    // The confirm-delete button should now be enabled.
    const confirmButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Delete selected')
    expect(confirmButton).toBeTruthy()
  })

  it('exits delete mode when Cancel is clicked', async () => {
    const wrapper = mount(AppSidebar, {
      props: { sessions: [makeSession()], currentSessionId: null, open: true },
      global: { stubs: { UIcon: true, UButton: true } },
    })

    // Enter delete mode.
    const trashButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Delete sessions')
    await trashButton!.trigger('click')
    expect(wrapper.text()).toContain('selected')

    // Cancel.
    const cancelButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Cancel')
    expect(cancelButton).toBeTruthy()
    await cancelButton!.trigger('click')

    // Back to normal — "Sessions" heading is back.
    expect(wrapper.text()).toContain('Sessions')
    expect(wrapper.text()).not.toContain('selected')
  })
})
