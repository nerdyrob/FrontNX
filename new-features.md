# New Feature Suggestions — FrontNX

Ideas to improve FrontNX beyond its current chat + markdown-session scope. Prioritized roughly by user impact vs. effort. Each is grounded in the existing architecture (`composables → services → repositories → server/api`).

---

## High impact

> **Status legend:** ✅ Completed · ⬜ Not started

### 1. Message editing & regeneration — ✅ Completed
- Allow editing a previously sent user message and **regenerating** the assistant reply from that point (splice messages by index, then re-run the streaming pipeline).
- Requires a "branch from here" view or simple in-place edit. Reuses `rewriteSessionFile()` and the existing streaming pipeline.
- **Implemented:** `editMessage(index, text)` and `regenerate(index)` in `useChatState.ts`; inline edit UI + regenerate button in `ChatMessage.vue`. Covered by `useChatState-edit.spec.ts` and `ChatMessage-edit.spec.ts`.

### 2. Conversation rename & search — ✅ Completed
- Sessions currently show a truncated first-message preview as the title. Add a rename action (stored in front-matter `title`).
- Add full-text search across sessions in the sidebar (`AppSidebar.vue`), backed by a new `repo.search(query)` that reuses the existing `parseMarkdown` + `extractPreview` logic.
- **Implemented:** `title`/`params` front-matter in `SessionService`; `repo.search()` + `repo.rename()`; `POST /api/session/search` and `POST /api/session/rename`; search box + inline rename in `AppSidebar.vue`. Covered by `session-fs-search.spec.ts` and `AppSidebar-search-rename.spec.ts`.

### 3. Conversation export — ✅ Completed
- **Export** the current session as Markdown, JSON, or plain text (the renderer already produces clean Markdown; only PDF print exists today).
- **Implemented:** `exportAsMarkdown/Text/Json` in `SessionService`; `exportSession(format)` in `useChatState.ts`; header export dropdown (Markdown/JSON/Text/PDF) in `index.vue`. Covered by `session.service-export.spec.ts` and `useChatState-export.spec.ts`.

### 4. Configurable model parameters — ✅ Completed
- Expose temperature, max tokens, top-p, and system prompt override in the UI.
- `lm-studio.service.ts:139-144` already builds the request body; add these fields to `sendChat` and surface controls in `ChatInput` / a settings panel. Persist preferences per session in front-matter.
- **Implemented:** `ChatRequestOptions` (temperature/maxTokens/topP) forwarded in `LmStudioService.sendChat`; per-session `ModelParams` stored in front-matter; settings gear + `ChatSettings.vue`. Covered by `lm-studio-params.spec.ts`, `useChatState-params.spec.ts`, and `ChatSettings.spec.ts`.

### 5. Multimodal / image input — ✅ Completed
- The renderer already supports base64 images (`Base64Image.vue`) and the service sanitizes images out of API payloads (`lm-studio.service.ts:89-91`). Add an image attach button in `ChatInput` that includes images in the user message for vision-capable models.
- **Implemented:** image attach button + previews in `ChatInput.vue`; images embedded in the message and forwarded as multimodal content (`includeImages` in `sendChat`) for vision-capable models. Covered by `lm-studio-images.spec.ts`, `useChatState-images.spec.ts`, and `ChatInput-image.spec.ts`.

---

## Medium impact

### 6. Persist UI preferences
- Remember `thinkingEnabled`, selected model, and sidebar open/closed state across reloads (localStorage). Today `thinkingEnabled` resets to `true` on every load/model switch (see code-review #2/#16).

### 7. Token & cost dashboard
- Aggregate `metrics.tokensUsed` / `processingTimeMs` already stored per message. Add a per-session and all-time summary (total tokens, est. cost if a price-per-token config is provided) in the sidebar or a stats view.

### 8. Conversation branching
- Fork a session at any message into a new session file, enabling exploration of alternate replies without losing history. Builds naturally on message splicing + repository `create`.

### 9. In-chat search & jump-to-message
- Add "find in conversation" that scrolls to and highlights the matching `ChatMessage`. Pairs with #2's search.

### 10. Stop / interrupt as a first-class feature
- Once the streaming abort is wired (code-review #1), add: stop-and-keep-partial, and "stop and discard" (don't persist the incomplete assistant message).

### 11. Markdown/image export of individual messages
- Right-click or button on a `ChatMessage` to copy as Markdown, or export a single code block / chart / SVG via the existing `CodeBlock`/`SvgRenderer`/`ChartRenderer` download buttons.

---

## Lower effort / polish

### 12. Keyboard shortcuts
- `Ctrl/Cmd+K` command palette (new session, search, model switch, export), `Ctrl/Cmd+Enter` send, `Esc` to stop streaming.

### 13. Streaming UX improvements
- Show live tokens/sec while generating (metrics exist but are only shown after completion in `ChatMessage.vue:88-92`).
- Collapsible "thought process" default state persisted per user.

### 14. Multiple model providers
- The LM proxy (`server/api/lm/[...].ts`) and `LmStudioService` are already abstracted. Add provider selection (e.g. OpenAI, Ollama, vLLM) via `LLM_SERVER_*` config so one binary can target different backends.

### 15. Settings / onboarding screen
- A first-run page that validates `LLM_SERVER_BASE_URL` / `LLM_SERVER_NAME` and shows connection status before the chat loads (instead of the current silent empty/error states).

### 16. Accessibility & responsive pass
- Ensure `AppSidebar` collapses gracefully on mobile (currently `w-8` collapsed but no overlay for small screens).
- Add `aria-live` to streaming message regions for screen readers.

### 17. Automated CI checks
- The repo already has Vitest + ESLint + typecheck (`package.json`). Add a GitHub Actions step running `lint`, `typecheck`, and `test:run` on PRs (the existing `.github` workflow only builds SEA binaries).

---

## Suggested first milestone
Implement #1 (stop streaming) and #2 (thinking toggle fix) first — they are bug-fixes that unlock existing dead code. Then #3 (import/export) and #1's edit/regenerate (#1 feature) for the biggest UX lift, since `SessionService` parsing/serialization is already built and tested.
