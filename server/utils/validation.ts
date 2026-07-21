export function validateString(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, message: `"${name}" must be a string` })
  }
  return value
}

export function validateNonEmptyString(value: unknown, name: string): string {
  const str = validateString(value, name)
  if (str.length === 0) {
    throw createError({ statusCode: 400, message: `"${name}" must not be empty` })
  }
  return str
}

export function validateNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw createError({ statusCode: 400, message: `"${name}" must be a number` })
  }
  return value
}

export function validatePlainObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw createError({ statusCode: 400, message: `"${name}" must be a plain object` })
  }
  return value as Record<string, unknown>
}

export function validateSessionMeta(value: unknown): { model: string; service: string; created: string } {
  const obj = validatePlainObject(value, 'meta')
  return {
    model: validateString(obj.model, 'meta.model'),
    service: validateString(obj.service, 'meta.service'),
    created: validateString(obj.created, 'meta.created'),
  }
}
