// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  extractPdfText,
  looksLikePdf,
  PdfExtractionError,
  sanitizePdfName,
} from '~/server/utils/pdf'

// Builds a minimal, valid single-page PDF with a correct xref table.
function makePdf(lines: string[] = ['Hello PDF', 'Second line']): Buffer {
  const content = lines
    .map((line, i) => `BT /F1 18 Tf 40 ${700 - i * 30} Td (${line.replace(/[()\\]/g, '\\$&')}) Tj ET`)
    .join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets: number[] = []
  for (const [i, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(out))
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  }

  const xrefStart = Buffer.byteLength(out)
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

describe('sanitizePdfName', () => {
  it('keeps the file name and drops path components', () => {
    expect(sanitizePdfName('C:\\docs\\quarterly.pdf')).toBe('quarterly.pdf')
    expect(sanitizePdfName('../../etc/passwd.pdf')).toBe('passwd.pdf')
  })

  it('strips control characters and falls back for empty names', () => {
    expect(sanitizePdfName('a\u0000b.pdf')).toBe('ab.pdf')
    expect(sanitizePdfName('')).toBe('document.pdf')
    expect(sanitizePdfName(undefined)).toBe('document.pdf')
  })
})

describe('looksLikePdf', () => {
  it('detects the PDF header', () => {
    expect(looksLikePdf(new Uint8Array(makePdf()))).toBe(true)
  })

  it('rejects other data', () => {
    expect(looksLikePdf(new Uint8Array(Buffer.from('hello world')))).toBe(false)
  })
})

describe('extractPdfText', () => {
  it('extracts text with page markers', async () => {
    const result = await extractPdfText(new Uint8Array(makePdf()))
    expect(result.truncated).toBe(false)
    expect(result.pages).toBe(1)
    expect(result.text).toContain('--- Page 1 ---')
    expect(result.text).toContain('Hello PDF')
    expect(result.text).toContain('Second line')
    expect(result.characters).toBe(result.text.length)
  })

  it('truncates long text and marks it', async () => {
    const result = await extractPdfText(
      new Uint8Array(makePdf(['A'.repeat(200), 'B'.repeat(200)])),
      { maxChars: 100 },
    )
    expect(result.truncated).toBe(true)
    expect(result.text).toContain('[... text truncated at 100 characters ...]')
    expect(result.text.length).toBeLessThan(300)
  })

  it('rejects a non-PDF payload', async () => {
    await expect(extractPdfText(new Uint8Array(Buffer.from('not a pdf'))))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects PDFs with no text layer', async () => {
    await expect(extractPdfText(new Uint8Array(makePdf([]))))
      .rejects.toBeInstanceOf(PdfExtractionError)
    await expect(extractPdfText(new Uint8Array(makePdf([]))))
      .rejects.toMatchObject({ statusCode: 422 })
  })

  it('rejects documents above the page limit', async () => {
    await expect(extractPdfText(new Uint8Array(makePdf()), { maxPages: 0 }))
      .rejects.toMatchObject({ statusCode: 413 })
  })

  it('rejects corrupted data that carries a PDF header', async () => {
    const corrupt = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('garbage'.repeat(100))])
    await expect(extractPdfText(new Uint8Array(corrupt))).rejects.toBeInstanceOf(PdfExtractionError)
  })
})
