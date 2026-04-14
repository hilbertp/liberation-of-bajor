---
id: "095"
title: "Invocation gap — backend signal for first O'Brien output"
goal: "The watcher tracks when O'Brien produces his first output token and exposes this via the API, so the frontend can show a gap indicator while waiting."
from: kira
to: obrien
priority: normal
created: "2026-04-14T00:00:00Z"
references: null
timeout_min: 20
status: "STAGED"
---

## Objective

Add a small backend signal: when the watcher invokes O'Brien and he produces his first stdout/stderr output, record that timestamp in the active slice's IN_PROGRESS file (or a sidecar). Expose it via the API. Frontend slice 103 uses this to show/hide the invocation gap indicator.

## Context

When Philipp approves a slice, the watcher invokes O'Brien (`claude -p`) and renames the file to `{id}-IN_PROGRESS.md`. There are 3–5 seconds before O'Brien produces any output. The Ops Center currently shows nothing during this gap.

The spec (in `kira/inbox/ops-dashboard-spec.md` addendum) requires: while in this gap, show "Invoking O'Brien — waiting for first response…". It disappears the moment O'Brien's first output arrives.

The simplest signal: a field `firstOutputAt` in the existing API response for the active slice. The watcher sets it to an ISO 8601 timestamp when the first byte of stdout or stderr arrives from the O'Brien process. Before first output: field is `null`. After: the timestamp.

## Tasks

1. In `bridge/watcher.js`, in the O'Brien invocation code (where `claude -p` is spawned):
   - Add a `firstOutputAt` variable, initialized to `null`.
   - On the first `data` event from the child process's stdout or stderr: set `firstOutputAt = new Date().toISOString()`.
   - "First" means the first event — if the flag is already set, skip.

2. Expose `firstOutputAt` in the existing active-slice API response:
   - In `dashboard/server.js`, find the endpoint that returns the current active build state.
   - Add `firstOutputAt` to the response object: either the timestamp or `null`.
   - The watcher must make this value available to the server — either via a shared in-memory object, a sidecar file (`bridge/first-output.json`), or by updating the IN_PROGRESS file's frontmatter.

   Recommended approach: write `bridge/first-output.json` with `{ sliceId, firstOutputAt }` when first output arrives. Reset (delete or null out) when the slice exits. The server reads this file as part of the active-build API response.

3. Verify the API response includes `firstOutputAt: null` when waiting and `firstOutputAt: "2026-..."` once output has arrived.

4. Clean up `bridge/first-output.json` when the slice completes (DONE, ERROR, or STUCK) so the next slice starts fresh.

5. Add `bridge/first-output.json` to `.gitignore`.

6. Commit on branch `slice/095-invocation-gap-backend`:
   ```
   feat(095): track first O'Brien output for invocation gap indicator
   ```

## Constraints

- Do not modify the frontend yet — that is slice 103.
- The `firstOutputAt` mechanism must reset between slices.
- Do not add latency to the O'Brien invocation path.

## Success criteria

1. When a slice enters IN_PROGRESS, the API returns `firstOutputAt: null`.
2. After O'Brien produces first output, the API returns `firstOutputAt: "<timestamp>"`.
3. After the slice exits (any terminal state), `firstOutputAt` resets to null for the next slice.
4. `bridge/first-output.json` in `.gitignore`.
5. Committed on `slice/095-invocation-gap-backend`.
