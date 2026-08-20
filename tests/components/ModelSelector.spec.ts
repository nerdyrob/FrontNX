// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModelSelector from '~/components/ModelSelector.vue'
import type { ModelOption } from '~/types'

const models: ModelOption[] = [
  { id: 'model-a', object: 'model', created: 1, owned_by: 'test' },
  { id: 'model-b', object: 'model', created: 1, owned_by: 'test' },
]

describe('ModelSelector placeholder (#4 Minor/UX)', () => {
  it('shows the placeholder when no model is selected', () => {
    const wrapper = mount(ModelSelector, { props: { models, modelValue: '' } })
    const options = wrapper.findAll('option')
    expect(options.some(o => o.text() === 'Select model')).toBe(true)
  })

  it('hides the placeholder once a model is selected', () => {
    const wrapper = mount(ModelSelector, { props: { models, modelValue: 'model-a' } })
    const options = wrapper.findAll('option')
    expect(options.some(o => o.text() === 'Select model')).toBe(false)
    expect(options.some(o => o.text() === 'model-a')).toBe(true)
  })
})
