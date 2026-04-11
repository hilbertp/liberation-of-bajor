# ADR: Repo Strategy — Two Repos, API Integration

**From:** Dax (Architect)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-09
**Scope:** Bet 2 — Contributor-facing relay & dashboard
**References:** `roles/dax/HANDOFF-REPO-STRATEGY-FROM-KIRA.md`

---

## Decision

**Option B — two repos, API integration.**

Lovable creates a new GitHub repo for the frontend dashboard. The existing `liberation-of-bajor` repo stays as the backend. The two communicate via the existing `/api/bridge` endpoint.

---

## Rationale

Option A (migrate everything) is the wrong tool for the wrong job. The `liberation-of-bajor` repo contains bridge infrastructure — YAML queue files, `.claude/` role files, shell scripts, the relay server, the watcher — that has no place in a Lovable-created frontend repo. Lovable is a React/UI tool. Pushing backend orchestration infrastructure into it creates a layout conflict with no payoff and real migration risk. The Bet 2 dashboard is also a disposable prototype by design — over-investing in repo consolidation now for a page that will be rewritten in Bet 3 is the wrong sequencing.

Option C (O'Brien also commits to Lovable repo) creates blurry ownership with no benefit over Option B. Avoid.

Option B is clean: each tool owns its natural domain. Lovable owns the React UI. `liberation-of-bajor` owns orchestration. The API is the seam.

---

## API surface

`server.js` already exposes one endpoint:

```
GET /api/bridge
→ { heartbeat, queue, commissions }
```

This is sufficient for the Bet 2 dashboard. Leeta only needs to poll this endpoint and render it.

**Two backend changes required before Leeta can call it cross-origin:**

1. **CORS headers** — server.js currently returns no `Access-Control-Allow-Origin` header. Add it.
2. **Bind to `0.0.0.0`, not `127.0.0.1`** — current binding is localhost-only. The Lovable frontend, hosted on Lovable's domain, cannot reach a localhost-only server. Change `HOST` to `0.0.0.0` (or make it configurable via env var).

That's one small O'Brien commission. Both changes are in `dashboard/server.js`.

---

## Sequencing for Kira

1. **Commission O'Brien first:** add CORS headers + change HOST to `0.0.0.0` in `dashboard/server.js`. Small, fast. Unblocks Leeta.
2. **Commission Leeta after O'Brien is done:** Lovable creates the frontend repo, builds the dashboard UI per Ziyal's spec, calling `GET /api/bridge` on the backend host/port.

O'Brien and Leeta cannot run in parallel — Leeta needs the CORS fix before she can develop against the real API.

---

## What Leeta needs to know

- Backend URL: TBD (wherever `server.js` is running — Philipp needs to confirm the host/port Lovable's frontend will call)
- Single endpoint: `GET /api/bridge`
- Response shape: `{ heartbeat: {...}, queue: { waiting, active, done, error }, commissions: [{id, title, state, from, created, completed}] }`
- Poll interval: every 5s (established in Bet 2 architecture)

---

## What does NOT change

- `liberation-of-bajor` repo structure, branch discipline, O'Brien's workflow — unchanged
- Queue lifecycle, watcher, relay service — unchanged
- Ziyal's design spec — unchanged, Leeta implements against it
