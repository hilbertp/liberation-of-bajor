# Rubicon Dashboard — UX Concept Session

**From:** Kira (Delivery Coordinator)
**To:** Ziyal (UX Expert)
**Date:** 2026-04-11
**Scope:** Bet 2 — Contributor-facing relay & dashboard

---

## Why this exists

The Rubicon dashboard has been built iteratively through commissions — Miles (O'Brien) implementing one slice at a time based on delivery needs, not a coherent design vision. Philipp has been giving live feedback as panels are built ("too clunky", "too wide", "wrong idle state") and the dashboard has accumulated technical debt in its layout and UX.

Philipp wants to pause implementation and do a proper UX concept session with you before more panels are built. Your job is to interview him, understand what he actually needs, and produce a UX concept he can react to — wireframe or HTML prototype — before Miles writes another line.

---

## What you're asking for

1. **Interview Philipp** — ask him your UX questions directly in the conversation. He's the sole user of this dashboard.
2. **Produce a UX concept** — a structured concept (annotated wireframe or rough HTML) showing the full dashboard layout with clear panel hierarchy, idle states, and information architecture that Miles can then implement.
3. **Explicitly resolve the open UX problems** listed below — each needs a UX answer grounded in how Philipp actually uses the tool, not a visual decoration decision.

---

## What the dashboard currently is

The Rubicon (`localhost:4747`) is Philipp's operational control panel for an AI agent orchestration system. He uses it to:
- **Review and approve commissions** (work orders for Miles) before they enter the build queue
- **Monitor active build work** (what Miles is doing right now, how long it's taking)
- **See queue and history** (what's pending, what's done)

It is NOT a public product. It is a personal ops tool — one human user, one screen, used throughout a working session.

---

## What has been built and why

### Active Commission panel (top-left, 50% width)
Shows the commission Miles is currently working on: ID, title, current pipeline stage, elapsed timer, and a 5-stage pipeline bar (Commissioned → Development → Peer Review → QA → Merged).

**Why 50% width:** Philipp asked for it narrower so the right side could be used for something else (TBD). Currently the right 50% is blank — this is unresolved design space.

**Current problem:** When Miles is idle (not working), the panel shows stale mock data or just "No active commission." This is poor UX — the panel is a dominant element on the page but carries no value when idle. We discussed showing contextual info: staged commission count if items await review, last completed commission summary, or "All clear." Not yet implemented.

### Awaiting Your Review panel (Rubicon gate, 50% width)
Shows commissions staged for Philipp's approval before they enter the queue. Each card has: title, summary, Approve / Amend / Ask Kira buttons, and a Details expander.

**Why it exists:** Before the Rubicon gate, commissions went straight to Miles. Philipp caught a near-deletion of real code. The gate was added so Philipp sees and approves every commission before Miles touches it.

**Why 50% width:** Matched to the active commission panel width for visual alignment.

**Current problems:**
- Details expander shows raw markdown text — not rendered. Commission bodies are long and hard to read. (053 commissions a Read/Edit/Ask Kira modal — not yet built.)
- "Approve" button (formerly "Commission") — naming was only just corrected.

### Stats bar
Four stat cards in a horizontal row: Waiting / In Progress / Complete / Failed / For Review.

**Why it exists:** Early implementation to show queue health at a glance.

**Current problem:** Philipp called it "way too clunky and takes too much space for niche details." These numbers matter occasionally (debugging, curious) but are not primary information.

### Queue + History panels (bottom, two-column)
Queue shows live PENDING/IN_PROGRESS commissions. History shows all past commissions with ID, description, type, status, duration.

**Why they exist:** Philipp asked for the queue panel alongside history in commission 049 so he could see what's waiting without scrolling history.

**Current problem:** No known issue stated yet — but layout, density, and visual weight haven't been reviewed as a whole.

### Header
"The Rubicon" title on the left, watcher status (IDLE / PROCESSING dot + text) on the right.

---

## Open design problems to resolve

1. **What goes in the right 50% next to the active commission panel?** Philipp reserved it deliberately. No answer yet.

2. **Idle state of the active commission panel.** What does it show when Miles isn't working? Options discussed: contextual nudge (staged count, last completed), collapsed state, placeholder. No decision made.

3. **Stats bar.** Too clunky. Options: remove entirely, collapse to a single line, move into the header, show only on hover, show only non-zero values. Needs a design answer.

4. **Details expander in review cards.** Currently raw text. Commission 053 adds Read/Edit/Ask Kira modes. You should factor this into the card design — expanded cards get tall, how does that affect layout?

5. **Information hierarchy.** What does Philipp actually look at first, second, third? The current layout has no clear visual priority. The active commission, the review queue, and the stats bar all compete equally.

6. **Panel density.** Everything is card-based with generous padding. At full MacBook width this may feel sparse or fragmented. Is there a tighter, more terminal-ish density that suits an ops tool better?

---

## What NOT to worry about

- The watcher backend, API endpoints, file structures — those are O'Brien's domain.
- The Rubicon gate logic (approve/amend/reject flow) — that's locked, just the visual design of the panel.
- Landing page / public-facing design — that's a separate Leeta concern.
- Bet 3 features (Ruflo, new roles) — design for what exists in Bet 2 now.

---

## Context on Philipp's taste

- Pulled away from LCARS (DS9-themed dark UI) in favour of a clean light dashboard (commission 048).
- Said "simplistic maximum eye guiding design" when asked about font/spacing.
- Dislikes noise: simplified pipeline stages from 10 to 5, rejected mock data.
- Uses the dashboard throughout a working session — it stays open.
- Single user, MacBook screen.

---

## Prior design work from Ziyal

You previously produced `deliveries/bet2-dashboard-design-spec.md` and `deliveries/bet2-dashboard-wireframe.html` — these predate the LCARS removal and the current layout. They may have useful thinking but the visual direction has changed. Don't treat them as current.
