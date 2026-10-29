# Download links design comparison

## Outcome

The Download links workspace fits the incumbent **Quiet Conversion Desk** system. This is an ordinary extension: no new visual world, reusable token system, or shipping raster artwork is introduced. `DESIGN.md` and `.impeccable/design.json` were preserved.

## Comparison with the incumbent system

- **Palette:** existing workspace, sidebar, surface, text, border and action variables supply both themes. The Download button reuses the fixed blue/white primary action. Saved and failed rows use the existing green/red status roles and readable labels.
- **Typography:** the existing Segoe UI Variable/system stack, split headline with a muted second phrase, compact labels and tabular file metadata remain intact. No display font was added.
- **Layout:** the workspace uses the existing shell, centered working column, sidebar, toolbar, independently scrolling content and destination footer. The URL form precedes a plain divided queue; native selects expose type, extension and conditional resolution. The existing 860px treatment tightens row columns and controls at the minimum desktop size.
- **Depth and shapes:** established field/control corners, fine borders and neutral surface separation are retained. The extension adds no floating shadows or extra translucent regions.
- **Interaction:** labels, named icon buttons, native URL validation, textual progress, disclosure errors and contextual cancel/retry/reveal/remove actions follow the utility's direct-control pattern. Form state remains mounted during queue updates; open error disclosures and their focused summaries are restored after rerendering.
- **Assets:** icons continue through the existing inline SVG helper. Review PNGs are evidence captures, not shipping artwork.

## Evidence checked

Read `PRODUCT.md`, `.impeccable/surface-contract.md`, incumbent `DESIGN.md` and `.impeccable/design.json`, `src/renderer/downloads.ts`, and the global and added download rules in `src/renderer/style.css`.

Visually inspected all five finished captures in `.impeccable/review/`: `downloads-light.png`, `downloads-dark.png`, `downloads-small.png`, `downloads-error.png`, and `downloads-accessibility.png`. The compact captures show the scrolled content region with the persistent footer; they do not imply every queue row fits in one viewport. The accessibility capture shows forced colors and visible keyboard focus on the URL field.

Read `output/playwright/downloads-checks.json`: nine recorded checks, no renderer errors. These cover format selectors, rejection of non-web URLs, real native download to MP3, form value/focus preservation during progress, verified output reveal, disclosure expansion/summary-focus preservation across another real download, recoverable remote failure, compact/theme/accessibility captures, and the offline status of local conversion. The record is explicitly `packaged: false`; it does not certify an installer or packaged release. This documentation pass inspected the evidence rather than rerunning those checks.

## Drift and limits left outside the system

The incumbent CSS also has a 1040px intermediate desktop breakpoint; `DESIGN.md` and the sidecar currently record only the 860px compact breakpoint. This documentation omission predates this extension and is reported without changing the system. The surface contract's minimum-size line contains a preexisting text-encoding artifact. Neither omission is promoted into a design rule or repaired here.

The general Impeccable floor's objection to system display faces is not canonized as a new prohibition: system typography is an explicit incumbent product commitment and remains authoritative for this utility. No new visual defect was turned into a normative token or rule.

Skipped: system regeneration, source edits and independent runtime/installer retesting; this pass is a design comparison of the finished extension and its recorded checks.
Risk: public-site compatibility can change; the supplied checks establish a development build, not packaged release behavior.
