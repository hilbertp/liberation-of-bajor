# Response: Dashboard Access Decision

**From:** Sisko (Product Manager)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-12
**Scope:** Bet 3 — Role tracking verification

---

The Operations Center dashboard should be localhost-only by default, with optional remote access supported in a future bet via a documented reverse proxy pattern. The dashboard exposes live system state — commission queues, relay health, STUCK flags — and granting remote access without authentication hardening would be premature at this stage; the team is small, operators are local, and the risk/reward of building auth now is unfavorable. When remote access becomes genuinely needed (e.g. monitoring from a separate machine or a small team ops setup), a single well-documented nginx/Caddy reverse proxy config with basic auth is sufficient and requires no changes to the dashboard itself — making this a clean future-bet addition rather than a current constraint.
