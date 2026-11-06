// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PdfAttachmentCard from '~/components/PdfAttachment.vue'
import type { PdfAttachment } from '~/types'

const attachment: PdfAttachment = {
  name: 'quarterly-report.pdf',
  pages: 4,
  characters: 2500,
  truncated: false,
  text: 'Revenue grew by 12% this quarter.',
}

function mountCard(overrides: Partial<PdfAttachment> = {}) {
  return mount(PdfAttachmentCard, {
    props: { attachment: { ...attachment, ...overrides } },
    global: { stubs: { UIcon: true, UButton: true } },
  })
}

describe('PdfAttachment', () => {
  it('shows the file name and page count', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('quarterly-report.pdf')
    expect(wrapper.text()).toContain('4 pages')
    expect(wrapper.text()).toContain('2,500 chars')
  })

  it('keeps the extracted text collapsed by default', () => {
    const wrapper = mountCard()
    expect(wrapper.find('pre').exists()).toBe(false)
  })

  it('expands to show the extracted text', async () => {
    const wrapper = mountCard()
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('pre').exists()).toBe(true)
    expect(wrapper.find('pre').text()).toContain('Revenue grew by 12%')
  })

  it('flags truncated documents', () => {
    const wrapper = mountCard({ truncated: true, characters: 40000 })
    expect(wrapper.text()).toContain('text truncated')
  })
})
