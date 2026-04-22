# Per-Slice Tracking Architecture — Token, Time, Human Hours

**From:** Kira (Delivery Coordinator)
**To:** Dax (Architect)
**Date:** 2026-04-11
**Scope:** Bet 3 prerequisite — Ruflo evaluation framework

---

## Non-negotiable requirement

**This system must be bulletproof.** The current timesheet has 5 entries across all roles combined, ever. O'Brien has zero. Kira has zero. The system exists in name only. Philipp's requirement is not "improve tracking" — it is "make tracking impossible to skip." Any architecture that relies on a role remembering, choosing, or being reminded to log has already failed. The solution must be structural: if data is not logged, the system breaks visibly. Silent omission is not acceptable.

---

## Why this exists

Philipp is beginning Bet 3 with a controlled experiment: run the same commissions through the legacy watcher (O'Brien via `claude -p`) and through Ruflo (new framework, ~40k GitHub stars, claims 75% token savings via model routing). To make the comparison meaningful, we need per-slice tracking of:

1. **Token count** (in + out) — real data from the runtime
2. **Real elapsed time** — stopwatch from commission pickup to DONE
3. **Estimated human hours** — how long a human developer would take to do the same work

This tracking must work on both the legacy path and the Ruflo path, outputting to the same schema so results are directly comparable.

---

## What already exists

- `bridge/orchestrator.js` already captures token data from `claude -p --output-format json` response (`session.tokensIn`, `session.tokensOut`, `session.costUsd`) — but only at the **session level** (aggregate across all commissions in one watcher run), not per-slice.
- `pickupTime` is tracked per commission inside `invokeOBrien()` — elapsed time is already calculated, just not persisted to disk.
- `bridge/timesheet.jsonl` exists with a manual schema used by DS9 roles. Not auto-populated by the watcher.
- `ds9:estimate-hours` skill exists for manual use by DS9 roles. Not wired into O'Brien's flow.

---

## The three architecture questions

### 1. Human hours estimation — who, when, how?

**Decided: O'Brien estimates, intra-slice.** O'Brien is ephemeral across slices but has full memory within a slice — he experiences the entire inference: the dead ends, the complexity, the decisions made mid-session. Kira sees only the brief and the result. Anon sees only the ACs and DONE report. O'Brien is the only one who lived the work.

O'Brien writes the following structured fields to his DONE report:
- `tokens_in` — input tokens consumed
- `tokens_out` — output tokens generated  
- `elapsed_ms` — wall-clock time from pickup to done
- `estimated_human_hours` — his judgment of how long a skilled human developer would take for the same work
- `compaction_occurred` — boolean; if the context window filled and compacted mid-session, this is an estimation-influencing event that should be logged, not silently absorbed. A compaction signals the work was complex enough to exhaust a context window — human hour estimates should be higher in these cases.

Kira optionally adds `expected_human_hours` to commission frontmatter as a pre-estimate. Over time, the delta between Kira's expected and O'Brien's actual reveals scope accuracy.

What still needs your input: schema design for `slicelog.jsonl` and how the watcher parses O'Brien's structured DONE fields.

### 2. Data schema and persistence

Where does per-slice data land, and in what format?

Current `timesheet.jsonl` schema (manual):
```json
{
  "ts": "ISO 8601",
  "role": "kira",
  "scope": "Bet 2 — ...",
  "deliverable": "slug",
  "session_start": "ISO 8601",
  "human_hours": 0.5,
  "notes": "..."
}
```

This schema is role-session oriented, not commission-slice oriented. We likely need a separate `bridge/slicelog.jsonl` (or extend the DONE file) with a per-slice schema:

```json
{
  "id": "052",
  "title": "...",
  "runtime": "legacy|ruflo",
  "tokens_in": 12400,
  "tokens_out": 3200,
  "cost_usd": 0.047,
  "elapsed_ms": 187000,
  "estimated_human_hours": 1.5,
  "estimated_by": "anon|kira|obrien",
  "result": "ACCEPTED|REJECTED",
  "ts_pickup": "ISO 8601",
  "ts_done": "ISO 8601"
}
```

Should the watcher auto-append to this log? Should the DONE report include structured fields the watcher parses? Or should this be separate infrastructure entirely?

### 3. Ruflo parallel tracking

Ruflo handles its own model routing — it may route sub-tasks to different models within a single commission. The token accounting may come back differently (multiple model calls, each with their own token counts). 

Does the schema need to accommodate per-model breakdown within a slice, or is aggregate per-slice sufficient for the Bet 3 comparison?

Also: the fork structure. Philipp wants to run legacy and Ruflo in parallel on the same commissions. Recommendation on branch strategy: `bet3/ruflo` off main vs full GitHub fork?

---

## What I need from you

1. **Recommended approach for human hours estimation** — pick one of the options above (or propose a better one) with rationale.
2. **Data schema** — define the per-slice log format and where it lives.
3. **Watcher integration pattern** — how does the watcher (or Ruflo) write to this log without breaking existing flow?
4. **Fork/branch recommendation** for the Ruflo experiment.

Once you've answered these, I'll commission O'Brien to implement the watcher side, and we'll handle the Ruflo side when Ruflo is initialized.

---

## Current state of timesheet.jsonl — confirmed broken

Philipp audited the file. Findings:
- 4 Mara entries (April 6, pre-DS9 rename)
- 1 Ziyal entry (today)
- O'Brien: zero entries ever
- Kira: zero entries ever
- Dax, Sisko, Anon: zero entries ever

This is not a discipline problem — it's an architecture problem. Self-reporting by ephemeral roles will never be reliable. Your architecture must solve for enforcement, not just schema:

1. **Watcher auto-writes O'Brien + Anon entries** — the watcher already has tokens and elapsed time. It must persist this after every commission and every evaluation automatically. No O'Brien action required except writing `estimated_human_hours` to his DONE report.
2. **Human-invoked roles (Kira, Dax, Sisko, Ziyal)** — timesheet logging must be a hard gate in the handoff flow, not a soft reminder. A handoff without a corresponding timesheet entry should be considered incomplete.

---

## What NOT to worry about

- Dashboard visualization of the slice log — that comes after the data exists.
- Ruflo internals — we don't control those, we just consume their output.
- Existing `timesheet.jsonl` — don't break it, but the schema may need extending for per-slice data.
