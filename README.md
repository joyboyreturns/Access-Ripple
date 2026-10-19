# AccessRipple

AccessRipple is a developer tool for exploring how a website is connected: pages, controls, destinations, observed browser/network errors, and automated accessibility findings appear in one evidence-linked graph.

## Current build

The backend-first proof of concept provides a local-only Fastify API, bounded Playwright scans, axe-core checks, a graph result, scan comparison, and an Obsidian-compatible ZIP export. The built-in checkout fixture demonstrates a missing-image finding and a simulated payment-flow error. It never sends a payment.

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

## Compact architecture map

The project keeps a Graphify source map and an Obsidian note/canvas export in `graphify-out/` and `knowledge-map/`. After source changes, rebuild it with `graphify update . --force --no-cluster`. Query a focused part of the code instead of loading the whole repository, for example:

```sh
graphify query "control flow graph error nodes" --seed buildGraph --budget 400
```

The source-only map ignores planning docs, local agent setup, editor state, and installed dependencies.
