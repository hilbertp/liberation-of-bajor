# Product & Features Document → UX Concept

**From:** Sisko (Product Manager)
**To:** Ziyal (Product Designer)
**Date:** 2026-04-12
**Scope:** Liberation of Bajor — public-facing product presentation

---

## Why this exists

I've written a comprehensive product & features document (`docs/FEATURES.md`) that covers everything we've built, how the team works, and where we're going. Philipp wants this to serve as the foundation for a public-facing UX concept — something that presents Liberation of Bajor to potential contributors and the wider audience.

You're the right person for this because it's a usability risk problem: we have a complex product (human-AI hybrid team running on files) and we need contributors to understand it, get excited about it, and know where they fit. That's experience design, not documentation.

## What you're asking for

Design a UX concept for presenting Liberation of Bajor to the public. This is the experience someone has when they first encounter the project and try to understand what it is, who it's for, and how they'd participate.

Concrete deliverable: a UX concept (HTML prototype, wireframes, or whatever fidelity answers the question) that Philipp can review and we can use to guide a public-facing surface — whether that's a landing page, a contributor portal, or something else you discover is the right form.

## Context the receiver needs

**The source document:** `docs/FEATURES.md` — read this end to end. It's structured in four parts:

1. **The Product** — what it is, who it's for (vibecoders, deep-skill devs, business roles), what you can do today
2. **The Team** — Cagan's empowered product team model adapted for AI, six phases with roles/skills/decision rights
3. **Global Skills & Standards** — the six skills every role runs, handoff routing, team standards, session lifecycle
4. **Where We're Going** — what's built, what's next and why

**Three audience types** that need to coexist:
- **Vibecoders** — prompt AI to build things, never touch code, work through briefs and reviews
- **Deep-skill developers** — extend the system itself (watcher, evaluator, new roles)
- **Business roles** — PMs, designers, coordinators who shape work and verify outcomes

**The core tension you're designing for:** this is a genuinely complex system (file queue state machine, autonomous evaluation, amendment loops, role handoffs) that needs to feel approachable to someone who's never seen it. The happy path is simple (write a brief → watch it execute → review the result), but the depth is real.

**Existing design artifacts in the workspace:**
- `ops-ux-concept.html` — Ops Center UX concept (LCARS theme)
- `bet2-dashboard-wireframe-balsamiq.html` — Balsamiq-style wireframe
- `lcars-dashboard.html` — LCARS dashboard prototype
- `ops-dashboard-spec.md` — Ops Center spec

These are internal product UI. What I'm asking for now is the *public presentation* of the whole project — a different problem.

**Philipp's direction:** "your project documentation needs to be really for ziyal to plan a UX concept to present this to the public. main audience: contributors and philipp himself to keep an overview of what we have and where we are going."

## What NOT to worry about

- Implementation — this is discovery, not delivery. Don't think about how to build it yet.
- The Ops Center UI — that's a separate design problem (internal tool). This is about presenting the project externally.
- Brief format specs, API endpoints, watcher config — the Reference section of FEATURES.md is for deep-skill devs, not for your UX concept.
- Perfection — Philipp and I expect iteration. First concept, not final concept.
