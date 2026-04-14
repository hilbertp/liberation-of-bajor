---
id: "073"
title: "Rename /wrap-up to /housekeep-memory across the repo"
goal: "Every role, doc, and skill file refers to the skill by its new name so no role loads stale instructions on next session start."
from: kira
to: obrien
priority: normal
created: "2026-04-14T00:00:00Z"
references: null
timeout_min: null
---

## Objective

The `/wrap-up` skill has been renamed to `/housekeep-memory`. Sweep the repo for all references and update them so no role inherits the old name from documentation.

## Context

The skill currently lives at `.claude/skills/wrap-up/`. The rename decision was made 2026-04-14 — the skill is no longer an end-of-session action only; it is a mid-session memory consolidation checkpoint used multiple times per conversation. The new name reflects this.

The skill's own content (what it instructs the role to do) is separate scope — do not rewrite skill logic. This brief is a naming sweep only.

## Tasks

1. Grep the entire repo for the strings `wrap-up`, `wrap_up`, and `/wrap-up` (case-insensitive). Capture all matching file paths.
2. In each matching file, replace all occurrences of `/wrap-up` → `/housekeep-memory`, `wrap-up skill` → `housekeep-memory skill`, and `wrap-up` → `housekeep-memory` where it refers to the skill by name. Do not alter prose that uses "wrap up" as a plain English phrase (e.g. "to wrap up the session" in a narrative sentence).
3. Rename the skill directory: `mv .claude/skills/wrap-up .claude/skills/housekeep-memory`.
4. Rename the skill file inside it if it is named `wrap-up.md` or similar — match the directory name.
5. Commit all changes on branch `slice/73-rename-housekeep-memory` with message: `housekeep(073): rename /wrap-up to /housekeep-memory across repo`.

## Constraints

- Do not rewrite skill logic or instructions — naming sweep only.
- Do not rename occurrences of "wrap up" used as plain English (non-skill references).
- Do not touch `bridge/queue/` files — historical records are immutable.
- Branch must be `slice/73-rename-housekeep-memory`. Do not commit to main.

## Success criteria

1. `grep -r "wrap-up" .claude/ docs/ KIRA.md FEATURES.md TEAM-STANDARDS.md` returns zero matches referring to the skill name.
2. The directory `.claude/skills/housekeep-memory/` exists and `.claude/skills/wrap-up/` does not.
3. All changes are committed on branch `slice/73-rename-housekeep-memory` with no uncommitted modifications.
