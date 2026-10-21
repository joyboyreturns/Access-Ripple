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

## The three real bugs the overhaul found

1. **The markup of a failing element was never recorded.** The `snippet` field existed in the schema and was shown in the developer evidence panel, but nothing ever wrote to it. Without it there is no way to ground a proposed change.
2. **Two different links could collapse into one node.** The selector for an element stopped at four ancestors, so on a list-heavy page every row produced the same path. Four links on Hacker News shared one id, the graph carried the same node twice, and React reported duplicate keys. The path now runs deeper, is verified to match exactly one element, and falls back to a marker when it cannot; the graph also refuses to hold two nodes with one id.
3. **A repaired page was never photographed.** Pictures were only kept for pages that still had a finding, which is exactly the page that no longer has one after a fix.

## What the real-site sweep found

Ten famous sites were scanned through the running service. Every one produced a well-formed graph, but three things were wrong, and all three mattered more on a real site than on the fixture.

- **A site that refuses the scanner was reported as if it had been scanned.** Stack Overflow and Devpost answer an automated browser with a Cloudflare challenge page, and the scan reported one inspected page with a finding on it. That is a lie an accessibility tool cannot tell. A refused page is now recognised, marked blocked rather than inspected, and the story says the site refused the automated browser and that nothing on it could be inspected.
- **A strict Content Security Policy stopped the checks from running, and the pages were then reported as findings.** The check source was added with `addScriptTag`, which a policy blocks, so four of MDN's five pages had no check run on them — and the tool reported "4 accessibility findings" for four unchecked pages. That is the one thing an accessibility tool must never say. The source is now installed before the site's own scripts, where a policy cannot reach it, and a page whose checks could not run is a separate, clearly labelled item that is never counted as a finding. MDN went from zero real findings to 40.
- **Interaction testing ate the whole budget on a heavy site.** Wikipedia, GOV.UK and the BBC reached one page and then ran out of time, because every interaction opens its own disposable page and waits for it. Interactions now get a fixed 35% slice of the budget and the crawl keeps the rest. Wikipedia went from one page to four, GOV.UK from one to five. The demo shop is unaffected.

The sites worth showing in a recording, measured on this machine after the fixes: **developer.mozilla.org** (about 45s, 4 pages, 681 controls, 40 findings in 4 kinds, 10 actions activated), **news.ycombinator.com** (about 35s, 5 pages, 1000 controls, 500 findings), **www.w3.org** (about 33s, 5 pages, 3 findings), **www.google.com** (about 30s, 14 findings) and **github.com** (about 50s, 5 pages, 33 findings). Stack Overflow and Devpost answer automated browsers with a challenge page, so they are not in a three-minute video.

## The route, 180 seconds

The full beat sheet with the words to say is in `devpost/demo-script.md`. In outline:

| Time | Beat |
| --- | --- |
| 0:00–0:12 | The landing page |
| 0:12–0:30 | Type a URL — no scheme needed — and press Map this website |
| 0:30–0:40 | Cut straight to the result |
| 0:40–0:58 | The summary and the story paragraph |
| 0:58–1:18 | The map, and a journey that was actually observed |
| 1:18–1:36 | The model reads the scan, and names what is missing |
| 1:36–1:48 | The proof: the page before and after, and the counts |
| 1:48–2:14 | What was not reached and what was not tested |
| 2:14–2:34 | The exported vault |
| 2:34–3:00 | What you learned, the repository, the closing line |

The cut at 0:30 is deliberate. Watching a scan run is the least interesting thing in the world; showing the result of a scan you already ran is the whole point.

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
