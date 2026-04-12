# Code AI - ChatGPT-like AI Chatbot

A full-stack AI chatbot application built with **Express.js**, **Angular**, and a database layer that uses **SQLite locally** and **PostgreSQL in production** (Render). Supports multiple AI providers (OpenAI, Anthropic, Google Gemini) with streaming responses, chat history, user authentication, and an optional **admin** account for user management.

## Features

- Real-time streaming responses (SSE)
- Multiple AI providers with **auto-detection** from API keys; provider and model chosen in the chat UI
- User authentication (JWT)
- Chat history with multiple conversations; client state clears correctly on logout / account switch
- Markdown rendering with code syntax highlighting
- Dark theme UI inspired by ChatGPT
- Responsive design (mobile-friendly)
- Optional **admin** user (env-driven): list users, edit name/email/password, delete users and all their data (`/admin`)
- Render deployment ready (`render.yaml` blueprint)

## Prerequisites

- **Node.js** 18+
- At least one AI provider API key (OpenAI, Anthropic, and/or Gemini)
- **Local:** SQLite only (no separate DB server). The default `DATABASE_URL` is `file:./dev.db`.
- **Production:** PostgreSQL (Render managed DB or any hosted Postgres)

## Local Development Setup

### 1. Clone and install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment variables

```bash
cd server
cp .env.example .env
```

Edit `server/.env`. For typical local development, use SQLite:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-jwt-secret-change-in-production"
PORT=3000

# At least one provider key (more keys = more options in the UI dropdown)
GEMINI_API_KEY=your-key-here

# Optional: single admin user (created/updated on server startup)
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=your-secure-password
# ADMIN_NAME=Admin
```

See `server/.env.example` for optional model overrides (`GEMINI_MODEL`, etc.) and admin variables.

### 3. Set up the database (SQLite)

The checked-in `prisma/schema.prisma` targets **SQLite** for local dev.

```bash
cd server
npx prisma generate
npx prisma db push
```

`db push` syncs the schema to `dev.db` without requiring Postgres migration SQL.

### 4. Start the development servers

**Terminal 1 — API**

```bash
cd server
npm run dev
```

**Terminal 2 — Angular**

```bash
cd client
npm start
```

Open **http://localhost:4200**. The dev proxy sends `/api` to the server (default port `3000`).

### Using PostgreSQL locally (optional)

If you prefer Postgres locally, copy `prisma/schema.production.prisma` over `prisma/schema.prisma`, set a `postgresql://...` `DATABASE_URL`, run `npx prisma migrate deploy`, then switch back before committing unless you intend to run only Postgres. The Render build overwrites `schema.prisma` from `schema.production.prisma` automatically (see below).

## Deploy to Render

### Blueprint (`render.yaml`)

1. Push the repository to GitHub.
2. In the Render dashboard: **New** → **Blueprint** → connect the repo.
3. Render provisions the web service and PostgreSQL from `render.yaml`.
4. Set **sync** secrets in the dashboard as needed: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and optionally `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.

The build command copies the production Prisma schema, generates the client, runs migrations, and builds the server:

```text
cd client && npm install --include=dev && npm run build && cd ../server && npm install --include=dev && cp prisma/schema.production.prisma prisma/schema.prisma && npx prisma generate && npx prisma migrate deploy && npm run build
```

`--include=dev` is required so Angular CLI and TypeScript are installed when `NODE_ENV=production`.

**Start command:** `cd server && node dist/index.js`

### Manual Render setup

Use the same build and start commands as above. Link `DATABASE_URL` to your Render Postgres instance. Set `JWT_SECRET` and your AI (and optional admin) environment variables.

## AI provider configuration

Providers are **not** chosen with a single `AI_PROVIDER` env var. Any key you set is detected; the chat screen offers a **provider** and **model** dropdown.

| Provider   | Environment variable   | Notes |
|------------|------------------------|--------|
| Google     | `GEMINI_API_KEY`       | Default catalog includes models such as `gemini-2.5-flash`; optional `GEMINI_MODEL` |
| OpenAI     | `OPENAI_API_KEY`       | Optional `OPENAI_MODEL` |
| Anthropic  | `ANTHROPIC_API_KEY`    | Optional `ANTHROPIC_MODEL` |

If multiple keys exist, the user picks the provider in the UI. If a model env is unset, built-in defaults apply.

## Admin user (optional)

When **all three** are set, the server creates or updates **one** admin user on every startup:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

That user has `isAdmin: true`, sees **Manage Users** in the sidebar, and can open **`/admin`** to list users, update name/email/password, or delete a non-admin user (cascades conversations and messages). If any of the three variables is missing, no admin is provisioned from env.

Admin APIs require a valid JWT and `isAdmin` on the user record.

## Project structure

```
code-ai/
├── render.yaml
├── server/
│   ├── prisma/
│   │   ├── schema.prisma              # SQLite (local dev)
│   │   ├── schema.production.prisma   # PostgreSQL (copied over on Render build)
│   │   └── migrations/                # Applied on Postgres (e.g. Render)
│   └── src/
│       ├── index.ts
│       ├── env.ts
│       ├── config/
│       ├── middleware/                # auth, admin
│       ├── routes/                    # auth, chat, admin
│       └── services/                  # AI providers, admin seed
├── client/
│   └── src/app/
│       ├── services/                  # Auth, Chat, Admin
│       ├── guards/                    # auth, admin
│       ├── pages/                     # login, register, chat, admin
│       └── components/
└── README.md
```

## API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | JWT | Current user (`isAdmin` when applicable) |
| GET | `/api/chat/conversations` | JWT | List conversations |
| POST | `/api/chat/conversations` | JWT | Create conversation |
| GET | `/api/chat/conversations/:id` | JWT | Get conversation + messages |
| PATCH | `/api/chat/conversations/:id` | JWT | Rename conversation |
| DELETE | `/api/chat/conversations/:id` | JWT | Delete conversation |
| POST | `/api/chat/conversations/:id/send` | JWT | Send message (SSE stream); body may include `provider`, `model` |
| GET | `/api/chat/providers` | JWT | Available providers/models for the UI |
| GET | `/api/admin/users` | JWT + admin | List users |
| PATCH | `/api/admin/users/:id` | JWT + admin | Update user (`name`, `email`, `password`) |
| DELETE | `/api/admin/users/:id` | JWT + admin | Delete user and related data (not admin) |
| GET | `/api/health` | — | Health check |

In production, the Express app also serves the Angular build and `GET *` returns `index.html` for client-side routes.
