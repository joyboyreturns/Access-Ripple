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

### Clearer routes, honest coverage, saved history, and real-site hardening
- [x] Animate the recorded route with a travelling pulse and flowing edges; stagger long routes and keep step labels readable; honor reduced-motion requests.
- [x] Explain coverage in the result: pages inspected/blocked/failed, destinations not reached with the stopping limit, links beyond depth, and controls activated versus untested.
- [x] Save completed scans on this computer (newest 25) and reopen them from **Recent scans** after a scanner restart; add list/rehydrate API and persistence tests.
- [x] Verify real public websites (example.com, W3C bad-demo, IANA) and fix what they exposed: blocked external links now report honestly as “not followed”, skip links activate by keyboard, and slow sites get a fair reopen timeout.
- [x] Ship a before/after repair loop on the controlled checkout sample (`/api/sample/state`) and verify 3 resolved items (image alternative text and two 404 signals) with 0 new and 0 changed.
- [x] Keep the suite green: 53 tests across 9 files, typecheck, production build.
- [ ] Learner review of the animated route, coverage wording, saved-history behavior, and the recorded demo route.

### Demo reliability: a three-minute recording that cannot fail
- [x] Scan the built-in demo shop from the studio in one click, with no network address and an identical result on every run.
- [x] Open the studio straight into that scan from the landing page, and keep it working across a reload.
- [x] State the scan result in one plain paragraph: observed counts, the first barrier to look at, and its suggested change.
- [x] Move the before/after repair loop into the interface, so the comparison needs no terminal during a recording.
- [x] Replace the dead end on a private or local address with an explanation and an offer to scan the demo shop.
- [x] Name the demo shop in the graph, the result panel, the history list, and the exported vault instead of showing a loopback address.
- [x] Record the four beats of the recording as a guide inside the studio.
- [x] Keep the suite green: 64 tests across 9 files, typecheck, production build.
- [ ] Learner review of the demo shop, the scan story, the repair lab, and the demo guide.

### Optional AI briefing
- [x] A local endpoint writes a plain-language read of a finished scan, with every sentence tied to evidence that exists in the scan.
- [x] Off by default. It switches on only when a provider key is present in a local `.env`, and the deterministic summary is always shown whether or not it is enabled.
- [x] Ground the model: it only sees a digest of recorded evidence, a sentence whose citations are all invalid is dropped, and a briefing with no grounded sentence fails rather than showing an unverified summary.
- [x] Show the citations as buttons that open the evidence the sentence came from.
- [x] Cover the digest, the grounding rules, and the whole request path with unit and API tests against a local mock provider.
- [ ] Learner records the AI beat with a real key configured, or decides to skip it.

### A brighter map and a real model
- [x] Rebuild the map so it reads as a space: colour-matched blooms, a pulse on the selected point, an aurora background with a vignette, flowing observed relationships, and floating label cards.
- [x] Move the site label under its node so it stops covering a neighbouring point.
- [x] Fix the grounding for real models: fold a citation back into the sentence it follows, ask for a low reasoning effort, and raise the token budget.
- [x] Try a chain of free models in order, because free-tier capacity is shared and one model is not dependable.
- [x] Report what the scan did not check: the coverage gaps enter the digest, the model is asked to name at least one, and the gaps show as dashed chips that are not links.
- [x] Keep a browser sweep of the whole studio as `npm run check:studio` (30 checks), and add an end-to-end test for the demo path and the graph's internal consistency.
- [x] Keep the suite green: 83 tests across 12 files, typecheck, production build, axe-core 0 violations.
- [ ] Learner reads the real briefing and decides whether the model beat belongs in the recording.

### A demo that opens on the result
- [x] Capture a small picture of every inspected page, and keep the picture of a page that no longer has a finding.
- [x] Show the same page before and after one change, with the counts above it, as a full-screen proof.
- [x] Propose a concrete change for a finding, grounded in the recorded markup, as a diff with the file and line it came from.
- [x] Label the apply action honestly: the model proposes, a human decides, and the demo repair is the tool's own fixture.
- [x] Record the markup of a failing element, which the developer evidence panel had always claimed to show but never captured.
- [x] Give every element a path that matches exactly one element, so two links can never collapse into one node, and refuse to build a graph with a repeated node id.
- [x] Keep a recorded scan of a real public site in the history, and label it as recorded rather than live.
- [x] Rewrite the guided tour to the new beat sheet, and grow the browser sweep to 36 checks.
- [x] Keep the suite green: 86 tests across 13 files, typecheck, production build, axe-core 0 violations.
- [ ] Learner records the three-minute demo following `devpost/demo-script.md`.

### Real public sites
- [x] Scan ten famous public sites and confirm every one produces a well-formed graph, with no repeated node id and no dangling edge.
- [x] Report a site that refuses the scanner as refused, not as an inspected page with a finding on it.
- [x] Give interaction testing a fixed slice of the budget so a heavy site still reaches more than one page.
- [x] Widen the total budget to 100 seconds and shorten the interaction reopen wait; the demo shop is unaffected.
- [x] Record which sites are worth showing, how long they take, and which ones answer automated browsers with a challenge page.
- [ ] Learner records the real-site beat with the site they choose.
