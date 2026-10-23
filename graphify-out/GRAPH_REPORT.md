# Graph Report - AccessRipple  (2026-10-23)

## Corpus Check
- 69 files · ~141,816 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .example 1, .css 1)

## Summary
- 680 nodes · 1579 edges · 37 communities (36 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ec26af3d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- AccessRipple
- fix.ts
- app.ts
- worker.ts
- interaction.ts
- contract.ts
- presentation.ts
- schema.ts
- check-studio.mjs
- url-safety.ts
- sandbox.ts
- compare.ts
- vitest
- build-graph.ts
- package.json
- types.ts
- compilerOptions
- graph-explorer.ts
- scripts
- GraphCanvas
- compilerOptions
- dependencies
- demo.mjs
- reach.ts
- devDependencies
- safeDisplayUrl
- keyboard-probe.test.ts
- tsconfig.build.json
- graph-interactions.test.ts
- vite.config.ts
- obsidian.ts
- ripple.test.ts
- SelectMenu
- prepare-demo.mjs
- tour.test.ts
- 6. Where to look in the code

## God Nodes (most connected - your core abstractions)
1. `App()` - 81 edges
2. `buildApp()` - 34 edges
3. `vitest` - 27 edges
4. `GraphCanvas()` - 26 edges
5. `performScan()` - 25 edges
6. `describe()` - 24 edges
7. `ScanResult` - 20 edges
8. `request()` - 19 edges
9. `AccessRipple` - 18 edges
10. `Icon()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `6. Where to look in the code` --references--> `buildGraph()`  [INFERRED]
  docs/ARCHITECTURE.md → src/graph/build-graph.ts
- `6. Where to look in the code` --references--> `isPublicIp()`  [INFERRED]
  docs/ARCHITECTURE.md → src/scan/url-safety.ts
- `6. Where to look in the code` --references--> `assertSafeUrl()`  [INFERRED]
  docs/ARCHITECTURE.md → src/scan/url-safety.ts
- `6. Where to look in the code` --references--> `performScan()`  [INFERRED]
  docs/ARCHITECTURE.md → src/scan/worker.ts
- `6. Where to look in the code` --references--> `scanStory()`  [INFERRED]
  docs/ARCHITECTURE.md → web/src/presentation.ts

## Import Cycles
- None detected.

## Communities (37 total, 1 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.05
Nodes (99): motion, react, react-dom, AiStatus, ApiError, APPLIED_FIXES_PATCH, APPLIED_FIXES_SUMMARY, applyProposal() (+91 more)

### Community 1 - "AccessRipple"
Cohesion: 0.05
Nodes (37): 1. The system at a glance, 2. One scan, end to end, 3. The model has to put its claim on trial, 4. What a scan becomes, 5. Safety boundaries, 7. How it is verified, AccessRipple architecture, A tour of the studio (+29 more)

### Community 2 - "fix.ts"
Cohesion: 0.11
Nodes (30): AiConfig, aiStatus(), Briefing, BriefingCitation, BriefingError, buildDigest(), DigestItem, groundSentences() (+22 more)

### Community 3 - "app.ts"
Cohesion: 0.12
Nodes (25): applyBody, AppOptions, buildApp(), canStartScan(), contractKey(), contractsFor(), createBody, DEFAULT_ORIGINS (+17 more)

### Community 4 - "worker.ts"
Cohesion: 0.13
Nodes (19): ScanLimits, SimulatedPatchOutcome, keyboardFindings(), probeKeyboard(), axeSource, captureScreenshot(), DEFAULT_LIMITS, ExtractedControl (+11 more)

### Community 5 - "interaction.ts"
Cohesion: 0.11
Nodes (25): InteractionExclusion, InteractionMode, PageEvidence, RuntimeErrorEvidence, ActionClass, activate(), BLOCKED_PATH, chooseFollowUp() (+17 more)

### Community 6 - "contract.ts"
Cohesion: 0.10
Nodes (19): zod, DEFAULT_BASE_URL, CheckedPrediction, ContractError, contractShape, contractUserPrompt(), issuesOnPage(), parseContract() (+11 more)

### Community 7 - "presentation.ts"
Cohesion: 0.14
Nodes (26): blockedShort(), cleanLabel(), cleanQuoted(), copies, Copy, destinationLabel(), flowShort(), isTestedFlow() (+18 more)

### Community 8 - "schema.ts"
Cohesion: 0.14
Nodes (13): AccessibilityEvidence, ControlEvidence, EvidenceLabel, GraphEdge, GraphEdgeKind, GraphNodeKind, InteractionExclusionReason, InteractionOutcome (+5 more)

### Community 9 - "check-studio.mjs"
Cohesion: 0.09
Nodes (11): playwright, option, out, proof, shot, failed, problems, real (+3 more)

### Community 10 - "url-safety.ts"
Cohesion: 0.21
Nodes (14): abortReasonFor(), assertSafeUrl(), blockedHostnames, blockedHostSuffixes, inV4Range(), invertedIpv4FromWords(), ipv4FromWords(), isNeverScannedAddress() (+6 more)

### Community 11 - "sandbox.ts"
Cohesion: 0.20
Nodes (18): buildPatchExport(), outcomeWord, pagePath(), PatchExport, AppliedPatch, applyPatch(), clearPatches(), DEMO_SHOP_FILES (+10 more)

### Community 12 - "compare.ts"
Cohesion: 0.24
Nodes (7): checkPredictions(), compareScans(), fingerprint(), issueKinds, matchIssues(), repairBetween(), selectorAffinity()

### Community 13 - "vitest"
Cohesion: 0.16
Nodes (10): fastify, vitest, allSummaries(), diskStore, scanDirectory(), scanPath(), ScanSummary, summarizeScan() (+2 more)

### Community 14 - "build-graph.ts"
Cohesion: 0.19
Nodes (10): buildGraph(), exclusionLabel(), lastStep(), linkLabel(), outcomeStatus(), InteractionEvidence, ScanResult, displayPath() (+2 more)

### Community 15 - "package.json"
Cohesion: 0.12
Nodes (16): engines, node, name, private, type, version, axe-core, concurrently (+8 more)

### Community 16 - "types.ts"
Cohesion: 0.12
Nodes (13): page, site, emptyGraph, EdgeExplanation, EvidenceLabel, GraphNode, GraphNodeKind, InteractionEvidenceView (+5 more)

### Community 17 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noUncheckedIndexedAccess, outDir (+7 more)

### Community 18 - "graph-explorer.ts"
Cohesion: 0.23
Nodes (17): buildExplorerScene(), constrained(), explainEdge(), explorerFacets(), ExplorerOptions, ExplorerScene, incompleteCheck(), strings() (+9 more)

### Community 19 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, capture:readme, check:studio, demo, dev, dev:api, dev:web (+7 more)

### Community 20 - "GraphCanvas"
Cohesion: 0.15
Nodes (6): explorerNodeColor(), GraphCanvas(), fitView(), keyDown(), rippleGeometry(), nodeColor()

### Community 21 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, jsx, lib, module, moduleResolution, noEmit, noUnusedLocals, noUnusedParameters (+5 more)

### Community 22 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, axe-core, fastify, @fastify/static, @fastify/swagger, @fastify/swagger-ui, jszip, motion (+4 more)

### Community 23 - "demo.mjs"
Cohesion: 0.38
Nodes (4): child, up(), wait(), waitFor()

### Community 24 - "reach.ts"
Cohesion: 0.24
Nodes (10): ScanComparison, annotateReach(), Index, indexGraph(), MOVEMENT, normalizedSnippet(), Reach, reachOf() (+2 more)

### Community 25 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, concurrently, tsx, @types/node, @types/react, @types/react-dom, typescript, vite (+2 more)

### Community 26 - "safeDisplayUrl"
Cohesion: 0.67
Nodes (6): errorEvidence(), redactMessage(), stableId(), runSingleInteraction(), safeDisplayUrl(), inspectControls()

### Community 27 - "keyboard-probe.test.ts"
Cohesion: 0.25
Nodes (4): clear, trap, document(), listen()

### Community 28 - "tsconfig.build.json"
Cohesion: 0.22
Nodes (8): ./tsconfig.json, compilerOptions, outDir, rootDir, types, exclude, extends, include

### Community 29 - "graph-interactions.test.ts"
Cohesion: 0.25
Nodes (5): checkout, finding(), home, node(), site

### Community 30 - "vite.config.ts"
Cohesion: 0.40
Nodes (3): vite, @vitejs/plugin-react, webRoot

### Community 31 - "obsidian.ts"
Cohesion: 0.43
Nodes (6): jszip, createObsidianZip(), frontmatter(), md(), safeName(), scan

### Community 32 - "ripple.test.ts"
Cohesion: 0.60
Nodes (4): finding(), page(), shop(), withoutSharedAffix()

### Community 33 - "SelectMenu"
Cohesion: 0.70
Nodes (5): SelectMenu(), choose(), closeMenu(), onKeyDown(), openMenu()

### Community 38 - "tour.test.ts"
Cohesion: 0.47
Nodes (3): TOUR, TourContext, TourStep

### Community 39 - "6. Where to look in the code"
Cohesion: 0.50
Nodes (5): 6. Where to look in the code, classifyAction(), priority(), pushExclusion(), runInteractions()

## Knowledge Gaps
- **8 isolated node(s):** `axe-core`, `@types/node`, `@types/react`, `@types/react-dom`, `concurrently` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 279 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `ripple.test.ts`, `App.tsx`, `fix.ts`, `app.ts`, `worker.ts`, `contract.ts`, `tour.test.ts`, `schema.ts`, `url-safety.ts`, `sandbox.ts`, `compare.ts`, `build-graph.ts`, `package.json`, `types.ts`, `keyboard-probe.test.ts`, `graph-interactions.test.ts`, `obsidian.ts`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **What connects `axe-core`, `@types/node`, `@types/react` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05151706700379267 - nodes in this community are weakly interconnected._
- **Why does `6. Where to look in the code` connect `6. Where to look in the code` to `App.tsx`, `AccessRipple`, `worker.ts`, `presentation.ts`, `url-safety.ts`, `build-graph.ts`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Should `AccessRipple` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Why does `AccessRipple architecture` connect `AccessRipple` to `6. Where to look in the code`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `fix.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11229946524064172 - nodes in this community are weakly interconnected._