---
doc: overhaul-plan
status: proposed
date: 2026-10-21
---

# AccessRipple — overhaul plan for the three-minute demo

This plan records the state of the proof of concept, what was fixed, what still stands between the project and a strong hackathon submission, and what is deliberately out of scope.

## Where the product stands

The kernel is real and verified end to end: a bounded local scanner drives a real Chromium session, activates safe controls once each in disposable pages, records what actually happened, runs axe-core on rendered content, and returns an evidence-linked graph. The studio renders that graph as a spatial map with a full list alternative, traces an observed journey to its destination, explains coverage honestly, compares a rescan against a previous scan, exports the result as a linked Obsidian vault, and can propose a grounded code change for a finding.

The proof of concept works. What a three-minute recording needs is a story that opens on the result rather than on the setup, and a story that holds together on a bad network.

## The critique that shaped this overhaul

A design review was asked one question: what makes a judge disengage from this demo. The answer was sharp and changed the plan.

- **The original script delayed its payoff until 1:45.** By 0:40 a judge was looking at another accessibility report. A report is the least interesting thing the tool does.
- **The fix has to be an honest loop.** Evidence, then a concrete change, then a human decision, then a rescan. The button that repairs the demo shop is labelled **Apply the demo repair**, never "apply the AI patch", because the model proposes and the tool never edits a scanned website.
- **A picture of the page beats a count.** The before-and-after page is the moment a judge remembers.
- **A fixture proves repeatability; a real site proves credibility.** The demo now opens a recorded scan of a real public site, labelled with its date, and never depends on a live external scan.
- **One dominant number.** *3 no longer observed.* And the interface says what it means: findings and browser signals the browser no longer recorded, not a claim that the site is now accessible.
- **Skip the extras.** An automatic demo mode would have duplicated the caption track that already exists, and a severity-times-reach score would have added false precision.

## What was built

| Addition | Why it earns its place in the recording |
| --- | --- |
| **The proof** — the same page before and after one change, side by side, with the counts above it | It is the cold open. A judge sees the result in the first ten seconds instead of waiting a minute and forty-five for it |
| **Page pictures** — every inspected page is captured, small | A repair can be seen, not only counted. The broken image on the left, the product graphic on the right |
| **A proposed change** — a model writes the smallest change that fixes the rule, as a diff, with the file and line it came from | It is the clearest possible "AI did something useful" beat, and it is grounded in the recorded markup |
| **The scan story** — one paragraph stating the observed counts and naming the first barrier | The result reads at a glance instead of being assembled from four numbers |
| **The demo shop** — a built-in four-page checkout that always starts broken, in one click | The demo cannot fail on a bad network |
| **The guided tour** — the recording script and the caption track in one | A muted recording still explains itself, and the viewer never fumbles a click |
| **A real-site scan** in the saved history | Answers "does this only work on its own demo?" |
| **Honest naming** — "browser signal", "not tested", "no longer observed" | It is an accessibility tool. Overstating is the one unforgivable bug |

## Three real bugs found while building this

1. **The markup of a failing element was never recorded.** The `snippet` field existed in the schema and was shown in the developer evidence panel, but nothing ever wrote to it. Without it there is no way to ground a proposed change.
2. **Two different links could collapse into one node.** The selector for an element stopped at four ancestors, so on a list-heavy page every row produced the same path. Four links on Hacker News shared one id, the graph carried the same node twice, and React reported duplicate keys. The path now runs deeper, is verified to match exactly one element, and falls back to a marker when it cannot; the graph also refuses to hold two nodes with one id.
3. **A repaired page was never photographed.** Pictures were only kept for pages that still had a finding, which is exactly the page that no longer has one after a fix.

## The route, 180 seconds

The full beat sheet with the words to say is in `devpost/demo-script.md`. In outline:

| Time | Beat |
| --- | --- |
| 0:00–0:12 | The proof, full screen: the page before and after, and the counts |
| 0:12–0:24 | The problem, and what a single tool cannot do |
| 0:24–0:42 | A real scan in ten seconds |
| 0:42–0:58 | The map, and a journey that was actually observed |
| 0:58–1:18 | The barrier, in the page, with its element |
| 1:18–1:38 | The model proposes a change, grounded in that markup |
| 1:38–1:48 | A human decides |
| 1:48–2:08 | The money shot: the pictures, the counts, the honest limit |
| 2:08–2:26 | A recorded scan of a real public site |
| 2:26–2:44 | What was not reached and what was not tested |
| 2:44–3:00 | What you learned, the repository, the closing line |

## What still stands between this and a submission

1. **The video is not recorded.** The guide, the captions, the demo shop and the real-site scan are all ready. What remains is pressing record.
2. **The AI beats need a provider key.** `cp .env.example .env`, add a key, restart the scanner. The free models are a chain, so a busy provider is not fatal. The deterministic summary above the model output always works, so a failed call costs one beat.
3. **The Devpost form is the learner's to write.** The project name, the short description, the reflection answers, and the exit survey are written by the learner, not drafted here. `6-ship` is explicit about this.
4. **The checklist still has open learner-owned items.** Final Review and the Code Tour / App Map are learning activities, not engineering gaps.
5. **One number should be re-read before recording.** *3 no longer observed* is the demo's dominant number, and it is three findings and browser signals, not three proven accessibility fixes. The interface says so on screen.

## Deliberately not done

- **The kernel was not rewritten.** It works, and it is verified.
- **No automatic demo mode.** The caption track already covers it, and building a playback engine would have cost time the recording itself needed.
- **No impact score.** Severity times reach looks precise and is not. One evidence-backed "why this first" is enough.
- **The model never edits a scanned website.** The demo shop is a fixture this tool owns; a real site gets a suggestion, not an edit.
- **The planning documents were not rewritten.** `scope.md`, `prd.md`, and `spec.md` remain the approved record, and this work stays inside their boundary.
- **The Devpost submission copy was not drafted.** That copy has to be the learner's own words.
