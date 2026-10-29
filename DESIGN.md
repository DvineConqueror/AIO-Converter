---
name: AIO Converter
description: A calm local conversion workspace for Windows.
colors:
  "bg": "#f7f8fa"
  "sidebar": "#eef0f4"
  "surface": "#fff"
  "raised": "#fff"
  "text": "#20242b"
  "muted": "#656d7b"
  "faint": "#e0e4eb"
  "blue": "#2463dc"
  "blue-hover": "#194fbe"
  "blue-wash": "#e9f0ff"
  "green": "#227347"
  "red": "#b3323a"
  "toolbar": "rgb(247 248 250 / 88%)"
  "dark-bg": "#181b20"
  "dark-sidebar": "#14171c"
  "dark-surface": "#20242b"
  "dark-raised": "#272c35"
  "dark-text": "#edf0f6"
  "dark-muted": "#a5aeba"
  "dark-faint": "#363d49"
  "dark-blue": "#81acff"
  "dark-blue-hover": "#a5c3ff"
  "dark-blue-wash": "#253859"
  "dark-green": "#8bd6a7"
  "dark-red": "#ff9aa0"
  "dark-toolbar": "rgb(24 27 32 / 90%)"
  "primary-ink": "#fff"
typography:
  headline:
    fontFamily: "\"Segoe UI Variable\",-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "2.45rem"
    fontWeight: 630
    lineHeight: 1.16
    letterSpacing: "-.035em"
  title:
    fontFamily: "\"Segoe UI Variable\",-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-.015em"
  body:
    fontFamily: "\"Segoe UI Variable\",-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: "\"Segoe UI Variable\",-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: ".91rem"
    fontWeight: 550
    lineHeight: 1.3
rounded:
  "tag": "4px"
  "quiet": "6px"
  "field": "7px"
  "secondary": "8px"
  "control": "9px"
  "container": "10px"
  "popover": "12px"
  "dropzone": "15px"
spacing:
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "15": "15px"
  "16": "16px"
  "18": "18px"
  "20": "20px"
  "22": "22px"
  "23": "23px"
  "24": "24px"
  "26": "26px"
  "38": "38px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.secondary}"
    padding: "10px 12px"
  button-quiet:
    textColor: "{colors.muted}"
    rounded: "{rounded.quiet}"
    padding: "8px"
  input-dimension:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.quiet}"
    padding: "8px"
  navigation-item:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "12px 13px"
    typography: "{typography.label}"
  format-tag:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.tag}"
    padding: "3px 6px"
  dropzone:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.dropzone}"
    padding: "24px"
---

# Design System: AIO Converter

## Overview

**Creative North Star: "The Quiet Conversion Desk"**

AIO Converter is a restrained desktop utility: cool neutral surfaces, clear blue actions, and a single mixed-file queue. System typography and native Windows window controls make it belong on the device. Apple-inspired precision appears in spacing, alignment, and responsiveness.

The workspace favors direct controls and legible file states. Tonal surfaces carry most of the depth; translucency is confined to the toolbar. Light, dark, and system appearance are equally supported. Raster artwork is unnecessary for this interface.

**Key Characteristics:**

- Cool neutral surfaces with blue action emphasis.
- System typography, compact controls, and plain queue rows.
- Subtle toolbar translucency with accessible alternatives.
- Inline SVG icons and native Windows window controls.

## Colors

The palette combines cool neutral surfaces with one action blue. Frontmatter names mirror the CSS variables; `dark-` entries describe their dark appearance overrides. System appearance follows the operating system.

### Primary

- **Action blue:** links, focus, selected controls, and progress use the semantic blue; hover and wash provide its interaction states. The primary conversion button retains the light action blue and white text in both themes.

### Neutral

- **Workspace / sidebar:** two cool background planes organize the application.
- **Surface / raised:** controls, bottom bar, drawer, popover, and toast.
- **Text / muted / faint:** content, secondary information, and fine boundaries.
- **Toolbar:** translucent workspace tint, replaced by a solid workspace tone when transparency is reduced.

Green and red communicate success and failure. Small file-family symbols also use localized purple, warm brown, and ochre tints; these are identification aids, not additional brand accents.

**The Action Blue Rule.** Use blue for actions, selection, focus, and running progress; reserve green and red for success and failure.

## Typography

**Heading and Body Font:** Segoe UI Variable, followed by the platform system stack recorded in frontmatter. No custom font is loaded. The user explicitly requires system typography for this Windows utility.

### Hierarchy

- **Headline:** workspace heading; muted lighter spans soften its second phrase. Detail pages use a smaller heading (2rem); compact layouts use 2.15rem for the main heading.
- **Title:** section headings; drawer headings use a small local increase (1.07rem).
- **Body:** base interface text, with smaller supporting copy by context.
- **Label:** navigation; other controls inherit the base family and use compact sizes. File metadata and counters use tabular numerals.

**The System Type Rule.** Use the existing system font stack for headings and controls, as explicitly required by the product brief.

## Layout

The desktop shell uses a fixed sidebar (218px) and flexible main column, with a minimum application height (480px). The toolbar (68px) and bottom conversion bar (minimum 95px) frame the independently scrolling content. The workspace is centered with a maximum width (1120px) and padding (30px 38px 26px).

Queue rows use four columns: flexible file identity, target (95px), status (100px), and actions (100px), separated by a 15px gap. File names truncate rather than pushing actions out of alignment. Settings use a fixed right drawer (330px). The target picker is 270px wide.

At the compact breakpoint (860px), the sidebar becomes 170px, workspace padding becomes 23px, queue columns tighten, and the drawer becomes 310px. This is a desktop resize treatment. Space follows a compact working rhythm with larger separation between task regions; frontmatter records observed steps, not an invented scale.

## Elevation & Depth

Tonal layering and fine borders establish normal surface hierarchy. The active navigation item and primary button have small shadows. The picker, toast, drawer, and dialog use larger floating shadows. Only the toolbar uses surface backdrop blur (18px); reduced transparency removes this and strengthens the modal backdrop. Exact shadow values live in the sidecar.

**The Quiet Depth Rule.** Separate everyday surfaces with tone and fine borders; reserve substantial shadows for floating UI.

## Shapes

Corners are gently rounded by function: small tags and quiet actions are tighter than primary controls, floating containers, and the drop area. Thin dividers structure queue rows. The import area has a dashed border that becomes solid in increased contrast mode. SVG icons use rounded strokes and joins; they communicate actions and file families without raster illustrations.

## Components

### Buttons

The primary action is confident but compact: fixed blue and white, rounded control corners, medium weight, and a small shadow. Its disabled state uses faint and muted neutrals without a shadow. Secondary buttons use the surface tone and a fine border; quiet buttons use muted text and a neutral hover fill. Enabled buttons shift down by 1px on press; reduced motion removes this feedback.

### Inputs / Fields

Dimension inputs and selects use workspace backgrounds, subtle borders, and small corners. Search uses a surface container with a focus-within inset ring. Keyboard focus uses a blue outline (2px) with an offset (4px), tightened to 3px in increased contrast mode. Native range and checkbox controls use blue accent color.

### Navigation

A compact icon-and-label sidebar uses muted defaults, neutral hover fills, and a surface-backed blue active item with a count badge. Navigation remains visible in the compact desktop layout.

### Chips

Supported format tags use small surface rectangles with compact padding. They are readable metadata, not oversized selectable pills.

### Cards / Containers

The import drop area is the main large rounded container. Hover and drag-over states use blue border and wash; its compact state becomes a horizontal row. The settings engine list uses a surface container and internal dividers. Ordinary queue files remain plain divided rows.

### Queue and Floating Controls

Each queue row keeps source identity, target choice, textual state, and contextual actions aligned. Running states expose thin progress; completed states expose reveal; failures retain error access and retry. Target selection uses a searchable popover; file settings use a nonmodal drawer. Toasts surface actionable errors, and a modal confirmation lists lossy changes.

## Do's and Don'ts

### Do:

- **Do** preserve light, dark, and system appearance with semantic surface and text variables.
- **Do** show visible keyboard focus and pair status color with readable status text.
- **Do** respect reduced motion, reduced transparency, increased contrast, and forced colors.
- **Do** use the existing inline SVG icon language and native Windows window controls.

### Don't:

- **Don't** add decorative raster artwork or a display font to this utility.
- **Don't** apply toolbar translucency across the workspace.
- **Don't** use status colors as general decorative accents.
