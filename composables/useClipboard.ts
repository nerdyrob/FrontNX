import { ref, onBeforeUnmount } from 'vue'

export function useClipboard() {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function copy(text: string): Promise<void> {
    if (!text) return

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const el = document.createElement('textarea')
        el.value = text
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }

      copied.value = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { copied.value = false }, 1500)
    } catch {
      copied.value = false
    }
  }

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })

  return { copied, copy }
}
