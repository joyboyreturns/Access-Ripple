# AccessRipple UI verification

Verified on 19 October 2026. This records mechanical evidence, not a completed learner interview or final ship approval.

## Automated checks

- `npm run typecheck` — passed for API, tests, and React code.
- `npm run build` — passed for the Vite frontend and compiled backend.
- `npm test` — 29 tests passed across 7 files. Includes URL safety, graph generation/comparison, ZIP export, API behavior, a controlled browser fixture, presentation grouping, and the bodyless-rescan regression.

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

This is a local proof of concept with bounded scans. It does not certify accessibility, activate arbitrary external controls, or modify external websites. Manual keyboard, screen-reader, and usability testing remain important. The backend test checkout remains a controlled fixture; there is no sample repair interface in this UI revision.

The supplied background video is decorative reference media, not a product demonstration recording. `demo-script.md` provides a sub-three-minute recording route; a submission video has not been recorded or uploaded by this work.

The learner’s final exploration, guided code tour, and readiness approval remain pending in `checklist.md`.
