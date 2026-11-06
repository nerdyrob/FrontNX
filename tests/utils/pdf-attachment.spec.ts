import { describe, it, expect } from 'vitest'
import type { PdfAttachment } from '~/types'
import {
  buildPdfAttachmentBlock,
  collapsePdfAttachmentBlocks,
  extractPdfAttachmentBlocks,
  formatPdfBlocksForCopy,
  restoreAttachmentPayloads,
  stripAttachmentPayloads,
} from '~/utils/pdf-attachment'

function makeAttachment(overrides: Partial<PdfAttachment> = {}): PdfAttachment {
  return {
    name: 'report.pdf',
    pages: 2,
    characters: 24,
    truncated: false,
    text: 'line one\nline two',
    ...overrides,
  }
}

describe('pdf-attachment', () => {
  it('builds a fence that carries the attachment metadata', () => {
    const block = buildPdfAttachmentBlock(makeAttachment())
    expect(block).toContain('```pdf-attachment {"name":"report.pdf","pages":2')
    expect(block).toContain('line one\nline two')
    expect(block.trimEnd().endsWith('```')).toBe(true)
  })

  it('uses a longer fence when the text contains backtick runs', () => {
    const block = buildPdfAttachmentBlock(makeAttachment({
      text: 'before\n```js\nconst x = 1\n```\nafter',
    }))
    expect(block.startsWith('````pdf-attachment')).toBe(true)
    expect(block.trimEnd().endsWith('````')).toBe(true)
  })

  it('extracts attachments and leaves placeholders for the renderer', () => {
    const block = buildPdfAttachmentBlock(makeAttachment())
    const result = extractPdfAttachmentBlocks(`Summarize this\n\n${block}\n\nThanks`)

    expect(result.attachments).toHaveLength(1)
    expect(result.attachments[0]).toMatchObject({
      name: 'report.pdf',
      pages: 2,
      truncated: false,
      text: 'line one\nline two',
    })
    expect(result.content).toContain('%%PDFATTACH_0%%')
    expect(result.content).toContain('Summarize this')
    expect(result.content).toContain('Thanks')
  })

  it('round-trips text with backticks through the fence', () => {
    const text = 'before\n```js\nconst x = 1\n```\nafter'
    const result = extractPdfAttachmentBlocks(buildPdfAttachmentBlock(makeAttachment({ text })))
    expect(result.attachments[0].text).toBe(text)
  })

  it('leaves malformed blocks for the regular code renderer', () => {
    const malformed = '```pdf-attachment not-json\nsome text\n```'
    const result = extractPdfAttachmentBlocks(malformed)
    expect(result.attachments).toHaveLength(0)
    expect(result.content).toBe(malformed)
  })

  it('strips PDF blocks and base64 images for editing, then restores them', () => {
    const block = buildPdfAttachmentBlock(makeAttachment())
    const content = `Explain this\n\n${block}\n\n![image](data:image/png;base64,AAAA)`

    const stripped = stripAttachmentPayloads(content)
    expect(stripped.text).toBe('Explain this')
    expect(stripped.attachments).toHaveLength(2)

    const restored = restoreAttachmentPayloads('Updated text', stripped.attachments)
    expect(restored).toContain('Updated text')
    expect(restored).toContain(block)
    expect(restored).toContain('data:image/png;base64,AAAA')
  })

  it('collapses PDF blocks for session previews', () => {
    const block = buildPdfAttachmentBlock(makeAttachment())
    const preview = collapsePdfAttachmentBlocks(`Summarize\n\n${block}\n\nThanks`)
    expect(preview).toContain('[pdf]')
    expect(preview).not.toContain('line one')
    expect(preview).toContain('Summarize')
  })

  it('formats PDF blocks as readable text for the clipboard', () => {
    const block = buildPdfAttachmentBlock(makeAttachment({ pages: 1 }))
    const copy = formatPdfBlocksForCopy(`Look at this\n\n${block}`)
    expect(copy).toContain('[PDF: report.pdf, 1 page]')
    expect(copy).toContain('line one')
    expect(copy).not.toContain('pdf-attachment')
  })
})
