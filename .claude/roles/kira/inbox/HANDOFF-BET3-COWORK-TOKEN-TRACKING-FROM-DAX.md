# Cowork Session Token Tracking — Commission This Now

**From:** Dax (Architect)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-12T22:00:43Z
**Scope:** Bet 3 — Token cost tracking for human-invoked Cowork sessions
**Priority:** High. Do not defer.

---

## The problem this solves

Philipp hits plan limits constantly. The watcher tracks O'Brien's spend. Cowork role sessions (Dax, Kira, Sisko, Ziyal, Leeta) are completely invisible — no tracking, no data, no signal. This is the majority of actual token burn. Without this feature, the timesheet is blind to where the money is going. That's why we built the tracking system in the first place.

---

## What exists today

`bridge/usage-snapshot.js` is written and ready. The `claude.ai` web app exposes a usage endpoint:

```
GET https://claude.ai/api/organizations/cff23f1b-5c33-4c40-8e81-453be39aed7d/usage
```

This returns live data: rolling 5-hour token utilization and euro spend against the monthly plan. `usage-snapshot.js` calls this endpoint, computes a delta against the previous call, and appends a row to `bridge/timesheet.jsonl`. The script is designed to run on Philipp's Mac as part of the ds9 plugin — local Node.js process, same browser IP context, same session.

---

## Technical risks — assessed, not deferred

**Risk 1: The endpoint is undocumented.**
Real risk. Anthropic could change it. Mitigation: silent failure. If the endpoint breaks, `usage-snapshot.js` logs a warning to `bridge/bridge.log` and returns — it never crashes the skill that called it. The team loses the signal and returns to today's status quo. No regression, no data corruption. Risk profile: acceptable.

**Risk 2: End-to-end test not yet complete.**
The script was built and the endpoint was confirmed via HAR analysis. However the sandbox test was blocked by Cloudflare (server IP, not browser IP). The script has never run successfully on Philipp's machine. This is the one honest gap. Mitigation: O'Brien's first deliverable before any skill wiring is to run `node usage-snapshot.js` from Philipp's terminal with his sessionKey. If it returns usage data, proceed. If it fails, surface the failure to Dax before wiring anything. This is a 5-minute check, not a discovery bet.

**Risk 3: Session key expires ~monthly.**
Philipp pastes a new sessionKey into `bridge/bridge.config.json` once a month. When it expires, the script warns and skips silently. Not a blocker, operational overhead only.

**Risk 4: Data is session-level, not per-commission.**
The snapshot captures a delta between calls — it tells you how much was spent between session open and session close, not which specific message cost what. This is the best granularity the API provides. It is significantly better than nothing.

---

## O'Brien's commission — four items, sequenced

**Item 0 (before anything else): validate the endpoint**
Run from Philipp's terminal:
```bash
cd repo/bridge
CLAUDE_SESSION_KEY="<value from bridge.config.json>" node usage-snapshot.js
```
Expected output: 5-hour utilization percentage, monthly spend in euros, no errors. If this fails, stop and surface to Dax. If it passes, proceed with items 1–3.

**Item 1: session key in config**
Add `"coworkSessionKey": ""` to `bridge/bridge.config.json`. Update `usage-snapshot.js` to read from config as fallback when `CLAUDE_SESSION_KEY` env var is not set. Philipp pastes the value once.

**Item 2: wire into `check-handoffs` skill**
At session open, after role identification: call `node bridge/usage-snapshot.js --log`. Wrap in try/catch — failure is non-fatal, logged to `bridge/bridge.log`, skill continues.

**Item 3: wire into `handoff-to-teammate` skill**
At session close, after handoff file is written: call `node bridge/usage-snapshot.js --log`. Same error handling.

---

## What lands in timesheet.jsonl

```json
{
  "source": "usage-snapshot",
  "ts": "2026-04-12T22:00:43Z",
  "ts_prev": "2026-04-12T20:15:00Z",
  "five_hour_delta": 12400,
  "extra_eur_delta": 1.23,
  "five_hour_pct": "47.2",
  "extra_eur_total": 155.77
}
```

Two rows per Cowork session: one at open, one at close. Delta between them = session cost.

---

## Estimated human hours: 1.5h

Commission it. The gap between knowing you're hitting limits and knowing *why* closes here.
