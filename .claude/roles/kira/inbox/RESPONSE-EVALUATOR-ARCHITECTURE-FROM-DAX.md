# ADR: Relay-Invoked Commission Evaluator — Full Cycle

**From:** Dax (Architect)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-09 (v2 — rewritten to cover complete commission lifecycle)
**Scope:** Bet 2 — Contributor-facing relay & dashboard
**References:** `roles/dax/HANDOFF-COWORK-EVALUATOR-ESCALATION-FROM-KIRA.md`

---

## Decision

The evaluator runs **inside `orchestrator.js`** as a second pass in the existing poll loop, invoked via the same `claude -p` pattern already used for O'Brien commissions. No new process, no Cowork involvement.

This replaces `kira-commission-watch` entirely. The full cycle — commission, execute, evaluate, amend-or-accept, merge — runs autonomously in the relay.

---

## The Complete Cycle

Here is the full lifecycle of a commission, from Kira's write to merged code on main:

```
1. Kira writes {id}-PENDING.md          (commission with ACs)
2. Watcher renames PENDING → IN_PROGRESS
3. Watcher invokes O'Brien via claude -p  (stdin: commission content)
4. O'Brien works on branch, writes {id}-DONE.md
5. Watcher detects DONE, archives original as {id}-COMMISSION.md
   ─── existing behavior ends here, new behavior below ───
6. Next poll: no PENDINGs waiting → watcher scans for DONE files
7. Watcher renames DONE → EVALUATING     (prevents double-evaluation)
8. Watcher invokes evaluator via claude -p (stdin: commission ACs + DONE report)
9. Evaluator returns verdict:
   a. ACCEPTED → rename EVALUATING → ACCEPTED, write merge PENDING
   b. AMENDMENT_NEEDED (cycle < 5) → rename EVALUATING → REVIEWED, write amendment PENDING
   c. AMENDMENT_NEEDED (cycle ≥ 5) → rename EVALUATING → STUCK, surface to Philipp
10. If amendment PENDING written → back to step 2 (O'Brien picks it up)
11. If merge PENDING written → O'Brien merges branch to main → DONE → auto-accepted (merge commissions skip evaluation)
```

The loop is fully autonomous. Philipp only gets involved if a commission hits STUCK.

---

## Design Details

### 1. Poll loop extension

The existing `poll()` function checks for `-PENDING.md` files and returns early if `processing` is true. Extend it:

```
function poll() {
  if (processing) return;

  // Priority 1: PENDING commissions (existing behavior — unchanged)
  const pendings = scan for -PENDING.md
  if (pendings.length > 0) { process first PENDING; return; }

  // Priority 2: DONE files needing evaluation (new)
  const dones = scan for -DONE.md
  for each DONE file:
    if (isMergeCommission(id)) { auto-accept; continue; }
    if (hasReviewEvent(id)) { skip; continue; }
    rename DONE → EVALUATING
    set processing = true
    invokeEvaluator(id)
    return;

  // Priority 3: idle
}
```

PENDING always goes first. Evaluation only runs when the queue has no pending work. This means if Kira writes a new commission while O'Brien's previous DONE is waiting for evaluation, the new commission runs first. That's correct — Kira made a deliberate priority call by writing the commission.

### 2. Where the evaluator gets its inputs

**The ACs (success criteria):** Read from `{id}-COMMISSION.md` in the queue directory. The watcher already creates this file (line 540 of current `orchestrator.js`) — it renames IN_PROGRESS to COMMISSION after O'Brien finishes. The file contains the exact commission content Kira wrote, including all acceptance criteria. No need to parse the register.

**O'Brien's report:** Read from `{id}-EVALUATING.md` (the renamed DONE file). This is O'Brien's output.

**Amendment cycle count:** Read `register.jsonl`, find the `root_commission_id` for this commission (from its frontmatter, or self if it's the original), count how many REVIEWED events exist for that root. This gives cycle number N.

### 3. The evaluator prompt

```
You are Kira, Delivery Coordinator for Liberation of Bajor.

Your job: evaluate whether O'Brien's DONE report satisfies ALL acceptance criteria in the original commission. Be specific. If even one AC is not met, the verdict is AMENDMENT_NEEDED.

## ORIGINAL COMMISSION (contains the acceptance criteria):

{contents of {id}-COMMISSION.md}

## O'BRIEN'S DONE REPORT:

{contents of {id}-EVALUATING.md}

## AMENDMENT CYCLE: {n} of 5

## BRANCH: {branch name from DONE report frontmatter or register}

Respond with ONLY valid JSON, no other text:
{
  "verdict": "ACCEPTED" or "AMENDMENT_NEEDED",
  "reason": "One paragraph explaining your decision. Reference specific ACs.",
  "failed_criteria": ["list of specific ACs that were not met, empty if ACCEPTED"],
  "amendment_instructions": "If AMENDMENT_NEEDED: specific instructions for O'Brien to fix each failed criterion. Reference file paths and expected changes. If ACCEPTED: empty string."
}
```

The `failed_criteria` field is important — it gives O'Brien a checklist, not a vague "try again."

### 4. Evaluation outcomes

**ACCEPTED:**
1. Register event: `registerEvent(id, 'ACCEPTED', { reason, cycle })`
2. Rename: `{id}-EVALUATING.md` → `{id}-ACCEPTED.md`
3. **Write merge commission:** `{next_id}-PENDING.md` with:
   - Frontmatter: `type: merge`, `source_commission_id: {id}`, `branch: {branch_name}`
   - Body: "Merge branch `{branch}` to main. Verify tests pass. Write DONE report confirming merge."
4. Call `POST /api/bridge/review` with `{ id, verdict: "ACCEPTED", reason }`

**AMENDMENT_NEEDED (cycle < 5):**
1. Register event: `registerEvent(id, 'REVIEWED', { verdict: "AMENDMENT_NEEDED", reason, failed_criteria, cycle })`
2. Rename: `{id}-EVALUATING.md` → `{id}-REVIEWED.md`
3. **Write amendment commission:** `{next_id}-PENDING.md` with:
   - Frontmatter: all standard fields + `root_commission_id: {root}`, `amendment_cycle: {n+1}`, `branch: {branch_name}`, `type: amendment`
   - Body: the amendment instructions from the evaluator's response + "Continue working on branch `{branch}`. The original acceptance criteria are: {ACs from COMMISSION file}. Fix the following: {failed_criteria}."
4. Call `POST /api/bridge/review` with `{ id, verdict: "AMENDMENT_NEEDED", reason }`

**STUCK (cycle ≥ 5):**
1. Register event: `registerEvent(id, 'STUCK', { reason: "amendment cap reached", cycle, history })`
2. Rename: `{id}-EVALUATING.md` → `{id}-STUCK.md`
3. Do NOT write another PENDING. The commission is dead until Philipp intervenes.
4. Call `POST /api/bridge/review` with `{ id, verdict: "STUCK", reason }`

### 5. Merge commissions skip evaluation

Merge commissions (frontmatter `type: merge`) are a special case. When O'Brien finishes a merge and writes a DONE report, the evaluator should **auto-accept** — don't invoke `claude -p`. The merge either succeeded (DONE file exists) or it didn't (ERROR). There's nothing to evaluate against ACs.

Detection: check frontmatter of the COMMISSION file. If `type: merge`, skip evaluation, rename DONE → ACCEPTED, register ACCEPTED event. Done.

### 6. Branch continuity

This is critical for amendments. O'Brien must continue working on the **same branch** across the entire amendment cycle. The branch name flows through:

1. Original commission → O'Brien creates branch, records it in DONE frontmatter
2. Evaluator reads branch from DONE report
3. Amendment commission includes `branch: {name}` in frontmatter
4. O'Brien checks out existing branch instead of creating new one
5. Merge commission includes `branch: {name}` — O'Brien merges that specific branch

If the branch name is lost, the cycle breaks. O'Brien's DONE report **must** include the branch name in its frontmatter. The evaluator reads it and passes it forward.

### 7. The `processing` flag

Evaluation is a `claude -p` call — it takes minutes. It **must** set `processing = true` and follow the same lifecycle as `invokeOBrien`:

- Set `processing = true` before invoking
- Write heartbeat with `status: 'evaluating'` and `current_commission: {id}`
- On completion: set `processing = false`, update heartbeat to idle, increment `processed_total`

This ensures the watcher never runs two `claude -p` calls concurrently.

### 8. Crash recovery extension

The existing `crashRecovery()` handles orphaned IN_PROGRESS files. Extend it to also handle:

- `-EVALUATING.md` files → rename back to DONE (re-evaluate on next poll)

Same pattern as IN_PROGRESS → PENDING recovery.

### 9. Commission ID for amendments and merges

Use the existing `nextCommissionId()` function (line 870 of orchestrator.js). It scans the queue directory and returns the next zero-padded ID. Amendment and merge PENDING files get fresh IDs just like any other commission.

### 10. Register event timeline (example)

For a commission that needs one amendment before acceptance:

```jsonl
{"id":"025","event":"COMMISSIONED","body":"...ACs...","branch":null}
{"id":"025","event":"DONE","durationMs":120000}
{"id":"025","event":"REVIEWED","verdict":"AMENDMENT_NEEDED","failed_criteria":["AC3: no test coverage"],"cycle":1}
{"id":"026","event":"COMMISSIONED","body":"...amendment instructions...","root_commission_id":"025","branch":"slice/025-feature"}
{"id":"026","event":"DONE","durationMs":90000}
{"id":"026","event":"ACCEPTED","reason":"All ACs met including test coverage","cycle":2}
{"id":"027","event":"COMMISSIONED","type":"merge","source_commission_id":"026","branch":"slice/025-feature"}
{"id":"027","event":"DONE","durationMs":15000}
{"id":"027","event":"ACCEPTED","reason":"auto-accepted merge"}
```

The full chain is traceable: 025 → reviewed → 026 (amendment) → accepted → 027 (merge) → done.

---

## What O'Brien Needs to Build (revised)

1. **Evaluator scan in `poll()`:** after PENDING check, scan for DONE files. Skip if merge commission (auto-accept). Skip if already reviewed (register check). Otherwise rename to EVALUATING, set `processing = true`, invoke evaluator.

2. **`invokeEvaluator(id)` function:** same structure as `invokeOBrien()` — reads COMMISSION + EVALUATING files, constructs prompt, calls `claude -p`, parses JSON response, handles verdict.

3. **Verdict handlers:**
   - ACCEPTED → register event, rename to ACCEPTED, write merge PENDING with branch name
   - AMENDMENT_NEEDED → register event, rename to REVIEWED, write amendment PENDING with root_commission_id, branch, cycle, ACs + fix instructions
   - STUCK → register event, rename to STUCK, no new PENDING

4. **Merge auto-accept:** detect `type: merge` in COMMISSION frontmatter, skip evaluation, auto-accept DONE.

5. **Branch name propagation:** read branch from DONE frontmatter, write it into amendment and merge commission frontmatter.

6. **Crash recovery extension:** scan for EVALUATING files at startup, rename to DONE for re-evaluation.

7. **Heartbeat updates:** evaluator sets `status: 'evaluating'` while running, resets to idle on completion.

8. **CORS + HOST fix in `server.js`:** add `Access-Control-Allow-Origin` headers, change HOST from `127.0.0.1` to `0.0.0.0`.

---

## What Does NOT Change

- Kira still writes the initial commission (PENDING file with ACs) — that's the human-authorized entry point
- O'Brien's execution path (PENDING → IN_PROGRESS → DONE) — unchanged
- Commission format, frontmatter schema, queue directory — unchanged (new optional fields: `root_commission_id`, `amendment_cycle`, `branch`, `type`)
- `POST /api/bridge/review` endpoint — already built, evaluator calls it
- Register format — unchanged (new event types: ACCEPTED, REVIEWED, STUCK)

---

## Risk

**Cold evaluation quality.** The `claude -p` evaluator starts with no context beyond what's in the prompt. It may misjudge complex ACs. Mitigation: the prompt includes the full commission text and full DONE report — no information is lost. If quality is poor, iterate on the prompt. The amendment cap ensures it can't loop forever.

**Branch name loss.** If O'Brien's DONE report doesn't include the branch name, the amendment cycle breaks. Mitigation: O'Brien's prompt (the commission body) should explicitly instruct him to include the branch name in his DONE report frontmatter. This is a convention that needs to be enforced in all commission templates.
