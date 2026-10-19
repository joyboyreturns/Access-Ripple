# AccessRipple

AccessRipple is a developer tool for exploring how a website is connected: pages, controls, destinations, observed browser/network errors, and automated accessibility findings appear in one evidence-linked graph.

## Current build

The React studio connects to a local Fastify API, bounded Playwright scans, and axe-core checks. It includes a video-led introduction, light/dark themes, a spatial graph with orbit/pan/zoom, grouped plain-language findings, a complete searchable inventory, rescan comparison, and an Obsidian-compatible ZIP export. The interface starts empty and only shows real scan results. A controlled checkout fixture remains in the backend for regression testing; it never sends a payment.

## Run the full app

Requirements: Node.js 22 and npm.

```sh
npm install
npx playwright install chromium
npm run dev
```

Open `http://127.0.0.1:5173/` and choose **Explore your website**. Enter a public website address, map it, and select a point for its impact and suggested next step. Use **List** for every recorded element, **Rescan and compare** after making your own source changes, and **Export vault** to save linked notes and the raw graph.

The decorative video and fonts are served locally. Video motion can be paused and starts paused when reduced motion is requested. The latest scan identifier is retained in this tab’s session so a reload can reconnect while the local scanner still has the result. No sample graph is seeded into the interface.

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

## Scan boundaries

- The service binds to loopback and is intended for local development only.
- Scans are bounded to five same-origin pages, two links deep, with per-page and overall time limits.
- External websites are inspected but not operated: no form submission, arbitrary button clicks, purchases, messages, account changes, or deletion.
- Link destinations without an executed action are marked inferred; browser/request failures are marked observed only when actually seen.
- Private and reserved network addresses are blocked. This local proof of concept is not a hardened public scanning service; do not expose it to the internet.
- Automated accessibility checks cover a useful subset of barriers; they do not certify accessibility or discover every bug.
- Scan results stay in memory until the service restarts; export a vault to keep them.

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

The project keeps a Graphify source map and an Obsidian note/canvas export in `graphify-out/` and `knowledge-map/`. After source changes, rebuild it with `graphify update . --force --no-cluster`. Query a focused part of the code instead of loading the whole repository, for example:

```sh
graphify query "control flow graph error nodes" --seed buildGraph --budget 400
```

The source-only map ignores planning docs, local agent setup, editor state, and installed dependencies.
