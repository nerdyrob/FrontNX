import { describe, it, expect, vi } from 'vitest'
import { uid } from '../../utils/uid'

describe('uid', () => {
  it('returns a string in UUID format', () => {
    const id = uid()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()))
    expect(ids.size).toBe(100)
  })

  it('uses crypto.randomUUID when available', () => {
    const mock = vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000000')
    vi.stubGlobal('crypto', { randomUUID: mock })
    expect(uid()).toBe('00000000-0000-4000-8000-000000000000')
    expect(mock).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('falls back to Math.random when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined)
    const id = uid()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    vi.unstubAllGlobals()
  })
})
