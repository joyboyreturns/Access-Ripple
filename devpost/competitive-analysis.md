# AccessRipple competitive analysis

Verified 21 October 2026. This is engineering research, not Devpost submission copy. Product descriptions below are published claims unless explicitly described as locally verified. No competing application was installed or independently audited, and no competitor code or media was copied.

## What this competition rewards

The intended event is **Build With AI: Basics**, identified by the installed Devpost Learn Skill Pack and local planning documents. Its overview asks for a small useful app built with the skills, a short working video, and an explanation of the builder's learning. It explicitly says reviewers will not clone or run the code. The practical implication is that the video must carry the evidence of a complete product experience. [Official overview](https://learn-ai-basics.devpost.com/)

The official rules list **Design, Potential Impact, Innovation/Idea, and Presentation**, equally weighted. The overview omits Potential Impact; the rules say they take precedence over conflicting material. Use all four criteria when reviewing the demo. [Official rules, §6 and §11](https://learn-ai-basics.devpost.com/rules)

## What is actually known about the field

The [official gallery](https://learn-ai-basics.devpost.com/project-gallery) was unpublished when checked. This edition has not yet reached judging, so there are no verified winners from it to reverse engineer. Public project pages can establish event association, but cannot establish eligibility, completeness, rank, or the strength of the whole field.

| Project | Evidence/status | Useful lesson for AccessRipple |
| --- | --- | --- |
| **Dev Cadence** | Its [Devpost page](https://devpost.com/software/dev-cadence) lists this event and describes a Chrome side panel for planning multiple hackathons, alongside a concrete account of the skill-pack learning process. A [public repository](https://github.com/vero-code/dev-cadence) is linked. **Confirmed event-associated page; not a verified finalist or winner.** | Specific audience and a recognizable problem make the pitch understandable immediately. The builder's own learning is part of the product story. |
| **BuildTrace** | Its [Devpost page](https://devpost.com/software/buildtrace) lists this event and describes a local Python app generator with a code inspector, execution terminal, offline fallback, and automated tests. **Confirmed event-associated page; published claims not independently tested.** | Visible execution evidence and graceful failure are compelling. AccessRipple should show the rescan verdict clearly, and label provider failure instead of substituting fabricated AI output. |
| **Access Now** | The [project page](https://devpost.com/software/access-now) records an **IC Hack 25 accessibility honourable mention**. It describes AI-generated image/link descriptions and measuring changes with Lighthouse. **Comparable past award recipient, not a current entrant.** | AI-generated alt text and before/after checking are established ideas. AccessRipple needs a more specific differentiator than “AI fixes accessibility.” |
| **3OIX – Superpower – AccessibilityPlus** | The [project page](https://devpost.com/software/accessibilityplus) records **Hack the Change 2025 first place** and describes photo/location reports, AI confidence, and a live map of physical accessibility. **Comparable past winner in a different problem space.** | A simple capture → analysis → visible map loop is easy to demonstrate. Its award does not prove that copying its feature set would improve this entry. |

## Product and visualization benchmarks

These are relevant established tools, not confirmed entrants in this hackathon.

**Axe DevTools is the most important functional benchmark.** Its [official extension page](https://www.deque.com/axe/devtools/extension/) describes AI assistance, component scans, prioritized/deduplicated results, issue sharing, and guided testing. [User Flow Analysis documentation](https://docs.deque.com/devtools-for-web/4/en/user-flow-analysis/) supports multi-state and multi-page testing with consolidated reporting. Therefore journey testing, AI assistance, and issue grouping are not original by themselves. AccessRipple should explain what its graph lets a developer understand that a report makes harder to see.

**Accessibility Insights is the usability benchmark.** Its [official overview](https://accessibilityinsights.io/docs/web/overview/) combines automated checks with a visual tab-stop helper and guided manual assessment. The valuable pattern is a guided next action and clear separation between automation and human review. AccessRipple's list alternative, keyboard controls, and explicit coverage limitations matter more than extra visual effects. It should not claim the depth of a complete manual assessment.

**Pa11y is a reproducibility benchmark.** Its [official repository](https://github.com/pa11y/pa11y) documents a Node/CLI workflow, configurable runners and reports. Its value is repeatable automation in development rather than a spatial UI. AccessRipple already builds on automated testing; its opportunity is to make evidence easier to investigate and preserve, while keeping the scan bounded and repeatable.

**Sigma.js and Cytoscape.js are interaction benchmarks.** [Sigma's official site](https://www.sigmajs.org/) demonstrates WebGL-based large-graph rendering with pan/zoom/hover/touch. [Cytoscape's official documentation](https://js.cytoscape.org/) provides interactive graph examples, compound nodes, selection, layouts and viewport controls. These demonstrate the baseline users expect: selection must answer a question, relationships must be inspectable, and scale must be managed. They are reference points, not a reason to replace AccessRipple's working SVG renderer days before submission.

## Comparison across the requested dimensions

This table is a reasoned assessment of published benchmarks and the repository baseline, not a numerical ranking or a claim of independently measured superiority. Final local validation belongs in the execution verification report.

| Dimension | Strong benchmark behavior | AccessRipple's credible advantage | Gap / decision |
| --- | --- | --- | --- |
| Innovation and originality | Axe already tests flows and proposes fixes; Access Now already used AI descriptions and measurement. | The combination of a relationship map, provenance, and a model's written pre-repair commitments checked against a rescan is a specific, testable idea. | Demonstrate the combination. Avoid “first,” “only,” or “finds every barrier.” |
| Technical complexity and implementation quality | Pa11y offers configurable repeatable automation; graph libraries provide robust interaction primitives. | Real Playwright evidence, axe checks, graph construction, grounded proposals, comparison, persistence and export form a complete loop. | A small correct scan is stronger than unsupported scale. Test duplicate ids, dangling edges and incomplete evidence. |
| Real-world usefulness | Accessibility Insights gives developers a practical next step; Axe integrates triage and remediation. | A developer can inspect how a control reaches the page with a finding, review its evidence, change source and recheck. | No real user study or measured time saving has been established. Say who benefits; do not invent adoption or conversion numbers. |
| Interactive visualization | Sigma and Cytoscape make navigation and selection standard expectations. | Spatial graph, route highlighting, evidence inspector and complete list can connect structure to investigation. | Clickable relationships and clear focus/fit behavior need direct interaction tests. Motion must preserve readability. |
| Accessibility and usability | Accessibility Insights supports keyboard assessment and explains manual work. | List alternative and reduced-motion support preserve access to evidence beyond the graph. | Automated checks of AccessRipple do not replace screen-reader and keyboard review. Do not imply visual graph access alone is sufficient. |
| Visual polish and presentation | Reference tools use purposeful hierarchy and consistent interaction patterns. | Existing local typography, graph palette, selected paths and before/after screenshots can create a strong identity. | Keep the map and the current decision visible. Avoid adding cards that push the key interaction below the fold. |
| Reliability and functional completeness | BuildTrace's published fallback story makes failure behavior visible. | The built-in shop is scanned in a real browser without a public network dependency; AI is optional. | Public sites change and may refuse automation; free model capacity is variable. Preserve honest recovery and a deterministic demo path. |
| Demonstration impact | Prior award projects describe a compact, understandable end-to-end action. | Reach finding → inspect route → repair controlled fixture → rescan → verdict is a visible argument. | Match narration to actual counts. A suggested alt-text repair and the fixture-wide repair resolve different sets of observations. |
| Alignment with judging | The event judges a coherent design, credible impact, novelty and clear working presentation. | The complete scan/investigate/recheck/export loop is aligned with all four. | A polished app does not establish eligibility or a submitted video. Finish the human-owned submission artifacts. |

## Highest-value work before recording

1. **Make relationships explain themselves.** A selected edge should name both endpoints, explain the derivation, and distinguish observed, inferred and unknown. This improves the map's value and the credibility of the pitch at the same time.
2. **Give a developer a defensible first action.** If adding priority, make severity and the ranking rationale visible. Do not invent business impact or turn page reachability into proof that a user is blocked.
3. **Show the limits beside the proof.** “Not rechecked” must never become “fixed”; automated results must stay separate from untested pages and browser policy signals.
4. **Keep the decisive path independent of a provider.** The controlled fixture plus real rescan should carry the main demo. A live model proposal is a bonus only when it returns promptly.
5. **Record a truthful three-minute story.** Establish the developer's question in the first 15 seconds, show one barrier and its evidence, then the measured result. Use actual current numbers; disclose saved scans and deliberate fixture faults.

## Originality and licensing

No benchmark code, screenshots, branding, or visual assets were adopted in this research. Existing axe-core use must retain its [MPL-2.0 notices](https://github.com/dequelabs/axe-core). Pa11y's repository declares LGPL-3.0, while Sigma and Cytoscape declare MIT; none was added as a dependency here. Those observations are not a full license audit. Check the rights to the existing hero video and any third-party site imagery before publishing the recording.

The strongest practical position is **an explainable accessibility investigation tool that tests its repair claims**. It is a narrower and more defensible claim than a universal accessibility scanner or a fully autonomous repair agent.
