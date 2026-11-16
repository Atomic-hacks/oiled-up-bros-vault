---
name: VAULT
description: Private savings tracking with warm surfaces, clear financial figures, and a floating charcoal navigation pill.
colors:
  bg: "#f7f8f3"
  surface: "#fff"
  text: "#242720"
  muted: "#7d8075"
  line: "#eeefe8"
  lime: "#d6f88c"
  charcoal: "#252b24"
  balance: "#d9f79c"
  balance-ink: "#28351d"
  button-dark: "#293027"
  button-hover: "#414c36"
  nav: "#262d25"
  nav-active: "#3c4634"
  nav-active-ink: "#d6f499"
  verified-bg: "#f0f6e9"
  verified-ink: "#759258"
  pending-bg: "#fdf5e5"
  pending-ink: "#b28d4e"
  rejected-bg: "#f9ece9"
  rejected-ink: "#ad625c"
  focus: "#8eae50"
  dark-bg: "#191d18"
  dark-surface: "#242a22"
  dark-text: "#edf1e8"
  dark-muted: "#a1ab99"
  dark-line: "#363d31"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "66px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-3px"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "34px"
    fontWeight: 750
    lineHeight: 1.5
    letterSpacing: "-1.25px"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "26px"
    letterSpacing: "-0.8px"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    lineHeight: 1.8
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 550
rounded:
  badge: "4px"
  field: "7px"
  button: "9px"
  panel: "14px"
  feature: "16px"
  dialog: "19px"
  pill: "45px"
spacing:
  control-gap: "8px"
  field-gap: "12px"
  mobile-gap: "16px"
  grid-gap: "22px"
  surface-inset: "24px"
  dialog-inset: "32px"
components:
  button-primary:
    backgroundColor: "{colors.button-dark}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "13px 19px"
  button-primary-hover:
    backgroundColor: "{colors.button-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "6px"
    padding: "8px 11px"
  field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "12px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px 27px"
  balance-card:
    backgroundColor: "{colors.balance}"
    textColor: "{colors.balance-ink}"
    rounded: "{rounded.feature}"
    padding: "25px 30px 24px"
  navigation:
    backgroundColor: "{colors.nav}"
    rounded: "{rounded.pill}"
    height: "68px"
    padding: "8px 15px"
  status-verified:
    backgroundColor: "{colors.verified-bg}"
    textColor: "{colors.verified-ink}"
    rounded: "{rounded.badge}"
    padding: "4px 7px"
---

# Design System: VAULT

## Overview

**Creative North Star: “The Private Vault”** — a descriptive name for the implemented world, derived from the approved VAULT brief.

Warm off-white space and white surfaces support large financial figures. Lime concentrates attention on savings progress and the central contribution action; charcoal anchors controls and the compact floating navigation. Rounded containers keep dense ledger information approachable.

This is a source-derived record of `src/index.css`, `src/App.css`, `src/App.tsx`, and `src/Admin.tsx`, informed by `PRODUCT.md`. Desktop and mobile screenshots were unavailable. Visual review remains outstanding; the finish review requested recapture because rendered evidence was absent. This document does not constitute visual acceptance.

**Key Characteristics:**

- Large Manrope figures with tabular numerals for the principal balance.
- DM Sans supporting copy and form controls.
- Warm light surfaces, lime emphasis, and a persistent charcoal pill.
- Shared component language across member and administrator views.

## Colors

The palette combines warm neutrals with a luminous yellow-green accent and separate status tones.

### Primary

- **Lime** marks the central contribution action and selection highlight.
- **Balance lime** fills the principal savings card and onboarding artwork; its darker ink keeps financial figures distinct.

### Secondary

- **Verified green**, **pending amber**, and **rejected rose** distinguish ledger states with text labels as well as color.

### Neutral

- **Warm background**, **white surface**, **text**, **muted**, and **line** correspond directly to the root CSS custom properties.
- **Charcoal** is a root primitive; buttons and navigation use the nearby dedicated values recorded above.
- The dark theme replaces the five background, surface, text, muted, and line custom properties. Some accent surfaces remain explicitly light in source; complete dark-theme visual consistency is unverified.

### Named Rules

**The Balance Emphasis Rule.** Use the balance lime surface to elevate financial progress and the lime action color for contribution controls, following the existing component roles.

## Typography

**Display Font:** Manrope, with sans-serif fallback.
**Body Font:** DM Sans, with sans-serif fallback.

Manrope supplies rounded, tightly tracked figures and headings. DM Sans keeps explanatory copy and controls compact. The body token describes modal explanatory copy, not a global browser-size override; the root sets the font family without setting a base font size.

### Hierarchy

- **Display:** principal balance; tabular numerals, with a smaller currency symbol. Responsive source sizes are 58px below 1380px, 43px below 800px, and 54px below 600px.
- **Headline:** page heading; reduces to 28px below 800px and 26px below 600px.
- **Title:** modal heading; reduces to 24px on small screens.
- **Body:** modal supporting paragraphs; other dense descriptions range from 10px to 12px in the build.
- **Label:** form labels; weight and size are recorded above.

**The Figure First Rule.** Preserve the principal balance’s scale, tight tracking, and tabular numerals when extending financial summaries.

The source carries 6–9px microcopy and tracked uppercase descriptive headings. These are implementation findings, not additional type roles or rules for future screens.

## Layout

The main content is centered with a maximum width of 1266px. The header has a maximum width of 1376px. Main margins become 7% below 1380px, 5% below 1100px, and 5.5% below 600px. Desktop overview and middle grids use 1.65fr / 1fr columns with the grid-gap token; below 800px they use 1.4fr / 1fr with 15px gaps, and below 600px they stack with the mobile-gap token.

Goal, profile, analytics, and administrator views reuse related two-column arrangements. Administrator grids stack below 800px; most member grids stack below 600px. Tables scroll horizontally where necessary. The activity summary hides selected columns on small screens.

The app reserves 125px below content, reducing to 110px below 600px. The floating navigation stays centered above the viewport edge, using safe-area-aware spacing on mobile. Below 600px its width is viewport minus 36px, capped at 390px, with a height of 66px.

## Elevation & Depth

Most panels are flat and separated by surface tone, rounded edges, or light divider lines. Diffuse shadows identify floating navigation, dialogs, toasts, and selected controls. Device illustrations use their own material shadows and gradients; those illustration treatments are not general panel styles.

### Shadow Vocabulary

- **Navigation:** `0 10px 28px #25301f28` anchors the floating pill.
- **Dialog:** `0 22px 70px #14200f30` separates modal content from a blurred backdrop.
- **Toast:** `0 7px 35px #28382122` lifts transient feedback.
- **Primary hover:** `0 5px 15px #27302115` accompanies the darker hover background.

Buttons transition background, transform, and shadow over 0.18s; activation shifts them downward by 1px. Balance progress uses a one-second width transition and 1.1-second entrance with `cubic-bezier(.16,1,.3,1)`. Reduced-motion preferences disable animations and transitions.

## Shapes

Small badges, fields, buttons, panels, feature cards, and dialogs follow the extracted rounded scale. Circles serve avatars, icon containers, status dots, and the central contribution action. The navigation is a long pill containing smaller rounded destination controls. Thin neutral strokes separate form fields and ledger rows without boxing every content region.

**The Floating Pill Rule.** Keep the navigation compact, centered, and visually distinct from the content surfaces; retain its circular lime contribution action.

## Components

### Buttons

Primary actions are charcoal with white type, compact padding, and rounded corners. Hover darkens toward olive and adds a diffuse shadow. Outline controls use a surface fill, light stroke, smaller padding, and 6px corners. Disabled buttons use half opacity and a not-allowed cursor. Keyboard focus uses a 3px focus-color outline offset by 4px.

### Chips

Ledger status badges pair semantic text with a soft tinted background and optional small dot. The implementation uses a compact 8px status label, shrinking to 7px on mobile; that text scale is not recommended as a future-system requirement.

### Cards / Containers

White panels carry the panel radius and inset tokens; feature cards have larger corners and their own surface tone. On mobile, standard panels use 22px 19px padding. Balance cards retain greater visual priority through color and the large financial figure rather than a shadow.

### Inputs / Fields

Inputs, selects, and text areas use the warm background, a 1px line-color border, and field corners. Labels sit above controls. Upload targets use a dashed border and show receipt previews. Errors appear as warm red text with contextual messages. Shared global focus treatment applies to form controls; the search input overrides its outline to zero, an accessibility finding left uncanonized.

### Navigation

The fixed charcoal pill contains icon-and-label destination buttons. Active destinations have a lighter charcoal-green inset and lime text; hover uses a neighboring tonal surface. The center contribution action is a lime circle with a surrounding charcoal ring. Member navigation persists across screen widths. Administrator views add scrollable tabs with a pale lime selected state.

### Balance and Progress

The lime balance card pairs a dominant naira amount with a progress track and a divided lower summary. Progress is dark green over a muted lime track and animates unless reduced motion is requested. Pending and verified amounts remain visibly distinguished through labels and status styling.

## Do's and Don'ts

### Do:

- **Do** preserve the hierarchy of principal balance, supporting metrics, and ledger detail.
- **Do** reuse the root color properties for surfaces, text, borders, and theme-aware controls.
- **Do** keep text labels with transaction status colors.
- **Do** preserve keyboard focus and reduced-motion support when extending components.
- **Do** capture desktop and mobile rendering before marking visual review complete.

### Don't:

- **Don't** replace the signature floating pill with a full-width bottom bar.
- **Don't** generalize the device illustration’s material shadows into every panel.
- **Don't** inherit the build’s tiny microcopy, uppercase descriptive kickers, or search-focus suppression as design-system rules.
- **Don't** treat this source extraction as rendered accessibility or responsive-layout approval.
