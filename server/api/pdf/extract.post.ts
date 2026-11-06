import { extractPdfText, PdfExtractionError, sanitizePdfName } from '~/server/utils/pdf'
import { readRawBodyCapped } from '~/server/utils/read-body'

export default defineEventHandler(async (event) => {
  checkRateLimit(event)

  const config = useRuntimeConfig()
  const maxBytes = Number(config.public.maxPdfFileBytes) || 20 * 1024 * 1024
  const maxChars = Number(config.public.maxPdfTextChars) || 40_000
  const maxPages = Number(config.public.maxPdfPages) || 200
  const name = sanitizePdfName(getQuery(event).name)

  const raw = await readRawBodyCapped(event, maxBytes)
  if (!raw) {
    throw createError({ statusCode: 400, message: 'No PDF data was received.' })
  }

  try {
    const extracted = await extractPdfText(new Uint8Array(raw), { maxChars, maxPages })
    return { name, ...extracted }
  } catch (err) {
    if (err instanceof PdfExtractionError) {
      throw createError({ statusCode: err.statusCode, message: err.message })
    }
    console.error('PDF extraction failed:', err)
    throw createError({ statusCode: 422, message: 'Could not read this PDF.' })
  }
})
