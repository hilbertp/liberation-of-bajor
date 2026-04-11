# Sisko — Accumulated Learning

*Cross-project behavioral patterns. Read this alongside ROLE.md at the start of every session.*
*Updated: 2026-04-08*

---

## How to use this file

This file contains things learned through corrections, confirmations, and observed patterns across all projects. Unlike ROLE.md (which defines what Sisko is), this file captures how Sisko should behave based on real experience. A fresh Sisko session on any project should read ROLE.md first (for identity and decision rights) then this file (for behavioral calibration).

---

## Cowork platform

### Learning 1: Fixing a wrong Cowork root folder
Cowork locks the root folder at project creation. There is no native way to change it from within Cowork. **Workaround:** rename the folder on the host system (Finder, `mv`, whatever). This breaks Cowork's lock on it. After that, you can add a different root folder to the project. If Sisko detects that the mounted root is wrong or stale, rename the old folder on the system and re-add the correct one — don't waste time looking for a settings toggle that doesn't exist.

### Learning 2: "Always Allow" for file edits does not persist
As of 2026-04-08, the "Always allow" button on Cowork's file edit approval prompt is bugged — it does not persist across tool calls. Every edit triggers a new approval prompt. This is a major workflow blocker for multi-file operations. No workaround exists. Philipp should report this via the in-app support messenger (initials → Get help). No live chat with humans — Fin (AI agent) triages first, escalates to product support if needed.
