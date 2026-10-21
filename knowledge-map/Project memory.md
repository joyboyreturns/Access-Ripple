# Project memory

Durable context for future OpenCode sessions. Keep this note concise; link to generated Graphify notes rather than copying code descriptions here.

## Preferences

- 2026-10-19 — Use Graphify queries for focused codebase navigation before reading source.
- 2026-10-19 — Use this Obsidian vault for durable project decisions, constraints, blockers, and next steps; do not preserve full chat transcripts.

## Decisions

- 2026-10-19 — Display labels are humanized in `web/src/presentation.ts` (`cleanLabel`, `shortcutOf`, `cleanQuoted`, `friendlyScanError`); raw accessible names stay in scan evidence and export. New graph flows must label script/email/phone links in plain language (`linkLabel` in `src/graph/build-graph.ts`), and journeys through them must not claim an “outside this scan” destination.
- 2026-10-19 — The studio action picker is a searchable combobox (`web/src/SelectMenu.tsx`) that keeps `#journey-control` and combobox ARIA; the graph surface sets `user-select: none` so orbiting never selects labels.
- 2026-10-21 — The built-in checkout fixture is a first-class product surface, not a test-only backend detail. The studio reaches it through `GET /api/sample/info` plus `POST /api/scans {"sample":"checkout"}`; the graph names it "Northstar demo shop" instead of a loopback address. A demo must never depend on a public website being reachable.
- 2026-10-21 — The demo shop is always reset to its broken state before a demo scan (`scanDemo` in `web/src/App.tsx`). The reset is unconditional on purpose: a cached variant can be stale if the sample was changed outside the interface.
- 2026-10-21 — Scan results lead with a plain-language story (`scanStory` in `web/src/presentation.ts`) built only from observed evidence, then the metric row. Every number in that sentence must come from the scan record, never from inference.
- 2026-10-21 — A private or local address is a policy outcome, not a dead end. The studio explains the block and offers the demo shop instead of stopping at an error.

## Current context

- Refresh the source graph with `graphify update . --force --no-cluster`, then refresh this vault with `graphify export obsidian --graph graphify-out/graph.json --dir knowledge-map`.
- Open `knowledge-map/` as the Obsidian vault. Start with [[graph.canvas]] or [[AccessRipple]].
- Open before shipping: Final Review and Code Tour/App Map checklist items, demo video recording, Devpost copy. Commits stay unpushed until the learner approves publishing.
- The demo route for the three-minute recording is `devpost/demo-script.md`; it runs entirely on the demo shop, so no network is needed while recording. The same four beats are available in the studio under the ▶ guide button.
- The Amazon India scan saved in `.data/scans` is the real-site fixture used for label checks (shortcut names, `javascript:void(0)` links).
- Kept local, not committed: `AGENTS.md`, `.opencode/`, this note, and editor state.
