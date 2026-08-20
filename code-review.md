# Code Review — FrontNX

Scope: all source under `components/`, `composables/`, `services/`, `repositories/`, `server/`, `utils/`, `types/`, and the top-level Vue/TS entry files. Hidden/build/dependency folders (`.nuxt`, `build`, `node_modules`, `coverage`, `.output`) were excluded.

Severity legend: 🔴 bug (wrong/incorrect behavior) · 🟠 security/robustness · 🟡 quality/maintainability · 🔵 minor/UX.

---

## 🔴 Functional bugs

### 1. Streaming cannot be stopped — `stop` event is never wired ✅ FIXED (test: `tests/composables/useChatState-streaming.spec.ts`)
`components/ChatInput.vue` emits `stop` when the user clicks the square button while streaming (`@click="$emit('stop')"`), and `services/lm-studio.service.ts` accepts an `AbortSignal` (`sendChat(..., signal)`), and `composables/useChatState.ts` already creates an `AbortController` (`requestController`) — but:
- `pages/index.vue` binds `@send`, `@update:thinking`, etc. on `<ChatInput>` and never binds `@stop`.
- `useChatState` exposes no `stop()` function and never exposes `requestController`, so nothing can call `requestController.abort()`.

**Result:** the Stop button is non-functional; the user must wait for the full response/timeout. The `requestController` signal is passed to `fetch` but never triggered.

**Fix:** add `function stopStreaming() { requestController?.abort() }` in `useChatState`, expose it, and add `@stop="chat.stopStreaming"` in `pages/index.vue`. The LM service already treats `AbortError` as a stop reason.

### 2. Thinking toggle can never be turned off ✅ FIXED (test: `tests/composables/useChatState-streaming.spec.ts`)
`composables/useChatState.ts:291` returns `thinkingEnabled: readonly(thinkingEnabled)`. `pages/index.vue:100` does `chat.thinkingEnabled.value = $event` in response to `@update:thinking`. Assigning to a `readonly()` ref is silently ignored (Vue warns in dev, no-op otherwise), so the value is permanently `true`.

**Result:** the "Think" toggle in `ChatInput` is purely decorative; thinking/reasoning output cannot be disabled by the user despite the documented feature.

**Fix:** expose a setter, e.g. `function setThinkingEnabled(v: boolean) { thinkingEnabled.value = v }` and use `@update:thinking="chat.setThinkingEnabled"` (mirroring the existing `setSelectedModel` pattern).

### 3. CSV export is silently truncated ✅ FIXED (test: `tests/components/DataTable.spec.ts`)
`components/DataTable.vue:233-234` calls `unparseCsv(data.value)`. `data` is the clipped view (`components/DataTable.vue:178-181`): `rawData.value.slice(0, MAX_ROWS)`. The UI banner explicitly says *"Export to CSV for full dataset"*, but only the first 5000 rows are exported.

**Fix:** export `rawData.value` (or `parsed.value.data`), not the truncated `data`.

### 4. Session `created` timestamp is rewritten on every save ✅ FIXED (test: `tests/composables/useChatState-session.spec.ts`)
`composables/useChatState.ts` builds markdown with `created: new Date().toISOString()` on every `saveSession()` (line 252) and `rewriteSessionFile()` (line 277). The on-disk front-matter `created` therefore reflects the *last save time*, not creation time.

**Result:** the sidebar (`AppSidebar` shows `session.timestamp` = `meta.created`) displays a "last modified" time while sessions are sorted by filename (creation). Also `deleteMessage` rewrites `created`, shifting the timestamp on edits.

**Fix:** capture `created` once when the session is first created and reuse it for subsequent writes (store it on the composable alongside `currentSessionPath`).

---

## 🟠 Security / robustness

### 5. `meta.created` and `meta.model` accepted without validation ✅ FIXED (test: `tests/server/validation.spec.ts`)
`server/utils/validation.ts:30-37` only checks types (string), not validity. `created` can be any string (so #4 also corrupts sortable/displayed timestamps), and `model` can be empty. Low severity but worth a basic shape/date check, especially since these values are persisted verbatim and later parsed back.

### 6. Path-based session API trusts client-supplied absolute paths ✅ ADDRESSED (mitigated)
`server/api/session/read.get.ts` and `rewrite.post.ts`/`delete.delete.ts` accept `path` from the client and resolve it via `resolveSafePath` (`repositories/session-fs.repository.ts:62-71`), which correctly blocks traversal outside `baseDir` and enforces `.md`. This is **mostly safe**, but:
- `list.get.ts` returns **absolute filesystem paths** as `session.path`. The client (`pages/index.vue`, `AppSidebar`) then round-trips these absolute paths back to read/delete. This leaks the server's directory layout and couples the client to absolute server paths (brittle across machines / the SEA binary).
- If `baseDir` is ever shared or the server runs with broader FS access, any `.md` file under `baseDir` is readable/writable via a crafted `path`. Acceptable for a single-user local app, but should be documented as trusted-local only.

**Suggestion:** use opaque session IDs (the filename without extension, already available as `id`) for client references, and resolve server-side from `baseDir` rather than accepting full client paths.

**Resolution:** `create()` and `list()` now return the opaque filename (not the absolute server path), and `read`/`write`/`delete` resolve it server-side via `resolveSafePath` (which still blocks traversal outside `baseDir`). The client no longer learns or round-trips absolute filesystem paths. Added test in `tests/repositories/session-fs.repository.spec.ts`.

### 7. Auth middleware is opt-in only ✅ ADDRESSED (mitigated)
`server/middleware/auth.ts` returns early when `config.apiKey` is empty, so the entire API (including the LM proxy and session file read/write) is unauthenticated by default. Fine for a localhost tool, but if `HOST=0.0.0.0` is used on a shared network this exposes the proxy and file store. Document the security model and consider failing closed or warning when binding to non-loopback without an API key.

**Resolution:** added `server/plugins/security.ts`, a Nitro plugin that logs a warning when the server is bound to a non-loopback address (`HOST` not `127.0.0.1`/`localhost`/`::1`) without an `apiKey` configured, so the local-only assumption is visible rather than silent. Failing closed was avoided to not break local dev.

### 8. No input size limit on session write/append bodies ✅ FIXED (test: `tests/repositories/session-fs.repository.spec.ts`)
`server/api/session/rewrite.post.ts` and `append.post.ts` do not enforce a size cap (unlike the LM proxy's 200 KB check in `server/api/lm/[...].ts:34-39`). A client could write arbitrarily large files. Add a size guard consistent with the LM proxy.

---

## 🟡 Quality / maintainability

### 9. Dead code: `deleteRange` and `append` endpoint are unused in the app ✅ FIXED
- `composables/useChatState.ts` exports `deleteRange` (line 298); it is only referenced by tests, never by UI logic. Either wire a "delete range" feature or remove it.
- `server/api/session/append.post.ts` and `composables/useSessionPersistence.ts:22-27` (`append`) are never called anywhere in the app. The streaming flow rewrites the whole file on each Save instead of appending. Remove the unused endpoint or adopt append-based persistence.

### 10. `SessionFsRepository` instantiated per request and re-runs migration each time ✅ FIXED (shared singleton via `server/utils/session-repository.ts`)
Each session route creates `new SessionFsRepository()` at module load (`const repo = new SessionFsRepository()`), and the constructor calls `migrateOldFiles()` plus `existsSync`/`mkdirSync`. Not per-request, but module-scope singletons drift from the `useChatState` pattern (which holds module-level service singletons). Consider a single shared repository instance.

### 11. `AppSidebar` re-declares the session item type inline ✅ FIXED
`components/AppSidebar.vue:81` declares a full inline type instead of importing `SessionListItem` from `repositories/session.repository.ts` (already used in `pages/index.vue:108`). Centralize the type to avoid drift.

### 12. `readonly()` wrapping is inconsistent and hides the thinking bug (#2)
`useChatState` returns several `readonly(...)` refs (`messages`, `selectedModel`, `thinkingEnabled`, …) but only provides setters for some (`setSelectedModel`). The pattern is good for encapsulation, but `thinkingEnabled` lacks a setter, which is exactly what caused #2. Add setters for every externally-mutable piece of state.

### 13. `parseError` in `StructuredDataViewer` is silently dropped ✅ FIXED (test: `tests/components/StructuredDataViewer.spec.ts`)
`components/StructuredDataViewer.vue:121-124` catches parse failures, `console.warn`s, and then renders the raw (possibly broken) document with **no error indicator**. Users can't tell invalid JSON/YAML/TOML/XML from valid. Surface `parseError` in the UI.

### 14. `ChartRenderer` uses unvalidated, attacker/LLM-controlled config ✅ FIXED (test: `tests/components/ChartRenderer.spec.ts`)
`components/ChartRenderer.vue:74-75` feeds `config.data` and `config.options` straight from parsed JSON into Chart.js. Malformed shapes can throw at render time (uncaught). Wrap in try/catch and validate the shape before rendering.

### 15. `MarkdownRenderer` bracketed-math heuristic can mis-classify content ✅ DOCUMENTED (no code change)
`utils/markdown.ts:75-78` converts any `[ ... ]` block containing LaTeX-like tokens into a display equation. Legitimate non-math bracketed content with `\frac`, `=`, `{` etc. (e.g. some config snippets) could be wrongly rendered as math. This is an intentional convenience heuristic; rather than change behavior (which would regress legitimate math), it is now **documented** in `README.md` under "Markdown & math rendering notes," advising users to wrap display math explicitly in `$$ ... $$` to avoid ambiguity.

### 16. `exportToPDF` mutates and never restores `document.title` ✅ FIXED
`composables/useChatState.ts:43-44` sets `document.title = ...` then prints but never restores it, so the browser tab keeps the generated filename as its title after printing. Save and restore the previous title.

---

## 🔵 Minor / UX

- `composables/useClipboard.ts` and `components/StructuredDataViewer.vue` both implement near-identical clipboard+copied-timer logic — consolidate into `useClipboard`. ✅ FIXED — `StructuredDataViewer` now uses `useClipboard`; copy path covered by `tests/components/StructuredDataViewer.spec.ts`.
- `server/utils/rate-limit.ts` types `event` as `any` (line 14); use `H3Event` for type safety. The `setInterval` (line 6) is never cleared, preventing clean process exit in the SEA binary. ✅ FIXED — `event` typed as `H3Event`; interval handle stored and cleared on Nitro `close`.
- `rate-limit.ts` keyed on `getRequestIP` with `xForwardedFor: true` — behind a proxy this can be spoofed via `X-Forwarded-For`; acceptable for local use but note it. ✅ ADDRESSED — documented inline in `rate-limit.ts`.
- `ModelSelector` placeholder `<option value="" disabled>` remains in the DOM even after a model is selected; harmless but the disabled empty option can briefly flash. ✅ FIXED — placeholder now rendered with `v-if="!modelValue"`; covered by `tests/components/ModelSelector.spec.ts`.
- `useChatState.sendMessage` watch on `selectedModel` force-enables thinking on model change (line 32), which combined with #2 means the user's preference is reset every time they switch models. ✅ FIXED — thinking now defaults on only for the first selection; user preference is preserved when switching models. Covered by `tests/composables/useChatState-streaming.spec.ts`.
- `pages/index.vue` scroll/watch triggers `scrollToBottom` on every token; fine, but uses two nested `nextTick`s (line 121-123, 127-131) unnecessarily. ✅ FIXED — removed the nested `nextTick`.
- `tests/` are present and reasonably structured; the functional bugs (#1–#4) are now covered by dedicated specs (`useChatState-streaming.spec.ts`, `useChatState-session.spec.ts`, `DataTable.spec.ts`), and additional component/repository/server specs cover the other fixes. ✅ ADDRESSED.

---

## Priority order to fix
1. #1 Stop streaming (broken core interaction)
2. #2 Thinking toggle (broken documented feature)
3. #3 CSV export truncation (data-loss on export)
4. #4 Session created timestamp drift
5. #6 / #7 document and harden the local-only security assumptions
6. Clean up dead code (#9) and surface parse/validation errors (#5, #13, #14)
