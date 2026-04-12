# Code AI - ChatGPT-like AI Chatbot

A full-stack AI chatbot application built with **Express.js**, **Angular**, and **PostgreSQL**. Supports multiple AI providers (OpenAI, Anthropic, Google Gemini) with streaming responses, chat history, and user authentication.

## Features

- Real-time streaming responses (SSE)
- Multiple AI provider support (OpenAI, Anthropic, Gemini)
- User authentication (JWT)
- Chat history with multiple conversations
- Markdown rendering with code syntax highlighting
- Dark theme UI inspired by ChatGPT
- Responsive design (mobile-friendly)
- Render deployment ready

## Prerequisites

- **Node.js** 18+
- An API key for at least one AI provider (OpenAI, Anthropic, or Gemini)
- No database setup needed locally (uses SQLite by default)

## Local Development Setup

### 1. Clone and install dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
PORT=3000

AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### 3. Set up the database

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
```

> **Note:** Local dev uses **SQLite** (zero setup). For production on Render, the build process automatically switches to **PostgreSQL**.

### 4. Start the development servers

In one terminal, start the Express backend:

```bash
cd server
npm run dev
```

In another terminal, start the Angular frontend:

```bash
cd client
npm start
```

The app will be available at **http://localhost:4200**.

## Deploy to Render

### Using the Blueprint (recommended)

1. Push the code to a GitHub repository
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **New** > **Blueprint**
4. Connect your GitHub repo
5. Render will auto-detect `render.yaml` and provision:
   - A **Web Service** (Express.js serving Angular build)
   - A **PostgreSQL Database** (free tier)
6. Add your AI provider API key in the environment variables

### Manual Deployment

1. Create a PostgreSQL database on Render
2. Create a Web Service with:
   - **Build Command**: `cd client && npm install && npm run build && cd ../server && npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
   - **Start Command**: `cd server && node dist/index.js`
3. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `AI_PROVIDER`, `OPENAI_API_KEY`

## AI Provider Configuration

Set `AI_PROVIDER` to one of: `openai`, `anthropic`, `gemini`

| Provider | Env Variable | Models |
|----------|-------------|--------|
| OpenAI | `OPENAI_API_KEY` | gpt-3.5-turbo (default), gpt-4 |
| Anthropic | `ANTHROPIC_API_KEY` | claude-3-haiku (default), claude-3-sonnet |
| Google | `GEMINI_API_KEY` | `gemini-2.5-flash` (default; set `GEMINI_MODEL` if Google returns 404) |

Override the model with `OPENAI_MODEL`, `ANTHROPIC_MODEL`, or `GEMINI_MODEL`.

## Project Structure

```
code-ai/
├── render.yaml          # Render deployment blueprint
├── server/              # Express.js backend
│   ├── prisma/          # Database schema
│   └── src/
│       ├── index.ts     # App entry point
│       ├── config/      # Database config
│       ├── middleware/   # JWT auth
│       ├── routes/      # API routes
│       └── services/    # AI provider
├── client/              # Angular frontend
│   └── src/app/
│       ├── services/    # Auth & Chat services
│       ├── guards/      # Route guards
│       ├── pages/       # Login, Register, Chat
│       └── components/  # Sidebar, Message, Input
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/chat/conversations` | List conversations |
| POST | `/api/chat/conversations` | Create conversation |
| GET | `/api/chat/conversations/:id` | Get conversation |
| PATCH | `/api/chat/conversations/:id` | Rename conversation |
| DELETE | `/api/chat/conversations/:id` | Delete conversation |
| POST | `/api/chat/conversations/:id/send` | Send message (SSE stream) |
