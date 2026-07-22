import { describe, it, expect, vi } from 'vitest'
import { useClipboard } from '../../composables/useClipboard'

describe('useClipboard', () => {
  it('initializes with copied=false', () => {
    const { copied } = useClipboard()
    expect(copied.value).toBe(false)
  })

  it('uses navigator.clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { copy, copied } = useClipboard()
    await copy('hello')

    expect(writeText).toHaveBeenCalledWith('hello')
    expect(copied.value).toBe(true)

    vi.unstubAllGlobals()
  })

  it('falls back to execCommand when clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined })
    document.execCommand = vi.fn().mockReturnValue(true)

    const { copy, copied } = useClipboard()
    await copy('test text')

    expect(copied.value).toBe(true)

    vi.unstubAllGlobals()
  })

  it('does nothing when text is empty', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { copy, copied } = useClipboard()
    await copy('')

    expect(writeText).not.toHaveBeenCalled()
    expect(copied.value).toBe(false)

    vi.unstubAllGlobals()
  })

  it('resets copied flag after timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    const { copy, copied } = useClipboard()
    await copy('text')
    expect(copied.value).toBe(true)

    vi.advanceTimersByTime(1600)
    expect(copied.value).toBe(false)

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})
