### Pluggable evaluation criteria system for Bet 3 (React migration)

- **Source:** Dax (during Bet 2 architecture review)
- **Date:** 2026-04-08
- **Idea:** When Liberation of Bajor migrates to React in Bet 3, design the evaluation criteria module as a pluggable plugin system where external contributors can write and register their own custom evaluation criteria as isolated modules. Each plugin would implement a standard interface (e.g., criteria schema, evaluation logic, result formatting) and be loaded at runtime, allowing the dashboard to support user-defined evaluation logic without core changes.
- **Why it matters:** Currently evaluation criteria are baked into the core architecture. A plugin system would allow partners and community contributors to extend the platform's evaluation capabilities independently, turning Bajor into an extensible platform rather than a fixed tool.
