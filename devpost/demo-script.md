# AccessRipple — the three-minute demo

The shape of the recording: **the argument → a real scan → the barrier and the route to it → the model proposes a change → the rescan verifies it → what is still missing.** The cut is deliberate: watching a scan run is the least interesting thing in the world, showing the result of a scan you already ran is the whole point.

The captions in the studio's guided tour carry the same words as this script, in the same order, so a muted recording still explains itself.

## Before you press record

- [ ] `npm run dev` is running.
- [ ] The provider key is in `.env` and the scanner was restarted after it was added. The AI beats need it.
- [ ] The sites you want to show are already in **Recent scans**. Scan them once, before you start recording.
- [ ] The demo shop has been run through once, so **Show the proof** is available.
- [ ] `npm run check:studio` passes with 37 of 37. It takes a minute and catches anything that broke.
- [ ] `npm run rehearse` runs the whole route and prints how long each beat takes.
- [ ] The window is one size. The layout is verified at 1440×960 and 390×844.
- [ ] Nothing private is in the repository, and the public repository is up to date.

## Choosing the site you type

Not every famous site behaves the same. These were measured on this machine, after the fixes:

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
Say: “A list tells you what failed. I also need to know how someone reaches it. AccessRipple connects the finding to the journey a control actually took, and checks whether my change removed it.”

**0:08–0:22 — Type a URL.**
Click **Explore your website**, type `developer.mozilla.org` with no `https://`, and press **Map this website**.
Say: “It opens the site in a real browser on this computer, reads up to five pages, and activates a bounded set of safe controls once each in disposable pages to see what actually happens.”

**0:22–0:30 — Cut.**
Cut straight to the result. The scan was run before you started recording, so the result is already there.

**0:30–0:50 — The result, and the barrier.**
The summary is on screen: pages inspected, visible controls, accessibility findings, actions tested. The story paragraph states it in one sentence. Open the finding.
Say: “Four pages, 681 controls, 40 accessibility findings in 4 kinds of barrier, and 10 actions actually activated. These are the MDN docs, and the target-size rule is failing on their featured article tags.”

**0:50–1:10 — The route to it.**
Show **ROUTES TO THIS POINT** in the inspector, then follow one of them.
Say: “This is not a diagram of what might happen. This is the path the browser took, with each step labelled by what was actually observed. And here are the controls that lead to the page with the problem — that is how I choose what to investigate.”
Click a route and let the pulse travel it. “Anything past the recorded route stays marked untested.”

**1:10–1:30 — The model proposes a change.**
Press **Propose a change**. The diff appears with the file and line.
Say: “A model proposes the smallest change that fixes the rule, grounded in the markup the browser recorded. This is a suggestion, not proof. Here is how I check it.”

**1:30–1:50 — Apply it to the controlled demo shop.**
Switch to the demo shop, apply the accepted change, and rescan.
Say: “Controlled demo shop — the fixture this tool owns, so the change can be applied here. On a real site this stays a suggestion you make in your own code.”

**1:50–2:10 — The verification.**
The comparison and the proof: the page before and after, with the counts.
Say: “The proposal was not the proof, the rescan was. The finding the change addressed is no longer observed. The two failures it did not touch are still there, because a description does not bring back a missing file — and the tool says so instead of pretending.”
Point out **not rechecked** if it appears: “And a page that could not be checked again is never counted as fixed.”

**2:10–2:22 — What is still missing.**
Open the coverage panel.
Say: “Ten controls were activated. Thirty-six were not, because they needed permission or were safe to skip. Automated checks cover a useful subset of barriers. Keyboard, screen-reader, and human testing complete the picture.”

**2:22–2:28 — The artefact.**
Press **Export vault**, open the zip briefly.
Say: “The whole map exports as a linked Obsidian vault, so a team keeps the evidence, not a screenshot.”

**2:28–3:00 — Learning and close.**
Say what you actually learned building this with AI, in one sentence, in your own words.
Then: **“I learned that finding a problem isn't enough. I need evidence that my change actually helped.”**
Show the repository link.

## If something goes wrong

- **The scan is still running when you cut.** Open **Recent scans** and pick the prepared scan of the same site. Say “here is the same site from a scan I ran a moment ago”.
- **The model call is slow or fails.** The deterministic summary above it always works. Skip to the next beat and say the model was unavailable. Do not retry on camera.
- **Show the proof is missing.** Run the demo shop once before recording: scan, propose, apply, rescan. The proof is stored with the scan.
- **The network is down.** Everything except the model beat works offline, because the demo shop is local and the recorded scans are on this computer.

## Honesty notes

- The demo shop is a controlled local fixture with a deliberate fault. Say so. Do not present it as a third-party site.
- “No longer observed” means the browser stopped reporting that finding on a page it checked again. It does not mean the site is now accessible, and the interface says so on screen.
- The model proposes; it does not apply. The button that changes the demo shop is labelled **Apply this change to the demo shop** for exactly that reason.
- A recorded scan is a recording, not a live scan. Say the date when you open a saved one.
- The counts in this script are the values the current build produced on this machine. Public sites change, so re-run `npm run check:studio` and re-check the numbers before you record.
- This is a recording guide, not evidence that a submission video has been recorded or uploaded.
