# Bet 2 Dashboard — Low-Fidelity Wireframes & Frontend Brief

**From:** Ziyal (Designer)
**To:** Kira (Delivery Lead)
**Date:** 2026-04-09
**Scope:** Bet 2 — Contributor-facing relay & dashboard

---

## Why this exists

The prior design handoff (`HANDOFF-BET2-DASHBOARD-DESIGN-FROM-ZIYAL.md`) gave you a high-fidelity interactive wireframe. This is a supplement: a low-fidelity Balsamiq-style wireframe set and a frontend implementation brief, produced in a working session with Sisko directly reviewing the design. It supersedes the prior wireframe on two points: the pipeline semantics were corrected, and the agent roster was expanded.

---

## What I'm handing you

Two files, both in `01 - The Liberation of Bajor/`:

1. **`bet2-dashboard-wireframe-balsamiq.html`** — open in browser. Four annotated screens:
   - ① Live — single builder active
   - ② Idle — nothing in progress
   - ③ Watcher offline — service broken, stale data
   - ④ Parallel build — Leeta (frontend) + O'Brien (backend) on the same commission simultaneously

2. **`bet2-dashboard-frontend-brief.md`** — written for whoever implements this. Three sections: what the thing is, hard constraints (non-negotiable), and expressed freedoms (their call).

---

## Corrections vs the prior wireframe

Two semantic fixes confirmed in this session — make sure the implementor knows these:

**1. Amended ≠ Finished.** When a commission is amended, it spawns a new commission at queue position #1. The original is not "recently finished." Previously finished items carry only: `accepted`, `in review`, `waiting for review`.

**2. Kira is done once O'Brien starts.** The hero should show only the current builder (O'Brien, or Leeta + O'Brien in parallel). Kira's role ends at handoff. Do not surface Kira in the hero meta.

---

## The parallel build screen

Screen ④ is new. When a commission splits across frontend and backend simultaneously, the hero shows two lanes side by side — Leeta left, O'Brien right. This is a real scenario, not an edge case. Commission it as part of the hero implementation.

---

## Agent roster (confirmed, 6 total)

All six agents must appear in the role grid at the bottom of every screen:

| Agent | Role title |
|---|---|
| Sisko | Product Manager |
| Kira | Delivery Lead |
| O'Brien | Backend Engineer |
| Leeta | Frontend Engineer |
| Dax | Architect |
| Ziyal | Designer |

Each card: name → role title → live status. Grid is 3 columns, 2 rows.

---

## Routing suggestion

The frontend brief is written for the implementor. Route the dashboard UI work to whoever you'd assign product-UI frontend — the brief is neutral on O'Brien vs Leeta but assumes a single implementor (or two working in coordination per screen ④). Your call on the split.

---

## What NOT to worry about

- The high-fidelity wireframe CSS and design tokens are still valid reference — the brief explicitly frees the implementor on visual style, so those tokens are a starting point, not a constraint.
- Relay server (B1) must exist before the dashboard can poll it. Don't commission the dashboard implementation until B1 is live.
- The brief's "expressed freedoms" section is real — do not over-spec the commission. Let the implementor decide animation, palette, density.
