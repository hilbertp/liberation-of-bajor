# Bet 2 Dashboard — Design Spec for Slicing

**From:** Ziyal (Product Designer)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-08
**Scope:** Bet 2 — Contributor-facing relay & dashboard

---

## Why this exists

Sisko's design brief (`roles/ziyal/HANDOFF-BET2-DASHBOARD-FROM-SISKO.md`, codeword: riverdale) asked me to design the dashboard a stranger sees at `http://localhost:4747`. This handoff gives you everything you need to slice and commission the dashboard implementation (B2 in Dax's architecture, Section 10).

---

## What I'm handing you

Two files in `roles/ziyal/deliveries/`:

1. **`bet2-dashboard-design-spec.md`** — the full design spec: layout, visual direction (palette, typography, spacing), the "aha" moment (PENDING → IN PROGRESS transition), empty state design, all five elements defined with implementation detail, responsive breakpoints, and slicing guidance.

2. **`bet2-dashboard-wireframe.html`** — interactive wireframe. Open in a browser. Control panel in the bottom-right lets you simulate: the PENDING → IN PROGRESS transition, the empty state (demo mode), live state, degraded/offline health. This is what the dashboard should look and feel like.

---

## What you need to know for slicing

### The five elements (priority order)

1. **Active commission (hero)** — full width, accent border, glow on in-progress, transition animation when stage changes. This is the "aha" moment. **Highest priority — ship this first.**
2. **Role status panel** — 4-column grid: Kira, O'Brien (live status from API), Nog, Bashir (hardcoded "coming soon").
3. **System health pill** — header, top-right. ONLINE/DEGRADED/OFFLINE from heartbeat freshness.
4. **Queue panel** — pending commissions, left column of bottom grid.
5. **Recent completions** — last 5 done commissions, right column of bottom grid.

### Suggested slicing (my recommendation, your call)

**Commission A — Minimum viable dashboard:**
- Header with logo + health pill
- Active commission element with the transition animation
- Role status row (can be hardcoded initially, wired to API in a later pass)
- Polls `/api/bridge` every 5s

**Commission B — Complete dashboard:**
- Queue panel
- Recent completions panel
- Empty state / demo mode (demo banner, demo commission from `relay/demo/`)
- Responsive breakpoints (3 tiers: >768px, 481-768px, ≤480px)

The hero element alone communicates the product. Queue and recent are context that completes the picture.

### Technical constraints (from Dax architecture + Sisko brief)

- Single HTML file: `relay/dashboard.html`. Inline CSS and JS. No build step.
- Polls `GET /api/bridge` every 5s. API schema in Dax's architecture doc Section 4.5.
- Read-only. No forms, no inputs, no auth.
- Dark background, developer-tool aesthetic. **No LCARS.**
- All design tokens, colors, typography, spacing defined in the spec and wireframe CSS.

### What O'Brien needs from the spec

The spec Section 5 has a complete implementation reference for each element: data sources, state mapping, badge colors, time formatting, sort order. The wireframe CSS has every token defined as CSS custom properties — O'Brien can lift them directly.

For the transition animation specifically: Section 3 explains the implementation approach (compare `active.stage` across poll cycles, add/remove CSS class).

---

## What NOT to worry about

- **Relay server (B1)** — separate slice, must exist before the dashboard can poll it. Dashboard is B2.
- **README (B3)** — separate slice.
- **Kira status reading (B4)** — separate slice.
- **LCARS ops dashboard (Bet 3)** — completely different surface and aesthetic.
- **Visual design iteration** — the wireframe is the design. O'Brien implements what's in the wireframe. If something doesn't work in implementation, O'Brien flags it and I'll adjust.

---

## Reference files

| File | What it tells you |
|---|---|
| `roles/ziyal/deliveries/bet2-dashboard-design-spec.md` | Full design spec — the primary reference |
| `roles/ziyal/deliveries/bet2-dashboard-wireframe.html` | Interactive wireframe — open in browser |
| `docs/architecture/BET2-RELAY-DASHBOARD-ARCHITECTURE.md` Section 4.5 | API JSON schema |
| `docs/architecture/BET2-RELAY-DASHBOARD-ARCHITECTURE.md` Section 10 | Dax's slice recommendation |
| `roles/sisko/RESPONSE-BET2-ARCHITECTURE-FROM-DAX.md` | Sisko's confirmed decisions |
