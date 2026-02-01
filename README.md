# CLouds Code

> Web application wrapping Claude Agent SDK with superior context and agent management

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

## Overview

CLouds Code is an AI-powered development assistant that orchestrates multiple specialized Claude agents. It provides rich context management, multi-agent orchestration, workflow automation, and knowledge persistence — all built on the Anthropic Claude SDK.

Available as a **web app** (React + Express) and an **Electron desktop app** for macOS, Windows, and Linux.

## Features

- **Multi-Agent Orchestration** — An orchestrator delegates work to specialized agents: code-analyst, implementer, test-runner, and researcher, each with scoped tool access.
- **Smart Context Management** — Token budget tracking, per-agent cost breakdown, and memory injection to keep agents informed without exceeding limits.
- **Knowledge Base (Memory)** — Persistent facts, conventions, decisions, and architecture notes with full-text search. Supports workspace and project scopes.
- **Workflow Automation** — Built-in templates (add API endpoint, fix bug, add feature, refactor component) with dependency-aware step execution, quality gates, and rollback support.
- **Plan Management** — AI-assisted plan creation with step-by-step execution and agent assignments.
- **Project Auto-Discovery** — Scans your codebase to detect tech stack, frameworks, testing setup, CI/CD, and architecture patterns.
- **Rich Project Metadata** — 20+ metadata categories covering tech stack, architecture, testing, security, monitoring, and more.
- **Real-Time Streaming** — WebSocket-driven token streaming, agent lifecycle events, and live cost tracking.
- **OAuth & API Key Auth** — Supports Claude CLI OAuth flow or `ANTHROPIC_API_KEY` environment variable.
- **Desktop App** — Electron wrapper with native builds for macOS (DMG), Windows (NSIS), and Linux (AppImage/DEB).

## Architecture

```
@cloudscode/web ──► @cloudscode/shared ◄── @cloudscode/server
                                                    ▲
                                           @cloudscode/electron
```

| Package | Role |
|---------|------|
| **@cloudscode/shared** | Common TypeScript types (agent, session, memory, workflow, plan, project) and utilities shared across all packages |
| **@cloudscode/server** | Express API server with WebSocket support, SQLite persistence, agent orchestration, workflow engine, and context management |
| **@cloudscode/web** | React single-page app providing the chat interface, agent panel, memory management, plan editor, and project setup UI |
| **@cloudscode/electron** | Electron shell that embeds the server and loads the web frontend as a native desktop application |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, Vite 6, Zustand 5, Tailwind CSS 4, TypeScript 5.7 |
| Backend | Express 4, better-sqlite3, WebSocket (ws), Pino, Zod |
| AI | Anthropic Claude SDK, Claude Code SDK, MCP |
| Desktop | Electron 33 |
| Build | Turborepo, pnpm, tsx |

## Prerequisites

- **Node.js** (LTS recommended)
- **pnpm** 9.15+
- **Anthropic API key** or Claude CLI OAuth credentials

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd cloudscode

# Install dependencies
pnpm install

# Set up authentication (choose one):

# Option A: OAuth via Claude CLI
npx @anthropic-ai/claude-code login

# Option B: Environment variable
export ANTHROPIC_API_KEY=your-key

# Start development (web + server)
pnpm dev

# Or start with Electron desktop app
pnpm dev:electron
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start web + server in development mode |
| `pnpm dev:electron` | Start Electron desktop app in development mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm clean` | Clean all build artifacts |
| `pnpm dist` | Build distributable Electron app |
| `pnpm dist:mac` | Build macOS distributable (DMG) |
| `pnpm dist:win` | Build Windows distributable (NSIS) |
| `pnpm dist:linux` | Build Linux distributable (AppImage/DEB) |

## Project Structure

```
cloudscode/
├── packages/
│   ├── shared/                 # Shared types & utilities
│   │   └── src/
│   │       ├── types/          # Agent, session, memory, workflow, plan, project types
│   │       ├── utils/          # Shared utility functions
│   │       ├── constants.ts
│   │       └── index.ts
│   │
│   ├── server/                 # Express API server
│   │   └── src/
│   │       ├── agents/         # Agent definitions, orchestrator, sub-agent runner, context builder
│   │       ├── auth/           # API key provider
│   │       ├── context/        # Context management
│   │       ├── db/             # SQLite database, migrations, settings store
│   │       ├── plans/          # Plan manager
│   │       ├── projects/       # Project discovery & metadata
│   │       ├── routes/         # REST API routes (api, memory, plans, projects, settings, workflows)
│   │       ├── services/       # Business logic services
│   │       ├── workflows/      # Workflow engine, templates, executor, rollback, validation
│   │       ├── workspace/      # Workspace file management
│   │       ├── app.ts          # Express app setup
│   │       ├── config.ts       # Environment config (Zod-validated)
│   │       ├── index.ts        # Server entry point
│   │       ├── ws.ts           # WebSocket server
│   │       └── ws-handler.ts   # WebSocket message handler
│   │
│   ├── web/                    # React frontend
│   │   └── src/
│   │       ├── components/
│   │       │   ├── agents/     # Agent panel, detail views, tool call display
│   │       │   ├── chat/       # Chat view, message list, input, markdown rendering
│   │       │   ├── context/    # Context visualization
│   │       │   ├── layout/     # App layout components
│   │       │   ├── memory/     # Memory panel, editor, categories, promotion suggestions
│   │       │   ├── plan/       # Plan management UI
│   │       │   ├── projects/   # Project management UI
│   │       │   ├── settings/   # Settings modal, setup screen
│   │       │   └── setup/      # Project setup wizard
│   │       ├── hooks/          # Custom React hooks
│   │       ├── lib/            # Client-side utilities
│   │       ├── stores/         # Zustand state stores
│   │       └── App.tsx
│   │
│   └── electron/               # Electron desktop wrapper
│       ├── src/
│       │   ├── main.ts         # Electron main process
│       │   └── preload.cts     # Preload script
│       ├── resources/          # App icons and assets
│       └── scripts/            # Build helper scripts
│
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # pnpm workspace definition
├── turbo.json                  # Turborepo pipeline config
└── tsconfig.base.json          # Shared TypeScript config
```

## Configuration

Environment variables are validated with Zod on startup:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `DATA_DIR` | `.cloudscode-data` | SQLite database directory |
| `ANTHROPIC_API_KEY` | — | API key (alternative to OAuth) |
| `LOG_LEVEL` | `info` | Pino log level |
| `MAX_BUDGET_USD` | — | Optional per-project token budget limit |
| `PROJECT_ROOT` | `cwd` | Root directory for workspaces |

## Agent System

CLouds Code uses a multi-agent architecture where an orchestrator routes tasks to specialized sub-agents:

| Agent | Role | Tools |
|-------|------|-------|
| **Orchestrator** | Routes work and delegates to sub-agents based on task requirements | All tools |
| **Code Analyst** | Explores code, finds patterns, traces dependencies, analyzes architecture | FileRead, Grep, Glob |
| **Implementer** | Writes and modifies code, creates files, runs commands | FileRead, FileEdit, FileWrite, Grep, Glob, Bash |
| **Test Runner** | Executes tests, analyzes failures, reports results | Bash, FileRead, Grep, Glob |
| **Researcher** | Searches external documentation and gathers information | WebSearch, WebFetch, FileRead, Grep, Glob |

Each agent receives tailored context hints (memory, workspace files, project context, conversation history) based on its role.

## License

TBD
