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

## Linux Distribution (Standalone Binary)

A single-file executable can be built for Linux x86_64 using Node.js SEA (Single Executable Applications). No Node.js runtime is required on the target machine.

```bash
npm run build:sea
```

Produces `build/frontnx-linux` (~122 MB). The `public/` directory with static assets is already inside `build/`.

### Distribution

Copy the entire `build/` directory to the target machine. Bundle contents:

```
build/
├── frontnx-linux      (the binary)
├── public/            (static assets)
├── server/            (Nitro server — not needed by the binary)
└── .sea/              (intermediate build — not needed)
```

Place a `.env` file alongside `build/frontnx-linux` on the target:

```
build/
├── frontnx-linux
├── public/
└── .env               (create this)
```

### Usage

```bash
cd build
./frontnx-linux
```

Starts the server at `http://0.0.0.0:3000` (or the address configured in `.env`). Environment variables are loaded from `.env` in the working directory.

### Notes

- The binary is **architecture-specific**: build on the same arch you deploy to (x86_64 Linux).
- Run `npm run build:sea` on the target platform; cross-compilation is not supported by SEA.

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
│       ├── append.post.ts
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
