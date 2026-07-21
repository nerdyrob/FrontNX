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

### HIGH: LLM proxy is an open relay
**File**: `server/api/lm/[...].ts`

The catch-all proxy forwards any request to the configured LLM server with zero authentication, rate limiting, or path restrictions. Any client that can reach this server can use it as a relay to the LLM backend, potentially exhausting quotas, sending abusive content, or probing internal services.

**Fix**: Add authentication (even a simple API key check via environment variable) and rate limiting. Consider restricting accepted methods and paths. Implement request size limits.
```ts
// Add early in the handler
if (body && JSON.stringify(body).length > 100_000) {
  throw createError({ statusCode: 413, message: 'Request too large' })
}
```

### HIGH: No input validation on server API routes [FIXED]
**Files**: `server/utils/validation.ts`, all `server/api/session/` routes

All session routes now validate body/query parameters before processing. A shared `server/utils/validation.ts` module provides `validateString`, `validateNonEmptyString`, `validatePlainObject`, and `validateSessionMeta` helpers. Each route validates required fields exist with correct types and returns 400 errors for invalid input.

### MEDIUM: No authentication on any API endpoint [FIXED]
**Files**: `server/middleware/auth.ts`, `nuxt.config.ts`

An optional API key authentication middleware has been added. When `API_KEY` environment variable is set, all `/api/*` routes require an `Authorization: Bearer <API_KEY>` header. The middleware only applies to API routes (not pages/assets). Documented in `.env.example`.

The LM proxy route (`server/api/lm/[...].ts`) now enforces a 200KB request body size limit, returning 413 for oversized requests.

### MEDIUM: TypeScript `any` usage masks type errors
**Files**: `services/lm-studio.service.ts:23,52,57`, `composables/useChatState.ts:60,80,154,188`

Extensive use of `any` in critical parsing functions (`extractContent`, `extractReasoning`, `extractMetrics`) and error handlers. This defeats TypeScript's type safety entirely in the most security-sensitive code paths (JSON parsing of LLM responses).

**Fix**: Define interfaces for the expected LLM API response shapes and use type guards/narrowing.

### LOW: DOMPurify SVG profile missing event handler attributes
**File**: `components/SvgRenderer.vue:37-43`

The `FORBID_ATTR` list only covers `onerror`, `onload`, `onclick`, `onmouseover`, `onmouseout` but misses `onfocus`, `onblur`, `oninput`, `onchange`, `onscroll`, `onbegin`, `onend`, etc. The `ADD_TAGS: ['use']` combined with `xlink:href` could enable external resource loading.

**Fix**: Use `FORBID_ATTR: ['on*']` or add the missing event handler attributes. Consider removing `ADD_TAGS: ['use']` or sanitizing `xlink:href` values.

### LOW: `document.execCommand('copy')` fallback is deprecated
**Files**: `components/ChatMessage.vue:173`, `components/CodeBlock.vue:72`

The Clipboard API fallback (`document.execCommand`) was deprecated in 2020. While it still works in most browsers, it's being removed. The try/catch already handles this gracefully but the fallback creates unnecessary DOM manipulation.

---

## Potential Bugs

### HIGH: Race condition during streaming deletion
**File**: `composables/useChatState.ts:101-112`

The stream callback accesses `messages.value[messages.value.length - 1]` to append deltas. If a message is deleted during streaming (via `deleteMessage`), the wrong message could receive content, or the index could be out of bounds.

**Fix**: Capture a reference to the assistant message ID at the start of streaming and find the message by ID in the callback, or lock deletions while streaming.

### HIGH: Error during first save creates orphaned session file
**File**: `composables/useChatState.ts:212-237`

`saveSession()` creates a new session file via POST (line 219-222), then immediately rewrites it. If the rewrite fails, the file exists but `currentSessionPath.value` is already set. The next save will rewrite without creating a new file, so recovery is possible, but if the user refreshes before the next save, the orphan exists.

**Fix**: Only set `currentSessionPath.value` after the first rewrite succeeds. Consider using the append endpoint for incremental streaming saves instead of full rewrites.

### MEDIUM: Empty assistant message with no timestamp if send fails instantly
**File**: `composables/useChatState.ts:86-96, 154-167`

An empty assistant message is pushed with `createdAt: ''` before streaming starts (line 90). If the `sendChat` call throws before any content arrives, the error handler checks `if (last.role === 'assistant')` and sets content/status but never sets `createdAt` if it's already set to a falsey value. It does set it (line 158) in the catch block now — actually, re-reading, it does set `last.createdAt` at line 158. This is fine. However, the empty message with no content could briefly flash "Thinking..." in the UI before the error content replaces it.

### MEDIUM: `saveSession` creates a new session file on every error recovery
**File**: `composables/useChatState.ts:154-176`

If streaming fails and `saveSession()` is called in the catch block (line 168-172), it may trigger another save that creates a new session file if `currentSessionPath` was never set (e.g., the first create POST succeeded but `currentSessionPath` wasn't assigned because... actually it is assigned at line 223). However, if the chat errored before the first user-message save completed, `currentSessionPath` would be null and the error save would create a new, empty session file.

### MEDIUM: `list()` uses blocking `readFileSync`
**File**: `repositories/session-fs.repository.ts:105`

`extractPreview()` uses `readFileSync` for every session file. For a large number of sessions, this blocks the Nitro server's event loop. Parse errors are silently caught (line 118), returning empty preview data without logging.

**Fix**: Use `readFile` (async) with `Promise.all`. Log parse failures at warn level.

### LOW: `ChartRenderer` registers Chart.js components globally at module scope
**File**: `components/ChartRenderer.vue:46-50`

`ChartJS.register(...)` is called at module evaluation time, not when the component mounts. If Chart.js is tree-shaken correctly by your bundler, this may be fine, but it means Chart.js is always initialized even if no chart is ever displayed. Multiple instances of this component would re-register (Chart.js handles this gracefully but it's unnecessary).

### LOW: `window.confirm` blocking dialogs
**File**: `pages/index.vue:123, 143`

Uses `window.confirm()` which blocks the JS thread, doesn't match the app's design system, and doesn't support cancellation properly in all browsers. Replace with a Nuxt UI modal.

### MEDIUM: SSE buffer drops trailing data lines from custom event streams [FIXED]
**File**: `services/lm-studio.service.ts`

The SSE parser's `lines.pop()` moves the last line (without trailing `\n`) into a `buffer` variable, but if the stream ends before another chunk arrives, that buffered line is never processed. Custom event SSE streams that end with a `data:` line followed by `EOF` (no trailing blank line) would silently drop their final event — including `chat.end` events carrying metrics and status.

**Fix**: After the read loop, process any remaining `buffer` content as a `data:` line before flushing the pending event. This ensures final events with no trailing newline are properly handled.

### LOW: `crypto.randomUUID` fallback not cryptographically secure
**Files**: `composables/useChatState.ts:6-12`, `services/session.service.ts:76-82`

The `uid()` fallback uses `Math.random()` which is not suitable for unique IDs that might be used as session identifiers. Since this runs in a browser/Nitro context where `crypto.randomUUID()` is available, the fallback may never execute, but consider removing it or using a proper polyfill.

---

## Performance

### HIGH: Markdown re-parsed entirely on every streaming token [FIXED]
**File**: `composables/useChatState.ts`

Rather than debouncing at the renderer level (which risks laggy display), the fix operates at the data layer. Streaming deltas are accumulated in non-reactive variables (`accContent`, `accReasoning`) and flushed to the reactive message ref at display refresh rate (via `requestAnimationFrame`, falling back to 50ms `setTimeout`). This reduces Vue reactivity updates from N per response to ~60 per second, preventing the cascading re-render through `ChatMessage` → `MarkdownRenderer` → `computed` on every token.

### HIGH: No virtualization for message list
**File**: `pages/index.vue:80-88`

All messages are rendered in the DOM simultaneously via `v-for`. Long conversations (100+ messages) with complex content (code blocks, tables, charts, SVGs) will cause significant memory and rendering overhead.

**Fix**: Implement virtual scrolling using `@tanstack/vue-virtual` or a similar library, or add a "load more" pagination.

### MEDIUM: Shiki highlighter loads eagerly at module import time
**File**: `utils/highlighter.ts:28`

`ensureHighlighter()` is called at module evaluation time (top-level), loading all 32 languages and 2 themes. Shiki with this many languages can be 2-5MB compressed. This delays initial page load even if the user never sees a code block.

**Fix**: Only call `ensureHighlighter()` when a `CodeBlock` component is actually mounted (it already does this as a fallback at `CodeBlock.vue:140-144`). Remove the top-level call at line 28.

### MEDIUM: `DataTable` parses entire dataset in computed, no pagination at data level
**File**: `components/DataTable.vue:149-156`

PapaParse parses the entire CSV string in a computed property. For large CSV files (e.g., 100k+ rows), this creates a massive JavaScript array and all rows are held in memory. TanStack Table provides client-side pagination but the data is still fully parsed.

**Fix**: Add a configurable maximum row limit. For very large datasets, warn the user or truncate.

### LOW: Session list re-fetched after every save
**File**: `pages/index.vue:177-179`

`loadSessions()` is called on every `sessionRefreshTick` change, which fires after every message save. During streaming, `saveSession()` is called on each message completion, triggering unnecessary session list refreshes.

**Fix**: Update the local sessions array in-place for the current session instead of re-fetching. Only re-fetch when switching sessions.

### LOW: `resizeTextarea` with `watch` + `nextTick` overhead
**File**: `components/ChatInput.vue:95-97`

Every keystroke triggers `watch(text)` → `nextTick(() => resizeTextarea())`. This adds a microtask per character. The `@input` handler already calls `resizeTextarea`, so the watch is redundant for user typing. Consider placing it only for programmatic changes.

---

## Missing Unit Tests

### HIGH: No tests for composables
**Directory**: `tests/composables/` (empty)

`useChatState.ts` (271 lines) is the central state management piece with streaming logic, session persistence, timeout handling, and error recovery. It has zero tests.

### HIGH: No tests for server API routes
**Directory**: `server/api/**`

None of the 7 API routes have tests. The path traversal vulnerability, input validation issues, and error handling bugs would be caught by route tests.

### HIGH: No tests for `LmStudioService` [FIXED]
**File**: `services/lm-studio.service.ts` (314 lines)

22 tests added in `tests/services/lm-studio.service.spec.ts` covering: model listing (success + HTTP error), OpenAI-style SSE streaming, custom event SSE format, reasoning content extraction from delta, inline thinking tags, metrics extraction from usage/stats fields, base64 image sanitization, HTTP error handling, empty stream handling, and custom reasoning event types.

### HIGH: No page-level component tests
**File**: `pages/index.vue` (180 lines)

No tests for the main page composition, session loading, message deletion confirmation, or scroll behavior.

### MEDIUM: No tests for remaining components
**Files with no tests**: `ChatMessage.vue` (209 lines), `ChatInput.vue` (98 lines), `AppSidebar.vue` (106 lines), `ModelSelector.vue` (25 lines), `ChartRenderer.vue` (82 lines), `TreeNode.vue` (71 lines), `SessionActions.vue` (32 lines)

### MEDIUM: No test coverage report
No coverage thresholds configured in vitest.config.ts. No coverage reporting setup for CI.

### Add suggested: Lint and type-check scripts [FIXED]
`lint` and `typecheck` scripts added to `package.json`. `@nuxt/eslint` module configured in `nuxt.config.ts` with flat config in `eslint.config.mjs`.

---

## Poor Coding Practices

### HIGH: Duplicate `uid()` implementation
**Files**: `composables/useChatState.ts:6-12`, `services/session.service.ts:76-82`

The same UUID generation function (with fallback) is copy-pasted twice. Extract to `utils/uid.ts`.

### HIGH: Duplicate copy-to-clipboard logic
**Files**: `components/ChatMessage.vue:159-185`, `components/CodeBlock.vue:61-81`, `components/Base64Image.vue:112-118`

Three components implement slightly different clipboard copy functions with `document.execCommand('copy')` fallbacks. Extract to a `useClipboard` composable.

### HIGH: System prompt hardcoded as a string literal
**File**: `services/lm-studio.service.ts:97-122`

The entire system prompt with all format instructions is embedded as a template string in the service class. This makes it difficult to customize, test, or update without modifying source code. It also mixes configuration (format instructions) with business logic.

**Fix**: Move to a separate constant file, or make it configurable via `AppConfig` / runtime settings.

### MEDIUM: CSS custom properties used inline instead of via Nuxt UI theme
**Files**: Multiple `.vue` files use `var(--ui-bg)`, `var(--ui-border)`, etc.

Nuxt UI v3 exposes a design token system. Direct CSS variable references bypass the theme layer and create tight coupling to the implementation.

### MEDIUM: Service instances created per composable call
**Files**: `composables/useChatState.ts:23-24`

`LmStudioService` and `SessionService` are instantiated inside the composable function body. If called in multiple components, multiple instances are created. Use a singleton pattern or provide/inject.

### MEDIUM: Mutable state exposed from composable
**File**: `composables/useChatState.ts:253-270`

`useChatState()` returns the raw Vue refs, allowing any consumer to do `chat.messages.value = []` or `chat.isStreaming.value = false`, bypassing any side effects (like saving). Only `sendMessage`, `deleteMessage`, etc., trigger saves.

**Fix**: Return `readonly()` wrapped refs and expose only mutation functions.

### MEDIUM: `useSessionPersistence` composable is defined but unused by `useChatState`
**Files**: `composables/useSessionPersistence.ts`, `composables/useChatState.ts`

`useChatState` calls `$fetch` directly for session API calls instead of using `useSessionPersistence`. This creates two parallel ways to access the session API with no clear purpose for the persistence composable.

**Fix**: Have `useChatState` consume `useSessionPersistence`, or remove it.

### LOW: `filename()` method on SessionService appears unused
**File**: `services/session.service.ts:183-187`

The `filename()` method exists but `SessionFsRepository` uses its own `toShortTimestamp()` function instead. Remove the unused method or consolidate.

### LOW: `console.warn` calls in production
**Files**: `components/StructuredDataViewer.vue:122`, `components/ChartRenderer.vue:67`, `components/CodeBlock.vue:79`

Console warnings from parse failures leak implementation details to the browser console in production. Consider using a debug-only logging utility.

### LOW: `XMLParser` instance created inside computed
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

| Priority | Category | Count |
|----------|----------|-------|
| **HIGH** | Security | 3 |
| **HIGH** | Bugs | 2 |
| **HIGH** | Performance | 2 |
| **HIGH** | Missing Tests | 3 |
| **HIGH** | Coding Practices | 3 |
| **HIGH** | Nuxt/Vue Best Practices | 1 |
| **MEDIUM** | Security | 2 |
| **MEDIUM** | Bugs | 3 |
| **MEDIUM** | Performance | 3 |
| **MEDIUM** | Missing Tests | 2 |
| **MEDIUM** | Coding Practices | 5 |
| **MEDIUM** | Nuxt/Vue Best Practices | 3 |
| **LOW** | Various | 11 |

**Top 5 actions to prioritize:**

1. Fix the path traversal vulnerability in session API endpoints (security — HIGH)
2. Add input validation and authentication to all API routes (security — HIGH)
3. Optimize MarkdownRenderer to avoid full re-parse on each streaming token (performance — HIGH)
4. Write tests for `useChatState`, `LmStudioService`, and server API routes (testing — HIGH)
5. Add ESLint and TypeScript strict mode configuration (best practices — HIGH)
