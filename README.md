# FrontNX

A configurable chat frontend for LLM servers (e.g. LM Studio) built with [Nuxt 3](https://nuxt.com) and [Nuxt UI](https://ui.nuxt.com).

Each conversation session is persisted to a unique markdown file with front-matter metadata (model, service, timestamp).

## Architecture

```
pages / components
      ↓
composables        (Vue reactivity bridges)
      ↓
services           (API calls, markdown formatting)
      ↓
repositories       (persistence abstraction)
      ↓
server/api         (Nitro routes for file I/O, LM proxy)
```

## Requirements

- Node.js >= 20
- An LLM server running with an OpenAI-compatible API endpoint

## Setup

```bash
npm install
```

Copy [.env.example](.env.example) to `.env` in the project root and fill in your values:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `3001` | Server port |
| `LLM_SERVER_BASE_URL` | — | Base URL of the LLM server API |
| `LLM_SERVER_NAME` | — | Display name shown in UI and saved to session files |
| `CHAT_REQUEST_TIMEOUT_MS` | `900000` | Request timeout in ms (15 minutes) |

## Development

```bash
npm run dev
```

Opens at `http://localhost:3001`.

## Build

```bash
npm run build
node build/server/index.mjs
```

Produces a production build in `build/`.

The `.env` file is loaded automatically by both `npm run dev` (via Nuxt) and `frontnx.sh` (via `source`).

## Standalone Binary (All Platforms)

A single-file executable can be built using Node.js SEA (Single Executable Applications). No Node.js runtime is required on the target machine.

```bash
npm run build:sea
```

Produces a binary in `build/`:

| Platform | Binary |
|---|---|
| Linux / macOS | `build/frontnx` |
| Windows | `build/frontnx.exe` |

The `public/` directory with static assets is already inside `build/`.

### Distribution

The entire `build/` directory can be copied as-is. Contents:

```
build/
├── frontnx            (or frontnx.exe on Windows)
├── public/            (static assets — required)
├── server/            (Nitro server — not needed by the binary)
└── .sea/              (intermediate build — not needed)
```

Place a `.env` file alongside the binary on the target:

```
build/
├── frontnx
├── public/
└── .env               (create this)
```

### Usage

```bash
cd build
./frontnx              # Linux / macOS
frontnx.exe            # Windows
```

The browser opens automatically after 2 seconds. Environment variables are loaded from `.env` in the working directory.

### Build via CI

GitHub Releases are built automatically when pushing a tag matching `v*`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Downloads include the binary, `public/`, `.env`, and `README.md`:

- `frontnx-linux-x64.tar.gz`
- `frontnx-macos-arm64.tar.gz`
- `frontnx-win-x64.zip`

### Notes

- The binary is **OS and architecture-specific** — build on the same platform you deploy to. Cross-compilation is not supported by SEA.
- Run `npm run build:sea` locally, or use the CI workflow for automated builds.

### Linux Desktop Icon

A `.desktop` file is included at `frontnx.desktop` in the repo. To install a launcher for your binary:

```bash
# Copy the icon
mkdir -p ~/.local/share/icons/hicolor/scalable/apps
cp assets/icons/frontnx.svg ~/.local/share/icons/hicolor/scalable/apps/

# Copy and tweak the desktop entry
cp frontnx.desktop ~/.local/share/applications/
# Edit ~/.local/share/applications/frontnx.desktop so that:
#   - Exec points to your binary's directory
#   - Icon path points to the SVG above
# (Or use the absolute path: Icon=/home/you/.local/share/icons/hicolor/scalable/apps/frontnx.svg)

# Update the desktop database
update-desktop-database ~/.local/share/applications/
```

FrontNX will then appear in your application menu.

## Tests

```bash
# Watch mode
npm run test

# Single run
npm run test:run

# With coverage
npm run test:coverage
```

Vitest is configured with `@nuxt/test-utils` and `happy-dom`.

## Project Structure

```
.
├── app.vue                    # App entry
├── nuxt.config.ts             # Nuxt configuration
├── vitest.config.ts           # Vitest configuration
├── package.json
├── types/                     # TypeScript interfaces
│   ├── model.ts
│   ├── chat.ts
│   └── config.ts
├── services/                  # Business logic & API calls
│   ├── lm-studio.service.ts
│   └── session.service.ts
├── repositories/              # Persistence layer
│   ├── session.repository.ts
│   └── session-fs.repository.ts
├── composables/               # Vue composables
│   ├── useChatState.ts
│   └── useSessionPersistence.ts
├── components/                # Vue components
│   ├── ChatMessage.vue
│   ├── ChatInput.vue
│   ├── ModelSelector.vue
│   └── SessionActions.vue
├── pages/
│   └── index.vue              # Main chat page
├── server/
│   ├── api/lm/[...].ts        # LM API proxy
│   └── api/session/           # Session persistence API routes
│       ├── create.post.ts
│       ├── rewrite.post.ts
│       ├── delete.delete.ts
│       ├── list.get.ts
│       └── read.get.ts
├── assets/
│   └── css/
│       ├── main.css
│       └── theme.css
└── tests/
    ├── services/
    │   └── session.service.spec.ts
    └── repositories/
        └── session-fs.repository.spec.ts
```

## Session Files

Chats are saved as markdown files in a user cache directory:

- Linux: `~/.cache/FrontNX/chat-sessions/`
- macOS: `~/Library/Caches/FrontNX/chat-sessions/`
- Windows: `%LOCALAPPDATA%\\FrontNX\\chat-sessions\\`

```markdown
---
model: llama-3.2-3b-instruct
service: LM Studio
created: 2026-07-13T17:30:00Z
---

## 2026-07-13T17:30:00Z — User

Hello

## 2026-07-13T17:30:05Z — Assistant (llama-3.2-3b-instruct)

Hi! How can I help you today?
```

The `service` field in session files uses the `llmServerName` config value.

## Features

- Model selection dropdown populated from the server's available models
- Streamed responses with real-time token display
- Per-message deletion and full session clear
- Automatic session persistence to markdown files
- Markdown session files are human-readable and portable
- Thinking/reasoning toggle (supported by the LLM server)
- PDF export via browser print

### Markdown & math rendering notes

The renderer supports inline (`$...$`) and display (`$$...$$`) math via KaTeX, plus fenced code blocks (` ```chart `, ` ```svg `, ` ```csv `/` ```tsv `, ` ```json `/`yaml`/`toml`/`xml`, and ` ```sql `/`graphql`) for interactive viewers.

It also **auto-detects bracketed math**: a fenced-by-whitespace block of the form

```text
[
  \frac{a}{b} = c
]
```

that contains LaTeX-like tokens (e.g. `\frac`, `\sqrt`, `\sum`, `=`, `{`) is rendered as a display equation without explicit delimiters. This is a convenience heuristic — legitimate non-math content that happens to contain those tokens (some config or data snippets) may be mis-classified as math. To avoid ambiguity, wrap display math explicitly in `$$ ... $$` (or `\[ ... \]`) instead of relying on bare `[ ... ]` blocks. (See code-review #15.)
