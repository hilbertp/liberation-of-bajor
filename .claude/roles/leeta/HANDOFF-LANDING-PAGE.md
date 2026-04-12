# Dax Landing Page — Build Spec

**From:** Ziyal (Product Designer)
**To:** Leeta (Frontend Engineer)
**Date:** 2026-04-08
**Scope:** Bet 1 — Open-source landing page (paused)

---

## Overview

Single-page marketing site for the Dax open-source framework. Primary goal: drive GitHub contributions. Secondary: Discord community engagement. Audience: developers who already use AI coding tools and are hitting the "solo agent ceiling."

**Reference wireframe:** `deliveries/dax-landing-wireframe-v1.html`
**Reference copy:** `deliveries/landing-page-copy-draft-v1.md`

---

## What's Locked (do not change)

These decisions have been reviewed with Philipp and are final:

- **Page structure**: 8 sections in this order: Hero → Problem → What Dax Is → Delivery Loop → Team Meetings → Roster → Get Involved → Footer
- **Copy**: All headlines, body text, and CTAs as written in the wireframe. If something reads awkwardly in implementation, flag it — don't rewrite silently.
- **Delivery loop layout**: 2×3 grid. Top row flows right (1→2→3), down arrow on right, bottom row flows left (6←5←4), up arrow on left back to 1. This is the visual structure — do not linearize it. Below the loop, include the annotation line: *"No human relay. No copy-pasting context between tools. The agents talk to each other."*
- **Roster grouping**: Three groups — "The delivery cycle", "Creative & content roles", "Advisory & specialist roles." Shipping vs. planned distinction must be visible.
- **Team meetings section**: Three example cards (creative alignment, architecture risk, sprint planning). These are specific and intentional.
- **CTAs**: Hero has one CTA ("View on GitHub"). Section 7 has three cards (Use it, Contribute, Join the conversation). **"Contribute" is the primary conversion card** — give it slightly more visual weight (accent border by default, or a filled background instead of outline). The other two are important but secondary. No other CTAs on the page.
- **No LCARS aesthetic**: This is a public-facing developer page, not the internal ops dashboard. No elbow bars, no amber/lavender palette, no Antonio font.
- **License**: Apache 2.0

## What's Flexible (use your judgment)

These are areas where Leeta has design freedom:

- **Visual style**: The wireframe is structural, not visual. You choose the final look — spacing, shadows, gradients, micro-interactions. See the Brand Kit section below for constraints and direction.
- **Animation on the delivery loop**: The wireframe uses static arrows. If you can make the loop animate (dots flowing along the path, steps highlighting in sequence), that would be powerful. But a clean static version is also fine.
- **Team meeting cards**: Could have hover states, could feel like "startable" sessions, could have subtle icons. Your call on how interactive they feel.
- **Roster cards**: The wireframe uses a simple grid. You can add hover effects, subtle icons per role, or visual differentiation beyond the planned/shipping distinction. Just keep planned roles visually de-emphasized.
- **Section transitions**: Dividers, fade-ins on scroll, spacing between sections — all yours.
- **Mobile layout**: The wireframe specs basic responsive behavior. On mobile: the delivery loop stacks vertically (1→2→3→4→5→6 in a single column), the roster grid goes single-column, the meeting cards stack. Beyond that, use your judgment.
- **Nav behavior**: Sticky nav is in the wireframe. You can add scroll-based section highlighting, smooth scroll to anchors, or a hamburger menu on mobile.
- **Footer**: Minimal content is locked (GitHub, Discord, Medium, Apache 2.0). All four links must be present. Layout is yours.

---

## Brand Kit (Lightweight)

This is not a full brand system — that's Vic's job when he comes online. This is enough direction for Leeta to make the landing page look intentional.

### Voice & Tone
- Developer-to-developer. Write like a good README.
- Direct, opinionated, a little irreverent.
- No marketing fluff. No "revolutionize" or "empower" or "seamless."
- If someone reads it and thinks "these people actually build software," we've nailed it.

### Color Direction

The wireframe uses a GitHub-dark palette as placeholder. Leeta can keep this or evolve it, but stay in the dark-background family. The page should feel like a tool, not a marketing site.

| Token | Wireframe value | Intent | Freedom |
|-------|----------------|--------|---------|
| `bg` | `#0d1117` | Page background | Can adjust darkness, stay dark |
| `surface` | `#161b22` | Cards, panels | Can adjust, maintain contrast with bg |
| `border` | `#30363d` | Subtle borders | Can adjust |
| `text` | `#e6edf3` | Primary text | Keep high contrast on dark bg |
| `text-muted` | `#8b949e` | Secondary text | Keep readable |
| `accent` | `#58a6ff` | Links, CTAs, highlights | **This is the most flexible token.** Can shift hue — consider a color that distinguishes Dax from GitHub's blue. |
| `green` | `#3fb950` | "Shipping" status | Keep green-family |
| `orange` | `#d29922` | "Planned" status, advisory label | Keep warm |
| `purple` | `#bc8cff` | Creative roles label, annotations | Keep distinct from accent |

**Key decision for Leeta:** The accent color. GitHub uses `#58a6ff`. If we keep it, the page will feel like a GitHub extension (not terrible for credibility). If we shift it — maybe a teal, or a warmer blue, or something entirely different — the page gets its own identity. Recommend trying 2-3 options and showing Philipp.

### Typography Direction

| Use | Wireframe | Notes |
|-----|-----------|-------|
| Headings | System font stack (-apple-system, etc.) | Can swap for a character font. Candidates: Inter (clean, dev-friendly), JetBrains Mono for headings (signals "this is a dev tool"), or Space Grotesk (modern, slightly opinionated). |
| Body | System font stack | Keep system stack or Inter. Readability over personality. |
| Code/monospace | Not yet used | Will need one for inline code references (`ROLE.md`, etc.). JetBrains Mono or Fira Code. |

### Spacing Philosophy

- Generous section spacing. Each section should feel like its own room.
- Tight internal spacing within cards and components.
- The page is long (8 sections). Breathing room prevents fatigue.

### Imagery & Icons

- **No stock photos.** No hero images of people or abstract gradients.
- **No illustrations** unless they're diagrams (like the delivery loop).
- **Minimal icons** — the wireframe uses unicode symbols as placeholders in the Get Involved cards. Leeta can use Lucide icons or similar. Keep them small and functional, not decorative.
- **The roster could use small avatar-style icons** per role — but only if they're consistent and don't look clipart-y. Optional.

---

## Responsive Behavior

| Breakpoint | Key changes |
|------------|-------------|
| Desktop (>1024px) | Default layout as wireframed |
| Tablet (768-1024px) | Roster grid goes 2 columns. Meeting cards stack to 1 column. Nav stays horizontal. |
| Mobile (<768px) | Everything single column. Delivery loop becomes vertical (1→2→3→4→5→6). Pipeline arrows become ↓ between each step. Nav gets hamburger or collapses to logo + GitHub link only. |

---

## Interaction States

| Element | Default | Hover | Active | Notes |
|---------|---------|-------|--------|-------|
| Hero CTA | Solid accent bg | Lighten 10% | Slight scale down | Single button, must be prominent |
| Nav GitHub link | Border, muted text | Border brightens, text lightens | — | Subtle, not competing with hero |
| Roster card | Surface bg, border | Border brightens | — | Planned cards stay muted even on hover |
| Meeting card | Surface bg, border | Border goes accent, slight lift | — | Should feel "startable" |
| Get Involved card | Surface bg, border | Accent border, lift -2px | — | These are the real conversion elements |
| Footer links | Muted text | Brighten to primary text | — | Minimal |

---

## Accessibility Requirements

Non-negotiable. Check these before shipping.

- **Color contrast**: All text must pass WCAG AA (4.5:1 for body, 3:1 for large text). The dark bg helps — just make sure muted text isn't too muted.
- **Focus states**: Every interactive element needs a visible focus ring. Tab order follows visual reading order.
- **Alt text**: The delivery loop diagram needs an aria-label describing the 6-step cycle for screen readers. Use `aria-hidden="true"` on the decorative arrow characters (→←↓↑) so screen readers skip them and rely on the label instead.
- **Semantic HTML**: Use proper heading hierarchy (h1 for hero, h2 for section labels, h3 for section headings). Use `<nav>`, `<main>`, `<section>`, `<footer>`.
- **Link purpose**: Every link text must make sense out of context. "View on GitHub" is good. "Click here" is not.
- **Reduced motion**: If you add scroll animations or the loop animation, wrap them in `@media (prefers-reduced-motion: reduce)` and provide a static fallback.

---

## Edge Cases

- **Long role descriptions**: The Garak card has the longest text. Make sure cards handle variable-length content gracefully (consistent height per row, or flexible height with alignment).
- **Planned roles growing**: The roster will gain more planned roles over time. The grid should handle 15+ cards without breaking.
- **External links**: GitHub, Medium, Discord links should all open in new tabs (`target="_blank" rel="noopener"`).
- **No JavaScript required for content**: The page should render all content without JS. Animations and interactions can be JS-enhanced, but the page must be readable with JS disabled.

---

## SEO Basics

Leeta owns technical SEO for this page:

- **Title tag**: "Dax — Open-Source AI Team Framework" (or similar, keep under 60 chars)
- **Meta description**: One sentence about what Dax is. Keep under 155 chars.
- **OG tags**: For GitHub/Discord/Twitter link previews. Needs og:title, og:description, og:image.
- **og:image**: Will need a simple social card. Can be generated — dark bg, "Dax" in the heading font, one-line tagline.
- **Canonical URL**: Set it.
- **Sitemap**: Single page, but still generate one for good practice.
- **Structured data**: Optional. `SoftwareApplication` schema if we want rich results.

---

## What Leeta Does NOT Need to Worry About

- **Copy changes**: Jake and Vic will handle copy refinement later. Build with the current copy as-is.
- **Full brand system**: This is a v1. We're establishing visual direction, not building a design system.
- **Analytics**: Philipp will add tracking after launch.
- **Domain/hosting**: Dax and Worf's territory. Leeta builds and deploys to Cloudflare Pages.

---

## Architecture Note: Theming

**Important for how you build the CSS.** We're planning a v2 feature: a style picker toggle that switches the entire page between clean developer mode (v1, what you're building now) and a LCARS/DS9 lore mode (amber/lavender palette, Antonio + Share Tech Mono fonts, elbow bars, character backstories in descriptions).

This means: **use CSS custom properties for every color, font, spacing, and border-radius token.** Don't hardcode values. When the toggle ships, we need to swap one set of variables and have the whole page re-skin without touching the HTML or layout.

You don't need to build the toggle or the LCARS theme. Just make sure the clean theme is built on tokens so we can add a second theme later without a rewrite.

---

## Deliverable

A deployed landing page on Cloudflare Pages that:
1. Follows the wireframe structure exactly
2. Uses the copy as written
3. Looks intentional and developer-credible (not templated)
4. Passes WCAG AA accessibility
5. Works on mobile, tablet, and desktop
6. Has basic SEO in place
