# Chat Frontend for LM Studio

## Stack
- **Framework:** [Nuxt 3](https://nuxt.com) (Vue 3, Nitro server)
- **UI Library:** [Nuxt UI](https://ui.nuxt.com) (based on Reka UI / Tailwind)
- **Language:** TypeScript
- **Markdown:** `front-matter` + custom writer for session files

## LM Studio API (OpenAI-compatible)

LM Studio runs a local server at `http://localhost:1234` by default, exposing:

- `GET /v1/models` — list downloaded models
- `POST /v1/chat/completions` — stream or non-stream completions

---

## Architecture — Layered Separation

```
UI (pages / components)
      ↓
composables  (thin Vue bridges — reactive state, orchestration)
      ↓
services     (business logic, API calls)
      ↓
repositories (data persistence)
      ↓
types        (interfaces / models — no logic)
```

Each layer depends only on the layer below it. Composables wire services/repositories to reactive state for Vue.

---

## Types (`types/`)

Pure TypeScript interfaces — no logic, no Vue, no imports from other layers.

| File | Contents |
|---|---|
| `types/model.ts` | `ModelOption { id, object, created, owned_by }` |
| `types/chat.ts` | `ChatMessage { id, role, content, model?, createdAt }`, `SessionMeta { model, service, created }` |
| `types/config.ts` | `AppConfig { lmStudioBaseUrl }` |

---

## Services (`services/`)

Plain TypeScript classes/functions — business logic + API calls. No Vue reactivity. Return promises.

**`services/lm-studio.service.ts`**

- `LmStudioService` class (instantiated once, configurable base URL)
- `getModels(): Promise<ModelOption[]>` — `GET /v1/models`
- `sendChat(messages, model, onChunk, signal): Promise<string>` — `POST /v1/chat/completions` (streaming)
  - Reads `ReadableStream`, calls `onChunk(delta)` for each token
  - Supports `AbortSignal` for cancellation
  - Returns full response text

**`services/session.service.ts`**

- `SessionService` class
- `createSession(meta: SessionMeta): Promise<string>` — delegates to repository
- `buildMarkdown(messages, meta): string` — formats conversation as markdown
- `parseMarkdown(content): { meta, messages }` — reverse parse

---

## Repositories (`repositories/`)

Persistence layer — abstracts *where* data lives. Implementations swap without changing services.

**`repositories/session.repository.ts`** (interface)

```ts
interface ISessionRepository {
  create(meta: SessionMeta): Promise<string>       // returns file path
  read(path: string): Promise<string>              // raw markdown
  write(path: string, content: string): Promise<void>
  append(path: string, block: string): Promise<void>
}
```

**`repositories/session-fs.repository.ts`** — Nitro server-side filesystem impl

- Uses `fs/promises` in Nitro server routes
- Saves to `~/chat-sessions/`
- Filename: `YYYY-MM-DD_HHmmss_modelId.md`

**`repositories/session-api.repository.ts`** — client-side impl

- Calls Nuxt server routes (`/api/session/*`) which delegate to FS repository
- or, for static SPA, uses `localStorage` / IndexedDB fallback

---

## Composables (`composables/`)

Thin Vue bridges — wrap services in reactive refs. Keep logic to a minimum; delegate to services.

**`composables/useChatState.ts`**

- `messages: Ref<ChatMessage[]>` — current conversation
- `selectedModel: Ref<string>` — active model ID
- `availableModels: Ref<ModelOption[]>` — fetched list
- `isStreaming: Ref<boolean>`
- `currentSessionPath: Ref<string | null>`
- Actions delegate to services:
  - `loadModels()` → calls `lmStudioService.getModels()`
  - `sendMessage(text)` → calls `lmStudioService.sendChat()`, pushes messages
  - `saveSession()` → calls `sessionService.buildMarkdown()`, writes via repo
  - `deleteMessage(index)`, `deleteRange(start, end)` → mutates array, rewrites session
  - `clearChat()` → resets, optionally deletes session file
  - `newSession()` → calls `sessionService.createSession()`, resets messages

**`composables/useSessionPersistence.ts`**

- Thin bridge to `ISessionRepository`
- `save(path, messages, meta)`, `load(path)`, `append(path, entry)`

---

## Phase Breakdown

### Phase 1 — Scaffold

1. Create Nuxt app (`npx nuxi init .`)
2. Install Nuxt UI (`npx nuxt module add @nuxt/ui`)
3. Configure `nuxt.config.ts` with `@nuxt/ui` module
4. Set `runtimeConfig.public.lmStudioBaseUrl` default `http://localhost:1234`
5. **Install Vitest** — `npm i -D vitest @vue/test-utils @nuxt/test-utils happy-dom`
6. Add `vitest.config.ts` and `nuxt.config.ts` `vitest` integration

### Phase 2 — Types

Create `types/model.ts`, `types/chat.ts`, `types/config.ts`.

### Phase 3 — Services

Create `services/lm-studio.service.ts` and `services/session.service.ts`.

### Phase 4 — Repositories

Create `repositories/session.repository.ts` (interface) and `repositories/session-fs.repository.ts` (server-side). Add server API routes in `server/api/session/` that proxy to the FS repository.

### Phase 5 — Composables

Create `composables/useChatState.ts` and `composables/useSessionPersistence.ts`.

### Phase 6 — Testing

- Unit tests for services and repositories (`services/*.spec.ts`, `repositories/*.spec.ts`)
- Component tests for UI components (`components/*.spec.ts`) using `@vue/test-utils` + `@nuxt/test-utils`
- Composable tests for state logic (`composables/*.spec.ts`)
- Run via `vitest` (watch mode with `vitest`, CI with `vitest run`)
- Coverage threshold configured in `vitest.config.ts`

### Phase 7 — UI Components

- `pages/index.vue` — main layout
- `components/ChatMessage.vue` — message bubble with hover delete
- `components/ChatInput.vue` — textarea + send/stop
- `components/ModelSelector.vue` — dropdown from available models
- `components/SessionActions.vue` — clear, new chat

### Phase 8 — Streaming & Polish

- Streaming display with cursor indicator
- Abort button
- Error handling (connection refused, model not loaded)
- Code copy button
- Markdown rendering in assistant messages
- Auto-scroll
- Keyboard shortcuts (Enter send, Shift+Enter newline)

---

## File Structure (expected)

```
frontnx/
├── app.vue
├── nuxt.config.ts
├── package.json
├── plan.md
├── .gitignore
├── vitest.config.ts
├── types/
│   ├── model.ts
│   ├── chat.ts
│   └── config.ts
├── services/
│   ├── lm-studio.service.ts
│   └── session.service.ts
├── repositories/
│   ├── session.repository.ts        (interface)
│   ├── session-fs.repository.ts     (server filesystem)
│   └── session-api.repository.ts    (client → server proxy)
├── composables/
│   ├── useChatState.ts
│   └── useSessionPersistence.ts
├── tests/
│   ├── services/
│   │   ├── lm-studio.service.spec.ts
│   │   └── session.service.spec.ts
│   ├── repositories/
│   │   └── session-fs.repository.spec.ts
│   ├── composables/
│   │   ├── useChatState.spec.ts
│   │   └── useSessionPersistence.spec.ts
│   └── components/
│       ├── ChatMessage.spec.ts
│       ├── ChatInput.spec.ts
│       ├── ModelSelector.spec.ts
│       └── SessionActions.spec.ts
├── components/
│   ├── ChatMessage.vue
│   ├── ChatInput.vue
│   ├── ModelSelector.vue
│   └── SessionActions.vue
├── pages/
│   └── index.vue
├── server/
│   └── api/
│       └── session/
│           ├── create.post.ts
│           ├── append.post.ts
│           ├── rewrite.post.ts
│           └── read.get.ts
└── public/
    └── favicon.ico
```

---

## Markdown Session File Format

```markdown
---
model: llama-3.2-3b-instruct
service: LM Studio
created: 2026-07-13T17:30:00Z
---

## 2026-07-13T17:30:00Z — User

Message content here…

## 2026-07-13T17:30:05Z — Assistant (llama-3.2-3b-instruct)

Response content here…
```

---

## Considerations

- **CORS:** Enable CORS in LM Studio settings.
- **Model switch mid-conversation:** Each message records its generating model. Switching only affects the *next* assistant reply.
- **Streaming fallback:** If streaming fails, retry with non-streaming (`stream: false`).
- **Context:** Full message array sent each request (OpenAI stateless style). Markdown file is the persistence source of truth.
- **Persistence strategy:** Server API routes handle file I/O. If deploying as static SPA, swap to `session-api.repository.ts` which proxies through Nitro, or use localStorage.
