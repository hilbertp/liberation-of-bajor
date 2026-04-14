# Operations Center — UX Spec & Wireframe Handoff

**From:** Ziyal (UX Specialist)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-11
**Scope:** Bet 2 — Operations Center (Philipp's personal ops tool, `localhost:4747`)

---

## Why this exists

Philipp and Ziyal completed the full UX design for the Operations Center dashboard in a working session. All four screens are locked and fully specced. This handoff gives you everything you need to slice and commission the implementation.

This is a **separate surface from the contributor-facing dashboard** (`bet2-dashboard-wireframe-balsamiq.html`). The Operations Center is Philipp's internal command-and-control view — not public, not for contributors.

---

## What I'm handing you

Two files in `01 - The Liberation of Bajor/`:

1. **`ops-ux-concept.html`** — open in browser. Four locked screens + inline crew roster:
   - ① Active Build — O'Brien building, queue with staged and accepted items, crew roster below
   - ② Commission Detail — Rendered view (default tab, read to approve)
   - ③ Commission Detail — Source view (raw markdown, inline edit)
   - ④ Idle — no active build, queue has staged items only, Idle A nudge visible

2. **`ops-dashboard-spec.md`** — the authoritative written spec. Use this as the commission reference source. The wireframe is the visual anchor; the spec is the contract.

---

## Key design decisions you must carry into commissions

### Queue panel — inline approval, no separate gate

There is no "Awaiting Your Review" gate panel. Approval is inline in queue rows.

- **Staged rows**: `⠿  Phase n  Title                    [Accept]  [Edit]`
- **Accepted rows**: `⠿  Phase n  Title              [✓ Accepted]  [Edit]`

Accepted rows: drag handle still present (for reordering accepted items), ✓ Accepted acts as a toggle (clicking reverts to staged), Edit opens the Commission Detail overlay.

### Phase labels

Every queue row and history row carries a Phase label — `Phase 1`, `Phase 2`, etc. This is the sprint/stakeholder-demo cycle the commission belongs to. It is **not** queue position. Queue position is implied by row order.

### Commission Detail overlay — two contexts

The overlay opens on Edit (any row) or Accept (staged only). Two tabs: Rendered (default) and Source. The action buttons change based on context:

- **Staged item** (Edit clicked): Approve / Refine / Reject
- **Accepted item** (Edit clicked): Save edits / Send to Kira / Remove from queue

### History rows

`#053  Phase 2  Commission detail modal             [merged]`

The `[merged]` tag is right-aligned (margin-left:auto). No description — title only.

### Post-build pipeline (Nog + Bashir)

Both are **coming soon** — Phase 3. Their panel is visible in the wireframe but rendered at 50% opacity with a dashed border. Do **not** commission Nog or Bashir implementation as part of this work. Wire the panel as a placeholder only.

### System health pill

`▲▄▂▄▃ online` — heartbeat waveform + status text. Two states: `online` (green) and `offline` (red). No intermediate states.

### Crew roster

Inline below the four panels in Screen ①. 4×2 grid. All 8 agents in pipeline order:

| # | Name | Role | Status |
|---|---|---|---|
| 01 | Sisko | Product Manager | active |
| 02 | Ziyal | UX Specialist | active |
| 03 | Kira | Delivery Lead | active |
| 04 | O'Brien | Backend Engineer | active |
| 05 | Nog | Code Reviewer | planned |
| 06 | Bashir | QA Engineer | planned |
| 07 | Dax | Architect | active |
| 08 | Worf | TBD | planned |

Active cards: solid border. Planned cards: dashed border, 55% opacity.

---

## Open decisions in the spec (do not block on these — build around them)

| # | Decision | Current assumption |
|---|---|---|
| 1 | Heartbeat waveform visibility | Mouseover only — waveform hidden at rest, revealed on hover. **Decided.** |
| 2 | "Recently completed" threshold (Idle B state) | No threshold — Idle B is permanent. Idle C only when no history exists. **Decided.** |
| 3 | Stop Build confirmation copy | See spec for draft copy |
| 4 | Post-build acceptance gate toggle location | Phase 3 |

---

## What NOT to worry about

- Nog and Bashir implementation — Phase 3, not your problem now
- Visual polish, pixel-perfect spacing — the wireframe is lo-fi, implementor has freedom within the layout intent
- The contributor-facing dashboard — separate surface, separate commissions
- Worf's role — still TBD, the card just shows "TBD" and "planned"
