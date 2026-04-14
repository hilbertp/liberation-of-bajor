---
id: "085"
title: "Queue panel: max height + internal scroll"
goal: "The Queue panel never grows beyond a fixed max height — excess items scroll internally and all other panels stay in place."
from: kira
to: obrien
priority: normal
created: "2026-04-14T00:00:00Z"
references: null
timeout_min: null
---

## Objective

The Queue panel in the Ops Center dashboard grows unbounded as staged slices accumulate. Add a max height and internal scroll so the layout stays stable regardless of queue depth.

## Context

The Ops Center uses a CSS grid layout with named areas (`hero / postbuild / queue / history`). Currently the Queue panel stretches to fit all its rows. When multiple slices are staged simultaneously, the panel grows tall enough to push the History panel down and break the intended layout.

The fix is CSS-only (or minimal JS if needed): cap the Queue panel height and make its content area scroll internally. The panel header (title + info icon) should remain fixed and visible — only the list of slice rows should scroll.

Reference files:
- `dashboard/lcars-dashboard.html` — the dashboard implementation
- `ops-dashboard-spec.md` — Ziyal's layout spec (grid areas, panel structure)

## Tasks

1. Read `dashboard/lcars-dashboard.html` to understand the current Queue panel markup and CSS.
2. Identify the Queue panel container and its content list element.
3. Apply a `max-height` to the Queue panel's scrollable content area. Use a value that fits comfortably in the viewport without crowding — `40vh` is a reasonable starting point; adjust if it looks wrong in context.
4. Set `overflow-y: auto` on that same element so a scrollbar appears only when content overflows.
5. Ensure the panel header stays fixed above the scroll area and is never clipped.
6. Verify the grid layout is unaffected — Active Build, Post-Build Pipeline, and History panels must not shift when the Queue panel has many items.
7. Commit on branch `slice/085-queue-panel-scroll` with message: `feat(085): queue panel max height and internal scroll`.

## Constraints

- CSS change only if possible. Avoid JS unless the layout genuinely requires it.
- Do not change any panel other than the Queue panel.
- Do not alter the Queue panel's row structure, row content, or action buttons.
- Do not modify `ops-dashboard-spec.md`.

## Success criteria

1. Queue panel has a max height — adding many rows does not grow the panel beyond it.
2. Slice rows scroll internally when they overflow the max height.
3. Queue panel header is always visible and not scrolled away.
4. Active Build, Post-Build Pipeline, and History panels are visually unaffected.
5. Change committed on `slice/085-queue-panel-scroll`.
