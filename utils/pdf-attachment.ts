import type { PdfAttachment } from '~/types'

// Info string used on the fenced block that carries extracted PDF text in a
// message. Keeping the metadata in the fence info line means the block is
// still readable in the session markdown and survives export/import.
export const PDF_FENCE_INFO = 'pdf-attachment'

// Matches a PDF attachment fence. The fence is at least three backticks and
// the closing fence must match the opening one, so extracted text containing
// shorter backtick runs cannot terminate the block early.
export function createPdfBlockRegex(): RegExp {
  return /(`{3,})pdf-attachment[ \t]+(\{[^\n]*\})\r?\n([\s\S]*?)\r?\n\1(?=\r?\n|$)/g
}

// Matches either a PDF attachment block or an inline markdown image with a
// base64 data URL. Used when a message is edited or copied so the payloads do
// not end up in the textarea or the clipboard.
export function createAttachmentRegex(): RegExp {
  return /(`{3,})pdf-attachment[^\n]*\r?\n[\s\S]*?\r?\n\1|!\[[^\]]*\]\(data:image\/[^)\s]+\)/g
}

function longestBacktickRun(text: string): number {
  const runs = text.match(/`+/g)
  if (!runs) return 2
  return runs.reduce((longest, run) => Math.max(longest, run.length), 2)
}

function parsePdfAttachment(metaRaw: string, body: string): PdfAttachment | null {
  try {
    const meta = JSON.parse(metaRaw) as Record<string, unknown>
    const text = body.replace(/\r\n?/g, '\n').trim()
    return {
      name: typeof meta.name === 'string' && meta.name ? meta.name : 'document.pdf',
      pages: typeof meta.pages === 'number' && Number.isFinite(meta.pages) ? meta.pages : 0,
      characters: typeof meta.characters === 'number' && Number.isFinite(meta.characters)
        ? meta.characters
        : text.length,
      truncated: meta.truncated === true,
      text,
    }
  } catch {
    return null
  }
}

// Serializes an attachment for storage in the message content. The fence is
// one backtick longer than the longest run in the text.
export function buildPdfAttachmentBlock(pdf: PdfAttachment): string {
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(pdf.text) + 1))
  const meta = JSON.stringify({
    name: pdf.name,
    pages: pdf.pages,
    characters: pdf.characters,
    truncated: pdf.truncated,
  })
  const body = pdf.text.replace(/\r\n?/g, '\n').trim()
  return `${fence}${PDF_FENCE_INFO} ${meta}\n${body}\n${fence}`
}

// Replaces each valid PDF block with a placeholder so MarkdownRenderer can
// extract it before markdown-it sees the fence. Invalid blocks are left alone
// and fall back to a normal code block.
export function extractPdfAttachmentBlocks(content: string): {
  content: string
  attachments: PdfAttachment[]
} {
  const attachments: PdfAttachment[] = []
  const text = content.replace(createPdfBlockRegex(), (match, _fence: string, metaRaw: string, body: string) => {
    const attachment = parsePdfAttachment(metaRaw, body)
    if (!attachment) return match
    attachments.push(attachment)
    return `%%PDFATTACH_${attachments.length - 1}%%`
  })
  return { content: text, attachments }
}

// Removes attachment payloads (PDF text and base64 images) from a message so
// they do not appear in the edit textarea. Returns them so they can be put back
// unchanged when the edit is saved.
export function stripAttachmentPayloads(content: string): { text: string; attachments: string[] } {
  const attachments: string[] = []
  const text = content.replace(createAttachmentRegex(), (match) => {
    attachments.push(match)
    return ''
  })
  return {
    text: text.replace(/\n{3,}/g, '\n\n').trim(),
    attachments,
  }
}

export function restoreAttachmentPayloads(text: string, attachments: string[]): string {
  const body = text.trim()
  if (attachments.length === 0) return body
  return [body, ...attachments].filter(Boolean).join('\n\n')
}

// Replaces PDF blocks with a short marker, used by session previews so a long
// document does not become the sidebar preview.
export function collapsePdfAttachmentBlocks(content: string): string {
  return content.replace(createPdfBlockRegex(), '[pdf]')
}

// Renders PDF blocks as readable plain text for the clipboard.
export function formatPdfBlocksForCopy(content: string): string {
  return content.replace(createPdfBlockRegex(), (match, _fence: string, metaRaw: string, body: string) => {
    const attachment = parsePdfAttachment(metaRaw, body)
    if (!attachment) return match
    const pages = attachment.pages === 1 ? '1 page' : `${attachment.pages} pages`
    return `[PDF: ${attachment.name}, ${pages}]\n${attachment.text}`
  })
}
