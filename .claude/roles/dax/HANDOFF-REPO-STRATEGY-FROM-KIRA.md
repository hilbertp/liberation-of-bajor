# Repo Strategy — Monorepo vs Split for Lovable Integration

**From:** Kira (Delivery Coordinator)
**To:** Dax (Architect)
**Date:** 2026-04-09
**Scope:** Bet 2 — Contributor-facing relay & dashboard

---

## Why this exists

We are ready to commission the first frontend slice (the contributor dashboard) and route it to Leeta (Lovable). A hard constraint has surfaced that requires an architectural decision before Kira can write any commission: **Lovable can only connect to GitHub repos it created itself.** It cannot be connected to an existing repo.

This decision blocks delivery. Kira is not making it unilaterally — it has real technical trade-offs that belong to Dax.

---

## What you're being asked for

An ADR (or equivalent recommendation) answering: **which repo strategy should this project use going forward?**

The decision must be actionable — Kira needs to know where to route Leeta's first commission and whether O'Brien's backend path changes.

---

## The options

### Option A — Migrate everything to a Lovable-created repo (one repo)

Lovable creates a new GitHub repo. All existing code from `liberation-of-bajor` is migrated into it. Both Leeta and O'Brien work from the same repo going forward.

- **Pro:** One repo, no integration layer, simpler long-term
- **Con:** Migration cost, Lovable's repo structure may not suit a Node.js backend/bridge codebase, Lovable may impose constraints on project layout or tech stack
- **Con:** Lovable's repo is "owned" by Lovable's connected account — how does O'Brien commit? Does it push to the same remote? Needs verification.

### Option B — Two repos, API integration

Lovable creates a frontend repo. The existing `liberation-of-bajor` repo stays as the backend. The two communicate via an API (the dashboard's `server.js` already exposes endpoints; the frontend would call them).

- **Pro:** Clean separation of concerns, no migration risk, each tool owns its natural domain
- **Con:** Two repos to manage, CORS/API surface must be designed explicitly, deployment of both must be coordinated
- **Con:** O'Brien still works in `liberation-of-bajor`; if any backend changes are needed to support the frontend (new API endpoints), that's a separate O'Brien commission before or alongside Leeta's work

### Option C — Two repos, O'Brien also commits to Lovable repo

Lovable creates a frontend repo. O'Brien is also granted push access and can commit backend/API glue code into it. The existing `liberation-of-bajor` repo remains for the bridge/watcher infrastructure only.

- **Pro:** Avoids full migration, keeps bridge/watcher where it is, O'Brien can handle backend-for-frontend code in the Lovable repo
- **Con:** Two repos still exist, ownership boundaries are blurry, Lovable's layout expectations may conflict with O'Brien's work

---

## Current repo state (for context)

`liberation-of-bajor` contains:
- `bridge/` — watcher, queue, heartbeat, relay infrastructure (Node.js)
- `dashboard/` — `server.js` (Express, reads `register.jsonl`, serves JSON endpoints + static files)
- `docs/`, `.claude/` — project documentation and role files
- Slices 1–10 merged to main. Next commission ID: 020.

The dashboard frontend is currently a static HTML file (`lcars-dashboard.html`) served by `dashboard/server.js`. It reads from `bridge/register.jsonl` and `bridge/heartbeat.json`.

Ziyal has produced a full design spec and interactive wireframe for the new dashboard UI. That work is in:
- `/sessions/magical-compassionate-bell/mnt/01 - The Liberation of Bajor/bet2-dashboard-frontend-brief.md`
- `/sessions/magical-compassionate-bell/mnt/01 - The Liberation of Bajor/bet2-dashboard-wireframe-balsamiq.html`

---

## What NOT to worry about

- The content of the first Leeta commission — Kira handles that once the repo decision is made
- Lovable account setup or who clicks what in the UI — Philipp handles that
- Design decisions — Ziyal's brief is final

---

## What Kira needs back

1. Which option (or a variant) you recommend and why
2. If two repos: what the API surface between them should look like (even at a sketch level), so Kira can coordinate O'Brien and Leeta commissions correctly
3. If migration: any risks or sequencing constraints Kira should know before commissioning

A short ADR format is fine. This does not need to be exhaustive — just enough for Kira to route work confidently.
