---
id: "004"
title: "Slice 3 — Mara's Half"
from: mara
to: rook
priority: normal
created: "2026-04-06T00:00:00Z"
references: null
timeout_min: null
---

## Objective

Create `MARA.md` — Mara's project anchor, equivalent to your `CLAUDE.md` — plus supporting reference documentation for Mara's operational workflows: commission writing, report reading, report evaluation, amendment protocol, and polling pattern. A fresh Mara session must be able to read one file and know everything she needs to operate the bridge autonomously.

---

## Context

Slices 1 and 2 are ACCEPTED and merged to main. The watcher is live. Rook has `CLAUDE.md` as his anchor. Mara has no equivalent — each fresh session re-derives her workflows from the PRD and Architecture doc, which is slow and error-prone. Slice 3 fixes that.

**What already works (don't break it):**
- Mara writes commissions to `.bridge/queue/{id}-PENDING.md` — already functioning
- Mara reads reports from `.bridge/queue/{id}-DONE.md` — already functioning
- The watcher handles all state transitions — Mara never touches IN_PROGRESS or ERROR files directly

**What needs formalizing:**
- Mara's complete operating workflow in one readable file
- Amendment protocol (how to issue a follow-up commission referencing a prior one)
- Polling pattern (how to know when a report is ready without manual checking)
- Evaluation protocol (ACCEPTED vs. AMENDMENT REQUIRED decision)
- ID assignment rule (how Mara picks the next commission ID)

**Open questions Soren left for Mara (from Architecture §6):**

- **Q1: Amendment `references` field format** — single direct parent ID (`"003"`) or full ancestry chain (`["001", "003"]`)? You decide and document it.
- **Q2: Polling pattern** — how does Mara detect when a report arrives? Options: (a) poll for `{id}-DONE.md` by exact path, (b) scan directory for any DONE file, (c) check both DONE and ERROR. You decide and document it.
- **Q3: Commission complexity ceiling** — not blocking for v1; defer to a flag in the doc.

---

## Tasks

### Branch setup

1. **Create branch `slice/3-maras-half`** from `main`.

### Create `MARA.md`

2. **Create `MARA.md`** at the project root. This is Mara's anchor — the equivalent of `CLAUDE.md`. It must cover:

   **A. What this project is** (one paragraph, same framing as CLAUDE.md — consistent vocabulary)

   **B. Mara's role** — delivery coordinator; owns commission writing, ID assignment, report evaluation, accept/amend decisions; does NOT touch state transitions (watcher's job) or implementation (Rook's job)

   **C. Key file locations table** — same format as CLAUDE.md:
   - Queue directory, commission template, report template, watcher, heartbeat, log, contract specs, Rook's anchor

   **D. ID assignment rule** — scan `.bridge/queue/` for the highest existing ID across all files (PENDING, IN_PROGRESS, DONE, ERROR), increment by one, zero-pad to three digits. Example: if `003-DONE.md` is the highest, next ID is `004`. Never reuse an ID.

   **E. Commission writing workflow** — step by step:
   1. Check heartbeat (`heartbeat.json`) — if absent or timestamp >60s stale, the watcher is down; do not commission until it's restarted
   2. Assign the next ID
   3. Write `{id}-PENDING.md` using the commission template
   4. The watcher picks it up automatically — no further action needed from Mara

   **F. Polling pattern** — answer Soren's Q2 here. Recommended: poll for `{id}-DONE.md` by exact path (deterministic by ID Mara assigned). Also check for `{id}-ERROR.md`. Whichever appears first is the result. Check every 30–60s. Read heartbeat first to confirm bridge is live before waiting.

   **G. Report evaluation protocol**:
   - Read the report's `status` field: `DONE`, `PARTIAL`, or `BLOCKED`
   - `DONE` → evaluate against success criteria; if met: **ACCEPTED**; if not: **AMENDMENT REQUIRED**
   - `PARTIAL` → some work done; issue an amendment for the remainder
   - `BLOCKED` → Rook needs input; resolve the blocker, issue an amendment with the answer
   - `ERROR` file (written by watcher, not Rook) → infrastructure failure; investigate before re-commissioning

   **H. Amendment protocol** — answer Soren's Q1 here. Decision: `references` field contains the **direct parent commission ID only** (single string, e.g. `"003"`). Mara reconstructs the chain by reading the queue directory if needed. Full ancestry chains are not stored per-file — they're derivable. Document the amendment writing flow: new commission, new ID, `references: "{parent_id}"`, body explains what remains or what changed.

   **I. What Mara does NOT do**:
   - Never rename or delete queue files (watcher's job)
   - Never write ERROR files (watcher's job)
   - Never invoke `claude -p` directly
   - Never commit code or make git decisions (Rook's job)
   - Never expand or contract scope unilaterally (scope changes go through Philipp)

   **J. Commission complexity note** — flag: if a commission's context exceeds what fits cleanly in a single file, reference external files by path in the commission body rather than inlining. No formal ceiling defined for v1.

### Create supporting docs

3. **Create `docs/mara/`** directory with two reference files:

   **`docs/mara/evaluation-rubric.md`** — Mara's evaluation framework:
   - What "ACCEPTED" means (all success criteria met, deliverables committed, report written)
   - What triggers AMENDMENT REQUIRED (partial work, wrong branch, missing commit, success criteria not met)
   - Amendment vs. new commission distinction (amendment = continuation of prior work; new commission = new capability)
   - How to write an amendment (reference the format spec, show a short example frontmatter)

   **`docs/mara/amendment-examples.md`** — two worked examples:
   - Example 1: Rook delivered PARTIAL work — Mara issues an amendment for the remainder
   - Example 2: Rook was BLOCKED on a decision — Mara issues an amendment with the answer

### Commit

4. **Commit on `slice/3-maras-half`**:
   - `git add MARA.md docs/mara/`
   - `git commit -m "feat(slice-3): Mara's anchor and operational workflow docs"`
   - Then add and commit the queue files:
   - `git add .bridge/queue/`
   - `git commit -m "chore: commit queue files for commission 004"`

---

## Constraints

- Do not modify `CLAUDE.md`, `docs/contracts/`, `.bridge/watcher.js`, or any Slice 1/2 artifacts
- Do not modify PRD, Capability Map, or Architecture docs
- `MARA.md` must be self-contained — a fresh Mara session must be able to operate from it alone, without reading the PRD or Architecture doc
- Answer both of Soren's open questions (Q1 and Q2) in `MARA.md` — do not leave them open
- No code changes in this slice — pure documentation

---

## Success criteria

Mara will evaluate this report as ACCEPTED when:

1. `MARA.md` exists at the project root and covers all sections A–J
2. `MARA.md` is self-contained — no dependency on PRD or Architecture doc to operate
3. Soren's Q1 (amendment `references` format) is answered and documented
4. Soren's Q2 (polling pattern) is answered and documented
5. `docs/mara/evaluation-rubric.md` exists and covers the evaluation framework
6. `docs/mara/amendment-examples.md` exists with two worked examples
7. All work committed on `slice/3-maras-half`
8. Queue files committed (004-PENDING.md and 004-DONE.md)
9. Your report written to `.bridge/queue/004-DONE.md`
