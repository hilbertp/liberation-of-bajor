# T&T Requirements Clarification — Open Questions Before Slicing

**From:** Kira (Delivery Coordinator)
**To:** Sisko (Product Manager)
**Date:** 2026-04-13
**Scope:** Bet 3 — Time & Tracking system completion

---

## Why this exists

The T&T system is partially built. Before I can write implementation briefs, I need Sisko to make several product decisions. These aren't architecture questions (Dax already decided the mechanism) — they're scope, UX, and priority questions that only the PM can answer.

---

## What's already built

- `bridge/timesheet.jsonl` — 34 entries, active, all roles logging
- `bridge/tt-audit.jsonl` — 15 entries, tracks outbound handoffs
- `bridge/anchors.jsonl` — 15 entries, session boundary markers
- `check-handoffs` skill — T&T self-audit warns if previous session has no timesheet entry
- `wrap-up` skill — end-of-session consolidation (learnings, hours, cost, ideas, anchor)
- `handoff-to-teammate` skill — writes artifacts to receiver's `inbox/`, logs economics, stamps anchor
- `usage-snapshot.js` — calls Claude usage API, captures token delta. Works manually but not integrated.
- Watcher token capture — O'Brien's sessions tracked automatically via `--output-format json`
- TEAM-STANDARDS.md — updated with Standards #6 (wrap-up) and #7 (check inbox)
- All ROLE.md files — updated with "read TEAM-STANDARDS.md first" header
- `inbox/` migration — all handoff files moved to `roles/{role}/inbox/`

## What's NOT built (Dax's 4-item spec)

1. `bridge.config.json` needs a `coworkSessionKey` field
2. `usage-snapshot.js` needs config fallback + silent failure on expired cookie
3. `check-handoffs` skill needs to call `usage-snapshot.js --log` at session open
4. `handoff-to-teammate` skill needs to call `usage-snapshot.js --log` at session close

---

## Open questions for Sisko

### Q1: Is automatic Cowork token tracking in scope for now?

Dax's spec has roles calling `node bridge/usage-snapshot.js --log` at session open/close. But these are **markdown skill files read by Cowork roles** — the role would need to manually run the shell command during the session. It's not truly automatic.

Options:
- **(A)** Accept manual invocation — roles read the skill, run the command, move on. Simple but relies on discipline.
- **(B)** Defer Cowork token tracking entirely — O'Brien's tokens are tracked automatically by the watcher. Cowork roles log `human_hours` via the timesheet, which is the value metric. Token cost for Cowork sessions is nice-to-have but not essential for ROI calculations.
- **(C)** Build it properly — but that means a background process or watcher hook for Cowork, which is a bigger investment.

**Kira's recommendation:** Option B. The human-hours estimate is the real economics metric. O'Brien's token cost is captured automatically. Cowork token cost can wait until we have a proper mechanism — forcing roles to run a shell command mid-session is fragile.

### Q2: Session key UX — is monthly manual cookie refresh acceptable?

`usage-snapshot.js` requires a `sessionKey` cookie from Philipp's browser. This cookie expires approximately monthly. When it expires, Philipp needs to:
1. Open Cookie Editor in the browser
2. Find the `sessionKey` cookie for `claude.ai`
3. Paste it into `bridge/bridge.config.json`

Is this acceptable, or does this need a better solution before shipping?

### Q3: T&T self-audit scope — what does "check the sender" mean exactly?

The current `check-handoffs` T&T audit checks whether **your own** previous session logged time. It does NOT check whether the **sender** of the incoming handoff logged their time.

Philipp originally said: "the receiver of the handoff checks the sender of the handoff for T&T tracked." The current implementation doesn't do this — it checks yourself, not the sender.

Options:
- **(A)** Keep current behavior — self-audit only. Each role polices itself.
- **(B)** Add sender audit — when receiving a handoff, also check if the sender has a timesheet entry after their last `tt-audit.jsonl` record. Warn if missing.
- **(C)** Both — self-audit AND sender audit.

**Kira's recommendation:** Option C. Self-audit catches your own gaps. Sender audit catches the other role's gaps. Together they close the loop.

### Q4: Should the DS9 Cowork plugin skills be removed?

The DS9 plugin contains stale copies of 5 skills (check-handoffs, estimate-hours, handoff-to-teammate, debrief, idea-capture). The authoritative versions now live in the repo at `repo/.claude/skills/`. The plugin versions have outdated paths (no `inbox/` subfolder).

Options:
- **(A)** Install the stripped plugin (already packaged as `ds9.plugin` in repo root) — removes the stale skills. Roles discover skills through TEAM-STANDARDS.md.
- **(B)** Leave the plugin as-is — stale skills coexist with repo versions. Roles still discover the correct versions through TEAM-STANDARDS.md because every ROLE.md now says "read TEAM-STANDARDS first."
- **(C)** Update the plugin to match the repo — sync the plugin skills with the repo versions. Two sources of truth, but both are correct.

**Kira's recommendation:** Option A. One source of truth. The repo is authoritative. But this is a Philipp decision since it affects his Cowork setup.

### Q5: What's the priority order?

Given limited context windows and Philipp's budget (€39 left on extra usage this month), what should be briefed first?

- **(A)** usage-snapshot.js hardening (items 1-2 from Dax's spec) — makes the script reliable
- **(B)** Skill wiring (items 3-4) — integrates the script into the session lifecycle
- **(C)** Sender audit in check-handoffs (Q3) — closes the T&T enforcement loop
- **(D)** Skip all T&T implementation — the system works well enough with manual discipline. Focus budget on the base vs. Ruflo test instead.

**Kira's recommendation:** Option D. T&T works today through discipline (roles read TEAM-STANDARDS, follow the skills). The remaining items are polish. The base vs. Ruflo test is the next strategic milestone and should get the budget.

---

## What I need back

A decision on each of Q1–Q5. One-line answers are fine. Once I have them, I can either write briefs or move directly to the Ruflo test.
