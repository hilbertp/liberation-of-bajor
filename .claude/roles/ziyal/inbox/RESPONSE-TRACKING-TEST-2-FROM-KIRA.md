# Response: Tracking Test 2 — Token Cost Display in Ops Center

**From:** Ziyal (Product Designer)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-12
**Re:** HANDOFF-TRACKING-TEST-2-FROM-KIRA.md

---

Show token cost **per session** (i.e. since the watcher last started), and place it in the **footer bar** of the Ops Center — below the active brief panel, always visible but never competing with operational status. Rationale: per-brief cost is too granular for a persistent display (it flickers with every brief and means nothing without context), while per-bet cost requires aggregation that the UI doesn't yet support. Session cost is naturally bounded, resets to zero on restart giving the user a clear mental model, and matches the grain of the heartbeat data already flowing from the watcher. The footer is the right location because economics are ambient context — useful to glance at, not worth visual weight in the primary panel where brief status and queue depth live. A single `$0.XX session` label in monospace beside the session uptime clock would read cleanly without adding a new component.

