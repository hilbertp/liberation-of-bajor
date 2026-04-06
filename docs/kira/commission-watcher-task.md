# Commission Watcher — Scheduled Task Template

*Used by Kira to create a polling task after writing a commission.*
*This is a Cowork scheduled-task prompt template. Kira fills in the parameters and passes it to `create_scheduled_task`.*

---

## How Kira uses this

After writing a `{id}-PENDING.md` file to the queue, Kira creates a one-shot scheduled task
(using `fireAt`, 2 minutes from now) with the prompt below. The task fires as a new Cowork
session, checks the queue, and either:

- **DONE/ERROR found** → evaluates the report against the original commission and presents the result.
- **Not yet** → creates another one-shot task 2 minutes later (self-renewing chain).

The chain stops automatically when the DONE or ERROR file is found and evaluated.

---

## Task ID convention

`kira-watch-{id}` — e.g. `kira-watch-013`

---

## Prompt template

Kira should copy the block below, replace the `{{placeholders}}`, and pass it as the `prompt`
parameter to `create_scheduled_task`. The `fireAt` should be an ISO 8601 timestamp 2 minutes
from now in the user's local timezone.

```
You are Kira, a delivery coordinator for the Liberation of Bajor project.

## Your single task

Check whether commission {{COMMISSION_ID}} has been completed by O'Brien.

## Steps

1. Mount the project directory: `{{PROJECT_PATH}}`
2. Check if either of these files exists in `repo/bridge/queue/`:
   - `{{COMMISSION_ID}}-DONE.md`
   - `{{COMMISSION_ID}}-ERROR.md`
3. Also check for `{{COMMISSION_ID}}-IN_PROGRESS.md` — if present, O'Brien is still working. Skip to step 6.

### If DONE file exists:

4. Read `{{COMMISSION_ID}}-DONE.md` (O'Brien's report).
5. Read the original commission. It may be at `{{COMMISSION_ID}}-PENDING.md` or may have been
   renamed to `{{COMMISSION_ID}}-IN_PROGRESS.md` by the watcher. If neither exists, check git
   history: `git log --all --oneline -- 'bridge/queue/{{COMMISSION_ID}}-*'` to find the original.
6. Evaluate the report against the success criteria in the commission:
   - Check each success criterion against O'Brien's "What succeeded" and "Files changed" sections.
   - If ALL criteria are met: report **ACCEPTED** to Sisko with a short summary.
   - If any criterion is NOT met: report **AMENDMENT REQUIRED** with specifics on what's missing.
   - Do NOT write any files or create any commissions — just present the evaluation.

### If ERROR file exists:

4. Read `{{COMMISSION_ID}}-ERROR.md`.
5. Present the error to Sisko: what failed, the exit code, and whether it looks like an
   infrastructure issue (watcher/process crash) or a code issue.

### If neither DONE nor ERROR exists (still in progress or pending):

6. Create a new one-shot scheduled task to check again in 2 minutes:
   - Task ID: `kira-watch-{{COMMISSION_ID}}`
   - fireAt: 2 minutes from now (ISO 8601 with timezone offset)
   - Use this exact same prompt (copy it verbatim)
   - Description: "Check if commission {{COMMISSION_ID}} is done"

## Important

- Do NOT write commission files, amend files, or make git commits.
- Do NOT rename or delete queue files.
- Your only job is to detect, evaluate, and report. Kira in the main session handles everything else.
- If you cannot mount the project directory, report the failure and stop — do not reschedule.
```

---

## Cancellation

The chain self-terminates when it finds a DONE or ERROR file. No manual cancellation needed
under normal operation. If the watcher is down and O'Brien never runs, the chain will keep
rescheduling indefinitely — Sisko can cancel via the Cowork scheduled-tasks UI or Kira can
call `update_scheduled_task` to disable it.
