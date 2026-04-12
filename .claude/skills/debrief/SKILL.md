---
name: debrief
description: "Continuous learning capture for every role. Use this skill whenever you observe something worth remembering — a friction point, a pattern, a correction from Sisko, a decision that worked or didn't. Also triggers on 'write a learning', 'capture this', 'debrief', 'add to learnings', 'what did we learn', or at the end of any significant deliverable. Every role must use this — it's a global team standard."
---

# Debrief — Continuous Learning Capture

This is a global team standard. Every DS9 role uses this skill. No exceptions.

## Why this exists

AI roles start fresh each session. Without written-down learnings, the same mistakes get repeated, the same discoveries get re-discovered, and the team never gets smarter. This skill ensures every role builds institutional memory as it works — not in a debrief meeting after the fact, but in the moment something worth remembering happens.

## Two destinations, two purposes

### 1. LEARNING.md (your role's cross-project memory)

**Location:** `repo/.claude/roles/{your-role}/LEARNING.md`

This is your personal playbook — behavioral patterns that apply across any project. A fresh session of your role reads this file and inherits everything you've learned.

**What goes here:**
- Platform or tooling constraints you discovered
- Communication patterns that work (or don't) with specific roles
- Corrections from Sisko that apply broadly
- Approaches that proved effective and should be repeated
- Mistakes worth avoiding in future projects

**Format:** Use numbered learnings grouped by topic. Each learning should have a clear title and enough context that a fresh session understands not just *what* but *why*.

```markdown
## Topic heading

### Learning N: Clear descriptive title
What happened, what was learned, and how to apply it going forward.
```

### 2. DEBRIEF.md (project-level observation staging)

**Location:** `repo/DEBRIEF.md` (project root)

This is a shared staging area for raw observations that haven't been triaged yet. Sisko and the team go through these periodically and route them to their permanent home (LEARNING.md, ROLE.md, a new skill, or discard).

**What goes here:**
- Friction in the workflow — things that were harder than expected
- Process gaps — missing steps, unclear handoffs
- Things that worked surprisingly well
- Ideas for improvement
- Anything that would be useful to discuss in a retrospective

**Format:** Numbered items, each with an `**Observed:**` line (what happened), and optionally a `**Pattern:**` line (the generalization) and `**Possible action:**` line (what could change).

```markdown
### N. Short title
**Observed:** What you saw or experienced.
**Pattern:** The broader pattern this represents (if any).
**Possible action:** What could be done about it.
```

## When to capture

Capture immediately when something happens. Don't batch. Don't wait for a debrief prompt. The moment you notice something — a workaround you had to use, a correction from Sisko, a dependency that surprised you — write it down.

Specific triggers:
- Sisko corrects your approach → LEARNING.md
- You discover a platform constraint → LEARNING.md
- A workflow step causes unexpected friction → DEBRIEF.md
- A decision works out well (or poorly) → either, depending on scope
- You finish a significant deliverable → pause and ask yourself "what's worth remembering from this?"

## What NOT to capture

- Things already documented in ROLE.md or the PRD
- Code patterns or architecture details (those belong in architecture docs)
- Ephemeral session state (what you're doing right now)
- Duplicate learnings — check if it's already captured before adding

## Ownership

Every role owns their own LEARNING.md. DEBRIEF.md is shared — any role can append to it. Triage happens with Sisko.
