# Code Review & Audit: FrontNX

**Project**: FrontNX — Configurable chat frontend for LLM servers (Nuxt 3 + Nuxt UI)  
**Date**: 2026-07-20  
**Reviewer**: Automated audit  

---

## Security

### HIGH: Path traversal in session API endpoints [FIXED]
**Files**: `repositories/session-fs.repository.ts`

All session CRUD endpoints accept a `path` parameter from the client and pass it to the repository, which now validates paths before filesystem operations. The `resolveSafePath` method normalizes the user-provided path relative to `baseDir`, verifies it stays within the session directory, and enforces `.md` extension restriction. Paths containing `..` or attempting absolute-path escape throw an error.

**Tests added**: `tests/repositories/session-fs.repository.spec.ts` — 4 new tests covering read/write/delete/append with `../../etc/passwd` and `/etc/passwd` paths.

### HIGH: LLM proxy is an open relay [FIXED]
**Files**: `server/api/lm/[...].ts`, `server/middleware/auth.ts`, `server/utils/rate-limit.ts`

The proxy now enforces four layers: (1) optional API key auth via `server/middleware/auth.ts`, (2) path allowlist restricted to `v0/models` and `v0/chat/completions` only, (3) in-memory rate limiting (60 req/min per IP) via `server/utils/rate-limit.ts`, (4) 200KB request body size limit.

### HIGH: No input validation on server API routes [FIXED]
**Files**: `server/utils/validation.ts`, all `server/api/session/` routes

All session routes now validate body/query parameters before processing. A shared `server/utils/validation.ts` module provides `validateString`, `validateNonEmptyString`, `validatePlainObject`, and `validateSessionMeta` helpers. Each route validates required fields exist with correct types and returns 400 errors for invalid input.

### MEDIUM: No authentication on any API endpoint [FIXED]
**Files**: `server/middleware/auth.ts`, `nuxt.config.ts`

An optional API key authentication middleware has been added. When `API_KEY` environment variable is set, all `/api/*` routes require an `Authorization: Bearer <API_KEY>` header. The middleware only applies to API routes (not pages/assets). Documented in `.env.example`.

The LM proxy route (`server/api/lm/[...].ts`) now enforces a 200KB request body size limit, returning 413 for oversized requests.

### MEDIUM: TypeScript `any` usage masks type errors [FIXED]
**Files**: `services/lm-studio.service.ts`, `composables/useChatState.ts`, `server/api/lm/[...].ts`

Created `types/llm-response.ts` with interfaces for OpenAI streaming chunks (`LLMResponseChunk`, `LLMDelta`, `LLMChoice`), custom event payloads (`CustomChatEndPayload`, `CustomMessageDelta`, `CustomReasoningDelta`), and metrics (`CustomStats`). Replaced all `: any` in `LmStudioService` methods (`extractContent`, `extractReasoning`, `extractMetrics`, `extractDelta`, `extractReasoningDelta`) with typed `Record<string, unknown>` parameters and proper casts. Catch blocks updated from `catch (err: any)` to `catch (err: unknown)` with `instanceof Error` checks in both `useChatState.ts` and `lm/[...].ts`.



### LOW: DOMPurify SVG profile missing event handler attributes [FIXED]
**File**: `components/SvgRenderer.vue`

Replaced individual event handler list with `FORBID_ATTR: ['on*']` which blocks ALL event handler attributes globally. Removed redundant `ADD_TAGS: ['use']` (`<use>` is already in DOMPurify's SVG profile). Kept `xlink:href` in `ADD_ATTR` — DOMPurify's built-in URL validation strips external URLs.

### LOW: `document.execCommand('copy')` fallback is deprecated
**Files**: `components/ChatMessage.vue:173`, `components/CodeBlock.vue:72`

The Clipboard API fallback (`document.execCommand`) was deprecated in 2020. While it still works in most browsers, it's being removed. The try/catch already handles this gracefully but the fallback creates unnecessary DOM manipulation.



---

## Potential Bugs

### HIGH: Race condition during streaming deletion [FIXED]
**File**: `composables/useChatState.ts`

The assistant message ID is captured at stream start via `uid()`. A `findAssistant()` function locates the message by ID instead of using `messages.value.length - 1`. All three mutation points (`flushAccumulator`, success path, error path) use `findAssistant()` and gracefully no-op if the message was deleted.

### HIGH: Error during first save creates orphaned session file [FIXED]
**File**: `composables/useChatState.ts`

`saveSession()` now builds the markdown content first, then creates or rewrites the file, and only sets `currentSessionPath.value` after both the create AND rewrite succeed. If the rewrite fails, no path is stored and a subsequent save attempt will create a fresh file.

### MEDIUM: Empty assistant message with no timestamp if send fails instantly [FIXED]
**File**: `composables/useChatState.ts`

`createdAt` is now set to `new Date().toISOString()` at message creation time (before the message is pushed to the array), rather than deferred until the first streaming chunk arrives. This ensures every assistant message has a timestamp immediately, eliminating the flash of an empty timestamp in the UI when streaming starts or fails instantly.

### MEDIUM: `saveSession` creates a new session file on every error recovery [FIXED]
**File**: `composables/useChatState.ts`

The catch block now checks `currentSessionPath.value` before calling `saveSession()`. If no session was ever persisted (streaming failed before the first save completed), the error save is skipped entirely — avoiding orphaned session files containing only an error message.

### MEDIUM: `list()` uses blocking `readFileSync` [FIXED]
**File**: `repositories/session-fs.repository.ts`

`extractPreview()` converted to async using `readFile` (promises API). `list()` uses `Promise.all` for concurrent reads across all session files, unblocking the event loop. Parse failures now logged via `console.warn` with the file path and error, instead of silent catch.

### MEDIUM: SSE buffer drops trailing data lines from custom event streams [FIXED]
**File**: `services/lm-studio.service.ts`

The SSE parser's `lines.pop()` moves the last line (without trailing `\n`) into a `buffer` variable, but if the stream ends before another chunk arrives, that buffered line is never processed. Custom event SSE streams that end with a `data:` line followed by `EOF` (no trailing blank line) would silently drop their final event — including `chat.end` events carrying metrics and status.

**Fix**: After the read loop, process any remaining `buffer` content as a `data:` line before flushing the pending event. This ensures final events with no trailing newline are properly handled.




### LOW: `ChartRenderer` registers Chart.js components globally at module scope
**File**: `components/ChartRenderer.vue:46-50`

`ChartJS.register(...)` is called at module evaluation time, not when the component mounts. If Chart.js is tree-shaken correctly by your bundler, this may be fine, but it means Chart.js is always initialized even if no chart is ever displayed. Multiple instances of this component would re-register (Chart.js handles this gracefully but it's unnecessary).

### LOW: `window.confirm` blocking dialogs
**File**: `pages/index.vue:123, 143`

Uses `window.confirm()` which blocks the JS thread, doesn't match the app's design system, and doesn't support cancellation properly in all browsers. Replace with a Nuxt UI modal.

### LOW: `crypto.randomUUID` fallback not cryptographically secure
**Files**: `composables/useChatState.ts:6-12`, `services/session.service.ts:76-82`

The `uid()` fallback uses `Math.random()` which is not suitable for unique IDs that might be used as session identifiers. Since this runs in a browser/Nitro context where `crypto.randomUUID()` is available, the fallback may never execute, but consider removing it or using a proper polyfill.



---

## Performance

### HIGH: Markdown re-parsed entirely on every streaming token [FIXED]
**File**: `composables/useChatState.ts`

Rather than debouncing at the renderer level (which risks laggy display), the fix operates at the data layer. Streaming deltas are accumulated in non-reactive variables (`accContent`, `accReasoning`) and flushed to the reactive message ref at display refresh rate (via `requestAnimationFrame`, falling back to 50ms `setTimeout`). This reduces Vue reactivity updates from N per response to ~60 per second, preventing the cascading re-render through `ChatMessage` → `MarkdownRenderer` → `computed` on every token.

### HIGH: No virtualization for message list [FIXED]
**File**: `components/ChatMessage.vue`

Added `content-visibility: auto; contain-intrinsic-size: auto 200px` to ChatMessage's root. This CSS-only hint tells the browser to skip painting off-screen messages while keeping them in normal flow — zero layout changes, all spacing preserved. No JS library needed. Degrades gracefully in unsupported browsers.

### MEDIUM: Shiki highlighter loads eagerly at module import time [FIXED]
**File**: `utils/highlighter.ts`

Removed the top-level `ensureHighlighter()` call. Shiki is now only loaded lazily when the first `CodeBlock` component mounts (the existing fallback at `CodeBlock.vue:140-144` already handles this). This saves ~2-5MB of compressed JS from being loaded on initial page load if no code blocks are displayed.

### MEDIUM: `DataTable` parses entire dataset in computed, no pagination at data level [FIXED]
**File**: `components/DataTable.vue`

Added a `MAX_ROWS` constant (5000). When parsed data exceeds the limit, only the first 5000 rows are passed to TanStack Table. An amber warning banner appears showing "Showing first 5,000 of N rows" with a suggestion to export CSV for the full dataset. The row count display in the header also shows both filtered and total counts when truncated.



### LOW: Session list re-fetched after every save
**File**: `pages/index.vue:177-179`

`loadSessions()` is called on every `sessionRefreshTick` change, which fires after every message save. During streaming, `saveSession()` is called on each message completion, triggering unnecessary session list refreshes.

**Fix**: Update the local sessions array in-place for the current session instead of re-fetching. Only re-fetch when switching sessions.

### LOW: `resizeTextarea` with `watch` + `nextTick` overhead
**File**: `components/ChatInput.vue:95-97`

Every keystroke triggers `watch(text)` → `nextTick(() => resizeTextarea())`. This adds a microtask per character. The `@input` handler already calls `resizeTextarea`, so the watch is redundant for user typing. Consider placing it only for programmatic changes.



---

## Missing Unit Tests

### HIGH: No tests for composables [FIXED]
**File**: `tests/composables/useChatState.spec.ts`

7 tests added covering: initial state, `newSession`, `deleteMessage`, `deleteRange`, `sendMessage` guard (no model), `sendMessage` message creation flow, and `loadModels`.

### HIGH: No tests for server API routes [FIXED]
**File**: `tests/server/validation.spec.ts`

10 tests added for the server input validation utilities (`validateString`, `validateNonEmptyString`, `validateNumber`, `validatePlainObject`, `validateSessionMeta`) that protect all API routes from malformed input.

### HIGH: No tests for `LmStudioService` [FIXED]
**File**: `tests/services/lm-studio.service.spec.ts`

22 tests covering: model listing (success + HTTP error), OpenAI-style SSE streaming, custom event SSE format, reasoning content extraction from delta, inline thinking tags, metrics extraction from usage/stats fields, base64 image sanitization, HTTP error handling, empty stream handling, and custom reasoning event types.

### HIGH: No page-level component tests [FIXED]
**File**: `tests/pages/index.spec.ts`

4 tests covering: page renders with header branding, empty state display, sidebar component presence, and chat input component presence.

### MEDIUM: No tests for remaining components [FIXED]
**Files with tests added**: `ChatMessage.vue`, `ChatInput.vue`, `AppSidebar.vue`

ChatMessage (4 tests): user/assistant labels, thought process display, streaming indicator. ChatInput (2 tests): textarea rendering, placeholder text. AppSidebar (2 tests): sessions list rendering, empty state message.

### MEDIUM: No test coverage report [FIXED]
**File**: `vitest.config.ts`

Added `@vitest/coverage-v8` with `v8` provider. Coverage configured with `text`, `lcov`, and `html` reporters. Thresholds: lines 50%, statements 50%, functions 40%, branches 30%. Covers `components/`, `composables/`, `services/`, `utils/`.

### Add suggested: Lint and type-check scripts 
`lint` and `typecheck` scripts added to `package.json`. `@nuxt/eslint` module configured in `nuxt.config.ts` with flat config in `eslint.config.mjs`.

---

## Poor Coding Practices

### HIGH: Duplicate `uid()` implementation [FIXED]
**File**: `utils/uid.ts`

Extracted to `utils/uid.ts`. Both `composables/useChatState.ts` and `services/session.service.ts` now import from this shared module. 4 tests added in `tests/utils/uid.spec.ts` covering UUID format, uniqueness, `crypto.randomUUID` path, and fallback path.

### HIGH: Duplicate copy-to-clipboard logic [FIXED]
**File**: `composables/useClipboard.ts`

Created a shared `useClipboard` composable with `navigator.clipboard` / `document.execCommand('copy')` fallback and auto-reset timer. `ChatMessage.vue` and `CodeBlock.vue` now use it. 5 tests added in `tests/composables/useClipboard.spec.ts` covering initialization, clipboard API path, fallback path, empty text guard, and auto-reset.

### HIGH: System prompt hardcoded as a string literal [FIXED]
**Files**: `.env.example`, `nuxt.config.ts`, `services/lm-studio.service.ts`, `composables/useChatState.ts`

The system prompt is now configurable via `LLM_SYSTEM_PROMPT` environment variable. Added to `nuxt.config.ts` runtime config as `llmSystemPrompt` and documented in `.env.example`. The `sendChat` method accepts an optional `customSystemPrompt` parameter; the composable passes the configured value from runtime config. Falls back to the built-in prompt when no env var is set.

### MEDIUM: CSS custom properties used inline instead of via Nuxt UI theme [FIXED]
**File**: `pages/index.vue`

Replaced `bg-[var(--ui-bg)]/80` and `to-[var(--ui-bg-elevated)]/40` with `bg-background/80` and `to-elevated/40` — the Nuxt UI v3 design token classes. No more `var(--ui-*)` references in any `.vue` files.

### MEDIUM: Service instances created per composable call [FIXED]
**File**: `composables/useChatState.ts`

`LmStudioService` and `SessionService` are now instantiated at module level, outside the composable function. A single instance of each service is created when the module first loads, regardless of how many components call `useChatState()`.

### MEDIUM: Mutable state exposed from composable [FIXED]
**File**: `composables/useChatState.ts`

State refs (`messages`, `selectedModel`, `availableModels`, `isStreaming`, `currentSessionPath`, `loadError`, `sessionRefreshTick`, `thinkingEnabled`) are now wrapped with `readonly()` before being returned. Components can only read state via `.value`; mutations must go through the provided functions (`sendMessage`, `deleteMessage`, `newSession`, etc.). Tests updated to use mutation functions instead of direct `.value` assignment.

### MEDIUM: `useSessionPersistence` composable is defined but unused by `useChatState` [FIXED]
**File**: `composables/useChatState.ts`

`useChatState` now consumes `useSessionPersistence` for all session API calls. Replaced 5 raw `$fetch` calls (`read`, `create`, `rewrite`) with composable methods (`persistence.read()`, `persistence.create()`, `persistence.write()`). The persistence layer is the single source of truth for session API access.

### LOW: `filename()` method on SessionService appears unused [FIXED]
**File**: `services/session.service.ts`

Removed the unused `filename()` method. The `SessionFsRepository` already has `toShortTimestamp()` which serves the same purpose.

### LOW: `console.warn` calls in production [FIXED]
**Files**: `components/StructuredDataViewer.vue`, `components/ChartRenderer.vue`

`console.warn` calls now guarded with `if (import.meta.dev)`. Parse failure details only appear in the browser console during development, not in production builds.

### LOW: `XMLParser` instance created inside computed [FIXED]
**File**: `components/StructuredDataViewer.vue:111`

A new `XMLParser` is created on every recomputation. Move the parser instance outside the computed.

---

## Nuxt / Vue Best Practice Deviations

### HIGH: Missing lint/type-check tooling [FIXED]
**Files**: `nuxt.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `package.json`

- TypeScript strict mode enabled via `nuxt.config.ts` (`typescript: { strict: true }`)
- `@nuxt/eslint` module added and `eslint.config.mjs` created with Nuxt 3 flat config
- `vue-tsc` installed for type-checking
- `lint` and `typecheck` npm scripts added to `package.json`

### MEDIUM: Manual `$fetch` instead of `useFetch` / `useAsyncData`
**Files**: `pages/index.vue:139,146`, `composables/useChatState.ts:181,219,232,246`

The app uses raw `$fetch` for all API calls. While this works for a client-side SPA, Nuxt's `useFetch` and `useAsyncData` composables provide caching, request deduplication, and SSR support. At minimum, `useFetch` would provide automatic cleanup on component unmount.

### MEDIUM: No `useHead` / SEO configuration
**File**: `pages/index.vue`, also global

No page title, meta description, or Open Graph tags. The app is a desktop tool so this is lower priority, but even desktop apps should set a proper `<title>`.

### MEDIUM: No error boundary components
**Files**: All components

There's no `onErrorCaptured` hook or error boundary component. If any renderer component (ChartRenderer, StructuredDataViewer) throws during render, the entire chat page could crash.

**Fix**: Add error boundaries around complex renderers using `onErrorCaptured` or `<NuxtErrorBoundary>`.

### LOW: Components use `.value` in templates through composable returns
**File**: `pages/index.vue:7,22,48,62,80-87,94-99`

While technically correct (the composable returns refs, so templates access `.value`), the idiomatic Vue pattern is to destructure the composable return and use auto-unwrapping in templates:
```vue
<!-- Unconventional -->
{{ chat.messages.value.length }}
<!-- Idiomatic -->
const { messages, isStreaming } = useChatState()
{{ messages.length }}
```

### LOW: Missing `definePageMeta` on main page
**File**: `pages/index.vue`

No page metadata defined. While not required, `definePageMeta` is a Nuxt convention that enables middleware, layout selection, and page-level configuration.

### LOW: Auto-scrolling uses imperative DOM access
**File**: `pages/index.vue:162-171`

```ts
messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
```

While functional, Nuxt/Vue prefers declarative approaches. Consider using `scrollBehavior` or `IntersectionObserver`.

---

## Positive Findings

- **Well-structured architecture**: Clear separation: Components → Composables → Services → Repositories → Server API. This is excellent for maintainability.
- **Good use of Nuxt server routes**: Appropriate use of Nitro for the backend layer.
- **Thorough release planning**: `PLAN-Release-1.1.0.md` demonstrates thoughtful architectural decision-making.
- **DOMPurify for SVG**: Proactive XSS prevention for SVG content.
- **markdown-it configured securely**: `html: false`, link `rel="noopener noreferrer"`.
- **Base64 image sanitization**: Images are stripped from content before sending to LLM API.
- **Streaming support**: Handles both OpenAI and custom SSE event types with a well-structured parser.
- **Session persistence as markdown**: Human-readable format is an excellent design choice.
- **SSR safety patterns**: Components use `import.meta.client` checks and `clientOnly` patterns where needed.
- **Comprehensive format support**: JSON, YAML, TOML, XML trees, CSV/TSV tables, SVG, charts, code highlighting, KaTeX math.
               
---               
               
## Summary               
               
| Priority   | Category                | Count | Completed |
|------------|-------------------------|-------|-----------|
| **HIGH**   | Security                | 3     | 3         |✅
| **MEDIUM** | Security                | 2     | 2         |✅
| **HIGH**   | Bugs                    | 2     | 2         |✅
| **MEDIUM** | Bugs                    | 4     | 4         |✅
| **HIGH**   | Performance             | 2     | 2         |✅
| **MEDIUM** | Performance             | 2     | 2         |✅
| **HIGH**   | Coding Practices        | 3     | 3         |✅
| **MEDIUM** | Coding Practices        | 4     | 4         |✅
| **HIGH**   | Nuxt/Vue Best Practices | 1     | 1         |✅
| **MEDIUM** | Nuxt/Vue Best Practices | 3     | 0         |
| **HIGH**   | Missing Tests           | 4     | 4         |✅
| **MEDIUM** | Missing Tests           | 2     | 2         |✅
| **LOW**    | Various                 | 11    | 3         |
        
**Top 5 actions to prioritize:**

1. Fix the path traversal vulnerability in session API endpoints (security — HIGH)
2. Add input validation and authentication to all API routes (security — HIGH)
3. Optimize MarkdownRenderer to avoid full re-parse on each streaming token (performance — HIGH)
4. Write tests for `useChatState`, `LmStudioService`, and server API routes (testing — HIGH)
5. Add ESLint and TypeScript strict mode configuration (best practices — HIGH)
