// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import {
  validateString,
  validateNonEmptyString,
  validateNumber,
  validatePlainObject,
  validateSessionMeta,
} from '~/server/utils/validation'

describe('validateString', () => {
  it('accepts valid strings', () => {
    expect(validateString('hello', 'test')).toBe('hello')
    expect(validateString('', 'test')).toBe('')
  })

  it('rejects non-strings', () => {
    expect(() => validateString(undefined, 'test')).toThrow()
    expect(() => validateString(null, 'test')).toThrow()
    expect(() => validateString(123, 'test')).toThrow()
    expect(() => validateString([], 'test')).toThrow()
  })
})

describe('validateNonEmptyString', () => {
  it('accepts non-empty strings', () => {
    expect(validateNonEmptyString('path', 'test')).toBe('path')
  })

  it('rejects empty strings', () => {
    expect(() => validateNonEmptyString('', 'test')).toThrow()
  })
})

describe('validateNumber', () => {
  it('accepts valid numbers', () => {
    expect(validateNumber(42, 'test')).toBe(42)
    expect(validateNumber(0, 'test')).toBe(0)
  })

  it('rejects non-numbers', () => {
    expect(() => validateNumber(NaN, 'test')).toThrow()
    expect(() => validateNumber('42', 'test')).toThrow()
    expect(() => validateNumber(undefined, 'test')).toThrow()
  })
})

describe('validatePlainObject', () => {
  it('accepts plain objects', () => {
    const obj = validatePlainObject({ a: 1 }, 'test')
    expect(obj.a).toBe(1)
  })

  it('rejects arrays and primitives', () => {
    expect(() => validatePlainObject([], 'test')).toThrow()
    expect(() => validatePlainObject(null, 'test')).toThrow()
    expect(() => validatePlainObject('string', 'test')).toThrow()
  })
})

describe('validateSessionMeta', () => {
  it('accepts valid meta', () => {
    const result = validateSessionMeta({
      model: 'gpt-4',
      service: 'OpenAI',
      created: '2026-01-01T00:00:00Z',
    })
    expect(result.model).toBe('gpt-4')
    expect(result.service).toBe('OpenAI')
  })

  it('rejects meta with missing fields', () => {
    expect(() => validateSessionMeta({})).toThrow()
    expect(() => validateSessionMeta({ model: 'gpt-4' })).toThrow()
  })
})
