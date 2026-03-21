# Landing Page Redesign + Demo Integration

**Date:** 2026-03-21
**Status:** Approved

---

## Overview

Redesign the landing page to use the app's white theme and embed an auto-playing product walkthrough that cycles through the full simulation flow: home input → simulation progress → results. Remove the separate DemoPage entirely.

---

## Goals

- Replace the current dark-themed landing page with a white/light theme consistent with the rest of the app
- Embed an auto-playing walkthrough window in the hero section that shows the full product journey
- Remove DemoPage (`/demo` route) — its purpose is fulfilled by the landing page walkthrough
- Apply minor UI/UX improvements to existing app pages (Header, HomePage, SimulatePage, ResultPage)

---

## Design

### Color & Theme

Match existing app pages exactly:
- Background: `#f8fafc`
- Card/surface: `#fff`
- Border: `#e2e8f0`
- Text primary: `#1e293b`
- Text secondary: `#64748b`
- Text muted: `#94a3b8`
- Accent: `#6355e0` / `#8070ff` (for logo, progress bar, badges)

Typography:
- Headings: Fraunces (serif) — already loaded
- Labels/mono: IBM Plex Mono — already loaded
- Body: DM Sans — already loaded

### Landing Page Sections

1. **Nav** — white background, logo (existing style), links (How it works, Platforms), Sign in button
2. **Hero** — headline + subtitle + two CTA buttons + auto-playing walkthrough window below buttons
3. **How it works** — existing 3-step content, light `#f8fafc` background
4. **Platforms & Sources** — existing platform badge list
5. **CTA** — bottom call to action
6. **Footer** — minimal, matches app style

### Auto-Playing Walkthrough Window

A framed product preview window (browser-chrome style) embedded in the hero. No label. Automatically plays through 3 phases in a loop:

**Phase 1 — Home (~4s)**
- Shows the DemoHomeView layout: pre-filled textarea with Noosphere product description, platform buttons (all selected), Run button
- Textarea text types in character by character (typewriter effect, ~80ms/char but abbreviated — show ~60 chars then jump to full)
- After ~3s, Run button animates a click (brief scale + color flash)

**Phase 2 — Simulation (~12s)**
- Transitions to the simulation progress view
- Sources appear one by one (from `MOCK_SOURCES`, ~400ms apart, newest on top)
- Progress message updates: "Searching external sources..." → "Generating personas..."
- Persona progress bar fills up (10 personas, ~300ms each)
- Round 1 starts: posts appear one by one across platforms (~500ms each)
- Round 2: more posts
- Status dot pulses green throughout

**Phase 3 — Results (~8s)**
- Transitions to result view with 5 tabs
- Starts on "Simulation" tab showing the verdict card (mixed/positive/negative badge, sentiment bars per platform)
- After ~3s, switches to "Social Feed" tab showing a few posts
- After ~3s, switches back to "Analysis" tab showing the markdown summary (partial)
- After ~2s, fades back to Phase 1

Total loop: ~24s

### Walkthrough Window Styling

- Outer shell: `border: 1px solid #e2e8f0`, `border-radius: 12px`, `box-shadow: 0 4px 32px rgba(0,0,0,0.07)`, `overflow: hidden`
- Top bar: `#f8fafc` background, three traffic-light dots (decorative), no text label
- Content area: white background, fixed height `420px`, `overflow: hidden` — content is clipped, not scrolled
- Max width: 760px, centered
- Phase transitions: `opacity` fade (0.3s ease)
- The entire window interior is `pointer-events: none` — no clicks, no interactive state. All buttons/tabs inside are display-only elements, not real event-handling components.

### Typewriter Effect (Phase 1)

Type the first 80 characters at ~60ms/char, then immediately append the remaining text in one tick (no animation for the tail). This gives the "typing" impression without waiting through the full input text. Cursor blink (`cursor-blink` class from `index.css`) shown during typing, hidden after.

### Run Button Click Animation (Phase 1 → Phase 2)

At the end of Phase 1, trigger a one-shot `@keyframes runClick` on the Run button: `scale(1) → scale(0.96) → scale(1)` over 200ms, background briefly shifts from `#1e293b` to `#8070ff` then back. After animation completes, fade-transition to Phase 2.

### Phase 3 Tab Sequence (use internal tab IDs)

- Start: `report` tab ("Simulation" label) — show verdict badge + sentiment bars per platform
- After 3s: switch to `feed` tab ("Social Feed" label) — show 2–3 posts
- After 3s: switch to `analysis` tab ("Analysis" label) — show first 3 paragraphs of markdown
- After 2s: fade back to Phase 1

### Sources Display (Phase 2)

Prepend each new source to the list (`[newSrc, ...existing]`) so newest appears at top, matching existing `useMockSimulation` behavior.

---

## Implementation

### Implementation Order (important — follow this sequence)

**Step 1 — Extract data before any deletions:**
Copy `MOCK_RESULTS` (report_json, posts_json, analysis_md, personas_json, sources_json) from `DemoPage.tsx` into `LandingDemoWindow.tsx` inline. Export `MOCK_SOURCES`, `MOCK_PERSONAS`, `MOCK_POSTS` from `useMockSimulation.ts` so they can be imported.

**Step 2 — Build `LandingDemoWindow.tsx`:**
Self-contained component with its own `useEffect`-driven timer loop. Does not use `useMockSimulation` hook (drives its own timers). Uses the extracted mock data. All interior elements are display-only (no event handlers).

**Step 3 — Rewrite `LandingPage.tsx`:**
Full rewrite — the existing 745-line dark-themed file is completely replaced. Do not try to adapt existing structure.

**Step 4 — Update `App.tsx`:**
Remove DemoPage import and `/demo` route, add `<Route path="/demo" element={<Navigate to="/" replace />} />`

**Step 5 — Delete `DemoPage.tsx`**

**Step 6 — Minor polish on existing pages**

### Files to Create
- `frontend/src/components/LandingDemoWindow.tsx` — new self-contained walkthrough component

### Files to Modify (full rewrite)
- `frontend/src/pages/LandingPage.tsx` — complete rewrite, white theme
- `frontend/src/hooks/useMockSimulation.ts` — export MOCK_SOURCES, MOCK_PERSONAS, MOCK_POSTS

### Files to Modify (minor)
- `frontend/src/App.tsx` — remove DemoPage, add /demo redirect
- `frontend/src/components/Header.tsx` — minor UI polish
- `frontend/src/pages/HomePage.tsx` — minor UI polish
- `frontend/src/index.css` — add `@keyframes runClick` if not present

### Files to Delete
- `frontend/src/pages/DemoPage.tsx` — only after data extraction is complete

### Nav Links
The new landing page nav has two links: "How it works" and "Platforms". Drop "Pricing" link (no dedicated pricing section in new design).

---

## Out of Scope

- Authentication / backend changes
- New content sections (pricing, testimonials)
- Mobile responsive overhaul (maintain existing responsive behavior)
- Modifications to SimulatePage or ResultPage beyond minor polish
