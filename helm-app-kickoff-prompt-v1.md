# HELM — Build Kickoff Prompt (v1)

This is a seed prompt for a fresh Claude Code session, written by the session
that built HANDOFF (same suite, same infra) after actually reading the live
source of `auth-worker`, `punch-worker`, PUNCH, `scout-intake`, `scout-addin`,
and TALLY this session — not from READMEs alone. Treat this as a well-informed
starting point, not gospel: the "Read this before writing any code" section
below tells you exactly what to verify against current source before building,
because source can drift out of sync with any prompt the moment someone else
touches it.

---

## Company / environment context

- Einbau Services Ltd. — custom architectural millwork installation subcontractor, Whitby, Ontario.
- Procore instance: `us02.procore.com`, company ID `562949953508586`.
- Existing infrastructure already in production and reusable:
  - Cloudflare Workers for OAuth/API proxying and app backends.
  - **`auth-worker`** (`https://auth.ben-a90.workers.dev`) — "Einbau ID," the shared login system this whole prompt is about building a front end for. KV-backed users (salted+hashed passwords, PBKDF2-SHA256), HMAC-signed session tokens (8h TTL, sliding refresh, 30-day absolute cap), rate limiting, an admin audit log. CORS is locked to `https://lambwright.github.io` — checked as an **exact `Origin` header match**, which does not include the path, so it already covers every app hosted at `lambwright.github.io/<anything>/` with zero changes needed.
  - Neon Postgres, Power Automate, GitHub Pages — same suite conventions as every other app here; **HELM v1 needs none of these** (see Stack below).
- **The "suite"**: SCOUT (bid prequalification, live), PUNCH (AI task management, live, single-user/Ben-only), INTAKE (entity/contact creation into NetSuite+Procore, live, popout of SCOUT), TALLY (expense/receipt processing, live), HANDOFF (Bid Board → Portfolio handoff automation, mid-build), and **LEDGER** (billing/reconciliation, PM-facing — status below). Long-term aspiration is possibly selling parts of this suite to other subcontractors; not relevant to HELM.

## The problem this app solves

1. **No admin UI exists over `auth-worker`'s own API.** Ben manages Einbau ID
   users (create, set-password, delete, list, audit) via raw `curl`/PowerShell
   today, or not at all. `auth-worker` already has full admin endpoints for all
   of this — nobody has built a front end for them.
2. **Getting a fresh session token for debugging is needlessly painful.** Every
   Claude Code session working on a suite app periodically needs a live Einbau
   ID bearer token (to test an admin-gated diagnostic route, etc.). The current
   workaround — a multi-line PowerShell script hitting `/auth/login` — has
   broken/needed troubleshooting more than once already (nested-quoting issues
   in Windows PowerShell 5.1), burning real session time on something that
   should be a one-click copy.
3. As the suite grows, both problems only get worse.

## Core scope for v1 — keep this small

1. **Thin React/Vite frontend on GitHub Pages**, same suite pattern, calling
   `auth-worker` directly (already CORS-allowed — see above, no `auth-worker`
   change needed).
2. **Login**: Einbau ID, identical pattern to every other app. Don't design
   this from scratch — copy TALLY's `web/src/auth.js` / `api.js` /
   `components/LoginScreen.jsx` near-verbatim (token storage in localStorage,
   sliding refresh via `/auth/verify`'s `refreshedToken`, a dev-mode Vite proxy
   so the browser stays same-origin past the CORS lock while developing).
3. **Once logged in as an admin** (`auth-worker`'s own `role: 'admin'`, which
   its `/auth/admin/*` endpoints already require):
   - **User list** — `POST /auth/admin/list-users`.
   - **Create user** — form → `POST /auth/admin/create-user` `{username, password, displayName, role}`.
   - **Set password** — per-user action → `POST /auth/admin/set-password`. Note in the UI that this immediately invalidates that user's existing sessions (auth-worker already does this — just surface it, don't reimplement).
   - **Delete user** — per-user action → `POST /auth/admin/delete-user`. auth-worker already refuses self-deletion; surface its error cleanly rather than re-validating client-side.
   - **Audit log viewer** — `POST /auth/admin/list-audit` → a plain table (actor, action, target, timestamp, IP).
4. **"Copy my session token"** (the actual trigger for building this now) — a
   button for any logged-in user (not admin-only — it just hands back the
   token for *their own* account, a privilege they already have by being
   logged in). **Simplest possible version, and start here**: the frontend
   already holds the current token in localStorage after login; the button
   just copies it to the clipboard. **No new backend endpoint required at
   all.** If it's stale, log in again — sliding refresh keeps it current
   otherwise.

## Explicitly deferred / not in v1

- **Any per-app settings/config/secrets management** (Cloudflare Worker vars,
  secrets, etc.) — there's no generalized shape for this across apps yet.
  Don't invent one speculatively; this is real future scope, not a v1 guess.
- **Per-app authorization/roles.** Each app layers its own authorization on
  top of Einbau ID's flat identity today, and they're all different: PUNCH
  gates on a single hardcoded username, TALLY uses an `ALLOWED_USERS` allowlist
  var, HANDOFF has its own roled `users` table (estimator/assignment/pm/admin).
  Unifying "who can do what in which app" into HELM is a real, valuable future
  direction — but a much bigger design question than v1 should try to solve.
  Confirm scope with Ben before touching this.
- **A dedicated "dev token" endpoint with its own lifecycle/scoping** distinct
  from a normal session token. Only build this if plain "copy my existing
  session token" turns out to be insufficient in practice — see Open Questions.
- **Any new Cloudflare Worker backend for HELM.** v1 should need none — it's a
  pure frontend over `auth-worker`'s existing API. If real HELM-specific server
  logic turns out to be needed later, that's a deliberate `helm-worker`
  decision to make then, not a default to reach for now.

## What's confirmed vs. not, about which suite apps use Einbau ID

- **Confirmed by reading actual source** (not assumed): SCOUT (`scout-addin/app.html`),
  INTAKE (`scout-intake`), PUNCH (`punch-worker`), TALLY, and HANDOFF all
  authenticate via Einbau ID / `auth-worker` today.
- **LEDGER: unconfirmed.** As of 2026-09-21 it has real, actively-developed
  code (`worker/`, `frontend/`, `db/`, `api-directory/`, under active
  development by its own separate Claude Code session) but no written
  documentation yet — its frontend README is still the unmodified Vite
  template default — and a source grep for Einbau ID / `auth-worker` usage
  found nothing. **Don't assume it's on Einbau ID.** Check LEDGER's own current
  source directly if/when it matters, or ask Ben — don't trust a stale claim
  either way.
- **This doesn't block v1.** User/password/token management is entirely an
  `auth-worker` concern, independent of which apps exist or what they do
  internally — HELM v1 doesn't need to understand any sibling app's business
  logic, only whether it participates in Einbau ID.

## Stack

- **Frontend**: React/Vite, GitHub Pages, matching the suite's existing
  pattern exactly. Copy HANDOFF's `web/src/theme.css` as a starting point (dark
  palette, JetBrains Mono/Oswald, the `--accent`/`--accent-rgb` token pattern)
  and pick a new accent color so HELM reads as its own app — TALLY is orange,
  SCOUT/INTAKE are green, HANDOFF is aquamarine, LEDGER will presumably claim
  its own; ask Ben before reusing blue (floated earlier as LEDGER's likely color).
- **Auth**: Einbau ID (`https://auth.ben-a90.workers.dev`) — **no changes
  needed to `auth-worker` for v1**; its existing admin endpoints already cover
  everything above.
- **Backend**: none for v1 — the frontend calls `auth-worker` directly, same
  as every other app's login flow already does.
- **Deploy**: same GitHub Pages Actions workflow as TALLY/HANDOFF
  (`.github/workflows/pages.yml`, a `VITE_AUTH_API` repo variable).

## Read this before writing any code

- **`auth-worker/src/index.js`** — read the actual current file, not this
  prompt's summary of it. ~440 lines as of this writing; holds the
  session-signing secret logic and the exact request/response shape for every
  `/auth/admin/*` endpoint, plus rate-limiting and audit behavior. This prompt
  may already be stale relative to it by the time you read this.
- **`auth-worker/README.md`** — the documented API table; cross-check against
  the source above, don't trust either alone.
- **`TALLY/web/src/auth.js`, `api.js`, `App.jsx`, `components/LoginScreen.jsx`**
  — the cleanest existing example of the Einbau ID frontend pattern to copy.
- Whichever of PUNCH / SCOUT / INTAKE / TALLY / HANDOFF's `theme.css` you like
  best as your visual starting point — don't design a new system from scratch.

## Notes from painful lessons learned building HANDOFF (same infra, same footguns)

- `wrangler secret put`'s interactive prompt silently mangles pasted values in
  Windows Terminal (displays a single `*` regardless of paste length, captures
  garbage/empty). If HELM ever needs a Worker secret, set it via
  `(Get-Clipboard).Trim() | npx wrangler secret put <NAME>` — never the
  interactive prompt.
- If HELM ever gets its own Worker (only if truly needed — see "explicitly
  deferred"), its `wrangler.jsonc` **must** declare `[vars]` explicitly before
  the first deploy. Deploying with no `[vars]` block is treated as
  authoritative by Cloudflare and silently wipes any plain vars already set on
  that Worker via the dashboard — this caused a real multi-day incident on
  `procore-worker`.
- A Worker calling another Worker's `*.workers.dev` URL via plain `fetch()` is
  blocked (Cloudflare error 1042) — use a service binding instead. Not
  relevant if HELM stays backend-less, but relevant the moment it isn't.
- This account's real per-invocation Cloudflare subrequest ceiling is ~8, well
  under the documented number — relevant only if HELM ever fans out several
  calls at once (e.g. a bulk user action).

## Open questions for Ben

1. Should "delete user" require a confirmation step beyond one click, given
   it's permanent and `auth-worker` has no undo?
2. Is the trivial "copy my current session token" button (no new backend)
   actually sufficient for the debugging-token use case, or is a genuinely
   longer-lived / differently-scoped dev token wanted? **Recommend starting
   with the trivial version** — it solves the real, already-felt pain with
   zero new backend code; only build more if that proves insufficient.
3. Repo name / GitHub Pages path — this prompt assumes `helm` →
   `lambwright.github.io/helm/`. Confirm with Ben.
4. Once LEDGER's Einbau ID status is confirmed either way, does HELM's user
   list need to show which apps a given account is expected to access, or is a
   flat list (matching `auth-worker`'s own flat KV store) enough for v1?
