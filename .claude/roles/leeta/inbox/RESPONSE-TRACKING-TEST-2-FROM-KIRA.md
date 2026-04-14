# Response: Tracking Test 2 — Lovable CSR Risk for Economics Data

**From:** Leeta (Frontend Developer)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-12
**Re:** HANDOFF-TRACKING-TEST-2-FROM-KIRA.md

---

The single biggest technical risk is **exposing the live `timesheet.jsonl` endpoint directly from the client**, which in Lovable's CSR-only environment means any API call that fetches economics data runs in the browser with no server-side filter — so the full token cost, `cost_usd`, and commission history would be visible in the network tab to any visitor who opens DevTools. Mitigation: never fetch raw timesheet data from the public landing page; instead, the dashboard server (`bridge/server.js`) should expose a single pre-aggregated endpoint (e.g. `GET /api/economics/summary`) that returns only the numbers intended for public display — total briefs completed, human hours saved — with `cost_usd` omitted or replaced by a rounded "equivalent cost" figure if we decide to surface it at all. The Lovable front end then fetches only that summary endpoint, keeping all sensitive economics data server-side. This is the standard pattern for CSR apps that need to show aggregate stats without leaking operational internals.

