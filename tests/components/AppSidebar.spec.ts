// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppSidebar from '~/components/AppSidebar.vue'

describe('AppSidebar', () => {
  it('renders sessions list when open', () => {
    const sessions = [{ id: '1', path: '/tmp/a.md', title: 'Session 1', preview: 'Hello', timestamp: '', totalTokens: 0, totalProcessingTimeMs: 0 }]
    const wrapper = mount(AppSidebar, {
      props: { sessions, open: true },
      global: { stubs: { UIcon: true, UButton: true } },
    })
    expect(wrapper.text()).toContain('Sessions')
    expect(wrapper.text()).toContain('Hello')
  })

  it('shows empty state when no sessions', () => {
    const wrapper = mount(AppSidebar, {
      props: { sessions: [], open: true },
      global: { stubs: { UIcon: true, UButton: true } },
    })
    expect(wrapper.text()).toContain('No sessions yet')
  })
})
