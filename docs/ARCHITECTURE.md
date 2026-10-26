# AccessRipple architecture

AccessRipple is two processes on one computer: a React studio in the browser and a local Fastify API that drives a real Chromium. Everything the studio shows is evidence the browser recorded; the optional model only ever reads that evidence and is checked against it.

## 1. The system at a glance

```mermaid
flowchart LR
    subgraph Browser["Your browser"]
        Landing["Landing page<br/><i>Landing.tsx</i>"]
        Studio["Studio<br/><i>App.tsx</i>"]
        Map["Spatial map<br/><i>GraphCanvas.tsx</i>"]
        Present["Plain-language layer<br/><i>presentation.ts</i>"]
        Tour["Guided tour<br/><i>tour.ts</i>"]
    end

    subgraph API["Local API · Fastify on 127.0.0.1:4317"]
        Routes["REST routes + OpenAPI docs<br/><i>src/api/app.ts</i>"]
        Gate["URL safety gate<br/><i>url-safety.ts</i>"]
        Worker["Scan worker<br/><i>worker.ts</i>"]
        Interact["Interaction tester + keyboard probe<br/><i>interaction.ts</i>"]
        Graph["Graph builder + reach<br/><i>build-graph.ts · reach.ts</i>"]
        Compare["Rescan comparison<br/><i>compare.ts</i>"]
        AI["Grounded AI layer<br/><i>briefing.ts · fix.ts · contract.ts</i>"]
        Sandbox["Demo shop sandbox + simulated patches<br/><i>sandbox.ts</i>"]
        Export["Obsidian vault · .patch · PR summary<br/><i>obsidian.ts · patch.ts</i>"]
    end

    subgraph Storage["On this computer"]
        Mem[("Live scans<br/>memory")]
        Disk[(".data/ JSON<br/>newest 25 scans")]
        Contracts[("Model commitments")]
    end

    Chromium["Headless Chromium<br/>Playwright + axe-core"]
    Site["A public website<br/>or your own localhost"]
    Shop["Northstar demo shop<br/>built-in fixture"]
    Model["Vercel AI Gateway<br/>MiniMax M3.1 Flash<br/>optional"]

    Landing --> Studio
    Studio --> Map
    Studio --> Present
    Studio --> Tour
    Studio <-->|"JSON over HTTP<br/>proxied by Vite in dev"| Routes
    Routes --> Gate --> Worker
    Worker --> Chromium
    Chromium -->|"GET / HEAD only"| Site
    Chromium --> Shop
    Worker --> Interact --> Chromium
    Worker --> Graph
    Routes --> Compare
    Routes --> AI -->|"digest of evidence only"| Model
    Routes --> Sandbox --> Shop
    Routes --> Export
    Worker --> Mem --> Disk
    AI --> Contracts
```

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Studio | React 19, Vite 8, Motion, hand-built SVG | Landing, scan bar, spatial map, inspector, list, proof, guided tour |
| API | Fastify 5, Zod, `@fastify/swagger` | Validates input, rate-limits public scans, serves the demo shop and OpenAPI docs |
| Scanner | Playwright Chromium, axe-core 4 | Crawls up to five same-site pages, runs accessibility checks, activates safe controls |
| Graph | Pure TypeScript | Turns scan evidence into nodes and edges, each labelled observed, inferred or untested |
| AI | `fetch` to the Vercel AI Gateway, or any chat-completions endpoint | Briefing, proposed change and written prediction, each grounded in recorded evidence |
| Storage | In-memory map + JSON files | Recent scans survive a restart; nothing leaves the computer except the scan itself and the optional model digest |

## 2. One scan, end to end

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant UI as Studio
    participant API as Fastify API
    participant Gate as URL safety gate
    participant W as Scan worker
    participant C as Chromium (Playwright)
    participant G as Graph builder

    Dev->>UI: Type a URL, or press "Scan the demo shop"
    UI->>API: POST /api/scans
    API->>Gate: assertSafeUrl(url)
    Gate-->>API: public address, or refused with a reason
    API-->>UI: 202 scanId
    API->>W: performScan() in the background
    loop up to 5 pages, 2 links deep, 100 s budget
        W->>Gate: check every page and every redirect target
        W->>C: route.fetch(maxRedirects: 0), then load the page
        C->>C: axe-core installed before the site's own scripts
        C-->>W: controls, links, console and network errors, findings, markup, thumbnail
        W->>C: activate safe controls once each in a disposable page
        Note over W,C: Non-GET requests are blocked and recorded.<br/>Pay, delete, send and sign out are never activated.
        C-->>W: observed outcome per control
    end
    W->>G: buildGraph(scan)
    G-->>W: SiteGraph (unique node ids, no dangling edges)
    W->>API: complete, save to .data/
    loop every 0.8 s
        UI->>API: GET /api/scans/{id}
    end
    UI->>API: GET /api/scans/{id}/graph
    UI-->>Dev: Metrics, map, inspector, scan story
```

## 3. The model has to put its claim on trial

This is the loop that makes the AI accountable. The model proposes, commits in writing, a human decides, and the browser delivers the verdict.

```mermaid
flowchart TD
    F["A finding the browser recorded<br/>rule + selector + failing markup"] --> P["Model proposes a change<br/>POST /api/scans/{id}/fix"]
    P --> G1{"Does the 'before' markup<br/>match what was recorded?"}
    G1 -- No --> X1["Proposal dropped"]
    G1 -- Yes --> C["Model commits in writing<br/>POST /api/scans/{id}/contract<br/>each id: gone or still there"]
    C --> G2{"Only ids it was given?<br/>Target covered? At most 3?"}
    G2 -- No --> X2["Commitment rejected"]
    G2 -- Yes --> H{"A human decides"}
    H -- "Demo shop:<br/>'Apply this change'" --> S["Applied to an in-memory copy<br/>of the demo shop only"]
    H -- "Any other site:<br/>'Simulate on the next rescan'" --> SIM["Applied inside the scanner's own browser<br/>only if the markup still matches<br/>page labelled SIMULATED PATCH"]
    S --> R["Rescan the same site"]
    SIM --> R
    R --> V{"Was the page<br/>inspected again?"}
    V -- No --> U["NOT RECHECKED<br/>never counted as a pass"]
    V -- Yes --> O{"Did the browser agree?"}
    O -- Yes --> HELD["HELD"]
    O -- No --> FAIL["FAILED<br/>shown, never hidden"]
```

The briefing follows the same rule: every sentence must cite an evidence id that exists in the scan, sentences with no valid citation are dropped, and a briefing with nothing grounded left is refused rather than shown.

## 4. What a scan becomes

```mermaid
flowchart LR
    Site(("site")) -- contains --> Page["page"]
    Page -- links-to --> Page2["page"]
    Page -- has-control --> Control["control"]
    Control -- may-lead-to --> Flow["flow<br/>a recorded journey"]
    Flow -- links-to --> Page2
    Page -- has-finding --> Finding["accessibility-finding"]
    Page -- has-error --> Error["runtime-error<br/>404, console, blocked"]
    Control -. failed-at .-> Error
```

Every node and edge carries an evidence label:

- **observed** — the browser did it and recorded the outcome.
- **inferred** — the markup suggests it, but nothing was activated.
- **untested** — out of budget, needs permission, or deliberately never activated.

The ripple of a barrier uses only observed page-to-page steps, rings pages by recorded-action distance, and never claims a barrier stops a journey.

## 5. Safety boundaries

```mermaid
flowchart TD
    In["Address typed by the user"] --> RL{"More than 5 scans this minute?<br/>the demo shop is exempt"}
    RL -- Yes --> R3["429: protects other people's sites"]
    RL -- No --> A{"Cloud credential address?<br/>169.254.169.254 · metadata.google.internal"}
    A -- Yes --> R1["Always refused"]
    A -- No --> B{"Private, loopback or custom port?<br/>NAT64 / mapped IPv4 decoded first"}
    B -- Yes --> T{"'Scan an address on my<br/>own computer' ticked?"}
    T -- No --> R2["Refused, and the demo shop is offered"]
    T -- Yes --> L["Scanned, marked<br/>ADDRESS ON THIS COMPUTER"]
    B -- No --> Scan["Scanned"]
    Scan --> Rules["During the scan:<br/>same-site only · redirects checked before following<br/>GET/HEAD only · consequential controls never activated<br/>challenge pages reported as refused, not as findings"]
```

## 6. Where to look in the code

| Question | Start here |
| --- | --- |
| How is a page crawled and checked? | `src/scan/worker.ts` → `performScan` |
| Which controls are clicked, and which never are? | `src/scan/interaction.ts` → `classifyAction`, `runInteractions` |
| Why was an address refused? | `src/scan/url-safety.ts` → `assertSafeUrl`, `isPublicIp` |
| How does evidence become a map? | `src/graph/build-graph.ts` → `buildGraph` |
| How is a rescan compared? | `src/graph/compare.ts` → `compareScans` |
| How is the model kept honest? | `src/ai/briefing.ts`, `src/ai/fix.ts`, `src/ai/contract.ts` |
| How is the plain-language copy written? | `web/src/presentation.ts` (`scanStory`, `barrierRipple`, `traceJourney`) |
| How is the map drawn? | `web/src/GraphCanvas.tsx`, `web/src/graph-explorer.ts` |

## 7. How it is verified

| Command | What it proves |
| --- | --- |
| `npm test` | 231 unit, API and end-to-end tests across 25 files, including real Chromium scans of the demo shop |
| `npm run typecheck` | Server and studio both type-check under TypeScript 7 |
| `npm run build` | The production studio builds and the API compiles |
| `npm run check:studio` | Drives the whole studio in a real browser and checks 45 behaviours, plus the AI path when a model key is configured |
