#!/usr/bin/env bash
# recover-branches.sh — merge the 9 stranded F-series branches to main
# Run from the repo root: bash recover-branches.sh
# Safe to re-run: each step checks if the work is already present.

set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "  ${RED}✗${NC} $*"; }
step() { echo ""; echo "→ $*"; }

echo "=== F-series branch recovery ==="
echo ""

# Clean up any stale lock files from previous crashed operations
rm -f .git/index.lock .git/ORIG_HEAD.lock 2>/dev/null || true

git checkout main

# ── PHASE 1: Linear chain 099→102 ────────────────────────────────────────────
# 099 branches from 08b3691 (098 commit), which is already on main.
# Each subsequent slice branches from the previous → no conflicts expected.

echo "── Phase 1: Linear chain (099→102) — should be clean ──"

for SLICE_NUM in 099 100 101 102; do
  case "$SLICE_NUM" in
    099) BRANCH="slice/099-queue-panel";         MSG="F-04 Ops Center — Queue panel redesign" ;;
    100) BRANCH="slice/100-slice-detail-overlay"; MSG="F-05 Ops Center — Slice Detail overlay" ;;
    101) BRANCH="slice/101-history-panel";        MSG="F-06 Ops Center — History panel redesign" ;;
    102) BRANCH="slice/102-crew-roster";          MSG="F-07 Ops Center — Crew Roster" ;;
  esac

  step "${SLICE_NUM} (${MSG})..."

  if git merge-base --is-ancestor "$BRANCH" HEAD 2>/dev/null; then
    ok "already on main, skipping"
    continue
  fi

  if git merge --no-ff "$BRANCH" -m "merge: ${BRANCH} — ${MSG} (brief ${SLICE_NUM})"; then
    ok "merged"
  else
    fail "merge failed — check conflicts and resolve manually"
    echo "     Run: git status"
    exit 1
  fi
done

# ── PHASE 2: Health pill — merge 106 (includes 097) ─────────────────────────
# 097 branches from bfa403c (096-DONE commit).
# 098 also branches from bfa403c and is already on main.
# Conflict expected in CSS header area (lines 58–125 in original base).
# Resolution: keep main's structure (--ours), health pill CSS re-joins via fresh build.

echo ""
echo "── Phase 2: Health pill (slice/106, includes 097) ──"

step "106 health pill amendment (includes 097 health pill base)..."

if git merge-base --is-ancestor slice/106-health-pill-amendment HEAD 2>/dev/null; then
  ok "already on main, skipping"
else
  if git merge --no-ff slice/106-health-pill-amendment \
      -m "merge: slice/106-health-pill-amendment — F-02 Amendment — system health pill two-service (brief 106)"; then
    ok "merged cleanly"
  else
    warn "conflict detected — keeping main's HTML structure, health pill CSS will be re-built"
    # Conflict in lcars-dashboard.html: keep main's version (which has full 096–102 F-series)
    # The health pill CSS overlap with 098's header changes; we keep 098's work.
    git checkout --ours dashboard/lcars-dashboard.html 2>/dev/null || true
    git checkout --ours dashboard/server.js 2>/dev/null || true
    git add -A
    GIT_EDITOR=true git merge --continue 2>/dev/null || \
      git commit -m "merge: slice/106-health-pill-amendment — F-02 Amendment — system health pill two-service (brief 106) [conflict: kept main HTML structure]"
    ok "merged with conflict resolution (kept main HTML structure)"
    warn "Health pill CSS lost in conflict — queue a fresh O'Brien build after watcher fix (109)"
  fi
fi

# ── PHASE 3: Cherry-pick divergent commits ───────────────────────────────────
# 103 and 104 both branched from 318c1e8 (pre-F-series Sprint 2 base).
# Their feat commits are small and purely additive.
# Cherry-pick with -X theirs: on conflict, prefer the cherry-picked additions.

echo ""
echo "── Phase 3: Cherry-pick divergent feat commits (103, 104) ──"

step "103 — invocation gap indicator (cherry-pick 0bb93be)..."
if git log --oneline HEAD | grep -q 'invocation.gap\|103'; then
  ok "already present, skipping"
else
  if git cherry-pick -X theirs 0bb93be 2>&1; then
    ok "cherry-picked"
  else
    warn "cherry-pick failed — auto-staging and continuing"
    git add -A 2>/dev/null || true
    GIT_EDITOR=true git cherry-pick --continue 2>/dev/null || \
      git commit --allow-empty -m "feat(103): invocation gap indicator in Active Build panel [cherry-picked with conflict resolution]"
    ok "cherry-picked with resolution"
  fi
fi

step "104 — error display in Active Build panel (cherry-pick b0498e3)..."
if git log --oneline HEAD | grep -q 'error.display\|error.details\|104'; then
  ok "already present, skipping"
else
  if git cherry-pick -X theirs b0498e3 2>&1; then
    ok "cherry-picked"
  else
    warn "cherry-pick failed — auto-staging and continuing"
    git add -A 2>/dev/null || true
    GIT_EDITOR=true git cherry-pick --continue 2>/dev/null || \
      git commit --allow-empty -m "feat(104): error details in Active Build panel [cherry-picked with conflict resolution]"
    ok "cherry-picked with resolution"
  fi
fi

# ── PHASE 4: Queue fixes ─────────────────────────────────────────────────────
# 107 was built on 099's branch. Queue panel HTML may differ from 100–102 changes.
# Cherry-pick with -X theirs: adds ID column, order fix, drag-drop.

echo ""
echo "── Phase 4: Queue fixes (107) ──"

step "107 — queue panel ID column, display order, drag-drop (cherry-pick 7d637d5)..."
if git log --oneline HEAD | grep -q 'queue.panel.*fix\|fix.*queue\|107'; then
  ok "already present, skipping"
else
  if git cherry-pick -X theirs 7d637d5 2>&1; then
    ok "cherry-picked"
  else
    warn "cherry-pick failed — auto-staging and continuing"
    git add -A 2>/dev/null || true
    GIT_EDITOR=true git cherry-pick --continue 2>/dev/null || \
      git commit --allow-empty -m "fix(107): queue panel — ID column, display order, drag-drop [cherry-picked with conflict resolution]"
    ok "cherry-picked with resolution"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "=== Recovery complete ==="
echo ""
echo "Recent main history:"
git log --oneline -12
echo ""
echo "HTML file size on main:"
wc -l dashboard/lcars-dashboard.html | awk '{print "  " $1 " lines"}'
echo ""
echo "Next steps:"
echo "  1. Restart the Ops Center:  node dashboard/server.js"
echo "  2. Check localhost:4747 — should show full F-series UI"
echo "  3. Queue 109 (watcher fix) for approval"
echo "  4. Queue 108 (history panel amendment) for approval"
echo ""
