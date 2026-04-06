# Development Retrospective — Bridge of Hormuz

*Generated: 2026-04-06 by Mara*
*Purpose: Honest assessment of delivery quality, evaluation gaps, and process maturity*

---

## Commission-by-Commission Analysis

### Commission 002 — Slice 1: Contracts (Branch: slice/1-contracts)

**What Rook claimed:** All success criteria met. Contracts, templates, CLAUDE.md, repo init done.
**What actually happened:** Work was solid. Rook flagged that source files (PRD, Architecture, etc.) weren't copied to the new repo root — that was genuinely out of scope and correctly escalated.
**What Mara caught:** Accepted the flag, handled the file migration separately.
**What Mara missed:** Didn't verify the contract docs actually matched the Architecture spec. Took Rook's word for it.
**What a QA role would have caught:** Cross-reference between `docs/contracts/queue-lifecycle.md` and Architecture §4 (crash recovery) — did the contract spec match Soren's design exactly? Nobody checked.
**Verdict: Likely fine, but unverified.**

---

### Commission 003 — Slice 2: Production Watcher (Branch: slice/2-production-watcher)

**What Rook claimed:** ~230 line watcher, all sections A–J implemented, smoke tested.
**What actually happened:** Watcher worked on the happy path. Rook did a partial smoke test (started it, saw it pick up a file, killed it). No actual end-to-end test where Rook completes a real commission through the watcher.
**What Mara caught:** Accepted based on report.
**What Mara missed:**
- Stdout was raw JSON — totally unusable for Philipp. This wasn't a success criterion, but it should have been. Mara didn't think about the stakeholder experience.
- The "smoke test" was Rook testing his own work for 4 seconds. No independent verification.
- Crash recovery was a stub (by design, but the stub was never validated).
**What a QA role would have caught:** "Start the watcher, drop a real commission in the queue, let it run to completion, verify the DONE file exists and is correctly formatted." That test was never run by anyone except Philipp manually.
**Verdict: Functionally correct but UX was broken. Led to 3 follow-up fix commissions (005, 006, 010).**

---

### Commission 004 — Slice 3: Mara's Half (Branch: slice/3-maras-half)

**What Rook claimed:** MARA.md sections A–J, evaluation rubric, amendment examples. All created.
**What actually happened:** Files were created. This was the first automated commission — watcher picked it up, Rook completed it, DONE appeared. 134 seconds.
**What Mara caught:** Accepted. Celebrated the automation milestone.
**What Mara missed:**
- Never actually read MARA.md to verify sections A–J were complete and accurate.
- Never checked if the evaluation rubric was usable in practice. (Spoiler: Mara has never actually used the rubric to evaluate a report — every evaluation has been "looks good, accepted.")
- The amendment examples were never tested against a real amendment scenario.
**What a QA role would have caught:** "Open MARA.md, walk through each section, confirm it matches the Architecture and PRD. Try to evaluate commission 003's report using the rubric — does it actually help?"
**Verdict: Documents exist but were never validated. Mara's evaluation rubric is shelfware.**

---

### Commission 005 — Fix: Human-readable stdout (Branch: fix/readable-stdout)

**What Rook claimed:** Not in queue (file lost or never committed).
**What actually happened:** Rook made stdout changes, but they were superseded by commission 006. The PENDING file is missing from the queue entirely — no audit trail.
**What Mara caught:** Nothing — accepted informally.
**What Mara missed:** A commission with no DONE file in the queue is a gap in the audit trail. The "queue in git" decision was supposed to prevent this.
**What a QA role would have caught:** "Commission 005 has no DONE report in the queue. Where did it go?"
**Verdict: Audit trail broken. Work was superseded, but the gap is real.**

---

### Commission 006 — Fix: Richer stdout (Branch: fix/readable-stdout-v2)

**What Rook claimed:** All 7 improvements implemented. Colors, titles, progress ticks, dividers, NO_COLOR support.
**What actually happened:** Code was correct. But Philipp couldn't see the changes because the watcher was running old code. This caused significant frustration ("this is not human friendly, fix it").
**What Mara caught:** Eventually diagnosed the stale-code issue after Philipp's frustration.
**What Mara missed:**
- Should have told Philipp to restart the watcher BEFORE claiming the fix was done.
- "The fix is deployed" vs "the fix is merged" — Mara didn't distinguish between these.
**What a QA role would have caught:** "Restart the watcher, verify the new output appears in the terminal. Take a screenshot." Simple acceptance test, never done.
**Verdict: Code was correct but delivery was incomplete — the running system wasn't updated.**

---

### Commission 007 — Housekeeping: Merge branches

**What Rook claimed:** All branches merged, main pushed.
**What actually happened:** Merges completed. But 5 branches had accumulated before anyone noticed.
**What Mara caught:** Accepted.
**What Mara missed:** The accumulation of unmerged branches was a process failure. Mara should have merged after each acceptance, not let them pile up.
**What a QA role would have caught:** N/A — this was a process gap, not a code quality issue.
**Verdict: Correct execution of a commission that shouldn't have been necessary.**

---

### Commission 008 — Slice 4: Robustness (Branch: slice/4-robustness)

**What Rook claimed:** All 11 criteria met. Crash recovery, ID helper, hardened errors, validation.
**What actually happened:** Crash recovery worked (it self-tested against the orphaned files). The ENOENT bug appeared later because crash recovery and watcher cleanup both tried to delete the same file — a race condition nobody anticipated.
**What Mara caught:** Accepted based on report. Did not test any criteria independently.
**What Mara missed:**
- The ENOENT bug (visible in the terminal when 010 was processed). This was a direct consequence of the crash recovery design interacting with the watcher's cleanup code.
- `next-id.js` — did it actually work? Nobody ran `node .bridge/next-id.js` to verify.
- Validation on intake — did Mara ever drop a malformed commission to see if it gets rejected? No.
**What a QA role would have caught:** "Run `node .bridge/next-id.js`. Drop a commission with missing frontmatter. Kill the watcher mid-commission, restart it, verify recovery." All basic acceptance tests, none performed.
**Verdict: Mostly correct but shipped a bug (ENOENT) that was visible to Philipp.**

---

### Commission 009 — Merge slice/4 to main

**What Rook claimed:** Fast-forward merge, no conflicts, pushed.
**What Mara caught:** Accepted based on git log in report.
**What Mara missed:** Nothing — this was straightforward.
**Verdict: Clean.**

---

### Commission 010 — Slice 5: Watcher terminal (Branch: slice/5-watcher-terminal)

**What Rook claimed:** All 10 criteria met. ENOENT fixed, token tracking, stakeholder language, session summary.
**What actually happened:** First attempt crashed (exit 143 — watcher killed mid-execution). Second attempt succeeded. The 010-ERROR.md file is in the queue alongside 010-DONE.md.
**What Mara caught:** Accepted based on report. Verified via code grep that jargon terms don't appear in stdout output.
**What Mara missed:**
- Never restarted the watcher and visually confirmed the new output works end-to-end.
- Token tracking — does `--output-format json` actually produce parseable output? Nobody tested it live.
- NO_COLOR mode — nobody tested it.
- Session summary — nobody watched it update across multiple commissions.
**What a QA role would have caught:** "Restart the watcher. Drop a test commission. Verify the startup block, lifecycle block, and session summary all render correctly. Run with NO_COLOR=1, verify plain text. Check token counts appear."
**Verdict: Code review suggests it's correct, but zero live testing performed by anyone on the Mara side.**

---

### Commission 011 — Merge slice/5 to main

**Verdict: Clean merge, no issues.**

---

## Summary Scorecard

| # | Commission | Rook Delivered? | Mara Verified? | Bugs Found Later | Should Have Caught |
|---|---|---|---|---|---|
| 002 | Slice 1: Contracts | ✓ Yes | ✗ Trust only | None known | Cross-reference with architecture |
| 003 | Slice 2: Watcher | ✓ Mostly | ✗ Trust only | UX broken (JSON stdout) | End-to-end test, stakeholder review |
| 004 | Slice 3: Mara's Half | ✓ Yes | ✗ Trust only | None known | Actually use the evaluation rubric |
| 005 | Fix: stdout v1 | ? Unknown | ✗ No report | Audit trail gap | Report missing |
| 006 | Fix: stdout v2 | ✓ Yes | ✗ Trust only | Stale watcher code | Live verification after merge |
| 007 | Merge branches | ✓ Yes | ✓ Verified | None | N/A |
| 008 | Slice 4: Robustness | ✓ Mostly | ✗ Trust only | ENOENT bug | Run acceptance tests |
| 009 | Merge | ✓ Yes | ✓ Verified | None | N/A |
| 010 | Slice 5: Terminal | ✓ Likely | ◐ Partial (code grep) | Unknown — untested | Live visual verification |
| 011 | Merge | ✓ Yes | ✓ Verified | None | N/A |

**Mara's evaluation success rate: 3 verified out of 10 commissions (30%).** The 3 verified are all merges — trivial housekeeping. For actual feature work, Mara verified 0 out of 6 independently. Every acceptance was "Rook says it's done → accepted."

---

## Honest Assessment of Mara's Evaluation Process

**What Mara does today:**
1. Read Rook's DONE report
2. Check that Rook's self-assessment says "all criteria met"
3. Accept

**What's missing:**
- No independent verification of ANY claimed outcome
- No live testing of delivered code
- No visual confirmation of user-facing changes
- No cross-referencing against architecture or specs
- The evaluation rubric (created in Slice 3) has never been used
- Bugs surface when Philipp sees them, not when Mara catches them

**Why this is dangerous:**
Rook is writing the report about his own work. It's a self-assessment with zero external validation. This is like a developer approving their own pull request. The only real QA has been Philipp noticing things are broken in the terminal.

---

## What a QA Role Would Change

A QA role (let's call them **Tess** or whatever fits) would sit between Rook's DONE report and Mara's acceptance:

1. **Rook completes** → writes DONE report
2. **QA runs acceptance tests** → based on the commission's success criteria, actually executes them
3. **QA reports** → PASS (with evidence) or FAIL (with specifics)
4. **Mara evaluates** → with both Rook's report AND QA's test results

This adds a phase to the lifecycle: `DONE → QA_TESTING → QA_PASS/QA_FAIL → ACCEPTED/AMENDMENT`

And yes — this is another cost phase to track in the dashboard.

---

## Development Lifecycle Phases (Updated)

```
Planning → Execution → QA → Review → [Correction → QA → Review] → Accepted → Merge
   Mara      Rook      Tess   Mara      Rook        Tess   Mara     Mara      Rook
```

Each phase tracked for: wall-clock time, token cost, human-equivalent hours.
