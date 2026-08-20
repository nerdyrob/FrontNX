export function useSessionPersistence() {
  async function create(meta: { model: string; service: string; created: string }) {
    return $fetch<{ path: string }>('/api/session/create', {
      method: 'POST',
      body: { meta },
    })
  }

  async function read(path: string) {
    return $fetch<{ content: string }>('/api/session/read', {
      params: { path },
    })
  }

  async function write(path: string, content: string) {
    return $fetch('/api/session/rewrite', {
      method: 'POST',
      body: { path, content },
    })
  }

  return { create, read, write }
}
