import { extractText, getDocumentProxy } from 'unpdf'

export interface PdfExtractionResult {
  pages: number
  characters: number
  truncated: boolean
  text: string
}

export interface PdfExtractionOptions {
  maxChars?: number
  maxPages?: number
}

export class PdfExtractionError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 422) {
    super(message)
    this.name = 'PdfExtractionError'
    this.statusCode = statusCode
  }
}

export function looksLikePdf(data: Uint8Array): boolean {
  const head = Buffer.from(data.subarray(0, 1024)).toString('latin1')
  return head.includes('%PDF-')
}

// Strips path components and control characters from a client-supplied name
// before it is echoed back or persisted in a message.
export function sanitizePdfName(value: unknown): string {
  const raw = typeof value === 'string' ? value : ''
  const base = raw.split(/[\\/]/).pop() ?? ''
  const cleaned = base
    .replace(/[\p{Cc}]/gu, '')
    .trim()
    .slice(0, 200)
  return cleaned || 'document.pdf'
}

// Extracts selectable text from a PDF. PDFs are untrusted input, so eval,
// font faces and system fonts are disabled. Scanned/image-only PDFs have no
// text layer and are reported as unprocessable rather than silently empty.
export async function extractPdfText(
  data: Uint8Array,
  options: PdfExtractionOptions = {},
): Promise<PdfExtractionResult> {
  const maxChars = options.maxChars ?? 40_000
  const maxPages = options.maxPages ?? 200

  if (data.byteLength === 0) {
    throw new PdfExtractionError('The PDF is empty.', 400)
  }
  if (!looksLikePdf(data)) {
    throw new PdfExtractionError('This file does not look like a PDF.', 400)
  }

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>
  try {
    pdf = await getDocumentProxy(data, {
      verbosity: 0,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
    })
  } catch {
    throw new PdfExtractionError('Could not open the PDF. It may be corrupted or password-protected.')
  }

  try {
    if (pdf.numPages > maxPages) {
      throw new PdfExtractionError(
        `This PDF has ${pdf.numPages} pages; the limit is ${maxPages}.`,
        413,
      )
    }

    const { totalPages, text } = await extractText(pdf, { mergePages: false })
    const pages = (Array.isArray(text) ? text : [text]).map((page) =>
      page.replace(/\r\n?/g, '\n').trim(),
    )
    const populated = pages.filter(Boolean)

    if (populated.length === 0) {
      throw new PdfExtractionError(
        'No extractable text was found. Scanned or image-only PDFs are not supported.',
      )
    }

    const joined = pages
      .map((page, index) => (page ? `--- Page ${index + 1} ---\n${page}` : ''))
      .filter(Boolean)
      .join('\n\n')

    if (joined.length <= maxChars) {
      return {
        pages: totalPages,
        characters: joined.length,
        truncated: false,
        text: joined,
      }
    }

    // Prefer cutting at a line boundary so the truncation marker does not
    // split a sentence in the middle.
    const newline = joined.lastIndexOf('\n', maxChars)
    const cutAt = newline > maxChars * 0.8 ? newline : maxChars
    const truncatedText = `${joined.slice(0, cutAt).trimEnd()}\n\n[... text truncated at ${maxChars} characters ...]`

    return {
      pages: totalPages,
      characters: truncatedText.length,
      truncated: true,
      text: truncatedText,
    }
  } catch (err) {
    if (err instanceof PdfExtractionError) throw err
    throw new PdfExtractionError('Could not extract text from this PDF.')
  } finally {
    await pdf.destroy().catch(() => {})
  }
}
