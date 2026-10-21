# AccessRipple

AccessRipple is a developer tool for exploring how a website is connected: pages, controls, destinations, observed browser/network errors, and automated accessibility findings appear in one evidence-linked graph.

## Current build

The React studio connects to a local Fastify API, bounded Playwright scans, and axe-core checks. It includes a video-led introduction, light/dark themes, a spatial graph with orbit/pan/zoom, grouped plain-language findings, a searchable inventory of everything recorded, rescan comparison, and an Obsidian-compatible ZIP export. The interface starts empty and only shows real scan results.

The studio also tests a bounded set of safe controls once each in disposable browser pages and records what actually happened: navigation, content changes, dialogs, validation, loading states, blocked requests, and failures. Observed outcomes replace inference for those controls, and a selected action shows its recorded route across independently inspected pages with an animated pulse along the way. Form and submit controls wait for explicit permission, requests that would change data are always blocked and recorded, and consequential actions such as delete, send, or pay are never activated. A controlled checkout fixture in the backend demonstrates the whole chain (catalogue → cart → checkout → payment); it never sends a payment or collects data.

Every result also explains its coverage — pages inspected, destinations not reached, and controls left untested, each with a reason — and completed scans are saved on this computer so **Recent scans** survives a restart of the scanner.

### Your own sites

Any public website can be scanned, including one of your own: a GitHub Pages site, a personal domain, or a project you have published. Type the address with or without `https://` and press **Map this website**.

A site running on your own machine is a different matter. Private and reserved addresses are refused by default, because a scanner that can reach `localhost` can reach anything your computer can. Tick **Scan an address on my own computer** under the URL field to open an address on your own machine — `http://localhost:5173`, a private network address such as `http://192.168.1.20:8080`, or any custom port. The permission is explicit, it applies to that scan and to its rescan, and the result is marked **ADDRESS ON THIS COMPUTER** so nobody mistakes it for a public site. The cloud credential addresses (`169.254.169.254` and `metadata.google.internal`) are refused whether the box is ticked or not.

### The demo shop
A built-in four-page checkout fixture is available directly in the studio. **Scan the demo shop** opens it in a real browser, always from its broken state, so the result is the same on every run and needs no internet connection. Any change accepted earlier is dropped first, so a second take starts where the first one did. **Prove a repair** switches the same fixture between its broken and repaired states and rescans, so the before-and-after comparison happens in the interface. **Show the proof** then shows the same page before and after, side by side, with the counts. The landing page's **See it in 60 seconds** opens the studio straight into that scan. A guide in the studio header lists the beats of a three-minute recording.

## Optional AI briefing and proposed changes

The studio can also show a short, model-written read of a finished scan, and it can propose a concrete code change for a finding. Both are off by default, and the deterministic scan summary is always shown whether or not they are enabled.

To enable them, copy `.env.example` to `.env` and fill in a key:

```sh
cp .env.example .env
```

```sh
ACCESSRIPPLE_AI_KEY=your-key
ACCESSRIPPLE_AI_BASE_URL=https://openrouter.ai/api/v1
ACCESSRIPPLE_AI_MODEL=minimax/minimax-m3.1-flash:free
ACCESSRIPPLE_AI_FALLBACK_MODELS=openrouter/free,cohere/north-mini-code:free
```

Any OpenAI-compatible chat-completions endpoint works, including a local one. `.env` stays on this computer and is ignored by git; restart the scanner after changing it. Free-tier capacity is shared and a single model can be busy at any moment, so a chain of fallbacks is used: the models are tried in order and the first usable answer wins.

Three rules keep the output honest, because an overconfident summary is worse than no summary.

1. The model only ever sees a compact digest of evidence the browser recorded, and is told that the evidence is data rather than instructions.
2. Every sentence must cite an evidence id that exists in the scan. Any sentence whose citations are all invalid is dropped, and if nothing survives the request fails and the studio keeps the deterministic summary. This checks that a citation points at something the browser really recorded. It does not check that the sentence is true of it, and the interface never claims it does.
3. The digest includes the coverage gaps, not only the findings, and the model is asked to name at least one thing the scan did not check. The gaps are listed under the summary whether or not the model chose to mention them, as dashed chips that are not links, because they describe what is missing rather than a piece of evidence.

A proposed change is grounded the same way: the model receives the failing rule, the CSS selector, and the markup the browser recorded, and the proposal is dropped unless it matches that markup. The tool proposes; it never edits a scanned website. On the built-in demo shop, which this tool owns, the same proposal can be applied so a rescan can prove whether it worked.

## The model has to put its claim on trial

A suggested change is worth little on its own, because a model can write a plausible replacement for a missing image description without ever checking whether it works. So before the change is applied, the model is asked to commit **in writing** to what its change will and will not fix.

The browser then checks those commitments against the rescan. On the demo shop the model commits to three things: the missing description will be gone, the 404 will still be there, and the other 404 will still be there. The rescan checks all three, and the interface reports each one as held, failed, or unknown.

The rules keep this honest:

- The model may only predict about ids it was given, and only two answers are allowed: gone or still there.
- The finding the change targets must be covered, and at most two more may be predicted.
- A prediction is only checked when the page it is about was inspected again. A page whose accessibility checks could not run cannot prove anything, so it is reported as **not rechecked** and never counted as a pass.
- A prediction that failed is reported as failed. The tool does not hide the model's mistakes, because a tool that only shows successes is not telling you whether to trust it.

## Run the full app

Requirements: Node.js 22 and npm.

```sh
npm install
npx playwright install chromium
npm run demo
```

`npm run demo` starts the app and opens the studio straight into a scan of the built-in demo shop. It takes about ten seconds, needs no internet connection, and always produces the same result.

`npm run prepare:demo` prepares this computer for a recorded demo: it clears the saved history, scans a set of well-known public sites, and leaves the demo shop in its broken state with the pair of scans that proves a repair.

**The core demo needs no account, no key and no network.** The optional AI briefing and the proposed change need a model provider key, but the app is complete without one: it says so where the button would be, and shows the deterministic summary instead.

If `npm run demo` does not open, start the two servers yourself and open `http://127.0.0.1:5173/`:

```sh
npm run dev
```

The scanner also serves the built studio itself once you have run `npm run build`, so `npm start` gives a working application on `http://127.0.0.1:4317/`.

Open `http://127.0.0.1:5173/` and choose **Explore your website**. Enter a public website address, map it, and select a point for its impact and suggested next step. Use **List** for every recorded element, **Rescan and compare** after making your own source changes, and **Export vault** to save linked notes and the raw graph. Before mapping, you can tick **Test form and submit controls too** to let the scanner activate submit controls as well; requests that would send or change data stay blocked either way. Choose **Scan the demo shop** to run the built-in fixture instead, or press **See it in 60 seconds** on the landing page to open the studio straight into that scan.

The **▶ guided tour** in the studio header walks the core journey one step at a time. Each step shows the sentence to say out loud, moves the interface to the place the narration is talking about, and advances when you perform the action. It doubles as the on-screen captions for a recorded demo, so a muted recording still explains itself.

The decorative video and fonts are served locally. Video motion can be paused and starts paused when reduced motion is requested. The latest scan identifier is retained in this tab’s session so a reload can reconnect, and completed scans are kept on this computer so they can be reopened from **Recent scans** after the scanner restarts. No sample graph is seeded into the interface.

### Run the backend

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

Use the returned `scanId` with `GET /api/scans/{scanId}`, `/graph`, and `/export/obsidian`. See the OpenAPI page for the full API. `GET /api/sample/info` describes the demo shop, and `GET /api/sample/state` reports whether it is currently in its broken or repaired state.

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
curl http://127.0.0.1:4317/api/scans/{newScanId}/compare/{scanId}
```

`GET /api/sample/state` reports the current variant. In the studio the same loop works through **Rescan and compare** after toggling the state; set it back to `before` when finished.

## Scan boundaries

- The service binds to loopback and is intended for local development only.
- Scans are bounded to five same-origin pages, two links deep, with per-page and overall time limits. Interaction testing gets a fixed slice of the budget so a heavy site still reaches more than one page.
- A bounded set of safe controls (ordinary buttons and same-site links) is activated once each in disposable browser pages. Form and submit controls are activated only when the scan explicitly allows it; a tick-box in the studio records that permission, and without it the rescan keeps the previous choice.
- Data-changing requests (anything other than GET/HEAD) and navigations outside the scanned website are always blocked and recorded, even with permission. Consequential actions such as delete, remove, send, pay, or sign out are never activated.
- Outcomes are labeled observed only when the browser recorded them; link and form destinations that were never activated remain inferred or not tested. Errors are attributed to the action that ran when they occurred, and unrelated page warnings stay context.
- Some sites answer an automated browser with a challenge page instead of the site. Those are reported as refused rather than as inspected, and the studio says plainly that nothing on them could be inspected.
- Private and reserved network addresses are blocked by default. Tick **Scan an address on my own computer** to open an address on your own machine — `localhost`, a private network address, or a custom port — with your permission. The cloud credential addresses (`169.254.169.254` and `metadata.google.internal`) are refused either way. A scan of a private address is marked as such in the result. This local proof of concept is not a hardened public scanning service; do not expose it to the internet.
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
