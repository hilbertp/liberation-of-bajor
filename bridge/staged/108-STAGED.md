---
id: "108"
title: "F-series integration + F-06 Amendment — history panel per Ziyal spec"
goal: "Recover the divergent F-series UI branch (096–102) into the current branch, then upgrade the history panel to Ziyal's spec: multi-expand, original prompt, Nog review thread."
from: kira
to: obrien
priority: high
created: "2026-04-15T00:00:00Z"
references: "101"
timeout_min: 45
status: "STAGED"
---

## Objective

Two problems, one slice.

### Problem 1 — Branch divergence (critical)

Slices 096–102 all built on their own feature branches, but each branch was cut from the `318c1e8` base (Sprint 2 end) rather than chained. Slice 103 likewise started from `318c1e8`. The result: there are now **two divergent trees**:

- **Tree A** (unreachable from current branch): `3feb00f`→`08b3691`→`60242a0`→`27f071f`→`8b3cc2a`→`b1d9bf1` — contains all F-series UI (layout, queue redesign, active build redesign, slice detail overlay, history redesign, crew roster)
- **Tree B** (current branch): `0bb93be`→`fa3775e` — contains only the 103 invocation gap indicator

Philipp is watching **Tree B** at localhost:4747. He sees the pre-F-series dashboard. All Sprint 3 frontend work is invisible to him.

### Problem 2 — History panel doesn't match Ziyal's spec (even on Tree A)

Slice 101 shipped an accordion-style expand (one row at a time). Ziyal's spec requires:
- Multiple rows expandable simultaneously — click ▶ to expand, ▶ again to collapse; others stay open
- Expanded row content: goal text (first line) + "Details >" button
- "Details >" opens a right-side overlay (or same briefing overlay) showing:
  1. **Original prompt to O'Brien** — the full slice body (rendered markdown), fetched from `bridge/queue/{id}-BRIEF.md` or `bridge/queue/{id}-DONE.md` or whichever exists
  2. **Nog review thread** — each `## Nog Review — Round N` section from the same file (if any); if none exist yet, show a soft "No reviews yet" placeholder
- Sprint badge column between chevron and ID
- Pagination: `← newer · page N of M · X entries · older →`

## Tasks

### Part 1 — Branch recovery (git operations)

1. Confirm you are on `slice/108-f-series-integration` (create this branch from the current HEAD, which is `fa3775e`).

2. Cherry-pick the six Tree A commits in order. Use `--allow-empty` if needed:
   ```
   git cherry-pick 3feb00f   # feat(096): CSS grid + Post-Build Pipeline mock
   git cherry-pick 08b3691   # feat(098): Active Build panel redesign
   git cherry-pick 60242a0   # feat(099): Queue panel redesign
   git cherry-pick 27f071f   # feat(100): Slice Detail overlay
   git cherry-pick 8b3cc2a   # feat(101): History panel redesign (accordion — will fix in Part 2)
   git cherry-pick b1d9bf1   # feat(102): Crew Roster
   ```

3. **Conflict resolution:** The most likely conflict is in `dashboard/lcars-dashboard.html` because 103 added the invocation gap indicator lines (9 lines) to sections that 096–102 also restructured. Resolve by keeping both changes — the invocation gap indicator and all F-series UI.

4. After each cherry-pick resolves cleanly, run a quick sanity check: `node -e "require('http')" && echo OK` (just confirms the Node server can still load). The actual server starts with `node dashboard/server.js` but don't start it in the slice — just verify the HTML is well-formed by checking it has both `id="queue-list"` and `id="brief-tbody"` present.

5. After all six cherry-picks succeed, the branch has both Tree A features AND Tree B (103 invocation gap). Commit the resolution if cherry-pick left any merge state:
   ```
   feat(108): integrate F-series UI branches (096–102) onto 103 base
   ```

### Part 2 — History panel: multi-expand + prompt + Nog review

After Part 1, `dashboard/lcars-dashboard.html` has the 101 history implementation (accordion). Now amend it:

**Step 1 — Remove accordion behaviour.**

In `toggleHistoryExpand(id)`:
- Remove the block that collapses the previously expanded row (`historyExpandedId` tracking)
- Remove `historyExpandedId`
- Just toggle `open` class on the clicked row's expand div — if open, close it; if closed, open it
- Multiple rows can now be open simultaneously

```js
// BEFORE (accordion):
let historyExpandedId = null;
function toggleHistoryExpand(id) {
  if (historyExpandedId && historyExpandedId !== id) {
    const prev = document.getElementById('history-expand-' + historyExpandedId);
    if (prev) prev.classList.remove('open');
    // … chevron reset …
  }
  historyExpandedId = id === historyExpandedId ? null : id;
  // … toggle …
}

// AFTER (multi-expand):
const historyExpandedSet = new Set();
function toggleHistoryExpand(id) {
  const expand = document.getElementById('history-expand-' + id);
  const chevron = document.getElementById('history-chevron-' + id);
  if (!expand) return;
  const isOpen = expand.classList.contains('open');
  expand.classList.toggle('open', !isOpen);
  if (chevron) chevron.textContent = isOpen ? '▶' : '▼';
  if (isOpen) historyExpandedSet.delete(id);
  else historyExpandedSet.add(id);
}
```

Give each chevron an `id="history-chevron-${eid}"` so it can be updated.

**Step 2 — "Details >" button opens briefing overlay with prompt + review.**

The existing briefing overlay (`history-detail-overlay`) currently shows cost/token stats and maybe goal text. Replace its content logic with two sections:

```
┌─────────────────────────────────────────────────────┐
│ #101 · F-06 History panel redesign              [✕] │
│                                                     │
│ ── Original prompt ──────────────────────────────── │
│ [rendered markdown of the slice body]               │
│                                                     │
│ ── Nog review thread ────────────────────────────── │
│ Round 1 — RETURN                                    │
│   [Nog's comment]                                   │
│ Round 2 — PASS                                      │
│   [Nog's comment]                                   │
│ (or: "No Nog review recorded." if none)             │
└─────────────────────────────────────────────────────┘
```

Fetching the content:

```js
async function openHistoryDetail(id) {
  // Try BRIEF.md first (archived), fall back to DONE.md
  const res = await fetch(`/api/queue/${id}/content`);
  if (!res.ok) { alert('Content not found for #' + id); return; }
  const data = await res.json();

  // Parse Nog review sections from body
  const nogSections = parseNogReviews(data.body);
  renderHistoryDetailOverlay(id, data.frontmatter.title, data.body, nogSections);
  document.getElementById('history-detail-overlay').style.display = '';
}

function parseNogReviews(body) {
  // Extract sections matching /^## Nog Review — Round \d+/m
  const sections = [];
  const re = /^## Nog Review — Round (\d+)([\s\S]*?)(?=^## Nog Review — Round |\s*$)/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    sections.push({ round: m[1], content: m[2].trim() });
  }
  return sections;
}
```

The `/api/queue/{id}/content` endpoint already handles PENDING and STAGED files. Extend it in `dashboard/server.js` to also check `bridge/queue/{id}-BRIEF.md` and `bridge/queue/{id}-DONE.md` (in that order) — these are the archived completed slices. If found, parse and return the same `{ id, frontmatter, body, raw }` shape.

**Step 3 — `server.js` — extend `/api/queue/:id/content` to cover BRIEF and DONE files.**

Current lookup order:
1. `bridge/queue/{id}-PENDING.md`
2. `bridge/staged/{id}-STAGED.md`
3. `bridge/staged/{id}-NEEDS_AMENDMENT.md`

Add after the existing checks:
4. `bridge/queue/{id}-BRIEF.md`
5. `bridge/queue/{id}-DONE.md`

**Step 4 — Pagination.**

The current history table shows the most recent 15 entries, no pagination. Add:
- Client-side pagination over `data.recent` (up to all entries, not sliced to 15)
  - The server already returns up to 10 in `data.recent`. Increase the server-side limit in `buildBridgeData` to return all completed entries (remove the `.slice(0, 10)` cap, or raise it to, say, 100).
  - Client paginates in pages of 10.
- UI: `← newer · page N of M · X entries · older →` links/buttons at the bottom of the history table
- `← newer` is disabled on page 1; `older →` is disabled on last page

**Step 5 — Sprint badge in history rows.**

The `recent` entries from the server already include `sprint` (computed from ID). Add a sprint badge column between chevron and ID in the history table rows, matching Ziyal's mockup.

## Constraints

- No new npm dependencies.
- The history-detail-overlay already exists in the DOM from slice 101 — reuse it, don't create a new overlay.
- If `parseNogReviews` finds no sections, show "No Nog review recorded." in that section — never hide the section.
- Part 1 cherry-picks must succeed cleanly before Part 2 work begins. If a cherry-pick fails, abort (`git cherry-pick --abort`), describe the conflict, and stop the slice (do not push broken HTML).
- All history rows must remain expandable independently — no accordion, no "collapse others on open".

## Success Criteria

1. The Ops Center at localhost:4747 shows the full F-series UI: two-column layout, active build panel, queue redesign, crew roster.
2. History rows: clicking ▶ expands a row; clicking again collapses it; multiple rows can be open simultaneously.
3. "Details >" opens overlay with two sections: original prompt (rendered markdown) and Nog review thread (or placeholder).
4. Sprint badge column present in history rows.
5. Pagination controls present and functional.
6. `/api/queue/:id/content` returns content for BRIEF.md and DONE.md (archived slices).
7. Committed on `slice/108-f-series-integration`.
