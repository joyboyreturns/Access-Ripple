---
doc: spec
status: draft
---

# AccessRipple — Technical Spec

## How This Works, In Plain Language

AccessRipple has a local web service that opens public pages in a controlled browser, records the pages and controls it can safely inspect, checks accessibility, and turns the evidence into graph nodes and connections. A React front end will later ask that service for the graph and let a developer orbit it, select a control, and follow its recorded path. A download turns the same result into linked Obsidian notes.

We will build and prove the service first, using a local sample checkout and the API. That keeps the risky part—safely looking at arbitrary URLs—small and testable before the animated interface is added. Scans are bounded and the local service is not a public scanning service.

## The Core Journey Through the System

Implements `prd.md > The Core Journey`.

1. A developer submits a public URL or chooses the sample in the future React app.
2. The API validates the URL, creates a scan record, and hands it to a bounded scan worker.
3. The worker opens the page with Playwright, rechecks destinations and redirects, records page metadata, anchors and interactive controls, listens for browser/console/request failures, and runs axe-core on rendered content. It does not submit forms or activate consequential controls.
4. The worker crawls only a few same-origin pages and stores evidence with observed/inferred/untested labels.
5. A graph builder creates typed nodes and edges. The API returns progress, result, graph, and comparison data.
6. The future front end draws the graph in a rotatable React Three Fiber scene, with a 2D/list mode and a details panel. Motion handles interface transitions and focus changes.
7. The export service packages the scan as linked Markdown notes and JSON for Obsidian.

## Stack

- **Node.js 22 LTS + TypeScript** — aligns with the installed runtime and supports the React/TypeScript product. Pin the major version in `.nvmrc` and `engines`.
- **Fastify 5** — a small Node HTTP API with request schemas and a direct TypeScript path. It keeps the service independent from the later visual interface. [Fastify docs](https://fastify.dev/docs/latest/), [TypeScript guide](https://fastify.dev/docs/latest/Reference/TypeScript/).
- **Playwright (Chromium only for the POC)** — renders client-side websites and exposes page events, request failures, anchors, and controls. Chromium-only keeps downloads and runtime size lower. [Playwright library](https://playwright.dev/docs/api/class-playwright).
- **axe-core** — runs real automated checks inside each rendered page. Its incomplete results remain “needs review”; automated checks cannot prove accessibility. [axe-core](https://github.com/dequelabs/axe-core), [API guide](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md).
- **React + Vite + TypeScript (later front end)** — local single-page interface. The backend slice ships first.
- **React Three Fiber + Three.js (later graph)** — a 3D graph rendered as React components, enabling orbit/pan/zoom. Pair R3F major version with React major version. [R3F intro](https://r3f.docs.pmnd.rs/getting-started/introduction).
- **Motion for React (the current Framer Motion package/name)** — use `motion` and import from `motion/react` for panel, focus, and scan-state transitions; do not use the separately licensed Motion+ package. [Motion docs](https://motion.dev/docs/react), [installation](https://motion.dev/docs/react-installation).
- **UI/UX Pro Max design skill** — use during the front-end pass to establish an intentional design system, after checking its install source and instructions. It is a design workflow, not a runtime dependency. [Project repository](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
- **JSZip** — generate an in-memory ZIP for the Obsidian export. [JSZip docs](https://stuk.github.io/jszip/).
- **Vitest + Fastify inject + Playwright** — exercise URL policy, graph construction, API behavior, and the sample browser journey. Versions will be pinned by the lockfile when installed; current versions are intentionally left to install-time resolution.

## Where It Runs and How Someone Tries It

- **Runtime:** local Node service and local React/Vite app, both bound to loopback for the demo.
- **Requirements:** Node.js 22, npm, and a locally installed Playwright Chromium browser. No account, API key, or paid service.
- **Backend start:** `npm run dev:api`; API defaults to `http://127.0.0.1:4317`.
- **Backend checks:** `npm test` and `npm run typecheck`.
- **Full app after the front end is built:** `npm run dev`; open `http://127.0.0.1:5173`.
- **Backend-first verification:** submit the bundled sample through `POST /api/scans`, poll `GET /api/scans/:scanId`, inspect `GET /api/scans/:scanId/graph`, and download `GET /api/scans/:scanId/export/obsidian`. The API docs page is `/docs` in development.
- A local app is enough to record the required demo. The submission later needs a short public video and public source repository; hosting is optional.

## Look and Feel

The later interface should feel like a polished, calm developer studio with an Obsidian-inspired spatial graph, bright status accents, and clear details. React Three Fiber provides 360-degree orbit, pan, and zoom. A 2D/list alternative must expose the same graph and details to keyboard, screen-reader, reduced-motion, and limited-GPU users. Motion for React animates focus, panels, and state changes with a reduced-motion mode. The exact palette and type choices remain for the UI/UX Pro Max design pass.

## Components

### Scan API

Validates input, starts scans, exposes status/results, supports rescans, graph requests, comparisons, and export. It binds to loopback, validates request bodies, and rejects cross-origin browser requests outside the local app. It is not exposed as a public scan service.

PRD ref: `prd.md > URL scan and accessibility findings`, `Observed control flows and runtime errors`, and `API and Obsidian-compatible export`.

### URL Safety Gate

Accepts HTTP/HTTPS only; rejects credentials in URLs, localhost/local domains, private, loopback, link-local, multicast, reserved, and metadata-service IP ranges. Resolve A and AAAA records and reject if any answer is non-public. Revalidate redirect targets and every browser request; cap redirect count; block non-HTTP(S), downloads, popups, and disallowed cross-origin requests. Treat this as layered mitigation, not a sandbox guarantee. Keep the service local-only and state this limitation in the README.

PRD ref: `prd.md > URL scan and accessibility findings` and `States and Boundaries`.

### Bounded Scan Worker

Runs one scan at a time initially, with a hard overall deadline, page cap, depth cap, per-page timeout, and a node/control cap. Opens each accepted page in an isolated browser context, tracks browser errors and failed requests, and extracts headings, anchors, buttons, form controls, accessible names, href/action metadata, and same-origin destinations. It does not submit forms, click arbitrary controls, perform purchases, or alter the visited site. `href`/form-action relationships without an executed action are labeled inferred or untested. Only controlled sample interactions may be executed when explicitly safe.

PRD ref: `prd.md > URL scan and accessibility findings` and `Observed control flows and runtime errors`.

### Accessibility Analyzer

Injects the installed axe-core source into each rendered page and captures violations, incomplete checks, rule IDs, impact, help text, CSS target, and a bounded text snippet. Incomplete items are labeled needs-review. Avoid saving full page HTML or form values.

PRD ref: `prd.md > URL scan and accessibility findings`.

### Graph and Evidence Builder

Creates stable IDs and a versioned graph with node kinds `site`, `page`, `control`, `flow`, `runtime-error`, and `accessibility-finding`. Edges include `contains`, `links-to`, `has-control`, `may-lead-to`, `observed-during`, `failed-at`, and `flags`. Every edge has an evidence label: `observed`, `inferred`, or `untested`. Browser/request failures are connected to the page and exact control only when evidence supports that link.

PRD ref: `prd.md > Observed control flows and runtime errors` and `Interactive graph and issue details`.

### Scan Store and Comparison

Keeps bounded scan results in process memory for the local session, keyed by a random scan ID. A rescan creates a new immutable result and references its predecessor. Comparison matches nodes by canonical URL plus element role/name/selector and finding rule/target; uncertain matches are marked changed/unmatched rather than silently equated. Restart clears scans; ZIP export is the save mechanism.

PRD ref: `prd.md > Demo fix and rescan` and `States and Boundaries`.

### Obsidian Exporter

Writes a ZIP with `AccessRipple Start.md`, a site note, page/control/flow/error/finding notes with Obsidian `[[wikilinks]]`, and `graph.json`. Filenames are sanitized, collision-safe IDs are used, user-derived text is escaped, and export size is bounded.

PRD ref: `prd.md > API and Obsidian-compatible export`.

### Checkout Sample

A local fixture contains a checkout route, form controls, a safe simulated payment action, one intentional flow/runtime error, and accessibility defects. The sample payment action never contacts a processor and never charges. A clearly labeled repair toggle changes only this fixture and allows a rerun.

PRD ref: `prd.md > The Core Journey`, `Demo fix and rescan`, and `States and Boundaries`.

### Graph Studio (later front end)

React/Vite app with URL setup, progress, an accessible 3D graph, 2D/list fallback, node detail panel, comparison, and export control. React Three Fiber handles orbit/pan/zoom and graph-node selection; Motion handles interface transitions. Include keyboard controls, textual graph alternative, reduced-motion handling, and WebGL-unavailable fallback.

PRD ref: `prd.md > Screens and Layout`, `Look and Feel`, and `Interactive graph and issue details`.

## Data Model

All scan data is in memory for the current API process; no website content is written to disk except when the learner exports it.

- `Scan`: `id`, `createdAt`, `status` (`queued|running|complete|partial|failed`), `inputUrl`, `canonicalOrigin`, `limits`, `pagesAttempted`, `progress`, `previousScanId?`, `errors[]`.
- `Page`: `id`, `url`, `title?`, `status`, `depth`, `outgoingLinks[]`, `controls[]`, `consoleErrors[]`, `requestFailures[]`.
- `Control`: `id`, `pageId`, `role`, `accessibleName?`, `selector?`, `href?`, `formAction?`, `method?`, `probeStatus` (`not-run|observed|blocked`), `evidenceLabel`.
- `Flow`: `id`, `sourcePageId`, `sourceControlId?`, `destinationPageId?`, `outcome`, `evidenceLabel`, `requestId?`.
- `RuntimeError`: `id`, `pageId`, `kind` (`page|console|request`), `message`, `url?`, `statusCode?`, `evidenceLabel`.
- `AccessibilityFinding`: `id`, `pageId`, `controlId?`, `ruleId`, `impact`, `status` (`detected|needs-review`), `target`, `snippet?`, `help`, `helpUrl`.
- `Graph`: `schemaVersion`, `nodes[]`, `edges[]`; API consumers must ignore unknown properties and reject unsupported schema major versions.

## API Contract

- `GET /api/health` — process health and graph schema version.
- `POST /api/scans` — body `{ "url": "https://…" }` or `{ "sample": "checkout" }`; returns `202` with `{ scanId, status }` or a structured validation/safety error.
- `GET /api/scans/:scanId` — progress and summary, then full scan result on completion.
- `GET /api/scans/:scanId/graph` — versioned nodes and typed edges.
- `POST /api/scans/:scanId/rescan` — rechecks the same normalized URL or sample and links the new result to the previous scan.
- `GET /api/scans/:scanId/compare/:otherScanId` — resolved/remaining/new/changed graph items.
- `GET /api/scans/:scanId/export/obsidian` — ZIP download.
- `GET /docs` — local development API docs.

Errors use `{ error: { code, message, retryable, details? } }`; never return stack traces or internal filesystem/network details.

## File Structure

```text
AccessRipple/
├── devpost/
│   ├── learner-profile.md       # ignored personal learning context
│   ├── scope.md                 # approved product scope
│   ├── prd.md                   # approved product requirements
│   ├── prd.html                 # interactive PRD review companion
│   ├── spec.md                  # this technical blueprint
│   └── spec.html                # interactive architecture companion
├── src/
│   ├── api/
│   │   ├── app.ts               # Fastify routes and schemas
│   │   └── server.ts            # loopback startup
│   ├── scan/
│   │   ├── url-safety.ts        # SSRF and redirect policy
│   │   ├── worker.ts            # bounded scan job
│   │   ├── crawl.ts             # same-origin page traversal
│   │   ├── inspect-controls.ts  # control inventory and link evidence
│   │   ├── browser-events.ts    # page, console, request errors
│   │   └── accessibility.ts    # axe-core injection and normalization
│   ├── graph/
│   │   ├── schema.ts            # node/edge types and version
│   │   ├── build-graph.ts       # evidence -> graph
│   │   └── compare.ts           # safe node matching between scans
│   ├── export/obsidian.ts       # Markdown notes and ZIP
│   ├── store/memory.ts          # bounded in-memory scan store
│   ├── sample/                  # local checkout fixture and safe behavior
│   ├── web/                     # React/Vite studio, added after API slice
│   └── shared/                  # API types used by front end
├── tests/
│   ├── unit/                    # safety policy, graph, export, comparison
│   ├── api/                     # route behavior and validation
│   └── e2e/                     # local sample scan journey
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── .nvmrc
├── .gitignore
├── LICENSE
└── README.md
```

## External Services and Dependencies

There are no external APIs, accounts, or paid services. The crawler visits the user-provided public site from the local machine, so network policy is a security boundary. Dependencies: [Fastify](https://fastify.dev/docs/latest/), [Playwright](https://playwright.dev/docs/api/class-playwright), [axe-core](https://github.com/dequelabs/axe-core), [JSZip](https://stuk.github.io/jszip/), [React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/introduction), and [Motion for React](https://motion.dev/docs/react). The package lockfile will pin actual versions. Chromium is downloaded locally through Playwright; no cloud browser is used.

## Important Failure Modes

- **A URL resolves to an internal address or redirects there** → reject before navigation; recheck each redirect and browser request; keep the API loopback-only. Browser route/DNS checks are layered defenses, not a hardened network sandbox.
- **A page hangs, crashes, or fails some requests** → enforce per-page and overall deadlines, keep partial data, and show the failed page/event.
- **A dynamic control has no inspectable destination** → show it as present with outcome `not tested`; do not invent a flow or execute it.
- **3D/WebGL is unavailable or motion is reduced** → offer the equivalent 2D/list view and details panel.
- **An export or comparison cannot complete** → retain the scan and return a specific retryable error.

## What Was Simplified and Why

- **Bounded local scans** instead of unrestricted cloud crawling — keeps the proof small and limits exposure; production scanning would need isolated workers and network-level egress controls.
- **Extract links and inspect controls without arbitrary clicks** instead of trying every action — prevents purchases, deletion, and other side effects; dynamic flows remain untested unless the local fixture has a safe scripted probe.
- **In-memory results plus ZIP export** instead of accounts and a database — enough for a demo and keeps website data local; restart clears the scan history.
- **One Chromium browser** instead of cross-browser testing — validates the graph/API kernel without expanding setup and runtime.

## Decisions and Open Issues

- **Learner direction:** URL-to-interactive website graph, 360-degree exploration, flow/error paths, a polished animated React front end, backend first, and Obsidian export.
- **Implementation recommendation:** Fastify + Playwright + axe-core for the local API, followed by React + R3F + Motion. Reason: these provide real rendered-page evidence and a rotatable graph with limited infrastructure. Tradeoff: browser installation and 3D accessibility/fallback work add complexity.
- **Safety boundary:** no form submission or arbitrary button clicks on external websites; payment and consequential actions are not run. A labeled local fixture can simulate such a flow safely.
- **Useful unknown:** whether a visible button’s route can be known without clicking it. The build will demonstrate that plain links can be mapped from page structure while a script-only button is labeled not tested unless a safe sample probe records it.
- **Limits recommendation for initial build:** maximum 5 same-origin pages, depth 2, 20-second navigation timeout, 60-second total scan timeout, 200 controls and 300 network requests per page, 1 active scan. Tune only if local sample and API checks show the values block the intended demo.
- **Status:** the technical stack is a reasoned implementation recommendation based on the learner’s direction; package version resolution will be verified during setup. The backend is local-only; public deployment is deferred.

## Graph Studio UI revision

The implemented front end lives in `web/` and is launched with `npm run dev` alongside the API. The introduction adapts the learner’s Vesper reference using the supplied local MP4, self-hosted Inter and Instrument Serif fonts, metallic controls, and Motion entrance transitions. Both themes, native dialogs, video pause, and reduced-motion preferences are supported.

The studio uses a lightweight SVG spatial projection with yaw, pitch, pan, zoom, keyboard orbit, and a neighborhood focus control. This replaces the earlier React Three Fiber recommendation; no WebGL dependency was added. A bounded, grouped visual scene keeps labels readable, while the searchable and progressively loaded List exposes the entire original inventory. Grouping preserves original IDs, targets, and graph relationships.

`web/src/presentation.ts` converts common accessibility rules into plain-language impact and suggested source changes. Browser security/network events are diagnostic signals, not proof that a visitor’s task failed. Raw selectors, rule IDs, and recorded messages remain behind Developer evidence. External sites are never modified.

The UI connects to scan, rescan, comparison, and ZIP export endpoints. It retains the latest scan ID in tab session storage and restores a result while the local scanner still has it. Rescan handles an expired result by starting a fresh URL scan and explicitly omitting unavailable comparison. Restarting the scanner still clears backend results.

The default interface contains no sample data or sample CTA, as requested by the learner. The backend fixture remains for controlled regression testing. No external-site auto-repair, sample repair UI, public deployment, or completed learner final review is claimed by this revision.

## Public demo deployment — 26 October 2026

The current implementation supersedes the earlier local-only deployment notes:
Home PC runs the production build under `accessripple.service` with Node 22,
Playwright Chromium, and restart-on-failure. Tailscale Funnel exposes HTTPS at
[the live demo](https://accessripple.tail601a7c.ts.net/); the scanner still binds only
to loopback. Public mode disables private-network scanning and uses a separate
history directory at `.data/public-demo`. Visitors share demo history and
fixture state, which the interface discloses. Local installations retain the
private-address opt-in. Scan history is now persisted across restarts.

The demonstration video is [available on YouTube](https://youtu.be/Uzcq7tJ8JL0)
(2 minutes 53 seconds, accessible without sign-in on 26 October). Deployment
settings and recovery commands are in [the hosting guide](../docs/DEPLOYMENT.md).
This records technical deployment, not learner final sign-off or Devpost submission.
