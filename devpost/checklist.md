---
doc: checklist
status: draft
---

# AccessRipple build checklist

Build mode: concise implementation, following the learner’s direct requests to continue without repeated product questions.

The scope, PRD, and spec already record approval. This checklist reconstructs the current UI revision; a separate build-order approval was not collected, so it remains draft. Implementation is authorized by the learner’s explicit request to improve the UI, use the supplied video, and fix the graph. No final interview, code tour, or ship approval is claimed.

## Slices

- [x] **1. Open a video-led AccessRipple introduction and enter the live studio**
  Becomes usable: A responsive landing page using the supplied local video, self-hosted fonts, working navigation, pause control, and theme switch.
  Why now: Establishes the requested visual direction and a clear path into the actual tool.
  PRD ref: `prd.md > Look and Feel`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Graph Studio UI revision`
  Build: Adapt the reference’s editorial typography, metallic controls, cinematic video, and entrance motion to AccessRipple.
  Verify (mechanical): Typecheck and production build; inspect landing at desktop and phone sizes; verify video playback, pause, dialogs, and themes.
  Learner check: Open the landing page, play/pause the video, and enter the studio.
  Commit: `Refine AccessRipple landing and graph studio`

- [x] **2. Scan a real website and understand its connected findings**
  Becomes usable: URL scanning, readable grouped graph, spatial orbit/pan/zoom, neighborhood focus, complete searchable list, and plain-language impact and guidance.
  Why now: Proves the product’s unique kernel using real browser evidence.
  PRD ref: `prd.md > The Core Journey`, `prd.md > Interactive graph and issue details`
  Spec ref: `spec.md > Graph and Evidence Builder`, `spec.md > Graph Studio UI revision`
  Build: Keep raw inventory intact, group repeated findings only in presentation, label untested journeys, show developer evidence on request, and retain scan results across page reloads while the local service has them.
  Verify (mechanical): Existing API/unit/end-to-end tests plus grouping tests; a live Google scan through the UI; node selection, filters, search, zoom, keyboard orbit, responsive layout, and failed-address handling.
  Learner check: Scan Google, select a finding, read its suggested next step, and find an individual element in List.
  Commit: `Refine AccessRipple landing and graph studio`

- [x] **3. Rescan, compare observations, and keep an export**
  Becomes usable: Real rescan comparison, recent scans from the current studio visit, and downloadable Obsidian notes plus raw graph.
  Why now: Completes the developer’s review-and-improve loop without changing external websites.
  PRD ref: `prd.md > Demo fix and rescan`, `prd.md > API and Obsidian-compatible export`
  Spec ref: `spec.md > Scan Store and Comparison`, `spec.md > Obsidian Exporter`
  Build: Connect the existing comparison and export endpoints; describe changes as observations, not proof of a fix.
  Verify (mechanical): Rescan Google in the UI, inspect comparison, download and inspect the ZIP, restore the result after reload.
  Learner check: Make a source change on a site you control, rescan it, and inspect the comparison and export.
  Commit: `Refine AccessRipple landing and graph studio`

## Hands-on Checkpoints

- [x] Early feedback received: the learner requested larger text, light/dark mode, a real Google scan, simpler issue descriptions, and the supplied video.
- [ ] Final exploration and feedback completed for this redesign.

## Final Review

- [ ] Final review complete — learner confirms ready to ship.

## Code Tour and App Map

- [ ] Learning activity complete — guided route or brief recap.
- [ ] Optional edit and transfer reflection addressed.
- [ ] `devpost/app-map.html` checked and shown.

Activity and evidence: Implementation and mechanical verification are recorded in `devpost/ui-verification.md`. The final learner review remains pending.

## Revisions

- The UI starts empty and uses real URL scans. The earlier sample graph was removed at the learner’s request; the controlled backend checkout fixture remains available for regression tests.
- A lightweight SVG spatial projection supplies yaw, pitch, pan, and zoom. A complete searchable list supplies the accessible alternative; no WebGL dependency is required.
- Browser policy messages are diagnostic signals and are presented separately from accessibility findings.


### User-requested journey clarity revision
- [x] Select a real control and show its ordered, directional route.
- [x] Keep the route visible while examining a finding.
- [x] Connect affected-control evidence and avoid misleading form destinations.
- [x] Verify live Google, phone layout, theme switch, production build, and regression suite.
- [ ] Learner review of the revised interaction and final submission materials.

### User-requested observed interaction revision
- [x] Activate safe controls once in disposable pages and record real outcomes (navigation, content change, dialog, validation, loading, blocked, failure).
- [x] Follow one revealed same-origin continuation link so script-driven flows such as catalogue → cart → checkout are observed, not inferred.
- [x] Gate form/submit controls behind explicit permission; always block data-changing requests and never activate consequential actions.
- [x] Attribute errors to the triggering action and keep unrelated page warnings as context.
- [x] Serve the extended checkout sample and verify the full chain, safe and authorized modes, rescan policy, phone layout, 49 tests, typecheck, and production build.
- [ ] Learner review of the consent wording, observed-journey presentation, and demo script.
