---
doc: prd
status: approved
---

# AccessRipple — Product Requirements

An interactive website-flow and accessibility workspace for developers. It maps a bounded set of pages, controls, observed outcomes, errors, and accessibility findings into one evidence-linked graph. Source: `scope.md > The Unique Kernel`, `The Core Loop`, and `The POC Boundary`.

## The Core Journey

1. The developer opens AccessRipple and chooses the built-in checkout sample or enters a public website URL. The scan setup explains the page and interaction limits.
2. AccessRipple checks the address and scans a bounded set of public same-site pages. It records page links, interactive controls, safe observed navigation, failed requests, browser errors, and automated accessibility findings. Progress and incomplete pages remain visible.
3. The developer opens the result in the AccessRipple studio. A spatial graph connects the site to pages, controls, destinations, observed actions, errors, and accessibility findings. The developer can orbit the graph through 360 degrees, zoom, pan, and select nodes; a 2D/list view provides the same information without requiring 3D navigation.
4. Selecting a control or flow highlights its recorded path: its page, accessible name or label, destination or observed outcome, related request or browser error, and any accessibility finding attached to that control. Selecting an error or finding opens evidence, impact, and suggested next steps. The report distinguishes directly observed facts from relationships inferred from page structure.
5. For the built-in checkout sample, the developer can trigger a clearly labeled demo repair and rerun its checks. For an external site, the developer makes the change in their own code and starts a rescan; AccessRipple never writes to the website.
6. The updated result compares flows and findings, showing what changed, what remains, and what was newly observed.
7. The developer exports a ZIP containing linked Obsidian notes for the site, pages, controls, flows, errors, and findings, plus machine-readable graph data.

The backend is built first and exposes the graph and evidence through an API; the animated front end follows. The end-to-end scan-to-exploration demo should fit under three minutes. All claims are limited to pages and safe interactions actually inspected. The graph must label the difference between observed, inferred, and untested behavior.

## Screens and Layout

### Scan setup

A URL field, scan action, and built-in checkout sample. Before a scan, the screen summarizes the bounded public-page and safe-interaction coverage. Invalid or unsafe destinations get an actionable message.

### AccessRipple studio

A responsive studio with a page/control index, a central rotatable 3D graph, and details for the selected node. The developer can orbit 360 degrees, zoom, pan, focus a neighborhood, or switch to a 2D/list view. Selecting a control or flow reveals the ordered, recorded path and any error or finding. Motion is purposeful and respects reduced-motion settings.

### Scan progress and result states

Progress identifies the current page and observed interaction. Partial failures remain visible alongside successful results. A complete result can have no issues; in that case, it says which pages, interactions, and checks completed.

### Export

A download action creates an Obsidian-compatible ZIP with a start note, linked notes for pages, controls, flows, errors, and findings, and a machine-readable graph file.

## Look and Feel

An Obsidian-inspired spatial graph with an animated, polished studio interface. The learner requested React, Framer Motion, and UI/UX Pro Max. The graph should support 360-degree exploration and still offer an accessible 2D/list alternative. Use motion to clarify focus, flow, and transitions; respect reduced-motion preferences. Exact palette and typography remain open for the design pass.

## Features and Behavior

### URL scan and accessibility findings

Implements `scope.md > The Core Loop` and `scope.md > The POC Boundary`.

- The developer can submit an HTTP or HTTPS public website address or choose the bundled checkout sample.
- The scan is bounded to a small same-site page set and reports every page attempted, skipped, and failed. Sign-in sites are unsupported in the first version.
- Real automated accessibility checks run on rendered pages. A finding retains its page, control/element reference where available, check identity, impact, and evidence.
- Potential findings needing human judgment are marked for review.
- Invalid, unsafe, blocked, timed-out, and unsupported scans have explicit outcomes; they cannot appear as successful empty reports.
- The report never claims exhaustive bug detection or accessibility certification.

### Observed control flows and runtime errors

Implements `scope.md > The Unique Kernel` and `The Core Loop`.

- Each scanned page contributes a bounded inventory of links and interactive controls with their accessible name or label, role, and page context.
- The scan records safe, observable relationships: page links, same-site destinations, navigation resulting from a permitted probe, failed network requests, uncaught browser errors, and console errors relevant to the observed flow.
- A control’s graph neighborhood presents its page, recorded action or destination, request/browser error when present, and attached accessibility findings. Selecting it in the interface reveals the flow path.
- Data is labeled as **observed**, **inferred**, or **not tested**; an inventory entry alone is not presented as proof that an action works.
- The scanner does not submit payments or trigger purchasing, deletion, messaging, account changes, or other consequential actions. The checkout fixture demonstrates payment controls without processing a payment.

### Interactive graph and issue details

Implements `scope.md > The Unique Kernel` and `The Core Loop`.

- The graph includes site, page, control, flow/outcome, runtime error, and accessibility finding nodes, with typed relationships between them.
- The developer can orbit 360 degrees, pan, zoom, select a node, and focus its connected neighborhood. A 2D/list view exposes the same information without the spatial scene.
- Selecting a page, control, flow, error, or finding shows its evidence and connected path. Node status is not conveyed by color alone.
- Graph states distinguish observed, inferred, and untested relationships.

### Demo fix and rescan

Implements `scope.md > What "Working" Looks Like` and `Explicitly Cut`.

- In the built-in checkout only, the developer can apply a labeled demo repair and rerun the relevant accessibility and flow checks.
- The updated graph compares prior and current observations, identifying changed, remaining, and newly detected results.
- For external sites, AccessRipple offers guidance and rescanning but does not change or publish the site.

### API and Obsidian-compatible export

Implements `scope.md > The POC Boundary`.

- The backend exposes scan state, page/control inventory, flow observations, runtime errors, accessibility findings, evidence, and graph relationships in a stable API format.
- A completed scan can be exported as a ZIP of linked Markdown notes and machine-readable graph data.
- An export failure does not discard the scan result.

## Acceptance Criteria

- Submitting a valid public HTTP or HTTPS address creates a scan identifier that exposes progress and results.
- A completed or partially completed scan names all pages attempted and returns graph nodes and typed relationships for pages, controls, observed outcomes, errors, and accessibility findings.
- Selecting a control in the graph can display its page and recorded flow, including an observed destination or a recorded error when present; unknown behavior is labeled rather than guessed.
- Payment and other consequential actions are not executed during scanning.
- Invalid, private-network, unsupported, timed-out, or unreachable destinations produce explicit failure or partial status, never a false successful empty report.
- Selecting a graph finding shows its evidence, impact, guidance, and affected page/control where available.
- The graph supports orbit/pan/zoom and a 2D/list alternative with equivalent node details.
- The sample can demonstrate a repair and rescan; external sites are never modified.
- An export contains navigable Markdown notes and independently readable graph data.

## States and Boundaries

- **First use** — The sample checkout works without an account or API key.
- **Scanning** — Page progress and safe interaction coverage are visible.
- **Partial success** — Successful pages remain usable; skipped and failed pages are identified.
- **No findings/errors** — Report completed coverage and distinguish absence of detected problems from a failed scan.
- **Observed vs inferred** — Every graph relationship is labeled by how it was obtained.
- **Unsafe action** — A consequential action is shown as not tested and is not executed.
- **External-site fix** — The developer changes their own source and rescans; AccessRipple does not write to the site.
- **Persistence** — Results live for the current local session and can be saved by export; no account or cloud history.

## Product Decisions

- The product is AccessRipple, an interactive developer tool for understanding website flow and resolving accessibility problems in context.
- URL input, graph API, Obsidian export, a beautiful animated front end, and a 360-degree graph are requested.
- The graph should connect pages, controls, flows, errors, and accessibility findings; selecting a node reveals its recorded path and evidence.
- The backend is built first; the React front end follows. Framer Motion and UI/UX Pro Max are requested for the later interface.
- The bundled checkout stays a reliable demo fixture, but no real payment is processed.
- Coverage and evidence are stated honestly; no universal guarantee is made.

## What We're Building

- A backend that safely scans bounded public pages, records a control inventory, safe navigation and runtime errors, runs real accessibility checks, and returns graph-ready API results.
- A linked Obsidian-compatible export and a reliable checkout sample with a safe demo fix.
- A React studio with a rotatable 3D graph, 2D/list alternative, flow details, and reduced-motion support.

## Deferred From the POC

- Authenticated websites, arbitrary workflows, exhaustive site crawling, and tests requiring source-code access.
- Execution of purchases, payments, messages, deletion, or other consequential actions.
- Direct code edits, deployment, or publishing fixes to external websites.
- Complete coverage of all functional bugs or accessibility standards, certification, accounts, cloud history, and collaboration.

## Non-Goals

- Guarantee every path, bug, or accessibility barrier is found.
- Treat automated results as legal compliance certification.
- Perform financial or other consequential actions on a scanned website.
- Modify an external site.

## Open Questions

- Exact scan page limit, safe-probe rules, timeout, and persistence duration will be set in `4-spec`.
- UI/UX Pro Max is treated as the requested design skill; its setup will be verified before the front-end build.
