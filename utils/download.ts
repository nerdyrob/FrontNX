// Triggers a client-side download of text content. No-ops outside the browser
// (e.g. during SSR or in tests) so callers don't need environment guards.
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
