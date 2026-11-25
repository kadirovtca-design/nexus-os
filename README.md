# NEXUS OS

A personal operating system: tasks, projects, calendar, finances, goals, habits, analytics and an AI assistant — in one fast, keyboard-friendly web app.

| | |
|---|---|
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion · Lucide · Recharts · TanStack Query · dnd-kit |
| **Backend** | Python 3.13 · FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 · argon2 |
| **Database** | PostgreSQL 16 |
| **AI** | Anthropic Claude (official `anthropic` SDK, streaming over SSE) — optional |
| **Dev env** | Docker Compose |

## Live deployment

| Part | Where | URL |
|---|---|---|
| Web app (Next.js) | Netlify | https://nexus-os-app-4qjq.netlify.app |
| API (FastAPI, Docker) | Render, Frankfurt | https://nexus-os-api-vp7l.onrender.com/api/docs |
| PostgreSQL 16 | Render (free plan) | internal only |

The Netlify site proxies `/api/*` to the Render API (`API_URL` env var on Netlify), so the browser talks to a single origin and session cookies stay first-party.

**Free-tier caveats:** the Render API sleeps after 15 min without traffic (first request then takes ~1 min); the free Render database **expires 30 days after creation** (upgrade it, or point `DATABASE_URL` at another Postgres such as Neon). Netlify's free tier injects a comment and a script into the HTML, which makes React log a recoverable hydration warning (#418) in the browser console; the app is unaffected.

**Redeploying:** the Render API auto-deploys on every push to `main`. The Netlify site was deployed by upload; connect the GitHub repo in Netlify (*Project configuration → Build & deploy → Link repository*) to get automatic deploys too.

---

## Features

- **Dashboard** — greeting, daily productivity score, KPIs, weekly chart, focus tasks, upcoming events, goals, finance snapshot, activity feed, quick actions. All numbers come from the database.
- **Tasks** — create / edit / delete / complete, priority, due date, category, project; search, filters, sorting; **List** and **Kanban** (drag & drop, persisted order).
- **Projects** — colors, deadlines, status, live completion %, detail page with quick-add.
- **Calendar** — month / week / day views, overlapping-event layout, now-line, create/edit/delete, link events to tasks, “schedule this task” from the day view.
- **Finance** — income & expenses, categories, overall and per-category monthly budgets, balance, 6-month cash flow, category donut, spending pace vs. budget, auto-generated monthly report, CSV export.
- **Goals** — categories, deadlines, milestones (progress auto-computed, goal auto-completes), manual progress for goals without milestones, completion stats.
- **Habits** — daily check-ins, weekly grid (back-fill past days), current/best streaks, 30-day consistency vs. weekly target, 12-week heatmap.
- **Analytics** — productivity trend, throughput, on-time & completion rates, weekday activity, habit consistency, goal completion, financial trend, 6-month statistics table; 7D/30D/90D/1Y ranges.
- **AI assistant** — plan my day, summarize tasks, suggest priorities, analyze productivity, organize projects. Grounded in a JSON snapshot of your workspace. **If no API key is configured the UI says so and shows setup steps; nothing is faked.** Rule-based “Local insights” (clearly labelled *not AI*) work without a key.
- **Shell** — collapsible sidebar, mobile drawer, ⌘K command palette, keyboard shortcuts, toasts, skeletons, empty states, confirmation dialogs, page transitions, dark/light/system theme + 6 accent colors.
- **Account** — profile, preferences (currency, timezone, week start), password change, active sessions with revoke, account deletion.

### Keyboard shortcuts

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl K` / `/` | Command palette (search tasks & projects, run commands) |
| `C` | New task |
| `G` then `D T P C F G H A I S` | Go to Dashboard, Tasks, Projects, Calendar, Finance, Goals, Habits, Analytics, Assistant, Settings |
| Calendar: `←` `→` `T` `M` `W` `D` | Previous / next, today, month / week / day |

---

## Quick start (Docker)

```bash
cp .env.example .env
```

```bash
docker compose up --build
```

Open <http://localhost:3000>, create an account. Migrations run automatically when the backend starts.

Optional demo data (≈60 days of realistic history — login `demo@nexus.os` / `demo12345`):

```bash
docker compose exec backend python -m scripts.seed
```

---

## Local development (without Docker)

### Prerequisites
- Python 3.12+ and Node.js 20+ (22 recommended)
- PostgreSQL 16 running locally

### 1. Database

```bash
createuser -P nexus        # password: nexus (or your own)
```

```bash
createdb -O nexus nexus
```

```bash
createdb -O nexus nexus_test   # used by the test suite
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env       # edit DATABASE_URL if needed
alembic upgrade head
python -m scripts.seed     # optional demo data
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. The Next.js dev server proxies `/api/*` to `http://localhost:8000` (override with `API_URL`).

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://nexus:nexus@localhost:5432/nexus` | SQLAlchemy URL (psycopg 3 driver) |
| `ENVIRONMENT` | `development` | `development` \| `test` \| `production` |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `SESSION_TTL_DAYS` | `30` | Sliding session lifetime |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Only needed if the API is called cross-origin |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_SECONDS` | `8` / `300` | Login throttling per IP + email |
| `ANTHROPIC_API_KEY` | — | Enables the AI assistant |
| `AI_MODEL` | `claude-opus-5-5` | Any Claude model ID |
| `AI_EFFORT` | `low` | `low` \| `medium` \| `high` \| `xhigh` \| `max` |
| `AI_MAX_TOKENS` | `8000` | Max tokens per reply |
| `AI_REFUSAL_FALLBACK` | `true` | Use the API's server-side fallback when a model declines |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `API_URL` | `http://localhost:8000` | Where `/api/*` is proxied (build-time for production builds) |

### Docker Compose (`.env` at repo root)
See `.env.example`: Postgres credentials, published ports, optional AI settings.

---

## Enabling the AI assistant

1. Create an API key at <https://platform.claude.com/> → *Settings → API keys*.
2. Put `ANTHROPIC_API_KEY=sk-ant-...` in `backend/.env` (or the root `.env` for Docker).
3. Restart the backend. `/assistant` switches from the setup screen to live chat.

How it works: `POST /api/assistant/chat` builds a compact snapshot of the user’s workspace (open tasks, next 72h of events, habits, active goals/projects, this month’s finances, last-7-day scores), sends it with a stable, cacheable system prompt, and streams Claude’s reply back as Server-Sent Events. The assistant is read-only — it suggests, it never modifies data. Errors (bad key, rate limit, unavailable model, network) are surfaced to the UI as explicit messages.

---

## API

FastAPI generates interactive docs:

- Swagger UI — <http://localhost:8000/api/docs>
- ReDoc — <http://localhost:8000/api/redoc>
- OpenAPI JSON — <http://localhost:8000/api/openapi.json>

All endpoints are under `/api`. Main groups: `auth`, `users/me`, `tasks`, `projects`, `finance` (`transactions`, `budgets`, `summary`, `categories`), `goals` (+ `milestones`), `habits` (+ `check-in`), `events`, `activity`, `dashboard`, `analytics`, `assistant`.

> State-changing requests must include the header `X-Requested-With: nexus` (CSRF defence). In Swagger UI, log in via `POST /api/auth/login` first — the session cookie is then sent automatically.

---

## Security model

- **Passwords**: argon2id (`argon2-cffi`), transparent re-hashing when parameters change, constant-time login path for unknown emails.
- **Sessions**: random 256-bit token in an `HttpOnly; SameSite=Lax` cookie (`Secure` in production); only its SHA-256 hash is stored. Sliding expiry, logout, “sign out other devices”, and automatic revocation of other sessions on password change.
- **CSRF**: SameSite cookies + mandatory custom header on every non-GET request.
- **Authorization / tenant isolation**: every user-owned row carries `user_id`; all access goes through scoped helpers (`app/services/crud.py`). Foreign keys in payloads (e.g. `project_id`, `task_id`) are re-validated against the caller. Cross-tenant access returns **404**. Covered by `tests/test_isolation.py`.
- **Validation**: Pydantic schemas with strict types, lengths, enums, color/currency/timezone formats; DB `CHECK` constraints for money and event ranges.
- **Other**: login rate-limiting, security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `no-store` on API), no secrets in code — everything via environment variables.

---

## Project structure

```
nexus-os/
├── backend/
│   ├── app/
│   │   ├── api/            deps (auth, CSRF), rate limiter, routes/*
│   │   ├── core/           config, database, security
│   │   ├── models/         SQLAlchemy models
│   │   ├── schemas/        Pydantic request/response models
│   │   ├── services/       crud scoping, activity log, stats, finance, habits, ai/
│   │   └── main.py
│   ├── alembic/            migrations
│   ├── scripts/seed.py     demo data
│   └── tests/              pytest (real Postgres)
├── frontend/
│   └── src/
│       ├── app/            (auth)/login|register, (app)/dashboard|tasks|projects|calendar|finance|goals|habits|analytics|assistant|settings
│       ├── components/     ui/, layout/, forms/, charts/, and one folder per module
│       ├── lib/            api client, react-query hooks, types, utils, theme
│       └── proxy.ts        cookie gate for protected routes
├── docker-compose.yml
├── DEVELOPMENT.md          roadmap, decisions, next steps
└── README.md
```

### Data model

`users` · `user_sessions` · `projects` · `tasks` (→ project) · `transactions` · `budgets` · `goals` · `milestones` (→ goal) · `habits` · `habit_completions` (→ habit, unique per day) · `calendar_events` (→ task, optional) · `activity_logs`. All user data cascades on account deletion.

---

## Development commands

| Task | Command |
|---|---|
| Backend tests | `cd backend && pytest -q` |
| Backend lint | `cd backend && ruff check app tests scripts` |
| New migration | `cd backend && alembic revision --autogenerate -m "message"` |
| Apply migrations | `cd backend && alembic upgrade head` |
| Seed demo data | `cd backend && python -m scripts.seed --reset` |
| Frontend dev | `cd frontend && npm run dev` |
| Type-check | `cd frontend && npx tsc --noEmit` |
| Lint | `cd frontend && npm run lint` |
| Production build | `cd frontend && npm run build && npm start` |

Tests use the `nexus_test` database (override with `DATABASE_URL`) and recreate the schema via Alembic on each run.
