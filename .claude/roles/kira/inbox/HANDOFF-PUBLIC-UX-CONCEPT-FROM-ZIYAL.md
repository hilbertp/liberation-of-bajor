# Public-Facing UX Concept — Liberation of Bajor

**From:** Ziyal (Product Designer)  
**To:** Kira (Delivery Coordinator)  
**Date:** 2026-04-12  
**Scope:** Bet 2.2 — Public project presentation (discovery, not delivery)  

---

## Why this exists

Sisko handed me a design brief (HANDOFF-FEATURES-UX-CONCEPT-FROM-SISKO) asking me to create a UX concept for presenting Liberation of Bajor to the public. The brief emphasized:

- **Audience:** Contributors (vibecoders, deep-skill devs, business roles) + Philipp (project overview)
- **Purpose:** Help people understand what the project is, where it is now (Bet 2 complete), and where it's going (Bet 3+)
- **Constraint:** This is a discovery concept, not a delivery spec. Meant for Philipp to review and iterate on before any implementation

I've completed the concept discovery. Now you need to:
1. **Stage this for Philipp's review** — present the HTML prototype and design spec
2. **Get Philipp's approval** on the UX direction before decomposing into implementation slices
3. **If approved,** slice this into briefs for O'Brien (HTML implementation) and possibly Leeta (landing page if it becomes a separate artifact)

---

## What you're asking for

**Deliverables completed:**

1. **`public-uxi-concept.html`** — Interactive HTML prototype (open in browser)
   - One-page scrollable experience
   - Navigation, hero, three audience paths, pipeline visualization, features, status, roadmap, CTA
   - Responsive (desktop → mobile)
   - Dark-first, developer-friendly aesthetic
   - Zero dependencies (inline CSS + JS)

2. **`PUBLIC-UX-CONCEPT-SPEC.md`** — Design specification
   - Rationale for every major decision (why one-page, why three audiences, why dark theme, etc.)
   - Visual hierarchy and spacing guidelines
   - Copy tone and voice
   - Implementation notes for O'Brien (what to build, colors, interactions, responsive breakpoints)
   - Open questions for Philipp

**What Kira needs to do:**
- Open `public-uxi-concept.html` in a browser and experience the flow
- Read `PUBLIC-UX-CONCEPT-SPEC.md` to understand the design thinking
- Stage this in the Ops Center for Philipp to review: approve, amend with feedback, or reject
- **Do not decompose into slices yet.** This is discovery. Wait for Philipp's signal.

---

## Context you need

### The brief from Sisko

Sisko handed me HANDOFF-FEATURES-UX-CONCEPT-FROM-SISKO.md on 2026-04-12 with this framing:

> "Design a UX concept for presenting Liberation of Bajor to the public. This is the experience someone has when they first encounter the project and try to understand what it is, who it's for, and how they'd participate."

Audience: contributors (three types) + Philipp for project overview  
Purpose: understand where the project is at and where it's headed

### What informed the design

- **FEATURES.md** — The source material. Four parts: what the product is, the team model, global skills/standards, where we're going
- **Existing design artifacts** — Ops Center UI, LCARS dashboard (internal only)
- **Sisko's guidance:** This is public-facing (not internal), so: no LCARS, no Star Trek aesthetic, developer tool vibe (GitHub Dark mode, Linear, Vercel)

### Three audience types the concept must serve

1. **Vibecoders** — Prompt AI to build things. Shape scope with Sisko and Ziyal. Never touch code.
2. **Deep-skill developers** — Extend the system itself. Modify watcher, evaluator, add new roles.
3. **Business roles** — PMs, designers, coordinators. Shape work via handoffs and staging gates.

All three coexist in the same product. The concept must help each one find their path.

### Bet 2 status (what's shipped)

- Autonomous pipeline: staging gate → brief queue → watcher → O'Brien → evaluation → auto-merge or amendment
- Ops Center: real-time dashboard showing queue, active work, completions, economics, health
- Role system: Sisko, Ziyal, Dax, Kira, O'Brien. Extensible.
- Economics tracking: full timesheet JSONL, per-brief costs, human-hours estimates
- Amendment cap: max 5 cycles, then STUCK → escalate to Philipp
- 65 briefs processed to date

---

## What NOT to worry about

- **Implementation details.** That's O'Brien's job after Philipp approves direction.
- **Copy refinement.** First draft. Sisko can wordsmith later if needed.
- **Pixel perfection.** This is low-fi at HTML level. Can iterate visually in dev.
- **Landing page vs. documentation page.** This is conceptual. O'Brien and/or Leeta will figure out the right form after Philipp gives direction.
- **Brand voice consistency.** No brand voice role exists yet. This concept establishes the visual tone; Vic (TBD) will handle messaging tone later.
- **Detailed responsive design.** Breakpoints are noted; O'Brien can refine on implementation.

---

## Next steps for Kira

### Immediate
1. Open `public-uxi-concept.html` in a browser (Chrome, Safari, Firefox all fine)
2. Scroll through the entire page to experience the flow
3. Read `PUBLIC-UX-CONCEPT-SPEC.md` to understand why each section exists

### Stage for Philipp
- Present both artifacts in the Ops Center (or however you handle Philipp reviews)
- Frame for Philipp: "Ziyal created a UX concept for the public-facing project presentation. Review and let us know: approved, amend with feedback, or reject?"

### If Philipp approves
- Kira slices into briefs for implementation:
  - **Slice 1:** O'Brien builds the HTML/CSS/JS for `public-uxi-concept.html`
  - **Slice 2 (optional):** Leeta adapts this as a landing page on Lovable + Cloudflare if we're building a separate site
- Use the "Implementation Notes for O'Brien" section in the spec as the brief foundation

### If Philipp amends
- Return to Ziyal with feedback (write a RESPONSE artifact to her inbox)
- Iterate on the concept before decomposing to implementation

### If Philipp rejects
- This path is closed. Surface learnings in debrief.

---

## Confidence level

**Design direction:** High. The concept answers Sisko's specific questions (what is it, who is it for, how does it work, where is it going) and serves three distinct audiences without requiring deep prior knowledge.

**Implementation feasibility:** High. Single HTML file, no dependencies, no build step. O'Brien can deliver this in one slice.

**Iteration readiness:** High. This is intentionally low-fi. Easy to revise based on Philipp feedback before O'Brien invests in polish.

---

## Files delivered

- `repo/public-uxi-concept.html` — Interactive prototype
- `repo/PUBLIC-UX-CONCEPT-SPEC.md` — Design spec and rationale

Both ready for Philipp's review. Open the HTML in a browser first.
