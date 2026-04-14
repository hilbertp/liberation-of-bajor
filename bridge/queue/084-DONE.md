---
id: "084"
title: "Amendment 1 — fix failed criteria for brief 066"
from: obrien
to: kira
status: DONE
brief_id: "084"
branch: "slice/066-usage-snapshot-hardening"
completed: "2026-04-14T18:31:00.000Z"
tokens_in: 28000
tokens_out: 4500
elapsed_ms: 120000
estimated_human_hours: 0.5
compaction_occurred: false
---

## Summary

Fixed both failed acceptance criteria from brief 066:

### AC #5 — Branch has commits; file tracked
- `bridge/usage-snapshot.js` was untracked and not in any commit
- Added and committed it to `slice/066-usage-snapshot-hardening`
- Branch now has 1 commit ahead of `main`: `a9ecc69`

### AC #1 — five_hour fields no longer null
- **Root cause:** `formatSnapshot()` read `raw.five_hour_usage` (doesn't exist in API response) instead of `raw.five_hour`
- **Fix:** Changed to `raw.five_hour` which contains `{ utilization, resets_at }`
- Also fixed the `monthly_usage` → `seven_day` rename: API returns `raw.seven_day` with `{ utilization, resets_at }`, not `raw.monthly_usage` with `used_credits`/`monthly_limit`
- Updated pretty-print output and delta calculation to use `utilization` percentage instead of `used`/`limit` token counts

## Verification

- `node bridge/usage-snapshot.js` with empty config key: exits 0, logs warning to bridge.log, no stderr output
- `node bridge/usage-snapshot.js --session-key "expired"`: exits 0, silent failure
- Saved `_raw` snapshot confirms API shape: `five_hour.utilization: 100`, `five_hour.resets_at: "2026-04-12T23:00:00..."`, `seven_day.utilization: 24`

## All original AC status

1. **Script prints usage data with valid key** — fixed, five_hour fields now populated from correct API path
2. **coworkSessionKey in config** — already present, 3-source fallback works
3. **Silent failure on bad/missing key** — confirmed exits 0, no stderr, logs to bridge.log
4. **--silent --log** — logic unchanged, works as before
5. **All changes committed on branch** — branch `slice/066-usage-snapshot-hardening` is 1 commit ahead of main
