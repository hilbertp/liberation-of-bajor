# Operations Center — UX Specification

**Author:** Ziyal (UX Specialist)
**For:** Kira (Delivery Lead) → O'Brien (Backend Engineer)
**Status:** Locked — 6 screens complete
**Reference wireframes:**
- `ops-ux-concept.html` — full dashboard, 5 screens (incl. history briefing detail)
- `rubicon-panel-active-build.html` — Active Build panel focused exploration (all 4 idle states)

---

## Purpose

Operations Center (`localhost:4747`) is Philipp's personal operational control panel for the DS9 agent pipeline. Single user. Stays open throughout a working session. Used to:

1. Review and accept slices before they enter the build queue
2. Monitor what O'Brien is currently building
3. See what's queued, what's building, and what has completed

It is not a public product. It is an ops tool. Density and accuracy matter more than decoration.

---

## Screens

| Screen | What it shows |
|---|---|
| ① Active Build | O'Brien building. Queue has both staged and accepted items. History shows one row expanded (two-step pattern). |
| ② Slice Detail — Rendered | Edit clicked on a staged queue item. Kira's spec formatted for reading. Default view. |
| ③ Slice Detail — Source | Source tab selected. Same overlay, raw markdown editable inline. |
| ④ Idle — Staged items | O'Brien not building. Active Build shows Idle A nudge. Queue has staged items only. History all collapsed. |
| ⑤ History — Briefing Detail | "Details ›" clicked on a history row. Full original brief shown read-only. No approval actions. |
| (inline) Crew Roster | Agent manifest rendered inline below the four panels in Screen ①. |

---

## Layout

```
┌──────────────────────────────────────────────────────┐
│ Operations Center                      ▲▄▂▄▃ online  │
├─────────────────────────┬────────────────────────────┤
│ ACTIVE BUILD            │ POST-BUILD PIPELINE        │
│ (left 50%)              │ Nog + Bashir — mocked      │
│                         │ (right 50%, same height)   │
├─────────────────────────┼────────────────────────────┤
│ QUEUE                   │ HISTORY ↓ newest first     │
│ (left 50%, below build) │ (right 50%)                │
└─────────────────────────┴────────────────────────────┘
```

Implementation: CSS grid with named areas (`hero / postbuild / queue / history`). Active Build and Post-Build Pipeline share a grid row — height is driven by the taller of the two, both cells stretch to match.

**Information hierarchy** (what Philipp looks at in order):
1. Active Build — eye goes here first via counting timer and animation
2. Queue — directly below Active Build; staged items accepted here, build order managed here
3. Post-Build Pipeline (Nog/Bashir) — mocked for now, right column top
4. History — right column bottom, newest first

---

## Header

- **Left:** "Operations Center" — app title
- **Right:** `▲▄▂▄▃ online` — system health pill

**System health** answers one question: are the watcher and relay reachable? If either is down, data on screen may be stale.

States:
- `online` — watcher and relay both responding; heartbeat waveform visible
- `offline` — watcher or relay unreachable; pill turns red

**Heartbeat waveform** (`▲▄▂▄▃`): shows recent relay pulse activity. Visible on mouseover only — hover reveals per-service detail: watcher latency, relay latency, last poll time. At rest, only the status text (`online` / `offline`) is shown.

The header never shows slice data, elapsed time, or queue counts.

---

## Active Build Panel

> **Reference:** `rubicon-panel-active-build.html` — all four states

### Active state layout

```
┌──────────────────────────────────────┐
│ ACTIVE BUILD                 3m 22s  │  ← panel label left, timer top-right
│                              elapsed │
│ #054                                 │  ← ID, small, muted
│ Rate limiter backoff                 │  ← title, primary, bold
│ Adds exponential backoff to          │  ← short description, full, no truncation
│ failed relay calls…                  │
│                                      │
│ [Comm.] [▶ Dev] [Review] [QA] [Merged] │  ← pipeline stages
│                                      │
│ O'Brien · Backend Engineer  ■ Stop   │  ← footer: builder left, stop right
└──────────────────────────────────────┘
```

### Timer

- Top-right of the **Active Build panel** (not the page header)
- Counts up from 0 when a slice enters Development
- Large font (24px+), bold — primary animation element
- "elapsed" label below, smaller
- Hidden when idle — only appears when O'Brien is building

### Slice identity

- **ID** (`#054`) — small, muted. Secondary.
- **Title** — large (19px), bold. Written by Kira.
- **Short description** — one sentence, shown in full, no truncation. Kira is responsible for keeping it short enough to fit on one line at panel width. If it wraps, fix the slice file, not the UI.

### Pipeline stages

Five stages in a horizontal row: Accepted · Development · Review · QA · Merged

- Completed: green background + green border
- Active: dark filled background, white text
- Pending: outlined, muted

### Builder identification

Footer left: `O'Brien · Backend Engineer`. Identifies the active agent without a separate panel.

### Stop Build

- **Label:** `■ Stop Build`
- **Style:** Red border, cream background. Not filled — visually present but not alarming.
- **Behavior:** Confirmation dialog before acting.
  - Copy: *"Stop #054 — Rate limiter backoff? O'Brien's current work will be preserved but the slice returns to pending."*
  - Options: **Confirm Stop** / **Keep Building**

### Idle states (priority cascade)

When O'Brien is not building, the panel shows one of three states in priority order:

**Idle A — Staged items awaiting acceptance** (highest priority)
- Shown when `bridge/staged/` contains unaccepted files
- Primary: `"2 slices awaiting your approval"` — warning color
- Secondary: `"Accept below to start the next build →"` — arrow points down to Queue

**Idle B — Last completed, nothing staged**
- Shown when nothing is staged and at least one slice has ever merged
- Primary: `"Last: #052 — Layout refactor"` — neutral color
- Secondary: `"completed 1m 12s ago · All clear"`
- No time threshold — Idle B is the permanent non-active state. Age does not degrade the signal. Falls through to Idle C only if the system has no history at all.

**Idle C — All clear** (lowest priority)
- Shown when nothing is building, nothing is staged, nothing recent
- Primary: `"All clear"` — neutral, quiet
- Secondary: `"No active build, nothing pending"`

**Ruled out:**
- "1 slice queued — waiting for O'Brien": the window between PENDING file existence and watcher pickup is seconds and nearly unobservable
- Empty/placeholder states

---

## Queue Panel

**Position:** Left column, directly below Active Build

Shows every slice Kira has delivered — both unaccepted (staged) and accepted (in build order). All in one list. No separate gate panel. Approval is inline.

### Sprint label

Every slice belongs to a sprint (`Sprint 1`, `Sprint 2`, …). The sprint is a build sprint — a unit of work that culminates in a stakeholder demo. The sprint label is shown on every queue row and every history row, so Philipp can see which sprint a slice belongs to at a glance.

### Row format

```
⠿  Sprint n  Title of slice                [Accept]  [Edit]
⠿  Sprint n  Title of slice          [✓ Accepted]  [Edit]
```

- `⠿` drag handle — left edge
- `Sprint n` — sprint badge, small, muted border
- Title — primary identity
- Actions — right-aligned on the same line (see below)
- **No short description in the compressed queue view**

### Two row states

**Staged** — delivered by Kira, not yet accepted:
- Sprint badge, title, `[Accept]` (green) + `[Edit]`
- Accept moves the slice into the build queue at the next available position
- Edit opens the Slice Detail overlay (staged context: Approve / Refine / Reject)
- Drag handle visible but inactive — staged rows have no queue position

**Accepted** — approved by Philipp, in build order:
- Sprint badge, title, `[✓ Accepted]` (green filled) + `[Edit]`
- `[✓ Accepted]` is a toggle — clicking again returns the slice to staged
- Edit opens the Slice Detail overlay (accepted context: Save edits / Send to Kira / Remove from queue)
- Drag handle active — drag to reprioritize

### Approval order = build order

First accepted = first built. Drag any non-amendment accepted row to change build priority. The **(i)** icon on the panel title reveals this on click — not shown inline.

### Amendment rows

Amendments are auto-accepted and locked at position #1. Their drag handle is grayed and disabled. If multiple amendments exist, they sort among themselves by creation date (oldest first).

---

## Slice Detail Overlay

**Triggered by:** Edit on any queue row (staged or accepted).

Full-width overlay over the dashboard. Two tabs:

**Rendered (default)** — Kira's spec formatted for fast scanning:
- Sections: Goal · Scope · Out of Scope · Acceptance Criteria
- Acceptance Criteria are the primary thing to verify
- Screen ② in the wireframe

**Source** — raw markdown, editable inline:
- Changes saved to the slice file on disk immediately
- `spec-source-note`: "Edit directly — changes are saved to the slice file on disk."
- Screen ③ in the wireframe

### Actions by context

| Context | Actions |
|---|---|
| Staged item (Edit from staged row) | **Approve** · **Refine** · **Reject** |
| Accepted item (Edit from accepted row) | **Save edits** · **Send to Kira** · **Remove from queue** |

**Staged context:**
- Approve — sends slice to O'Brien; enters build queue
- Refine — returns to Kira for another pass; removed from queue
- Reject — drops the slice entirely; removed from queue (destructive, right-aligned)

**Accepted context:**
- Save edits — writes changes to the slice file on disk; no re-approval needed
- Send to Kira — removes from queue, routes back to Kira for a revision pass
- Remove from queue — drops the slice entirely (destructive, right-aligned)

The overlay is dismissed with `✕ close` top-right of the overlay header.

---

## History Panel

**Position:** Right column, below Post-Build Pipeline

Sorted **newest first** — labeled `↓ newest first` in the panel header.

### Row format

```
#053  Sprint 2  Slice detail modal             [merged]
#052  Sprint 1  Dashboard layout refactor           [merged]
```

- `#id` — small, muted
- `Sprint n` — sprint badge (same style as queue rows)
- Title — primary
- `[merged]` status badge — right-aligned, green

No short description. No timestamp — newest-first sort communicates recency.

Only "merged" items appear here. In-progress (Nog review / Bashir QA) items will appear in the Post-Build Pipeline panel when live (Sprint 3+).

### Two-step row expand

Each data row has a `▸` chevron as its first element. Clicking it expands the row in-place:

**Step 1 — Expand (chevron click):**
- Chevron rotates to `▾`
- A second line appears below the row showing:
  - Quick description: one sentence from the slice brief (italic, muted)
  - `Details ›` button right-aligned

**Step 2 — Full briefing (Details › click):**
- Opens the History Briefing Detail overlay (Screen ⑤)
- Full original brief, read-only
- Context bar shows: sprint · builder · outcome · duration · tokens · cost

Default state: all rows collapsed. One row may be in expanded state at a time (opening a new row collapses the previous — O'Brien implements this; wireframe shows both states side by side across screens ① and ④).

### History Briefing Detail overlay

Triggered by `Details ›` on any expanded history row. Full-viewport overlay over the dashboard.

**Header:** slice ID, title, context bar (sprint · builder · outcome · duration · tokens · cost), `✕ close`

**Body:** full brief contents — Objective, Context (file references), Tasks (numbered), Constraints, Acceptance Criteria

**Footer:** single `✕ Close` button — right-aligned. No approval actions. This slice is settled.

Dismiss with `✕ Close` button or Escape key.

---

## Post-Build Pipeline Panel

**Position:** Right column, top — same row as Active Build, matching height

**Current state:** Mocked — dashed border, 50% opacity, "coming soon" badge on both lanes. Not interactive.

Two lanes stacked vertically with a ↓ arrow between:

```
Nog — Code Review           [coming soon]
anti-patterns · style · linting · conventions
            ↓
Bashir — QA                 [coming soon]
E2E regression · user journey · sprint-gated
```

When live (Sprint 3+): a slice flows Development → Nog → Bashir → (optional acceptance gate) → Merged.

### Nog — Peer Reviewer

Reads what O'Brien wrote and applies the judgment a senior developer would apply.

- **Anti-patterns** — structural decisions that create future pain
- **Cleverness over readability** — code that requires a comment to explain what it does needs to be rewritten
- **Mistakes** — logic errors, off-by-one, wrong assumptions, obvious bugs
- **Team conventions and language** — naming, file structure, vocabulary consistent with the codebase
- **Coding and nesting style** — indentation discipline, avoidance of deep nesting, consistency across files
- **Linting** — hard gate; nothing passes Nog with lint errors

Nog does not write tests. He reads code.

### Bashir — End-to-End QA Engineer

Understands the product, not just the code. Reads both code and documentation to reconstruct the user journey, then writes tests that protect it.

- **User journey comprehension** — scours code and docs to understand what the product does from a user's perspective
- **Regression test composition** — writes E2E tests covering identified use cases; existing tests are maintained and extended, never regressed
- **Test pipeline execution** — two trigger modes:
  - *After every increment* — more thorough, higher token cost
  - *After every sprint* — default; a sprint is a work unit culminating in a stakeholder demo, not a calendar unit

Sprint-gated is the default. E2E costs stay proportional to demonstrated value.

Bashir does not review code style. He validates behavior.

---

## Crew Roster (Screen ⑤)

> **Reference:** `ops-ux-concept.html` — Screen ⑤

A full-page agent manifest. Shows every agent in the pipeline — both active (currently deployed) and planned (not yet built). Philipp uses this to understand who does what and what's coming.

### Layout

4×2 grid of agent cards. Order is fixed and intentional — reflects the pipeline sequence and delivery priority.

### Card anatomy

```
01
O'Brien
BACKEND ENGINEER
[ active ]

Builds accepted features end-to-end. Owns the watcher, relay, and server.
```

- **Number** — small, muted. Sequential ID, not a priority rank.
- **Name** — large, bold. The agent's identity.
- **Role** — small caps, muted. Functional label.
- **Status badge** — `[ active ]` in green or `[ planned ]` in muted. Outlined pill.
- **Function line** — one sentence describing what the agent does in the pipeline.

### Visual treatment

- **Active agents** — solid border, full opacity, hand-drawn jitter shadow (`:after`).
- **Planned agents** — dashed border, 55% opacity, no shadow. Not interactive.

### Agent manifest

| # | Name | Role | Status | Function |
|---|---|---|---|---|
| 01 | Sisko | Product Manager | Active | Owns the product vision, shapes bets, and approves what gets built. |
| 02 | Ziyal | UX Specialist | Active | Lo-fi wireframes and written specs. Output is optimised for fast stakeholder sign-off, not visual polish. Hands off to Kira with zero ambiguity. |
| 03 | Kira | Delivery Lead | Active | Breaks designs into slices, sequences the queue, and coordinates the pipeline. |
| 04 | O'Brien | Backend Engineer | Active | Builds accepted features end-to-end. Owns the watcher, relay, and server. |
| 05 | Nog | Code Reviewer | Planned | Peer-reviews O'Brien's output before it ships. Flags anti-patterns, style issues, and lint failures. |
| 06 | Bashir | QA Engineer | Planned | Writes and runs E2E tests covering user journeys. Sprint-gated by default. |
| 07 | Dax | Architect | Active | Holds the system architecture. Consulted on structural decisions and long-range design. |
| 08 | Worf | TBD | Planned | Role to be defined. |

### Ordering rationale

Order follows the slice lifecycle: vision → design → delivery → build → review → QA. Dax and Worf sit at the end as cross-cutting roles not tied to a single pipeline stage.

---

## Open Decisions

| # | Decision | Current assumption | Status |
|---|---|---|---|
| 1 | Heartbeat waveform visibility | Mouseover only — waveform hidden at rest, revealed on hover | **Decided** |
| 2 | "Recently completed" threshold (Idle B) | No threshold — Idle B is permanent, Idle C only when no history exists | **Decided** |
| 3 | Stop Build confirmation copy | "Stop #054 — Rate limiter backoff? O'Brien's current work will be preserved but the slice returns to pending." | Needs review |
| 4 | Post-build acceptance gate toggle location | Not specced yet | Sprint 3 |

---

## What this spec does not cover

- Watcher backend, API endpoints, file structures — O'Brien's domain
- Slice file format and directory structure — O'Brien's domain
- Queue ordering and amendment logic backend implementation — O'Brien's domain
- Landing page / contributor-facing design — separate surface (`bet2-dashboard-wireframe-balsamiq.html`)
- Sprint 3 features: Nog live, Bashir live, post-build acceptance gate
