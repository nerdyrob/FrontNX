# Release 1.1.0 — Enhanced AI Output Rendering

Improve how the app renders AI-generated content with support for structured data, code syntax highlighting, interactive tables, SVG, and base64 images.

## Dependency Graph

```
Task 1 (Syntax Highlighting) ─┬─ Task 2 (JSON/YAML/TOML Viewer)
                              ├─ Task 3 (CSV/TSV Tables)
                              └─ Task 6 (SQL/GraphQL/Schema Actions)

Task 4 (SVG)      ─ Independent
Task 5 (Base64)   ─ Independent
```

All tasks can be parallelized. Tasks 2, 3, and 6 reuse the `<CodeBlock>` component from Task 1.

## Architectural Integration Notes

These notes apply across all tasks and must be followed to fit the existing codebase.

### Single Fence Renderer
`md.renderer.rules.fence` is a single slot — only one override can exist. **Task 1's `<CodeBlock>` must be the sole fence override.** Tasks 2, 3, and 6 must hook into `<CodeBlock>` via component composition (language-based delegation), not by adding separate markdown-it renderers.

### Multi-Pass Pipeline
The existing `MarkdownRenderer.vue` has 4 passes:
1. LaTeX normalization (protects fenced code blocks)
2. KaTeX rendering → `%%BLOCKn%%` placeholders
3. markdown-it rendering
4. Block reinsertion

New renderers plug into **Pass 3** (markdown-it fence override). Verify that the LaTeX pre-processing in Pass 1 correctly protects all new language tags from false-positive math detection.

### Shiki Singleton
`createHighlighter` is async and expensive. Create a singleton in `utils/highlighter.ts` that:
- Initializes once via `createHighlighter` with a curated list of grammars (not all 200+)
- Caches the instance for reuse across SSR renders and client hydration
- Disposes on HMR in dev mode

### Theme / Color Mode
Nuxt UI v3 uses Tailwind + `color-mode` (light/dark). All new components must:
- Use Shiki's dual-theme support (`codeToHtml(code, { theme: { light: 'github-light', dark: 'github-dark' } })`)
- Follow the existing `prose-message` CSS class convention for typography
- Use Tailwind classes consistently with the rest of the codebase

### Streaming Resilience
AI responses stream in chunk-by-chunk. `MarkdownRenderer.vue` re-renders the full content on each update. All renderers must handle:
- Incomplete code fences (missing closing ```)
- Malformed JSON/YAML/XML during streaming (partial content)
- Partially-rendered tables (uneven rows)
- Graceful degradation: render as plain text if parsing fails, never break the full render

### SSR Compatibility
| Library | SSR-safe? | Note |
|---------|-----------|------|
| `shiki` | Yes | Node.js native |
| `isomorphic-dompurify` | Yes | Wraps `dompurify` for server |
| `papaparse` | Yes | Pure JS, no DOM |
| `fast-xml-parser` | Yes | Pure JS |
| `@tanstack/vue-table` | Yes | Headless, no DOM |
| `yaml` / `@iarna/toml` | Yes | Pure JS |
| `file-saver` | **No** | Browser only — wrap in `onMounted` / `client-only` |
| `sql-formatter` | Yes | Pure JS |

### Error Handling Pattern
All renderer components must follow a consistent error boundary pattern:
```vue
<template>
  <div v-if="error" class="text-red-500 dark:text-red-400 ...">{{ error }}</div>
  <div v-else-if="!content" />
  <div v-else><!-- rendered output --></div>
</template>
```

### Bundle Size & Lazy Loading
`shiki` (WASM), `@tanstack/vue-table`, and any future `mermaid` addition are heavy. Load renderers as async components:
```ts
const CodeBlock = defineAsyncComponent(() => import('~/components/CodeBlock.vue'))
```

---

## Task 1 — Code Syntax Highlighting + Copy Button (Foundational)

Add language-aware code rendering with a reusable `<CodeBlock>` component.

### Libraries (suggested)

| Library | Purpose |
|---------|---------|
| `shiki` | VS Code's syntax engine, SSR-compatible, 200+ languages |
| `@vueuse/core` | `useClipboard()` for copy button |

### Implementation

- Add `shiki`
- Create `components/CodeBlock.vue`:
  - Language label badge (from markdown fence info string)
  - Syntax-highlighted output via shiki
  - Copy-to-clipboard button
  - Optional line numbers toggle
- Override markdown-it's fence renderer in `utils/markdown.ts` to use `<CodeBlock>`
- Fall back to plain `<pre><code>` when language is unknown or highlighting fails

### Tests (`tests/components/CodeBlock.spec.ts`)

| # | Case | Expected |
|---|------|----------|
| 1 | Renders code with correct language class | DOM contains `.language-js`, `.language-python` etc. |
| 2 | Copy button copies content to clipboard | `navigator.clipboard.writeText` called with correct text |
| 3 | Fallback renders plain `<code>` on error | Error boundary renders plain escaped `<code>` |
| 4 | Language detection from markdown code fences | ` ```js ` produces `.language-js` |
| 5 | Empty/falsy code renders nothing | Component renders empty slot or null |
| 6 | XSS: `<script>` tags in code are escaped | Tags appear as text, not executed |

---

## Task 2 — Interactive JSON / YAML / TOML / XML Viewer

Detect structured data in code blocks and render a collapsible tree viewer.

### Libraries (suggested)

| Library | Purpose |
|---------|---------|
| `yaml` (`js-yaml`) | Parse YAML into objects |
| `@iarna/toml` | Parse TOML into objects |
| `fast-xml-parser` | Parse XML into a JSON-like tree — fast, no DOM overhead |
| *(Build the tree view as a recursive Vue component — third-party viewers often clash with Nuxt UI's design system)* |

### Implementation

- Add `yaml`, `@iarna/toml`, and `fast-xml-parser`
- Build `components/StructuredDataViewer.vue`:
  - Auto-detect format from language label (json/yaml/toml/xml)
  - Collapsible tree for objects/arrays/XML elements
  - Raw ↔ pretty ↔ tree view toggle
  - Size warning for payloads > 500 KB
  - Copy formatted output button
- Register as markdown-it renderer for `json`, `yaml`, `toml`, `xml` code fences

### Tests (`tests/components/StructuredDataViewer.spec.ts`)

| # | Case | Expected |
|---|------|----------|
| 1 | Renders valid JSON as collapsible tree | Tree nodes exist for each key/value |
| 2 | Toggle between raw/tree views | View switches, content identical |
| 3 | Deeply nested objects expand/collapse | Clicking expander shows/hides children |
| 4 | Invalid JSON shows error fallback | Error message rendered, no crash |
| 5 | Empty object/array renders correctly | Renders `{}` or `[]` placeholder |
| 6 | YAML input renders tree correctly | YAML parsed, tree matches keys |
| 7 | XML input renders as collapsible element tree | Elements parsed, tree shows tag names and attributes |
| 8 | Large payload shows size warning | Warning displayed, tree optionally truncated |

---

## Task 3 — Interactive Table Component (CSV/TSV)

Parse tabular data and render sortable, filterable tables.

### Libraries (suggested)

| Library | Purpose |
|---------|---------|
| `papaparse` | Gold-standard CSV/TSV parser — handles quoted fields, newlines in cells |
| `@tanstack/vue-table` (v8) | Headless table with sorting, filtering, pagination — pairs well with Nuxt UI styling |

### Implementation

- Add `papaparse` and `@tanstack/vue-table`
- Build `components/DataTable.vue`:
  - Parse CSV/TSV text into typed rows
  - Sortable columns (click header to toggle asc/desc)
  - Text filter input
  - Pagination (25 / 50 / 100 rows)
  - Export to CSV button
- Register as markdown-it renderer for `csv`, `tsv` code fences
- Auto-detect separator: comma vs tab

### Tests (`tests/components/DataTable.spec.ts`)

| # | Case | Expected |
|---|------|----------|
| 1 | Parses basic CSV with headers | Renders correct number of rows/columns |
| 2 | Parses TSV correctly | Same data as CSV equivalent |
| 3 | Column sorting works | Click header sorts asc, click again desc |
| 4 | Text filtering filters rows | Only matching rows visible |
| 5 | Pagination shows correct page count | 50 rows with page size 25 shows 2 pages |
| 6 | Empty CSV shows empty state | "No data" message, no crash |
| 7 | Malformed CSV shows error | Error message, no crash |
| 8 | Export button triggers download | Blob download with `.csv` filename |

---

## Task 4 — Safe SVG Rendering

Render inline SVG markup safely with built-in interactivity options.

### Libraries (suggested)

| Library | Purpose |
|---------|---------|
| `dompurify` + `isomorphic-dompurify` | Server-safe sanitization for Nuxt SSR — strips `<script>`, `on*`, `javascript:` URLs |
| *(No SVG creation lib needed — rendering AI-provided markup, not generating it)* |

### Implementation

- Add `isomorphic-dompurify`
- Build `components/SvgRenderer.vue`:
  - Render via `v-html` with DOMPurify sanitization
  - Strip `<script>`, `on*` event handlers, `javascript:` URLs
  - Strip external `href`/`xlink:href` to non-data URIs
  - Make responsive: auto-add `viewBox` if missing, scale to container
- Detect SVG in AI output (raw `<svg>` tags or ` ```svg ` fences)
- `markdown-it` must allow `svg` tag through when inside a rendered SVG block

### Tests (`tests/components/SvgRenderer.spec.ts`)

| # | Case | Expected |
|---|------|----------|
| 1 | Renders valid SVG visually | DOM contains `<svg>` element with correct attributes |
| 2 | Strips `<script>` tags | `<script>` removed, no execution |
| 3 | Strips `onclick`, `onload` handlers | Attributes stripped |
| 4 | Strips external `javascript:` href | Link stripped or neutered |
| 5 | Valid SVG with `viewBox` scales correctly | `width`/`height` set to 100%, `viewBox` preserved |
| 6 | Invalid/malicious SVG returns sanitized output | DOMPurify returns safe subset |
| 7 | Empty string renders nothing | No output |

---

## Task 5 — Base64 Image Enhancement

Improve rendering of inline base64-encoded images with lazy loading and size guards.

### Libraries (suggested)

| Library | Purpose |
|---------|---------|
| `file-saver` | `saveAs()` download trigger with correct MIME type |
| `@vueuse/core` | `useIntersectionObserver()` for lazy loading |
| *(Rendering is native `<img>` — no image library needed)* |

### Implementation

- Detect base64 `data:image/...` URLs in rendered markdown output
- Build `components/Base64Image.vue`:
  - Lazy load via `loading="lazy"` + IntersectionObserver
  - Enforce 500 KB decoded size cap; show warning for oversized
  - Detect MIME type from data URI (`image/webp`, `image/png`, etc.)
  - Download button with correct file extension
- Integrate via markdown-it image renderer override

### Tests (`tests/components/Base64Image.spec.ts`)

| # | Case | Expected |
|---|------|----------|
| 1 | Valid base64 WebP renders with correct src | `<img>` src matches data URI |
| 2 | `loading="lazy"` attribute present | Attribute set on `<img>` |
| 3 | Oversized image (>500 KB) shows warning | Warning text rendered, image not loaded |
| 4 | Invalid base64 string shows error | Error state rendered |
| 5 | Download button triggers download | Blob download with correct extension |
| 6 | PNG format detected correctly | Download uses `.png` extension |

---

## Task 6 — Code Block Actions for SQL / GraphQL / OpenAPI

Add format, validate, and preview buttons to code blocks for query/schema languages.

### Libraries (suggested)

| Library | Purpose |
|---------|---------|
| `sql-formatter` | Indents SQL keywords — supports 20+ dialects |
| `graphql-language-service` | GraphQL parsing + validation (heavier — skip if only formatting is needed) |

### Implementation

- Build `components/CodeBlockActions.vue` (integrated into `<CodeBlock>`):
  - **Format** — basic keyword indentation (SQL `SELECT`/`FROM`, GraphQL `query`/`mutation`)
  - **Validate** — basic syntax checks (unmatched parens, quoted strings, incomplete statements)
  - **Raw ↔ Formatted toggle** — show original or formatted version
  - Only show actions for `sql`, `graphql`, `openapi`/`oas` language types
  - Actions appear as icon buttons in the CodeBlock header bar

### Tests (`tests/components/CodeBlockActions.spec.ts`)

| # | Case | Expected |
|---|------|----------|
| 1 | Format button indents SQL correctly | `SELECT * FROM t WHERE a=1` indented with line breaks |
| 2 | Validate detects unbalanced parentheses in SQL | Error message shown |
| 3 | Validate detects missing closing quote in GraphQL | Error message shown |
| 4 | Toggle between raw/formatted keeps content identical | Round-trip produces same text |
| 5 | Actions hidden for unsupported languages | No buttons rendered for ` ```js ` |
| 6 | Empty content shows no actions | No buttons rendered |

---

## Task 7 — Mermaid Diagrams (Future Consideration)

Mermaid is a common AI output format for flowcharts, sequence diagrams, Gantt charts, and entity-relationship diagrams. It pairs naturally with SVG rendering (Task 4).

| Library | Purpose |
|---------|---------|
| `mermaid` | Renders Mermaid diagram definitions to SVG in the browser. ~150 KB gzipped. |
| `isomorphic-dompurify` | Sanitize the generated SVG before injecting into DOM |

**Not included in 1.1.0** due to bundle size and complexity — recommend evaluating as a follow-up after the SVG renderer (Task 4) is proven.

---

## Cross-Cutting Concerns

### Caching Strategy
Shiki highlighting, tree parsing, and CSV parsing are expensive operations that run on every stream update. Cache rendered output keyed by content hash:

```ts
const cache = new Map<string, string>()
const key = hash(content + language)
if (cache.has(key)) return cache.get(key)
const result = await render(content)
cache.set(key, result)
return result
```

Use `shallowRef` + `computed` with content hash dependency in each renderer component. Consider `lru-cache` or a simple `Map` with a max size (e.g., 50 entries) to avoid memory growth.

### Accessibility
All interactive elements require ARIA labels and keyboard support:

| Component | Requirement |
|-----------|-------------|
| Copy button | `aria-label="Copy code"`, announces success/failure |
| Sortable table headers | `aria-sort="ascending"` / `"descending"`, keyboard-activated |
| Tree view expanders | `aria-expanded`, `role="tree"` / `role="treeitem"`, keyboard arrow navigation |
| Filter input | `aria-label="Filter results"` |
| Tab panels (raw/pretty/tree) | `role="tablist"`, `role="tab"`, `aria-selected` |

Add `role="status"` / `aria-live="polite"` regions for announcements (sort changed, rows filtered, copy completed).

### Dependency Installation
All new libraries are dev dependencies or runtime dependencies as appropriate:

```
npm install shiki @vueuse/core
npm install yaml @iarna/toml fast-xml-parser
npm install papaparse @tanstack/vue-table
npm install isomorphic-dompurify
npm install file-saver
npm install sql-formatter
npm install --save-dev @types/file-saver
```

---

## Items Explicitly Excluded

| Item | Reason |
|------|--------|
| KaTeX / MathJax | KaTeX already implemented in `MarkdownRenderer.vue` — no changes needed |

## Changelog

```markdown
## [1.1.0] — TBD

### Added
- Code syntax highlighting with shiki and reusable `<CodeBlock>` component
- Copy-to-clipboard button on all code blocks
- Interactive JSON/YAML/TOML/XML tree viewer
- Sortable, filterable, paginated CSV/TSV data tables
- Safe inline SVG rendering with DOMPurify sanitization
- Lazy-loaded base64 images with size capping and download
- Format, validate, and raw-toggle actions for SQL/GraphQL/OpenAPI

### Architecture
- Single fence renderer pattern: `<CodeBlock>` as sole markdown-it fence override
- Shiki highlighter singleton for SSR via `utils/highlighter.ts`
- Color-mode-aware themes (light/dark) in all new components
- Streaming-resilient rendering: all components handle incomplete input gracefully
- Consistent error boundary pattern across all renderers
- Lazy-loaded heavy renderers via `defineAsyncComponent`
- Rendered output caching keyed by content hash
- ARIA labels and keyboard navigation on all interactive elements
```
