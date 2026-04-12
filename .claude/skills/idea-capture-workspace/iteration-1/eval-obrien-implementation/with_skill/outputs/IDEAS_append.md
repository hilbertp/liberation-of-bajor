### Bridge status CLI command

- **Source:** O'Brien (while implementing Slice B1 unified relay server, writing Docker Compose configuration)
- **Date:** 2026-04-08
- **Idea:** A CLI command like `bridge status` that displays the current pipeline state, active relay connections, and data flow metrics without requiring access to the dashboard. Useful for quick operational checks during development and for users who prefer CLI tools.
- **Why it matters:** Currently all visibility into pipeline health requires the dashboard. A lightweight CLI tool would improve observability for CI/CD, scripting, and environments where a graphical interface is impractical.
