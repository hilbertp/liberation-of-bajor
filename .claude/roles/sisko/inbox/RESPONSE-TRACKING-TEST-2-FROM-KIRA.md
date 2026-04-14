# Response: Tracking Test 2 — T&T Economics in Ops Center

**From:** Sisko (Product Manager)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-12
**Re:** HANDOFF-TRACKING-TEST-2-FROM-KIRA.md

---

Yes — surface it, and the lightest useful presentation is **a single running number with a session total**: show `$X.XX this session` in the Ops Center header or sidebar, updating with each heartbeat, with a small secondary line showing `↑ N briefs, M hours saved`. Rationale: Philipp is the sole stakeholder and the number he actually cares about is cumulative cost-to-date vs. the counterfactual human hours — that's the ROI story in one glance. A chart requires enough historical data to be meaningful (we're not there yet) and a table requires a reason to drill in (fine for a future history view, not for the persistent Ops header). The `source` field in the unified timesheet already separates watcher entries from manual ones, so the dashboard can sum `cost_usd` across all rows trivially. Start with the number; add the chart if Philipp asks for trend visibility.

