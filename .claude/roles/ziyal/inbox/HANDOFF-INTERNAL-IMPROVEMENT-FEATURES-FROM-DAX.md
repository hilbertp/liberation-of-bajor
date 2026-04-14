# Internal Improvement Features — Landing Page / Dashboard Promotion

**From:** Dax (Architect)
**To:** Ziyal (Designer)
**Date:** 2026-04-08
**Scope:** Bet 2 — Contributor-facing dashboard

---

## Why this exists

During Bet 2 architecture work we built several internal improvement capabilities that run across all DS9 roles. Sisko wants these surfaced as a minor feature section — they're not the hero story but they demonstrate that the platform improves itself as it works. You're the right person to figure out how to present them.

## What you're asked for

A design concept for a minor feature section (landing page, dashboard, or both — your call) that showcases the platform's self-improvement capabilities. These are secondary to the core relay/queue story but worth promoting because they show operational maturity.

## The features to promote

**Economics tracking.** Every role logs human-equivalent hours and token cost for every deliverable. The platform knows what work costs and what a human would have billed. Data lives in `bridge/timesheet.jsonl`. Key angle: "know what your AI workforce costs vs. what it saves."

**Idea capture.** Every role watches for future feature ideas during normal work and logs them to a central backlog (`IDEAS.md`). Ideas surface organically during architecture reviews, code reviews, delivery — they're captured inline, not in a separate brainstorm. Key angle: "your agents generate product ideas while they work."

**Continuous learning.** Each role maintains a `LEARNING.md` file with cross-project behavioral patterns. Learnings persist across sessions — a role that made a mistake once won't make it again. Key angle: "agents that get better over time."

**Debrief and review.** Project-specific observations are staged in `DEBRIEF.md` for Sisko to triage. The team self-reflects without being asked. Key angle: "built-in retrospectives."

**Cross-project role memory.** Role learnings carry forward to new projects. A Dax that learned "don't spike standard engineering problems" on Liberation of Bajor applies that lesson on the next project. Key angle: "institutional memory that compounds."

## What NOT to worry about

- Don't design the core relay/queue features — that's already scoped elsewhere.
- Don't design the Quark economics dashboard (that's a future bet idea, not Bet 2).
- Don't worry about exact copy — just the visual concept and information hierarchy. We'll refine copy later.

## Context the receiver needs

- The target audience is contributors and potential adopters evaluating the platform.
- These features are real and working today — they're not aspirational. Every artifact referenced above exists in the repo.
- The tone should be understated confidence, not hype. These are table-stakes for a mature AI orchestration platform.
- Reference files: `TEAM-STANDARDS.md` (standards 1-3), `skills/estimate-hours/SKILL.md`, `skills/idea-capture/SKILL.md`, `skills/debrief/SKILL.md`.
