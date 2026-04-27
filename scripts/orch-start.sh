#!/bin/bash
# orch-start.sh — Load (or reload) the orchestrator launchd agent
PLIST="$HOME/Library/LaunchAgents/dev.liberation.orchestrator.plist"
REPO_PLIST="$(cd "$(dirname "$0")" && pwd)/dev.liberation.orchestrator.plist"

# Symlink plist into LaunchAgents if not already there
if [ ! -L "$PLIST" ]; then
  ln -sf "$REPO_PLIST" "$PLIST"
  echo "Symlinked plist into ~/Library/LaunchAgents/"
fi

# Ensure log directory exists
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$REPO_ROOT/bridge/logs"

# Unload first (ignore error if not loaded), then load
launchctl unload "$PLIST" 2>/dev/null
launchctl load "$PLIST"
echo "Orchestrator agent loaded. Use 'launchctl list dev.liberation.orchestrator' to check status."
