// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeBlockActions from '~/components/CodeBlockActions.vue'

describe('CodeBlockActions', () => {
  it('shows format and validate buttons for SQL', () => {
    const wrapper = mount(CodeBlockActions, {
      props: { code: 'SELECT * FROM t', lang: 'sql', modelValue: 'SELECT * FROM t' },
    })
    expect(wrapper.find('button[aria-label="Format"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Validate syntax"]').exists()).toBe(true)
  })

  it('hidden for unsupported languages', () => {
    const wrapper = mount(CodeBlockActions, {
      props: { code: 'const x = 1', lang: 'js', modelValue: 'const x = 1' },
    })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('validate detects mismatched parens in SQL', async () => {
    const wrapper = mount(CodeBlockActions, {
      props: { code: 'SELECT * FROM t WHERE (a = 1', lang: 'sql', modelValue: '' },
    })
    await wrapper.find('button[aria-label="Validate syntax"]').trigger('click')
    expect(wrapper.text()).toContain('Mismatched')
    expect(wrapper.text()).toContain('1 open')
    expect(wrapper.text()).toContain('0 close')
  })

  it('validate passes for valid SQL', async () => {
    const wrapper = mount(CodeBlockActions, {
      props: { code: 'SELECT * FROM t WHERE a = 1', lang: 'sql', modelValue: '' },
    })
    await wrapper.find('button[aria-label="Validate syntax"]').trigger('click')
    expect(wrapper.text()).toContain('Valid')
  })

  it('validate detects mismatched braces in GraphQL', async () => {
    const wrapper = mount(CodeBlockActions, {
      props: { code: 'query { user { name }', lang: 'graphql', modelValue: '' },
    })
    await wrapper.find('button[aria-label="Validate syntax"]').trigger('click')
    expect(wrapper.text()).toContain('Mismatched')
  })

  it('format emits updated value for SQL', async () => {
    const wrapper = mount(CodeBlockActions, {
      props: { code: 'SELECT * FROM t WHERE a=1', lang: 'sql', modelValue: 'SELECT * FROM t WHERE a=1' },
    })
    await wrapper.find('button[aria-label="Format"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue')![0][0] as string
    expect(emitted).toContain('SELECT')
    expect(emitted).toContain('FROM')
    expect(emitted).toContain('\n')
  })

  it('emits raw code on toggle back', async () => {
    const wrapper = mount(CodeBlockActions, {
      props: { code: 'SELECT * FROM t', lang: 'sql', modelValue: 'SELECT * FROM t' },
    })
    await wrapper.find('button[aria-label="Format"]').trigger('click')
    await wrapper.find('button[aria-label="Show raw"]').trigger('click')
    const events = wrapper.emitted('update:modelValue')!
    expect(events[events.length - 1][0]).toBe('SELECT * FROM t')
  })
})
