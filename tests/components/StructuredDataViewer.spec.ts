// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StructuredDataViewer from '~/components/StructuredDataViewer.vue'

describe('StructuredDataViewer', () => {
  it('renders valid JSON as collapsible tree', () => {
    const wrapper = mount(StructuredDataViewer, {
      props: { code: '{"name": "test", "count": 42}', lang: 'json' },
    })
    expect(wrapper.text()).toContain('name')
    expect(wrapper.text()).toContain('test')
  })

  it('toggles between raw and tree views', async () => {
    const wrapper = mount(StructuredDataViewer, {
      props: { code: '{"x": 1}', lang: 'json' },
    })
    const buttons = wrapper.findAll('button[role="tab"]')
    const rawBtn = buttons.find(b => b.text() === 'Raw')
    expect(rawBtn).toBeTruthy()
    await rawBtn!.trigger('click')
    expect(wrapper.find('pre').exists()).toBe(true)
    expect(wrapper.find('pre').text()).toContain('{"x": 1}')
  })

  it('shows raw view for invalid JSON', () => {
    const wrapper = mount(StructuredDataViewer, {
      props: { code: '{invalid}', lang: 'json' },
    })
    expect(wrapper.find('pre').exists()).toBe(true)
    expect(wrapper.text()).toContain('{invalid}')
  })

  it('renders YAML input correctly', () => {
    const wrapper = mount(StructuredDataViewer, {
      props: { code: 'name: Alice\nage: 30', lang: 'yaml' },
    })
    expect(wrapper.text()).toContain('name')
    expect(wrapper.text()).toContain('Alice')
  })

  it('renders XML input with expandable tree', async () => {
    const wrapper = mount(StructuredDataViewer, {
      props: { code: '<root><item id="1">hello</item></root>', lang: 'xml' },
    })
    const treeBtn = wrapper.findAll('button[role="tab"]').find(b => b.text() === 'Tree')
    await treeBtn!.trigger('click')
    expect(wrapper.text()).toContain('root')
    const treeItems = wrapper.findAll('[role="treeitem"]')
    expect(treeItems.length).toBe(1)
    await treeItems[0].trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('item')
    const subItems = wrapper.findAll('[role="treeitem"]')
    await subItems[1].trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('[0]')
    const subItems2 = wrapper.findAll('[role="treeitem"]')
    await subItems2[2].trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('#text')
    expect(wrapper.text()).toContain('hello')
  })

  it('shows size warning for large payloads', () => {
    const large = JSON.stringify({ data: 'x'.repeat(600 * 1024) })
    const wrapper = mount(StructuredDataViewer, {
      props: { code: large, lang: 'json' },
    })
    expect(wrapper.text()).toContain('Large file')
  })

  it('renders empty object', () => {
    const wrapper = mount(StructuredDataViewer, {
      props: { code: '{}', lang: 'json' },
    })
    expect(wrapper.text()).toContain('{}')
  })

  it('renders TOML input correctly', () => {
    const wrapper = mount(StructuredDataViewer, {
      props: { code: 'title = "example"\n[owner]\nname = "Tom"', lang: 'toml' },
    })
    expect(wrapper.text()).toContain('title')
    expect(wrapper.text()).toContain('example')
  })
})
