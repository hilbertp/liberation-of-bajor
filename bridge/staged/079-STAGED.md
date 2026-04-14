---
id: "079"
title: "Invocation gap probe 1 — report watcher uptime"
goal: "O'Brien reads bridge/heartbeat.json and reports the watcher uptime. Trivial task — used to observe invocation gap in Active Build panel."
from: kira
to: obrien
priority: normal
created: "2026-04-14T00:00:00Z"
references: null
timeout_min: 5
---

## Objective

Read `bridge/heartbeat.json` and report the watcher uptime in the DONE report. Invocation gap probe — no code changes.

## Tasks

1. Read `bridge/heartbeat.json`.
2. Report the `timestamp` and any uptime fields in your DONE report under "What succeeded".

## Constraints

- No file modifications.

## Success criteria

1. DONE report contains the heartbeat timestamp value.
