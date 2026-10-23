# AccessRipple — the three-minute demo

The shape of the recording: **the argument → a real scan → the barrier and the route to it → the model proposes a change and commits to what it will fix → the rescan checks the commitment → what is still missing.** The cut is deliberate: watching a scan run is the least interesting thing in the world, showing the result of a scan you already ran is the whole point.

The captions in the studio's guided tour carry the same words as this script, in the same order, so a muted recording still explains itself.

## Before you press record

- [ ] `npm run dev` is running.
- [ ] The provider key is in `.env` and the scanner was restarted after it was added. The AI beats need it.
- [ ] `npm run prepare:demo` has been run. It clears the saved history, scans the five public sites, and leaves the demo shop in its broken state with the pair the proof needs. Run it the morning of the recording, not earlier: the saved history keeps only the newest twenty-five scans, so test runs push the prepared sites out.
- [ ] **Show the proof** is available.
- [ ] `npm run check:studio` passes. It takes a minute and catches anything that broke. It leaves the demo shop exactly as it found it, so it is safe to run at any time.
- [ ] `npm run rehearse` runs the whole route and prints how long each beat takes.
- [ ] The window is one size. The layout is verified at 1440×960 and 390×844.
- [ ] Nothing private is in the repository, and the public repository is up to date.

## Choosing the site you type

Not every famous site behaves the same. These were measured on this machine:

| Site | Time | Pages | What it gives you |
| --- | --- | --- | --- |
| **developer.mozilla.org** | about 45s | 4 | 681 controls, **40 real findings in 4 kinds**, 10 actions activated. Fast enough, and a genuine barrier to point at |
| **news.ycombinator.com** | about 35s | 5 | 1000 controls, 500 findings. The most dramatic numbers |
| **www.w3.org** | about 33s | 5 | 187 controls, 3 findings. Scanning the accessibility authority itself is a good line |
| **www.google.com** | about 30s | 4 | 39 controls, 14 findings, 8 actions |
| **github.com** | about 50s | 5 | 307 controls, 33 findings |

**Use MDN.** It has a real, specific barrier to show: *"All touch targets must be 24px large"* on its featured article tags — a WCAG 2.2 target-size failure on the most-read developer documentation site on the internet.

**Avoid Stack Overflow and Devpost on camera.** They answer automated browsers with a Cloudflare challenge page. The tool now reports that honestly, but it is a distraction in a three-minute video.

## The route, 180 seconds

**0:00–0:08 — The argument, over the landing page.**
Show the hero for three seconds, then the positioning line.
Say: “This is for developers who own a website. A list tells you what failed. AccessRipple shows which journeys pass through each barrier, has an AI propose a fix, and then rescans to check it.” Say who it is for and what it does in the first ten seconds, and start on the app, not on a title card.

**0:08–0:22 — Type a URL.**
Click **Explore your website**, type `developer.mozilla.org` with no `https://`, and press **Map this website**.
Say: “It opens the site in a real browser on this computer, reads up to five pages, and activates a bounded set of safe controls once each in disposable pages to see what actually happens.”

**0:22–0:30 — Cut.**
Cut straight to the result. The scan was run before you started recording, so the result is already there, and the map is the first thing below the numbers.

**0:30–0:48 — The result, and the barrier.**
The summary is on screen: pages inspected, visible controls, accessibility findings, actions tested. Open the finding.
Say: “Four pages, 681 controls, 40 accessibility findings in 4 kinds of barrier, and 10 actions actually activated. These are the MDN docs, and the target-size rule is failing on their featured article tags.”

**0:48–1:08 — Its ripple, and the route to it.**
Press **See its ripple on the map** in the inspector. The barrier's page moves to the centre, the pages one and two recorded actions away sit on rings around it, and every arrow is named after the control the browser activated. Open one arrow to show its evidence, then press **Back to map** and follow one of the **ROUTES TO THIS POINT**.
Say: “This is the barrier's ripple: every action the browser actually took into this page and on from it. It shows where the barrier sits on real journeys — it does not claim the barrier stops them. And the line under it says who this check protects — on MDN's tags, people with limited dexterity and anyone on a touch screen.”
If you have a few seconds, show the discovery on the demo shop instead: the **Add to cart** button reveals a **View cart** link that is not in the page's source, and the scanner follows it. Say: “That cart link only exists after a click. The scanner found it by activating the button, and followed it into the next page — so a page that is not in the markup still ends up on the map.”

**1:08–1:28 — The model proposes a change, and commits to what it will fix.**
On the controlled demo shop, press **Propose a change**. The diff appears with the file and line. Then press **Ask what this will fix**.
Say: “The model receives the failing element the browser actually recorded, and proposes this change. Then I make it commit, in writing, to what it will and will not fix — before anything is applied. It says the description finding will be gone, and that the two missing-file errors will still be there. That is a prediction the browser can check.”

**1:28–1:42 — Apply it.**
Press **Apply this change to the demo shop**, then **Rescan and compare**.
Say: “I approve that exact replacement, not a prebuilt repaired page. On a real site this stays a suggestion you make in your own code.”

**1:42–2:02 — The verification.**
The comparison, then the proof: the page before and after, with the counts and the verdicts.
Say: “The rescan is the proof, not the proposal. The finding the change addressed is no longer observed. The two failures it did not touch are still there, because a description does not bring back a missing file. And the model's prediction held on all three — which the browser checked, not me.”
Point out the verdict strip if it appears: “And a page that could not be checked again is never counted as fixed.”

**2:02–2:14 — What is still missing.**
Open the coverage panel.
Say: “Ten controls were activated. Thirty-six were not, because they needed permission or were safe to skip. Automated checks cover a useful subset of barriers. Keyboard, screen-reader, and human testing complete the picture.”

**2:14–2:22 — The artefact.**
Press **Export vault**, open the zip briefly.
Say: “The whole map exports as a linked Obsidian vault, so a team keeps the evidence, not a screenshot.”

**2:22–3:00 — How I built it, and what I learned.**
The judges score the learning journey as well as the app, so give it these 38 seconds. Say it in your own words; the prompts below are real events from this project, so pick the two that mattered to you:
- The planning skills (`1-start` to `4-spec`) turned a vague idea into a scope, a PRD and a spec before any code. What did the interview change about your idea?
- A reasoning model spent its whole token budget thinking and returned nothing. Lowering the reasoning effort and raising the budget fixed it.
- Models put the citation after the full stop, which tore it off its sentence. Folding it back made the grounding check work.
- A rehearsal found that every keyboard finding was silently missing because of a helper the dev server added. Rehearsing end to end caught what unit tests could not.
Then close on: **“I learned that finding a problem isn't enough. I need evidence that my change actually helped.”**
Show the repository link.

## If something goes wrong

- **The scan is still running when you cut.** Open **Recent scans** and pick the prepared scan of the same site. Say “here is the same site from a scan I ran a moment ago”.
- **The model call is slow or fails.** The deterministic summary above it always works. Skip to the next beat and say the model was unavailable. Do not retry on camera.
- **The model will not commit to anything.** The proposal is still shown and can still be applied and measured. Skip the prediction line and say the model did not make a prediction.
- **Show the proof is missing.** Run `npm run prepare:demo` before you start. The proof is stored with the scan.
- **The network is down.** Everything except the model beat works offline, because the demo shop is local and the recorded scans are on this computer.

## Honesty notes

- The demo shop is a controlled local fixture with a deliberate fault. Say so. Do not present it as a third-party site.
- “No longer observed” means the browser stopped reporting that finding on a page it checked again. It does not mean the site is now accessible, and the interface says so on screen.
- The route is made of observations that each really happened. How they join into one route is the tool's reading of them, and the interface says that too.
- The model proposes and predicts; it does not apply. The button that changes the demo shop is labelled **Apply this change to the demo shop** for exactly that reason.
- A recorded scan is a recording, not a live scan. Say the date when you open a saved one.
- The counts in this script are the values the current build produced on this machine. Public sites change, so re-run `npm run check:studio` and re-check the numbers before you record.
- This is a recording guide, not evidence that a submission video has been recorded or uploaded.
