---
doc: overhaul-plan
status: proposed
date: 2026-10-21
---

# AccessRipple — overhaul plan for the three-minute demo

This plan covers the state of the proof of concept, what was fixed, what still stands between the project and a strong hackathon submission, and what is deliberately out of scope.

## Where the product stands

The kernel is real and verified end to end: a bounded local scanner drives a real Chromium session, activates safe controls once each in disposable pages, records what actually happened, runs axe-core on rendered content, and returns an evidence-linked graph. The studio renders that graph as a spatial map with a full list alternative, traces an observed journey to its destination, explains coverage honestly, compares a rescan against a previous scan, and exports the result as a linked Obsidian vault.

The proof of concept works. It does not need a new kernel. What it needs is a reliable path from "it works" to "a judge understood it in ninety seconds".

## What was fixed in this pass

| Problem | Effect on the demo | Fix |
| --- | --- | --- |
| The studio could only scan a public address | A demo needed a reachable website and good wifi | **Scan the demo shop** runs the built-in checkout fixture in one click, always from its broken state |
| The before/after repair loop was curl-only | The most convincing beat needed a terminal mid-recording | **Prove a repair** switches the fixture and rescans from inside the studio |
| The result was four numbers and a list | A judge had to assemble the meaning themselves | **The scan story** states the observed counts and names the first barrier to look at |
| A private or local address ended in an error | A dead end in the middle of a recording | The block is explained and the demo shop is offered instead |
| The fixture was called `127.0.0.1` in the map, history, and vault | Looked unfinished | It is named **Northstar demo shop** everywhere |
| The landing page had no fast path into a working result | The first ten seconds were atmosphere, not proof | **See it in 60 seconds** opens the studio straight into a scan, and `#demo` survives a reload |
| The landing video had no poster frame | The first second of a recording was a black rectangle | A poster frame is generated from the video and served locally |
| There was no script for the recording | Fumbling, retakes, and lost time | **The guided tour** carries the sentence to say, moves the interface to the right place, and advances on the action the viewer takes. It doubles as on-screen captions, so a muted recording still explains itself |

Verification: 68 tests across 10 files, typecheck, production build, axe-core 0 violations on the landing page, the studio with a scan, the caption bar, the demo guide, the phone layout and light theme, Lighthouse accessibility 1.0 and best practices 1.0.

## The demo route

The four beats are recorded in `devpost/demo-script.md` and mirrored in the studio's guide button. The whole route runs on the built-in fixture, so it needs no network and returns the same numbers every time.

1. **0:00–0:15 — the idea.** The landing page, then **See it in 60 seconds**.
2. **0:15–0:40 — a real scan in ten seconds.** Four pages, nine controls activated once each in a disposable browser, stated in one sentence.
3. **0:40–1:45 — understand and follow.** Open the first barrier, read the impact and the fix, then follow a button and walk the observed route.
4. **1:45–2:20 — prove a repair.** Repair the fixture, rescan, compare: three items the browser no longer reports, nothing new.
5. **2:20–2:45 — the boundary.** Everything runs on this computer and nothing on a scanned site is sent or changed.

## What still stands between this and a submission

1. **The public repository was twelve commits behind** and has now been pushed. `github.com/joyboyreturns/Access-Ripple` carries the observed-interaction work, the animated routes, the saved history, the repair loop, and the demo revision. Confirm it before the submission.
2. **The video is not recorded.** The guided tour removes the script problem; what remains is pressing record and narrating.
3. **The Devpost form is the learner's to write.** The project name, the short description, the reflection answers, and the exit survey are written by the learner, not drafted here. `6-ship` is explicit about this.
4. **The checklist still has open learner-owned items.** Final Review and the Code Tour / App Map are learning activities, not engineering gaps, and they belong to the learner.
5. **The AI briefing needs a key.** Copy `.env.example` to `.env`, add a provider key, and restart the scanner before recording, or skip that beat entirely.

## Planned work, in priority order

### Phase A — do this before recording (about an hour, no new features)

- Push the twelve-plus commits to the public repository, after the learner confirms nothing private is in them.
- Read through `devpost/learner-profile.md` once before publishing. It is personal context and is ignored by git by default, but it must not appear in the repository either.
- Run the guided tour once end to end without recording. Ten minutes of rehearsal removes most retakes.
- Record the video with the tour running. The caption bar does the explaining; the narration is optional.
- Keep the recording at a single window size. The layout is verified at 1440×960 and 390×844.

### Phase B — the optional AI briefing (built, needs a key to switch on)

- **An AI-written briefing of the scan.** A local endpoint asks a model to summarise the findings in plain language, and the studio shows the result under the deterministic summary as **A model read of this scan**. It is off until `ACCESSRIPPLE_AI_KEY` is set in a local `.env`, and any OpenAI-compatible chat-completions endpoint works, including a local one. Two rules keep it honest: the model only sees a digest of recorded evidence, and every sentence must cite an evidence id that exists in the scan. A sentence whose citations are all invalid is dropped, and if nothing survives the request fails and the studio keeps the deterministic summary. The citations appear as buttons that open the evidence the sentence came from. The default model is a free OpenRouter one, and the whole path is covered by unit and API tests against a local mock provider.
- To use it: `cp .env.example .env`, fill in a key, and restart the scanner. The key never leaves the computer and the file is ignored by git.
- The risk is the one that matters: it needs a provider key and a working network at recording time. The deterministic summary above it is generated locally and always works, so a failed model call costs one beat and nothing else. Configure it before recording, never during.

### Phase C — a generated fallback video, only if there is no time to record

A scripted screen recording with narration would guarantee a submission artefact even if the learner cannot record one. It is a large piece of work and the result is rarely better than a human recording, so it is a fallback, not a goal.

### Phase D — after the hackathon

The "Later" list in `devpost/scope.md` stays as it is: deeper page coverage, signed-in workflows, source inspection, more browsers, and shared team scan history. None of it changes the kernel, and none of it should be started before the submission is in.

## What was deliberately not done

- The kernel was not rewritten. It works, and it is verified.
- The planning documents were not rewritten. `scope.md`, `prd.md`, and `spec.md` remain the approved record of the decision, and the work above stays inside the boundary they set.
- The public repository was not pushed. Publishing is the learner's decision, and it needs their explicit approval.
- The Devpost submission copy was not drafted. That copy has to be the learner's own words.
