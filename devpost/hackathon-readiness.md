# Hackathon readiness evidence

Verified 21 October 2026, rechecked 22 October 2026. This is a preparation checklist, not a submission or a declaration of eligibility.

## Verified event requirements

The [official rules](https://learn-ai-basics.devpost.com/rules) set the deadline at **26 October 2026, 17:00 EDT**, which is **27 October 2026, 02:30 IST**. Judging is 27–30 October; winners are planned around 4 November.

Required: a new project created during the submission period, Devpost Learn Skill Pack use, generated scope/PRD/spec in the repository, an installable working app, a public code repository, a feature description, a public YouTube/Vimeo demonstration under three minutes, and English materials or translations. Disclose incorporated pre-existing work and respect third-party rights. The rules recommend an open-source license. Personal eligibility, conflicts and excluded jurisdictions require the entrant's confirmation.

## Evidence and outstanding work

| Requirement | Local evidence | Readiness |
| --- | --- | --- |
| Planning workflow | Installed six-step skill pack; `devpost/scope.md`, `prd.md`, `spec.md` record the plan. | Present. A repository alone cannot prove the full learning process; the builder should explain it in their own words. |
| New project in event period | Project memory identifies current development and a public repository. | Not independently proven by this research. Preserve truthful creation history; do not retroactively manufacture evidence. |
| Working end-to-end behavior | 22 October: 200 tests, typecheck, production build, two back-to-back 56-check browser sweeps, axe-core with no violations, and a live developer.mozilla.org scan. | Verified locally. Rerun `npm run check:studio` on the recording machine before recording. |
| Public repository | Project memory names `joyboyreturns/Access-Ripple`. | Check public access and that the final tested changes and planning files are present before submission. No push performed by this research. |
| Public working video | `devpost/demo-script.md` is a recording guide. | A guide is not a video. No final public video URL was verified. |
| Submission description / registration | No final submitted form inspected. | Human-owned and unverified; the entrant must supply truthful learning and ownership details. |
| Media and dependency rights | README records font notices and hero-video provenance. | Confirm publication permission for the video and any third-party imagery; provenance alone is not a license grant. |

## Judging review

The four criteria below are equally weighted under the [rules](https://learn-ai-basics.devpost.com/rules), despite the overview displaying only three:

| Criterion | What to put on screen | Honest limitation |
| --- | --- | --- |
| Design | Scan progress and recovery, clear map selection, readable evidence, repeatable comparison. | Test all visible controls and phone layout; visual polish alone does not prove completion. |
| Potential Impact | A specific developer can trace a control to a page with a barrier and decide what to fix. | No measured productivity improvement or user validation is established. |
| Innovation/Idea | Graph provenance plus a model's explicit pre-repair prediction checked by the browser. | Flow scanning and AI remediation already exist; do not claim category invention. |
| Presentation | One coherent scan → evidence → controlled repair → rescan → verdict → export sequence. | The final video is still required. Keep within the time limit and match narration to observed values. |

Use the current test report and the research in `competitive-analysis.md` to make the final readiness decision. A first-place outcome cannot be predicted from public evidence, especially while the official gallery is unpublished.

## 22 October recheck

The rules page still lists the four equal criteria, and the [project gallery](https://learn-ai-basics.devpost.com/project-gallery) is still unpublished, so there is no field to compare against yet. Two faults that a judge could have seen were fixed: a page redirect could carry the scan to another server (the one failing test), and the one-click demo answered "Too many scans" after a rehearsal because the demo shop counted against the public-site rate limit. The ripple of a barrier was added for Innovation and Potential Impact: it places a finding on the journeys the browser recorded and names who the check protects, without claiming the barrier stops anyone.

## 23 October recheck

The rules page was read again: the deadline, the pass/fail Stage One (fits the theme, built with the skill pack as shown by `scope.md`, `prd.md` and `spec.md` in the repository) and the four equally weighted criteria are unchanged. The license must be detectable in the repository's About section; GitHub detects it as MIT.

Two faults a judge or a live recording could have hit were fixed. The model's written prediction was sent without the low reasoning setting and with a 600-token budget, so a reasoning model could spend the budget thinking and return nothing; it now uses the same settings as the proposal, with a regression test. And a busy free model left no way to retry on screen; the briefing, the proposal and the prediction now say plainly that the model is busy and offer to ask again.

For the video, a finished scan now fits one 1440 × 900 frame: the map keeps its own height instead of stretching to the inspector, and the result scrolls itself so the metrics, the whole map and the inspector share the screen. The README was rebuilt around the problem, the audience and the proof, with screenshots captured by `npm run capture:readme` and an architecture overview in `docs/ARCHITECTURE.md`.

Verified: 202 tests across 22 files, typecheck, production build, and the 56-check browser sweep. Still open and human-owned: the public video link, the Devpost form, and the learner's final review.
