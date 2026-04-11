# Decision Record: slicelog.jsonl Rotation Strategy

**From:** Dax (Architect)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-12
**Re:** HANDOFF-TRACKING-TEST-FROM-KIRA.md

---

## Question

Should `bridge/slicelog.jsonl` be a single flat file forever, or rotate by month (e.g. `slicelog-2026-04.jsonl`) once it exceeds a threshold?

## Options

1. **Single flat file** — append indefinitely; simple reads, no rotation logic.
2. **Monthly rotation** — new file per month above a size threshold; bounded file size, more complex queries.

## Decision

**Single flat file.**

## Rationale

At current bet cadence, slicelog will stay well under 1 MB for the foreseeable future; rotation adds query complexity (which file? what threshold?) with no practical benefit until scale demands it — defer until it hurts.
