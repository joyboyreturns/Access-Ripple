# AccessRipple UI verification

Verified on 19 October 2026. This records mechanical evidence, not a completed learner interview or final ship approval.

## Automated checks

- `npm run typecheck` — passed for API, tests, and React code.
- `npm run build` — passed for the Vite frontend and compiled backend.
- `npm test` — 53 tests passed across 9 files. Includes URL safety, graph generation/comparison, ZIP export, API behavior, persistence, interaction classification policy, controlled browser fixtures with real observed interactions, presentation grouping and observed-route tracing, sample before/after switching, and the bodyless-rescan regression.

## Real browser checks

- A live Google scan through the studio completed with 2 inspected pages, 39 visible controls, 14 accessibility findings, 3 browser diagnostics, 37 possible journeys, 96 graph nodes, and 98 edges. These are recorded observations, not stable claims about Google.
- A second live scan completed and the comparison showed 1 item no longer observed, 16 still observed, and 1 new item. No external website was changed. Dynamic content can alter the observations.
- Selecting the graph’s Low text contrast point opened “Some text is hard to read” with the corresponding impact, guidance, page, and evidence.
- Keyboard orbit changed node projection; zoom reached 115%; neighborhood focus reduced the scene to 3 points; reset restored the view. In Pan mode, the right arrow moved the scene horizontally by 22 pixels.
- Control search for “Search” returned 11 entries. Selecting “Search for Images” opened its own details. Progressive loading exposed all 96 recorded inventory entries.
- Reloading the studio restored the latest real scan. Recent scans displayed the two scans opened during that visit. Native dialogs closed with Escape.
- Entering an FTP URL displayed the HTTP/HTTPS validation message and retained the current result.
- Export downloaded a real ZIP. Inspection found 100 archive entries, the start note, and graph data containing the same 96 nodes and 98 edges.
- The supplied local MP4 loaded with ready state 4, duration about 10 seconds, and working play/pause controls. It was served as video/mp4; the two local fonts were served as font/woff2.
- Light/dark switching, desktop navigation, the phone menu, and the How it works dialog worked. The phone menu reported expanded state and successfully entered the studio.
- Checked the 1440×960 desktop layout, 390×844 phone layout, and a 320-pixel viewport. Document width matched viewport width at 390 and 320, without horizontal page overflow. Graph text was 13 CSS pixels; explanatory copy was larger. Dense small-screen graphs reserve persistent labels for the selected point and page context; List remains available.
- A resize feedback issue was fixed by taking the SVG out of intrinsic layout flow. The final desktop graph stage measured approximately 661 pixels within an approximately 860-pixel workspace.
- The final browser log check returned no warnings or errors, and no visible button lacked a name.

## Fixes found during verification

- Removed the initial seeded graph and sample CTA; only real URL results populate the studio.
- Excluded hidden inputs, hidden/inert/ARIA-hidden elements, and stylesheet-like names from the visible-control inventory.
- Corrected node label coordinates, kept animated scale out of SVG node positioning, and preserved original finding IDs and targets when grouping.
- Fixed JSON content-type headers on bodyless rescan requests, with a dedicated regression test.
- Kept URL validation and scan failures separate from scanner connectivity; preserved the prior result on failure.
- Added explicit behavior for expired scans, keyboard pan, mobile filter navigation, local media fallback, and a complete inventory outside the bounded visual scene.

## Review boundaries

This is a local proof of concept with bounded scans. It does not certify accessibility, activate arbitrary external controls, or modify external websites. Manual keyboard, screen-reader, and usability testing remain important. The backend test checkout remains a controlled fixture; the before/after repair loop runs through the sample-state API and a rescan comparison, not through a code editor in this UI.

The supplied background video is decorative reference media, not a product demonstration recording. `demo-script.md` provides a sub-three-minute recording route; a submission video has not been recorded or uploaded by this work.

The learner’s final exploration, guided code tour, and readiness approval remain pending in `checklist.md`.


## Selected-action journey correction

- A named action picker opens a directional journey: source page → selected control → inferred destination → independently scanned destination page, when available. Selecting a finding keeps the route visible.
- Numbered steps, arrowheads, larger labels, keyboard pan/zoom, and a persistent ordered details list make the path inspectable. Mobile uses a vertical route.
- Findings are matched to actual rendered controls by resolving their selectors against the DOM. Broad page warnings are not automatically assigned to every button. Destination observations are context, not proof of causation.
- Form destinations are extracted only for submit controls, including explicit form overrides. Text fields and ordinary buttons no longer inherit a submission flow.
- Unknown script-driven behavior and unvisited destinations are explained explicitly. External buttons, forms, and payments are not activated.
- Live Google browser verification: 2 pages, 39 visible controls, 31 possible journeys, 14 accessibility findings, 3 browser diagnostics. Dynamic content can change these counts. Search for Images displayed four ordered steps and five destination observations. Selecting Low text contrast kept the journey and opened the readable guidance.
- Verified 390px phone viewport with document width 390px, four numbered steps, six directional edges, working light/dark toggle. Graph labels measure 15px on phone and 16px on desktop. Fixed the non-clickable gap between graph dots and label cards.
- Type checks, production build, and all 34 tests across seven files pass. Browser fixture coverage includes checkout → payment destination error context, export, rescan, and corrected form inference. New unit coverage includes unknown destinations, script controls, exact control findings, and unrelated warning exclusion.
- That revision was a read-only evidence map; recorded browser interaction testing was added in the section below.

## Observed interaction testing revision

Verified on 19 October 2026 with the same local-first scanning service.

- Safe controls are now activated once each in disposable browser pages and their real outcome is recorded: `navigated`, `content-changed`, `dialog-opened`, `validation-shown`, `loading`, `no-visible-change`, `blocked`, or `failed`. A follow-up click follows at most one revealed same-origin continuation link, which is how a script-driven reveal enters the crawl.
- Interaction policy: form and submit controls are activated only when the scan was explicitly authorized (studio tick-box, or `authorizeSubmit: true` in the API). Non-GET/HEAD requests, cross-origin navigations, and consequential actions (delete, send, pay, sign out, and similar names) are never activated — the former are blocked and recorded, the latter are explained as untested with a reason. Authorization mode is preserved across rescans unless explicitly changed.
- Graph and journey changes: activated controls get observed flow nodes with outcome, step summaries, and a `links-to` edge to the independently inspected destination. Untested or inferred routes keep their original labels. Observed errors connect to the triggering action with a `failed-at` edge; unrelated page warnings remain page-level context, not causes.
- Controlled sample evidence (authorized scan through the running dev service): 4 pages inspected including `/sample/cart`, which is only reachable through the JavaScript reveal (`Add to cart` → `View cart · 1 item`); 10 observed actions; 1 consequential exclusion (`Remove item`); 12-step observed journey catalogue → cart → checkout → payment → retry. Safe mode records 9 actions and skips `Check details` with reason `requires-authorization`. The simulated payment gateway timeout is attributed to the action that navigated to the payment page.
- Studio evidence: consent tick-box visible and unchecked by default; report reads “10 actions activated once in a disposable browser … 1 control stayed untested”. Selected “Add to cart” shows “activated once in a controlled browser” with captioned steps (“Observed navigation · action tested once”, “Continue · activated in a controlled browser”, “Destination · independently inspected”), and route findings are captioned “Recorded on the destination page · context, not proof this action fails”.
- Phone check at 390×844: document width matched the viewport (390 = 390), consent control measured 354×33 CSS pixels, interaction report 360×134, no horizontal overflow.
- Attribution hardening found during verification: page-load 404s were racing into the first interaction step. The interaction page now waits for its own load to settle before observing, so errors are attributed only when they occur after the activation. Exemption reasons are now classified before budget limits, so a consequential control is never mislabeled as “budget”.
- Known boundary: only recorded controls on inspected pages are activated, once each, within a ten-action budget; text entry, real payments, and destructive actions remain out of scope, and a `no-visible-change` outcome may still reflect missing state rather than a broken control.

## Animated routes, coverage honesty, saved history, and real-site verification

Verified on 19 October 2026 against the running local service and three live public websites.

- Selected-action journeys now animate their recorded route: the observed edges carry a flowing dash and a pulse dot travels the exact polyline of the numbered steps. Long routes zigzag so each “STEP n” stays readable, and per-step label cards appear on hover or selection while every step remains listed with its caption in the details panel. Reduced-motion requests disable both the pulse and the dash flow.
- Live check (authorized sample scan): 12-step journey from “Add to cart”, pulse present with a 10.8-second path across 7 waypoints, moving between samples; observed edges computed `stroke-dasharray: 6px 8px` with the `sweep 1.6s` animation; all 12 step numbers rendered on alternating rows without collisions.
- Coverage is now explained in plain language in the result: pages inspected, pages blocked by policy, pages that failed, destinations found but not reached (with the page or time limit that stopped the crawl), links beyond the depth limit, and controls activated versus left untested. Sample scan coverage evidence: 4 inspected, 0 blocked, 0 failed, 10 activated, 1 untested, no crawl stop.
- Scan history is saved on this computer as JSON (newest 25 under `.data/`, overridable with `ACCESSRIPPLE_DATA_DIR`). After forcing a real service restart, `GET /api/scans` still listed both scans, `GET /api/scans/{id}` rehydrated the full graph from disk, the studio reconnected to the saved scan after reload, and **Recent scans** reopened a persisted scan from disk. Malformed identifiers are rejected and unreadable files are skipped (unit-tested).
- Real-website round, safe mode, no site was changed:
  - `example.com` — 1 page, 1 control. First run exposed a reporting bug (below). After the fix the external link reports “Leaves this website · not followed” with no spurious error.
  - `www.w3.org/WAI/demos/bad/before/home.html` — 5 pages, 48 accessibility findings on the home page, JS mega-menus traced through `content-changed → revealed link → navigated` chains, and the header skip link activated via keyboard with the honest outcome “The viewport moved after activation”.
  - `www.iana.org/help/example-domains` — 5 pages, 31–200 controls per page, all recorded controls activated cleanly after the reopen fix.
  - Real site pages carried their own genuine signals (a dead Piwik analytics script 404 on the W3C demo) attributed at page level, never to interaction steps.
- Fixes found by real-site verification, each committed with tests:
  - A blocked cross-origin link click surfaced as “Navigated to chrome-error://chromewebdata/” plus a raw `ERR_BLOCKED_BY_CLIENT` error attributed to the action. Blocked navigations are now reported as `blocked` with reason `external-navigation`, the attempted host in the summary, and no false site error. Data-request and unsafe-URL blocks carry their own reason too.
  - Off-screen skip links and focus-revealed controls rejected pointer clicks and were recorded as failures. The interaction engine now falls back to keyboard activation (focus + Enter), which is how keyboard visitors use them, and detects anchor/scroll movement as the visible outcome.
  - Disposable interaction pages were given a fair reopen timeout (up to 15 seconds, capped by the scan’s navigation limit) after a slow real site timed out during reopen and one control was misreported as failed.

## Before/after repair loop on the controlled sample

- The checkout sample now ships in two states. `POST /api/sample/state {"variant":"before"}` serves the broken checkout (image without alternative text, pointing at a missing file); `{"variant":"after"}` serves the fixed checkout (`product.svg` with alternative text). Everything else stays identical, so a rescan isolates the repair.
- Verified loop: before-scan record `65c791b0-960d-44b1-8073-311d94170cfb`, toggle to `after`, rescan `1e010993-d876-43f9-ac40-30d68b61d361` (authorization mode preserved, `previousScanId` linked), then compare: 3 resolved (HTTP 404 for `missing-product.webp`, the console 404 line, and the `image-alt` finding “Images must have alternative text”), 0 new, 0 changed, and the 2 remaining are fixture features unrelated to the fix (the simulated gateway timeout and the demo’s color-contrast finding). The sample was restored to `before` afterwards, and an e2e test locks the toggle behavior in.
