---
name: check-handoffs
description: "Scan the project folder for handoff files addressed to the current role. Use when starting a new session, when someone says 'check your handoffs', 'any handoffs for me?', 'what's waiting for me?', or when a role needs to pick up work left by another role."
---

# Check Handoffs

You are checking the project for handoff files addressed to you (the current role).

## How it works

Handoff files follow the naming convention `HANDOFF-*.md` and live in the role's directory under `repo/.claude/roles/{role-name}/`. They may also appear in the project root or other shared locations.

## T&T Self-Audit (run before inbox scan)

Before checking for handoffs, verify that your previous session's time was logged:

1. **Identify your role name** (lowercase, e.g. `dax`, `kira`, `sisko`).

2. **Read `bridge/tt-audit.jsonl`.** Find the most recent line where `"role"` matches your role name.
   - If **no entry exists** for your role — skip this entire self-audit. This is your first session; there's nothing to check.

3. **If an entry is found**, note its `ts` value. Read `bridge/timesheet.jsonl`. Look for any line where `"role"` matches your role name **and** `"ts"` is chronologically after the audit entry's `ts`.

4. **If no timesheet entry is found** after that timestamp, display this warning prominently:

   > ⚠️ **T&T gap detected.** No timesheet entry found since your last outbound handoff (`<ts from audit entry>`). Run `ds9:estimate-hours` to log your previous session before proceeding.

   **Do not block.** Show the warning and then continue to the inbox scan below.

5. **If a matching timesheet entry is found** — no warning needed. Proceed normally.

---

## Steps

1. **Identify your role name.** Check which DS9 role you are currently operating as (e.g., ziyal, sisko, kira, dax, leeta, obrien, bashir, nog, worf, odo).

2. **Search your own role directory first.** Look for any `HANDOFF-*.md` files in:
   ```
   repo/.claude/roles/{your-role-name}/
   ```

3. **Search project-wide.** Scan the entire project for handoff files that mention your role name in the filename or content:
   - Files matching `*HANDOFF*` or `*handoff*` anywhere in the project
   - Files matching `*{your-role-name}*` in shared locations like the project root or `bridge/` directory

4. **Report what you found.** For each handoff file:
   - File path
   - Who it's from (check the "From:" line if present)
   - Date
   - One-line summary of the task or context

5. **If no handoffs found**, say so clearly: "No handoff files found for {role}. Nothing waiting."

## After finding handoffs

Read the handoff file(s) and confirm with the user before acting on them. A handoff is an instruction set — don't start executing until the user says go.
