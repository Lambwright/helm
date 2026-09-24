# HELM

The admin front end for **Einbau ID** (`auth-worker`) — the shared login
system every app in the suite (SCOUT, PUNCH, INTAKE, TALLY, HANDOFF) already
authenticates against. Before HELM, managing users meant raw `curl`/PowerShell
against `auth-worker`'s API, or not managing them at all.

Full design context lives in [`helm-app-kickoff-prompt-v1.md`](helm-app-kickoff-prompt-v1.md).
Two things it assumed turned out to need a real decision once building started
— recorded here since they're not in the kickoff prompt:

- **Archive, not delete.** The UI never permanently deletes a user — it
  archives them (`disabled: true`, sessions killed immediately, login
  refused, record and audit history intact, reversible any time via
  Unarchive). Permanent deletion still exists — `auth-worker`'s
  `/auth/admin/delete-user` — but on purpose isn't wired into HELM's UI;
  reach it via `curl` if you really mean it.
- **`auth-worker` gained two endpoints for this**: `/auth/admin/archive-user`
  and `/auth/admin/unarchive-user`, both additive/backward-compatible (see
  `auth-worker/README.md`). Existing users with no `disabled` field behave
  exactly as before.

## Layout

```
web/      React + Vite frontend (Einbau ID gated, admin-only feature set).
.github/  GitHub Pages deploy workflow for web/.
```

No backend of its own — `web/` calls `auth-worker` directly. If HELM ever
needs real server-side logic, that's a deliberate future `helm-worker`
decision, not a default to reach for.

## Features

- **Sign in** with any Einbau ID account (`/auth/login`).
- **Copy token** (any logged-in user, not admin-gated) — copies your current
  session token to the clipboard, for pasting into a `curl`/PowerShell
  session while debugging another app. No new backend endpoint; it just
  reads what's already in `localStorage` after login.
- **Admin-only** (`auth-worker`'s own `role: 'admin'`):
  - **Users** — list, create, set password (invalidates that user's
    sessions immediately, surfaced in the UI), archive/unarchive.
  - **Audit Log** — a plain table of every admin action: actor, action,
    target, timestamp, IP.

## Dev

```bash
cd web
npm install
npm run dev
```

Vite proxies `/auth` to `https://auth.ben-a90.workers.dev` in dev, so the
browser stays same-origin (`auth-worker`'s CORS is locked to
`https://lambwright.github.io`) — same pattern as TALLY/HANDOFF. No `.env`
needed for dev.

## Deploy

GitHub Pages via `.github/workflows/pages.yml`, same as every other suite
app. Needs one repo variable set (Settings → Secrets and variables →
Actions → Variables):

- `VITE_AUTH_API` = `https://auth.ben-a90.workers.dev`

Deploys to `https://lambwright.github.io/helm/` on push to `main` (path-filtered
to `web/**` and the workflow file itself).

## Open questions from the kickoff prompt

Still open, not needed to ship v1:

- Whether "copy my session token" (no new backend, no scoping/lifecycle of
  its own) stays sufficient in practice, or a genuinely separate dev-token
  endpoint turns out to be worth building.
- Whether HELM's user list should eventually show which suite apps a given
  account is expected to access — blocked on confirming LEDGER's Einbau ID
  status, and on deciding how much of "who can do what in which app" HELM
  should own at all (each app layers its own authorization differently today
  — PUNCH: hardcoded username, TALLY: `ALLOWED_USERS` var, HANDOFF: its own
  roled `users` table). Real future scope, not a v1 guess.

## Nice-to-haves (not bugs)

- **Cross-tab session sync.** Every suite app reads the shared
  `einbau_id_token` from localStorage once, on page load. A tab left open
  overnight won't notice that you logged out or back in from another tab
  until you reload it. A `window.addEventListener("storage", …)` that
  re-runs `verify()` when `einbau_id_token` changes would fix that. Worth
  doing in every app at once, not HELM alone.
