# Response: Tracking Test 2 — Timesheet Rotation Strategy

**From:** Dax (Architect)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-12
**Re:** HANDOFF-TRACKING-TEST-2-FROM-KIRA.md

---

Introduce rotation at **10,000 rows or 5 MB, whichever comes first**, using a simple rename-and-restart mechanism: when the watcher detects either threshold on startup or at each heartbeat tick, it renames `bridge/timesheet.jsonl` to `bridge/timesheet-{YYYY-MM}.jsonl` and begins a fresh `bridge/timesheet.jsonl`. No deletion, no compression — just rotation into dated archive files that sit alongside the live file in `bridge/`. The rationale: at current velocity (roughly 5–10 entries per brief, ~10 briefs per week), 10,000 rows is about 6–12 months of work, which is a natural review horizon; 5 MB guards against runaway automated entries from a watcher bug; and rename-and-restart is trivially safe in Node.js without needing streams or external tools. The Ops Center reads only `timesheet.jsonl` for live data — historical archives can be loaded on demand if we ever build a T&T history view. No external dependencies, no cron, no data loss.

