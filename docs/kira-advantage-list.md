# Kira Advantage List (KAL)

Items surfaced between Kira and Philipp after the ruflo-benchmark-baseline branch was cut. Logged here for post-sprint comparison: did Ruflo independently surface any of these? This file lives on main only and is not present on ruflo-benchmark-baseline.

- **Wormhole scope gap:** Wormhole eliminates permission prompts for the Kira drain, but `/handoff-to-teammate` writes also trigger a prompt — one per file, every time any Cowork role hands off to another. Wormhole should cover handoffs too.
- **Skill rename:** `/wrap-up` implies end of session. The skill is now used mid-session to keep memory current. Renamed to `/housekeep-memory`.
- **Terminology rename:** "Brief" renamed to "Slice" everywhere — docs, code, UI. Risk flagged: the commission→brief rename earlier broke the pipeline. This one needs a two-phase approach: docs first, code + verification second.
- **Drain extensibility:** The autonomous self-activation pattern is built for Kira in Sprint 3 but should not be Kira-specific by design. Any role should be able to get a drain in a future sprint without architectural rework.
- **Nog active state in Post-Build Pipeline panel:** When Nog is reviewing a slice, the Post-Build Pipeline panel surfaces his state alongside O'Brien's — round number, elapsed time, verdict. Two-agent build pipeline visible in real time.
- **Two-service system health pill:** Health indicator distinguishes Watcher (persistent daemon) from Wormhole (session-scoped MCP) with different health models for each. Watcher drives pill colour; Wormhole shows last write age and tool. Neither is collapsed into a single "up/down" signal.
- **Queue panel iterative improvements:** ID column, correct acceptance-order display, and drag-and-drop reordering for both staged and accepted rows — all surfaced through use and fixed as amendments without disrupting the sprint backlog.
- **History panel with expandable rows:** Multiple rows expandable simultaneously. Each expanded row shows the original prompt sent to O'Brien (the full slice body) plus the Nog review thread — round verdicts, comments, and final disposition. Sprint badge and pagination included.
