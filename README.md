# FrontNX

A chat frontend for [LM Studio](https://lmstudio.ai) built with [Nuxt 3](https://nuxt.com) and [Nuxt UI](https://ui.nuxt.com).

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
server/api         (Nitro routes for file I/O)
```

## Requirements

- Node.js >= 20
- LM Studio running locally with API server enabled (default `http://localhost:1234`)

## Setup

```bash
npm install
```

Configure settings directly in [nuxt.config.ts](nuxt.config.ts):

- `runtimeConfig.public.lmStudioBaseUrl`
- `runtimeConfig.public.chatRequestTimeoutMs` (default `900000` = 15 minutes)

## Development

```bash
npm run dev
```

Opens at `http://localhost:3000`.

## Build

```bash
npm run build
npm run preview
```

Produces a production build in `.output/`.

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
│   └── api/session/           # Session persistence API routes
│       ├── create.post.ts
│       ├── append.post.ts
│       ├── rewrite.post.ts
│       └── read.get.ts
└── tests/
    └── services/
        └── session.service.spec.ts
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

## Features

- Model selection dropdown populated from LM Studio's available models
- Streamed responses with real-time token display
- Per-message deletion and full session clear
- Automatic session persistence to markdown files
- Markdown session files are human-readable and portable
