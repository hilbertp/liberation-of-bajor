---
id: "221"
title: "F-WG — isGitProcessAlive: combine lsof + age + PID-alive checks"
from: rom
to: nog
status: DONE
slice_id: "221"
branch: "slice/221"
completed: "2026-04-26T13:49:30.951Z"
tokens_in: 0
tokens_out: 0
elapsed_ms: 0
estimated_human_hours: 0.0
compaction_occurred: false
---

## Summary

Skeleton DONE — work in progress.

## Tasks

- [ ] Add `isPidAlive(pid)` helper
- [ ] Modify `isGitProcessAlive` to return `{ alive, reason }`
- [ ] Add lockfile PID-reading helper
- [ ] Update prune logic to combine signals
- [ ] Regression tests

## Acceptance criteria

- [ ] AC0. Skeleton DONE first commit
- [ ] AC1-AC9 pending
