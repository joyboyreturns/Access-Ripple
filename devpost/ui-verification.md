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

## Interface accessibility and responsive pass

Verified on 19 October 2026 with axe-core 4.x injected into the running studio (Chromium, 1440×960 and 390×844), covering WCAG 2.0/2.1 A, AA, and best-practice rules.

- Landing page: 0 violations. The one finding on the first run — the video control’s `aria-label` (“Pause background animation”) did not contain its visible text (“Pause motion”), tripping `label-content-name-mismatch` — was fixed by letting the visible text be the accessible name.
- Studio with a saved scan loaded, coverage expanded: 0 violations. Journey view with the animated route, including a hover-revealed step card: 0 violations. Recent scans dialog: 0 violations. Phone 390×844 with the journey active: 0 violations, document width 390 equals viewport, no horizontal overflow.
- The graph node names were the substantive fix. Node cards truncate long labels with an ellipsis, so the visible text (“Northstar · Secure check…”) was no longer contained in the accessible name; and in journey mode the floating “STEP n” plus a card concatenated into text the name did not include. Nodes now compute one rendered string — optionally prefixed with `STEP n · ` — and use it both as the visible card text and inside the accessible name, which keeps Label in Name satisfied for every node. Accessible names still carry the finding count (`· 4 findings`) where cards show `· 4`.
- Keyboard: the coverage summary is focusable and a real Enter keypress toggles the details; journey nodes and the history dialog were already keyboard reachable and unchanged.
- Reduced motion: with `prefers-reduced-motion: reduce` emulated, the travelling pulse is `display: none` and the observed-edge animation reports `animation-name: none`; the static dashed route remains.

## Action picker refinement and interaction polish

- The “Follow a button or link” control was a native `<select>`; it is now a searchable combobox built for the studio (`web/src/SelectMenu.tsx`). Type to filter, see the page each control sits on beside its name, move with arrows/Home/End, confirm with Enter, dismiss with Escape, and stop following with the clear button. Real sites carried up to 200 controls per page, so searching the list matters. It keeps `id="journey-control"` and a labelled combobox (`aria-expanded`, `aria-controls`, `aria-activedescendant`).
- Verified with real input in Chromium: typing “cart” narrows to the four cart controls, arrow keys move the highlighted option, Enter traces its route, Escape closes while keeping the selection and focus, the clear button returns to the full map, and a mouse click selects the same way. The popup attaches to the field edge and floats over the graph without clipping.
- axe-core: 0 violations with the picker closed and open (desktop 1440×960, phone 390×844), light theme with a traced journey included. Phone stays 390 wide with no horizontal overflow; reduced motion removes the popup entrance animation.
- Smaller polish: consistent press feedback on buttons, a softer dialog entrance, hover states on history rows and the load-more control, an accent focus treatment on the scan field, and thin scrollbars on the dialog and option list.

## Plain-language labels, honest script links, and a calmer map

Found while exploring the Amazon India scan saved in history: machine-looking names (“Cart, shift, option, c”, “Show/hide shortcuts, shift, option, z”, “May lead to void(0)”), and orbiting the map selected its own labels.

- Orbiting and panning no longer select anything: the graph surface sets `user-select: none`. Verified by dragging the map 150 pixels with a real mouse and reading back an empty selection.
- Sites that bake keyboard shortcuts into accessible names now read naturally. “Cart, shift, option, c” displays as “Cart”, “Search, option, forward slash” as “Search”, and “Show/hide shortcuts, shift, option, z” as “Show/hide shortcuts”. The shortcut is parsed into its own inspector chip — “Shortcut: Shift + Option + C”, “Option + /” — and the raw accessible name stays untouched in the scan data and export.
- Links that run scripts no longer produce “May lead to void(0)”. New scans label them “May run a script on this page”; existing scans display “This link runs a script instead of opening a page”. Email and phone links get the same treatment.
- Journeys through script links now say “This link runs a script on the same page. There is no page destination to inspect, and the action itself was not activated.” instead of claiming a destination was outside the scan; the step caption reads “In-page script · action not tested”. A control with a real page destination still reports the inspected destination.
- Recorded summaries that quote a control name are cleaned the same way (“Activated “Cart” …”), and common scan failures are translated into next steps: unresolvable address, refused connection, timeout, blocked scanner, certificate problems, and network loss each explain what to do next.
- Verified on the live Amazon India scan: picker and list labels are clean, the inspector shows the shortcut chip, no “void(0)” or raw shortcut text appears anywhere in the interface, the unit suite grew to 60 tests (shortcut parsing, script-link labels, journey summaries), and axe-core reports 0 violations on the map after the change.

## Demo reliability revision

Verified on 21 October 2026 against the running local service.

- **Scan the demo shop** in the studio starts the built-in checkout fixture with one click. It runs in a real Chromium session, inspects 4 pages, activates 9 safe controls once each, and finishes in about ten seconds with no network address involved. `GET /api/sample/info` describes the fixture; the button always resets it to its broken state first, so repeated runs produce the same numbers.
- **Landing → studio in one click**: "See it in 60 seconds" sets `#demo` and opens the studio, which starts the demo-shop scan on arrival. A fresh load of `#demo` opens the studio rather than the landing page, and a restored previous scan is skipped in that path so the demo scan is the one that runs.
- **Scan story**: the result now states the observed numbers in one paragraph — "We inspected 4 pages of Northstar demo shop and found 2 accessibility barriers, after activating 9 controls in a disposable browser" — then names the first barrier to look at, where it was found, and the suggested change. A link opens that finding. The tone marker reads "Needs attention", "Worth a look", or "Nothing blocking".
- **Prove a repair**: the repair lab appears only for a demo-shop scan. "Repair the demo shop" switches the fixture to its repaired state; "Rescan and compare" then reports **3 no longer observed, 2 still observed, 0 new**, and the story updates to 1 barrier and 1 browser signal. A fresh demo-shop scan after the repair returns the fixture to its broken state.
- **Dead ends removed**: a private or local address now reports that private addresses are blocked on purpose and offers the demo shop instead of stopping at the error.
- **Naming**: the fixture is "Northstar demo shop" in the graph's site node, the result panel, the recent-scans list, and the exported vault note, instead of `127.0.0.1`.
- **Demo guide**: a header button lists the four beats of the recording with the exact control to press in each.
- `npm run typecheck`, `npm run build`, and `npm test` (64 tests across 9 files) pass. New tests cover the sample-info endpoint, the sample scan path, and the scan story's claims and its no-barrier case.
- Not verified here: a screen recording of the route, a phone-width pass over the new panels, and an axe pass on the new story, repair, and guide surfaces.

## Optional AI briefing

Verified on 21 October 2026 against a local mock provider that speaks the OpenAI chat-completions shape.

- `GET /api/ai/status` reports `configured: false` with no key present, and the studio shows a card explaining how to enable it. `POST /api/scans/{scanId}/briefing` answers 503 `AI_NOT_CONFIGURED`, and the deterministic scan summary above it is untouched.
- With a key and endpoint configured, the status endpoint reports the model and provider, and the studio shows **A model read of this scan** with a **Write a briefing** button.
- A grounded model answer is shown with its citation markers removed from the prose and the cited evidence listed underneath as buttons. Clicking a citation opens that node in the inspector: the inspector moved from "An image needs a text alternative" to "A resource returned an error (404)" when the 404 citation was pressed.
- A model answer that cites only evidence the scan never recorded is rejected with 502 `BRIEFING_FAILED`, and nothing unverified is shown. A sentence with no citation at all is dropped, and a sentence with a mix of a valid and an invalid citation is kept with the valid one.
- The key is read from a local `.env` file, which is ignored by git, and is never sent to the browser. `.env.example` carries placeholders only.
- axe-core reports 0 violations on the briefing card in both the unconfigured and configured states.
- Not verified here: a real model provider, because no key was available on this machine. The provider response shape is covered by the mock provider, but a real model's compliance with the citation format has not been observed. The grounding rules make a non-compliant model fail safely rather than show an unverified claim.

## Real provider, a brighter map, and a full sweep

Verified on 21 October 2026 against a live free OpenRouter endpoint.

- The AI briefing now works with a real provider. The free tier needed two fixes that a mock could not have caught. The MiniMax model is a reasoning model: it spent its whole token budget thinking and returned `content: null`, so the request now asks for a low reasoning effort and a larger token budget, which brings the answer down from about 21 seconds to about 3.5. The second fix was in the grounding itself: models put the citation after the full stop, and a plain sentence split tore the citation off the sentence it belonged to, so both halves failed the check. Citation-only fragments are now folded back into the sentence they follow.
- Free-tier capacity is shared, so a single model is not dependable. The models are tried in order and the first usable answer wins: `minimax/minimax-m3.1-flash:free`, then `openrouter/free`, then `cohere/north-mini-code:free`. Measured over three runs each: the primary answered 3 of 3, the router 2 of 3, and Cohere 3 of 3 but at 17 to 30 seconds. The Google Gemma and NVIDIA free models returned 404 or 429 for this account, so they are a last resort rather than a first choice.
- The briefing now names what is missing. The digest carries the coverage gaps alongside the findings, and the model is asked to name at least one thing the scan did not check. A real answer ended with "Two controls were not activated, and keyboard, screen-reader, and human testing are still needed", citing the two gap items. Those appear as dashed chips that are not links, because they describe an absence rather than a piece of evidence.
- A real answer for the demo shop: 4 pages inspected, 9 controls activated, 2 accessibility findings, 3 browser signals, 14 citations, 3.5 seconds.
- **The map was rebuilt to read as a space rather than a chart.** Each point now carries a soft colour-matched bloom, the selected point gets a slow pulse ring, the scene sits in a three-colour aurora with a vignette, the observed relationships carry a slow travelling dash so the map reads as live, and the label cards float on a soft shadow. The site label moved underneath its node because it was covering a neighbouring point.
- A full browser sweep of the studio now passes 30 of 30 checks with no console errors: the one-click demo, all four filters, the searchable list, an empty search, the inspector, focus mode, zoom, the coverage explanation, the AI briefing, the repair loop, the export, the saved history, a reload that restores the scan, and both error paths (a private address and an unsupported scheme). It is kept as `npm run check:studio` and needs the app running.
- A new end-to-end test covers the demo path through the API: the scan, the graph's node kinds, that every edge points at a node that exists, the private-address refusal, the repair loop with 3 resolved and 0 new, and the vault download.
- axe-core reports 0 violations on the new map in the studio, on the journey route, in light theme, and at 390 pixels, with no horizontal overflow on the phone layout. Under a reduced-motion request the new pulse and edge animations report `animation-name: none`.

## The three-minute demo overhaul

Verified on 21 October 2026 with a live free provider and a real third-party site.

- **The proof.** The same page before and after one change, side by side, with the counts above it: "3 no longer observed · 2 still observed · 0 new". It is reachable from the header, from the comparison panel, and from `#proof`, so the recording can open on it. The page a repair touched is shown first, and the interface says in words that these are findings and browser signals the browser no longer recorded, not a claim that the site is now accessible.
- **Page pictures.** Every inspected page is captured as a small JPEG (about 30 to 50 KB) and kept in the scan. The demo shop's checkout page shows a broken image before and the product graphic after, which is the change a reviewer remembers. A repaired page is photographed too, which is the case that matters after a fix.
- **A proposed change.** For a selected finding the model writes the smallest change that fixes the rule, grounded in the markup the browser recorded, and the studio shows it as a diff with the file and line it came from. A real answer for the demo shop: `<img class="product-art" src="/sample/missing-product.webp">` becomes the same tag with `alt="Product image"`, at `src/sample/site/checkout.html:29`. The panel says in words that this is a grounded suggestion, not a verified fix, and the button that changes the demo shop is labelled **Apply the demo repair**. The tool never edits a scanned website.
- **Three real bugs were found while building this.**
  1. The markup of a failing element was never recorded. The `snippet` field existed in the schema and was shown in the developer evidence panel, but nothing wrote to it, so no change could be grounded. The axe runner now records it.
  2. Two different links could collapse into one node. The element path stopped at four ancestors, so on a list-heavy page every row produced the same path; four links on Hacker News shared one id, the graph held the same node twice, and React reported duplicate keys. The path now runs deeper, is verified to match exactly one element, falls back to a marker when it cannot, and the graph refuses to hold two nodes with one id. A re-scan of Hacker News now produces 2506 nodes with 2506 unique ids and no dangling edges, and the browser reports no console problems.
  3. A repaired page was never photographed, because pictures were only kept for pages that still had a finding.
- **A real third-party site.** A recorded scan of Hacker News: 5 pages, 1000 visible controls, 500 findings grouped into 5 kinds of barrier, 10 actions activated, 36 controls skipped. The studio opens it in about 2 seconds and it is labelled as recorded, with its date.
- **The scan story now counts the same unit as the metrics.** It states the raw number of findings and says how many kinds of barrier they fall into, so "500 findings in 5 kinds of barrier" and the metric "500 accessibility findings" cannot be read as contradicting each other.
- **The guided tour was rewritten to the new beat sheet** and is now the caption track for the recording: proof, scan, finding, journey, proposal, repair, limits.
- **The browser sweep grew to 36 checks** and passes 36 of 36 with no console errors, including the proposal, the honest apply label, the proof's two pictures, and the counts that lead it.
- axe-core reports 0 violations on the proof view, the proposal card, and the new landing line. The suite is 86 tests across 13 files, typecheck and production build pass.

## Real public sites, and two failures the sweep found

Ten famous sites were scanned through the running service. Every one produced a well-formed graph: no repeated node id, no dangling edge, and the studio opened a 2506-node scan in about two seconds.

| Site | Time | Pages | Controls | Findings | Browser signals | Actions tested |
| --- | --- | --- | --- | --- | --- | --- |
| google.com | 21s | 4 | 39 | 14 | 12 | 8 |
| en.wikipedia.org | 108s | 4 | 790 | 229 | 2 | 3 |
| github.com | 49s | 5 | 315 | 4 | 14 | 8 |
| developer.mozilla.org | 24s | 4 | 681 | 4 | 11 | 10 |
| stackoverflow.com | 3s | 1 | 0 | 0 | 1 | 0 |
| devpost.com | 2s | 1 | 0 | 0 | 1 | 0 |
| gov.uk | 64s | 1 | 88 | 1 | 4 | 1 |
| w3.org | 33s | 5 | 187 | 3 | 2 | 10 |
| bbc.co.uk/news | 77s | 1 | 171 | 31 | 0 | 2 |
| news.ycombinator.com | 35s | 5 | 1000 | 500 | 0 | 10 |

Two failures came out of it, and both were fixed.

- **A site that refuses the scanner was reported as if it had been scanned.** Stack Overflow and Devpost answer an automated browser with a Cloudflare challenge page, and the scan reported one inspected page with a finding on it. A refused page is now recognised, marked as blocked rather than inspected, and the story says plainly that the site refused the automated browser and that nothing on it could be inspected. It is a property of the site, not a fault in the scan, and the interface says that too.
- **Interaction testing ate the whole budget on a heavy site.** Wikipedia, GOV.UK and the BBC reached one page and then ran out of time, because each interaction opens its own disposable page and waits for it. Interactions now get a fixed 35% slice of the budget and the crawl keeps the rest, the total budget is 100 seconds, and the reopen wait is shorter. Wikipedia went from one page to four, GOV.UK from one to five, and the BBC from one to five. The demo shop is unaffected: it still activates nine actions in about ten seconds.

A quick site still finishes as soon as it is done, so the demo shop scan is not slowed by the wider budget. The recordings guide now names MDN, W3C, Google, GitHub and Hacker News as the sites worth showing, and warns against Stack Overflow and Devpost, which answer automated browsers with a challenge page.
