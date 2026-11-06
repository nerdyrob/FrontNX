// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ChatInput from '~/components/ChatInput.vue'
import type { PdfAttachment } from '~/types'

const extracted: PdfAttachment = {
  name: 'report.pdf',
  pages: 3,
  characters: 1234,
  truncated: false,
  text: 'Extracted PDF body',
}

function mountInput() {
  return mount(ChatInput, {
    props: { streaming: false },
    global: { stubs: { UIcon: true, UButton: true } },
  })
}

async function selectPdf(wrapper: ReturnType<typeof mountInput>, file: File) {
  const input = wrapper.findAll('input[type="file"]').find(i => i.attributes('accept') === 'application/pdf,.pdf')
  expect(input).toBeTruthy()
  Object.defineProperty(input!.element, 'files', { value: [file], configurable: true })
  await input!.trigger('change')
  await flushPromises()
}

describe('ChatInput PDF attach', () => {
  beforeEach(() => {
    globalThis.$fetch = vi.fn().mockResolvedValue(extracted)
  })

  it('renders a PDF attach button and a hidden PDF input', () => {
    const wrapper = mountInput()
    const button = wrapper.findAll('button').find(b => b.attributes('title') === 'Attach PDF')
    expect(button).toBeTruthy()

    const inputs = wrapper.findAll('input[type="file"]')
    expect(inputs).toHaveLength(2)
    expect(inputs[1].attributes('accept')).toBe('application/pdf,.pdf')
  })

  it('uploads a PDF and emits it with the message', async () => {
    const wrapper = mountInput()
    const file = new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' })

    await selectPdf(wrapper, file)

    expect(globalThis.$fetch).toHaveBeenCalledWith(
      '/api/pdf/extract',
      expect.objectContaining({ method: 'POST', body: file }),
    )
    expect(wrapper.text()).toContain('report.pdf')
    expect(wrapper.text()).toContain('3p')

    await wrapper.find('textarea').setValue('summarize this')
    await wrapper.find('textarea').trigger('keydown.enter')

    const sent = wrapper.emitted('send')
    expect(sent).toBeTruthy()
    expect(sent![0][0]).toEqual({
      text: 'summarize this',
      images: [],
      pdfs: [extracted],
    })
  })

  it('allows sending a PDF without any text', async () => {
    const wrapper = mountInput()
    await selectPdf(wrapper, new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' }))

    await wrapper.find('textarea').trigger('keydown.enter')

    const sent = wrapper.emitted('send')
    expect(sent).toBeTruthy()
    expect(sent![0][0]).toMatchObject({ text: '', pdfs: [extracted] })
  })

  it('rejects files that are not PDFs', async () => {
    const wrapper = mountInput()
    const vm = wrapper.vm as unknown as { uploadPdf: (file: File) => Promise<void> }
    await vm.uploadPdf(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    await flushPromises()

    expect(wrapper.text()).toContain('is not a PDF')
    expect(globalThis.$fetch).not.toHaveBeenCalled()
  })

  it('rejects PDFs above the size limit without uploading', async () => {
    const wrapper = mountInput()
    const vm = wrapper.vm as unknown as { uploadPdf: (file: File) => Promise<void> }
    const file = new File(['x'], 'huge.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 21 * 1024 * 1024 })

    await vm.uploadPdf(file)
    await flushPromises()

    expect(wrapper.text()).toContain('larger than the 20 MB limit')
    expect(globalThis.$fetch).not.toHaveBeenCalled()
  })

  it('shows an extraction error returned by the server', async () => {
    globalThis.$fetch = vi.fn().mockRejectedValue({
      data: { message: 'No extractable text was found.' },
    })

    const wrapper = mountInput()
    await selectPdf(wrapper, new File(['%PDF-1.4'], 'scan.pdf', { type: 'application/pdf' }))

    expect(wrapper.text()).toContain('Could not add "scan.pdf"')
    expect(wrapper.text()).toContain('No extractable text was found.')
  })

  it('removes an attached PDF', async () => {
    const wrapper = mountInput()
    await selectPdf(wrapper, new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' }))
    expect(wrapper.text()).toContain('report.pdf')

    const removeButton = wrapper.findAll('button').find(b => b.attributes('title') === 'Remove PDF')
    expect(removeButton).toBeTruthy()
    await removeButton!.trigger('click')
    expect(wrapper.text()).not.toContain('report.pdf')
  })
})
