// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import IndexPage from '~/pages/index.vue'

vi.mock('~/services/lm-studio.service', () => ({
  LmStudioService: vi.fn().mockImplementation(() => ({
    getModels: vi.fn().mockResolvedValue([{ id: 'test-model', object: 'model', created: 1, owned_by: 'test' }]),
    sendChat: vi.fn().mockResolvedValue({ content: '', status: 'complete' }),
  })),
}))

vi.mock('~/services/session.service', () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    buildMarkdown: vi.fn().mockReturnValue('# session'),
    parseMarkdown: vi.fn().mockReturnValue({
      meta: { model: '', service: '', created: '' },
      messages: [],
    }),
  })),
}))

globalThis.$fetch = vi.fn().mockResolvedValue([])

describe('IndexPage', () => {
  it('renders the app header with Frontnx branding', async () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          AppSidebar: true,
          ModelSelector: true,
          ChatInput: true,
          ChatMessage: true,
          UIcon: true,
          UButton: true,
        },
      },
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(wrapper.text()).toContain('Frontnx')
  })

  it('shows empty state when there are no messages', async () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          AppSidebar: true,
          ModelSelector: true,
          ChatInput: true,
          ChatMessage: true,
          UIcon: true,
          UButton: true,
        },
      },
    })
    await new Promise((r) => setTimeout(r, 50))
    const text = wrapper.text()
    const hasStart = text.includes('Start a conversation')
    const hasConnecting = text.includes('Connecting')
    expect(hasStart || hasConnecting).toBe(true)
  })

  it('renders sidebar component', async () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          AppSidebar: true,
          ModelSelector: true,
          ChatInput: true,
          ChatMessage: true,
          UIcon: true,
          UButton: true,
        },
      },
    })
    await new Promise((r) => setTimeout(r, 50))
    const sidebar = wrapper.findComponent({ name: 'AppSidebar' })
    expect(sidebar.exists()).toBe(true)
  })

  it('renders chat input component', async () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          AppSidebar: true,
          ModelSelector: true,
          ChatInput: true,
          ChatMessage: true,
          UIcon: true,
          UButton: true,
        },
      },
    })
    await new Promise((r) => setTimeout(r, 50))
    const input = wrapper.findComponent({ name: 'ChatInput' })
    expect(input.exists()).toBe(true)
  })
})
