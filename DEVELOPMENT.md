# NEXUS OS — Development Log

Living document: what is done, what is left, and why things are the way they are.

## Roadmap

| # | Stage | Status |
|---|-------|--------|
| 0 | Inspect workspace (empty), pick stack, provision Postgres 16 | ✅ |
| 1 | Backend skeleton: config, DB session, models, Alembic | ✅ |
| 2 | Auth: register / login / logout, server-side sessions, argon2 | ✅ |
| 3 | Domain APIs: tasks, projects, finance, goals, habits, calendar, activity | ✅ |
| 4 | Aggregates: dashboard + analytics endpoints | ✅ |
| 5 | AI assistant: Anthropic provider + honest "not configured" fallback | ✅ |
| 6 | Backend test suite (pytest, real Postgres) incl. tenant-isolation tests | ✅ |
| 7 | Frontend shell: design tokens, sidebar, command palette, auth pages | ✅ |
| 8 | Frontend modules wired to API | ✅ |
| 9 | Docker Compose, README, end-to-end verification | ✅ |

## Architecture decisions

* **Sessions, not JWT.** Login creates a random 256-bit token; only its SHA-256
  hash is stored in `user_sessions`. The raw token lives in an `HttpOnly`,
  `SameSite=Lax` cookie. Benefits: instant revocation (logout, "sign out other
  devices", password change), no secrets in JS-readable storage.
* **CSRF.** Cookie is `SameSite=Lax`; additionally every state-changing request
  must carry `X-Requested-With: nexus` — a header cross-site forms cannot set
  and that cross-origin fetch cannot send without a CORS preflight we reject.
* **Same-origin in the browser.** Next.js rewrites `/api/*` to FastAPI, so the
  browser only ever talks to one origin. CORS is still configurable for direct use.
* **Tenant isolation.** Every user-owned row has `user_id`. All reads go through
  `owned()` / `get_owned_or_404()` in `app/services/crud.py`; foreign keys passed
  in payloads (e.g. `project_id` on a task) are re-checked against the caller.
  A cross-tenant lookup returns **404** (never 403) to avoid leaking existence.
* **Money** is `NUMERIC(12,2)` in the DB and `Decimal` in Python; serialized as
  strings→numbers at the edge. Transactions carry a sign via `type`
  (`income`/`expense`); `amount` is always positive.
* **Budgets** are per-category monthly limits (`category = NULL` = overall cap),
  recurring every month.
* **Productivity score** (0–100), computed per local day of the user:
  `60% × tasks completed ÷ (completed + tasks due that day still open)` and
  `40% × habit check-ins ÷ active habits`. A component with no data is dropped and the
  weights re-normalised; a day with neither returns *no score* rather than 0.
  The same function (`app/services/stats.py`) feeds the dashboard and analytics.
* **Activity log** is written by services (not DB triggers) so messages are human-readable.
* **AI assistant** uses the official `anthropic` SDK, model `claude-opus-5-5` by
  default, streaming over Server-Sent Events. Without `ANTHROPIC_API_KEY` the
  API reports `configured: false` and the UI shows setup instructions plus
  deterministic *"Local insights"* that are explicitly labelled as non-AI.
* **Theme/accent** are stored on the user (`preferences` JSON) so they follow the account.

## Verification log (2026-11-25)

| Check | Result |
|---|---|
| Backend pytest (19 tests: auth, CSRF, sessions, cascade delete, **tenant isolation**, every module, dashboard/analytics math, AI-not-configured path) | ✅ 19/19 |
| `ruff check` / `tsc --noEmit` / `eslint` | ✅ clean |
| Playwright E2E on a fresh account: register (weak-password rejection) → project → task via `C` shortcut → complete → Kanban drag persisted → income/expense → budget → goal milestone → habit check-in → event linked to task → dashboard numbers → ⌘K theme switch → delete with confirm → mobile drawer, no horizontal overflow → logout → protected-route redirect | ✅ no page errors, no 5xx |
| AI chat SSE through the Next.js proxy with an invalid key | ✅ streamed `ai_auth` error shown honestly |
| AI chat with a **real** key | ⚠️ not verified — no key available in the build environment |
| `docker compose` stack (Postgres + API + Next standalone): migrations on boot, seed, login via proxy, dashboard | ✅ |

Bugs found and fixed during verification: sidebar nav components re-created on every render (broke the active-pill animation);
command palette dropped the first keystrokes (async focus); user menu opened below the viewport; nested ORM refs not
serialised from `model_validate`; analytics `GROUP BY` ordinal; invalid timezone produced 500 instead of 422; stale session
cookie could loop — API now clears it on 401.

## Remaining / next steps

* Recurring events and tasks (RRULE) — not implemented.
* Email verification / password reset by email — needs an SMTP provider.
* Rate limiting on `/auth/login` is in-process (per worker); use Redis for multi-worker.
* Calendar drag-to-reschedule.
