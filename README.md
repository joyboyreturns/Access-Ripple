# AccessRipple

AccessRipple is a developer tool for exploring how a website is connected: pages, controls, destinations, observed browser/network errors, and automated accessibility findings appear in one evidence-linked graph.

## Current build

The React studio connects to a local Fastify API, bounded Playwright scans, and axe-core checks. It includes a video-led introduction, light/dark themes, a spatial graph with orbit/pan/zoom, grouped plain-language findings, a complete searchable inventory, rescan comparison, and an Obsidian-compatible ZIP export. The interface starts empty and only shows real scan results.

The studio also tests a bounded set of safe controls once each in disposable browser pages and records what actually happened: navigation, content changes, dialogs, validation, loading states, blocked requests, and failures. Observed outcomes replace inference for those controls, and a selected action shows its recorded route across independently inspected pages with an animated pulse along the way. Form and submit controls wait for explicit permission, requests that would change data are always blocked and recorded, and consequential actions such as delete, send, or pay are never activated. A controlled checkout fixture in the backend demonstrates the whole chain (catalogue → cart → checkout → payment); it never sends a payment or collects data.

Every result also explains its coverage — pages inspected, destinations not reached, and controls left untested, each with a reason — and completed scans are saved on this computer so **Recent scans** survives a restart of the scanner.

## Run the full app

Requirements: Node.js 22 and npm.

```sh
npm install
npx playwright install chromium
npm run dev
```

Open `http://127.0.0.1:5173/` and choose **Explore your website**. Enter a public website address, map it, and select a point for its impact and suggested next step. Use **List** for every recorded element, **Rescan and compare** after making your own source changes, and **Export vault** to save linked notes and the raw graph. Before mapping, you can tick **Test form and submit controls too** to let the scanner activate submit controls as well; requests that would send or change data stay blocked either way.

The decorative video and fonts are served locally. Video motion can be paused and starts paused when reduced motion is requested. The latest scan identifier is retained in this tab’s session so a reload can reconnect, and completed scans are kept on this computer so they can be reopened from **Recent scans** after the scanner restarts. No sample graph is seeded into the interface.

## Run the backend

Requirements: Node.js 22 and npm.

```sh
npm install
npx playwright install chromium
npm run dev:api
```

Open `http://127.0.0.1:4317/docs`. The sample lives at `http://127.0.0.1:4317/sample/checkout`.

Start a sample scan:

```sh
curl -X POST http://127.0.0.1:4317/api/scans \
  -H 'content-type: application/json' \
  -d '{"sample":"checkout"}'
```

Use the returned `scanId` with `GET /api/scans/{scanId}`, `/graph`, and `/export/obsidian`. See the OpenAPI page for the full API.

### Before/after repair loop on the sample

The checkout sample ships in two states so you can demonstrate a real fix on a site you control:

```sh
# 1. Scan the broken state (the product image has no alternative text and 404s).
curl -X POST http://127.0.0.1:4317/api/sample/state -H 'content-type: application/json' -d '{"variant":"before"}'
curl -X POST http://127.0.0.1:4317/api/scans -H 'content-type: application/json' -d '{"sample":"checkout"}'

# 2. Apply the fixed state (product.svg with alternative text).
curl -X POST http://127.0.0.1:4317/api/sample/state -H 'content-type: application/json' -d '{"variant":"after"}'

# 3. Rescan the same scan and compare: the image finding and both 404 signals resolve.
curl -X POST http://127.0.0.1:4317/api/scans/{scanId}/rescan -H 'content-type: application/json' -d '{}'
curl http://127.0.0.1:4317/api/scans/{newScanId}/compare/{scanId}'
```

`GET /api/sample/state` reports the current variant. In the studio the same loop works through **Rescan and compare** after toggling the state; set it back to `before` when finished.

## Scan boundaries

- The service binds to loopback and is intended for local development only.
- Scans are bounded to five same-origin pages, two links deep, with per-page and overall time limits.
- A bounded set of safe controls (ordinary buttons and same-site links) is activated once each in disposable browser pages. Form and submit controls are activated only when the scan explicitly allows it; a tick-box in the studio records that permission, and without it the rescan keeps the previous choice.
- Data-changing requests (anything other than GET/HEAD) and navigations outside the scanned website are always blocked and recorded, even with permission. Consequential actions such as delete, remove, send, pay, or sign out are never activated.
- Outcomes are labeled observed only when the browser recorded them; link and form destinations that were never activated remain inferred or not tested. Errors are attributed to the action that ran when they occurred, and unrelated page warnings stay context.
- Private and reserved network addresses are blocked. This local proof of concept is not a hardened public scanning service; do not expose it to the internet.
- Automated accessibility checks cover a useful subset of barriers; they do not certify accessibility or discover every bug.
- Completed scans are saved as JSON on this computer (the newest 25, under `.data/`) so history survives restarts; delete that folder to clear the history. Export a vault to keep a portable copy.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

## Project planning

The product scope, PRD, and technical specification are in `devpost/`. `devpost/learner-profile.md` is local personal context and is excluded from version control.

The UI revision checklist records completed mechanical checks separately from the learner’s pending final review. A short demo route is in `devpost/demo-script.md`.

## Media provenance

The landing animation is the video supplied in the learner’s Vesper design-reference prompt, stored at `web/public/media/ripple-hero.mp4`. It is decorative and is not a recording of AccessRipple scanning a website. Its source is recorded beside the asset. The Inter and Instrument Serif fonts are self-hosted with their OFL notices in `web/public/fonts/`.

## Compact architecture map

The project keeps a Graphify source map and an Obsidian note/canvas export in `graphify-out/` and `knowledge-map/`. After source changes, refresh both with:

```sh
graphify update . --force --no-cluster
graphify export obsidian --graph graphify-out/graph.json --dir knowledge-map
```

Open `knowledge-map/` as a vault in Obsidian to browse the generated notes and `graph.canvas`. The vault enables Obsidian's graph, canvas, backlinks, and navigation plugins. The source-only map ignores planning docs, local agent setup, editor state, and installed dependencies. Query a focused part of the code instead of loading the whole repository, for example:

```sh
graphify query "control flow graph error nodes" --seed buildGraph --budget 400
```
