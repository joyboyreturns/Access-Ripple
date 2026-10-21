# AccessRipple — the three-minute demo

The shape of the recording: **landing page → type a URL → cut to the result → the map and the journeys → the proof.** The cut is the point. Watching a scan run for forty seconds is the least interesting thing in the world; showing the result of a scan you already ran is the whole point.

## Before you press record

- [ ] `npm run dev` is running.
- [ ] The provider key is in `.env` and the scanner was restarted after it was added. The AI beats need it.
- [ ] The sites you want to show are already in **Recent scans**. Scan them once, before you start recording.
- [ ] The demo shop has been run through once, so **Show the proof** is available. The cold open depends on it.
- [ ] `npm run check:studio` passes with 36 of 36. It takes a minute and catches anything that broke.
- [ ] The window is one size. The layout is verified at 1440×960 and 390×844.
- [ ] Nothing private is in the repository, and the public repository is up to date.

## Choosing the site you type

Not every famous site behaves the same. These were measured on this machine, after the fixes:

| Site | Time | Pages | What it gives you |
| --- | --- | --- | --- |
| **developer.mozilla.org** | about 45s | 4 | 681 controls, **40 real findings in 4 kinds**, 10 actions activated. The best of both: fast enough, and it has a genuine barrier to point at |
| **news.ycombinator.com** | about 35s | 5 | 1000 controls, 500 findings. The most dramatic numbers |
| **www.w3.org** | about 33s | 5 | 187 controls, 3 findings. Scanning the accessibility authority itself is a good line |
| **www.google.com** | about 30s | 4 | 39 controls, 14 findings, 8 actions. The most famous name, and it finds real things |
| **github.com** | about 50s | 5 | 307 controls, 33 findings |

**Use MDN.** It scans in well under a minute, it is unmistakably real, and it has a genuine, specific barrier to show: *“All touch targets must be 24px large”* on its featured article tags — a WCAG 2.2 target-size problem on the world's most-read developer documentation site. The name makes the credibility beat land on its own.

Two sites to avoid on camera: **stackoverflow.com** and **devpost.com** answer automated browsers with a Cloudflare challenge page. The tool now reports that honestly, but it is a distraction in a three-minute video. Wikipedia, GOV.UK and the BBC scan correctly but take over a minute.

## The route, 180 seconds

**0:00–0:12 — The landing page.**
Show the hero and the video. Say: “AccessRipple turns a website into a map of its pages, journeys, and accessibility barriers, and every point on that map is backed by something a real browser recorded.”

**0:12–0:30 — Enter a URL.**
Click **Explore your website**, type the address you prepared — `developer.mozilla.org`, with no `https://`, to show it does not matter — and press **Map this website**. The scan starts.
Say: “It opens the site in a real browser on this computer. It reads up to five pages, and it activates a bounded set of safe controls once each in disposable pages to see what actually happens.”

**0:30–0:40 — Cut.**
Cut straight to the result. Do not show the wait. The scan was run before you started recording, so the result is already there.

**0:40–0:58 — The result.**
The scan summary is on screen: pages inspected, visible controls, accessibility findings, actions tested. The story paragraph underneath states it in one sentence.
Say: “Four pages, 681 controls, 40 accessibility findings in 4 kinds of barrier, and 10 actions actually activated and recorded. These are the MDN docs, and the target-size rule is failing on their featured article tags.”

**0:58–1:18 — The map, and a journey.**
Switch to **Controls**, choose a control, and watch the pulse travel the recorded route.
Say: “This is not a diagram of what might happen. This is the path the browser took, with each step labelled by what was actually observed. Anything past the recorded route stays marked untested.”
Rotate the map. Select a finding and read the human impact and the recorded element.

**1:18–1:36 — The model reads the scan.**
Press **Write a briefing**.
Say: “A model writes this, but it only ever sees the evidence the browser recorded, and every sentence has to cite an id that exists in the scan. Click a citation and it opens the evidence it came from. And notice the dashed chips — those are the things the scan did **not** check.”

**1:36–1:48 — The proof of a change.**
Open **Show the proof**. The same page before and after one change, side by side, with the counts.
Say: “We changed one image on a checkout page. Three things the browser no longer reports, and nothing new. The proposal was not the proof, the rescan was.”
Press **Repair the demo shop** then **Rescan and compare** if you want to show the loop live rather than as a still.

**1:48–2:14 — What is still missing.**
Open the coverage panel on the real-site scan.
Say: “Ten controls were activated. Thirty-six were not, because they needed permission or were safe to skip, and the scan ran out of budget. Automated checks cover a useful subset of barriers. Keyboard, screen-reader, and human testing complete the picture.”

**2:14–2:34 — The artefact.**
Press **Export vault**. Open the zip briefly, or just show the download.
Say: “The whole map exports as a linked Obsidian vault, so a team keeps the evidence and not a screenshot.”

**2:34–3:00 — Learning and close.**
Say what you actually learned building this with AI, in one sentence, in your own words.
Then: “Don’t stop at a finding. Follow the journey, inspect the evidence, and verify the change.”
Show the repository link.

## If something goes wrong

- **The scan is still running when you cut.** Open **Recent scans** and pick the prepared scan of the same site. Say “here is the same site from a scan I ran a moment ago”.
- **The model call is slow or fails.** The deterministic summary above it always works. Skip to the next beat and say the model was unavailable. Do not retry on camera.
- **Show the proof is missing.** Run the demo shop once before recording: scan, propose, apply, rescan. The proof is stored with the scan.
- **The network is down.** Everything except the model beat works offline, because the demo shop is local and the recorded scans are on this computer.

## Honesty notes

- The demo shop is a controlled local fixture with a deliberate fault. Say so. Do not present it as a third-party site.
- “No longer observed” means the browser stopped reporting that finding. It does not mean the site is now accessible, and the interface says so on screen.
- The model proposes; it does not apply. The button that repairs the demo shop is labelled **Apply the demo repair** for exactly that reason.
- A recorded scan is a recording, not a live scan. Say the date when you open a saved one.
- The counts in this script are the values the current build produced on this machine. Public sites change, so re-run `npm run check:studio` and re-check the numbers before you record.
- This is a recording guide, not evidence that a submission video has been recorded or uploaded.
