# AccessRipple — the three-minute demo

## Before you press record

- [ ] `npm run dev` is running. `npm run demo` starts it and opens the studio in demo mode.
- [ ] The provider key is in `.env` and the scanner was restarted after it was added. The AI beats need it.
- [ ] The demo shop has been run through once, so **Show the proof** is available. The cold open depends on it.
- [ ] `npm run check:studio` passes with 30 of 30. It takes a minute and catches anything that broke.
- [ ] The window is one size. The layout is verified at 1440×960 and 390×844.
- [ ] Nothing private is in the repository, and the public repository is up to date.

## The route, 180 seconds

**0:00–0:12 — The cold open: the proof.**
Open `http://127.0.0.1:5173/#proof`. The proof fills the screen: the same page before and after one change, side by side, with **3 no longer observed · 2 still observed · 0 new** across the top.
Say: “We changed one image on a checkout page. AccessRipple checked what the browser actually stopped reporting. Three things are no longer observed, nothing new appeared.”

**0:12–0:24 — The problem, and what is different.**
Say: “Axe and Lighthouse tell you a check failed. They do not tell you which control it belongs to, what the user actually hit, or whether your fix worked. AccessRipple uses axe-core for the checks and adds the journey, the evidence, and the comparison.”

**0:24–0:42 — A real scan, in ten seconds.**
Close the proof and press **Scan the demo shop**. The browser opens four pages, activates nine safe controls once each in disposable pages, and records what happened.
Say: “This is a real Chromium session on this computer. Nine controls were activated once each. Form and submit controls need permission, and requests that would change data stay blocked.”
Point at the story paragraph. Do not read every metric.

**0:42–0:58 — Make the map mean something.**
Switch to **Controls**, choose **Add to cart**. The pulse travels the recorded route.
Say: “This is the path the browser took, not a diagram of what might happen. Each step is labelled with what was actually observed, and anything past the recorded route stays marked untested.”

**0:58–1:18 — The barrier, in the page.**
Open **Findings** and select the missing image description. Show the human impact, the CSS selector, and the recorded markup.
Say: “A person who cannot see the image misses what it communicates. Here is the exact element the check ran on.”

**1:18–1:38 — The model does something useful.**
Press **Propose a change**. The proposal appears as a diff, with the file and line it came from.
Say: “A model proposes the smallest change that fixes the rule, grounded in the markup the browser recorded. It points at checkout.html line 29. This is a grounded proposal, not a verified fix.”
Be explicit about that last part. It is the difference between a demo and a lie.

**1:38–1:48 — A human decides.**
Press **Apply the demo repair**, then **Rescan and compare**.
Say: “The demo shop is a local fixture this tool owns, so the repair can be applied here. On a real site this stays a suggestion you make in your own code.”

**1:48–2:08 — The money shot.**
The proof reopens with the two pictures. Point at the broken image on the left and the product graphic on the right, and at the counts.
Say: “The proposal was not the proof. The rescan was. Three things the browser no longer reports, and nothing new. The two that remain are the simulated gateway timeout and a contrast finding that was never part of this fix.”
Open the coverage panel. “And this only covers five pages. What was not reached, and what was not tested, is written down rather than left out.”

**2:08–2:26 — It is not only the demo shop.**
Open **Recent scans** and open the saved Hacker News scan. Show the address, the date it was recorded, one observed route, and one finding with its evidence.
Say: “This is a recorded scan of a real public site, taken on this machine, not a live scan. Five pages, a thousand controls, ten of them activated, and five hundred findings grouped into five kinds of barrier. The tool does not stop working when the site stops being ours.”

**2:26–2:44 — Honest limits.**
Open the coverage summary on that scan.
Say: “Thirty-six controls were never activated. Some needed permission, some were safe to skip, and the scan ran out of budget. Automated checks cover a useful subset of barriers. Keyboard, screen-reader, and human testing complete the picture.”

**2:44–3:00 — Learning and close.**
Say what you actually learned while building this with AI, in one sentence, in your own words.
Then: “Don’t stop at a finding. Follow the journey, inspect the evidence, and verify the change.”
Show the repository link.

## If something goes wrong

- **The model call is slow or fails.** The deterministic summary above it always works. Skip to the next beat and say the model was unavailable. Do not retry on camera.
- **The scan is slow.** It takes about ten seconds. The progress panel shows pages inspected. Narrate over it.
- **Show the proof is missing.** Run the demo shop once before recording: scan, propose, apply, rescan. The proof is stored with the scan.
- **The real-site scan is missing.** It lives in the saved history on this computer. Re-scan Hacker News once before recording; never scan it live on camera.
- **The network is down.** Everything except the model beat works offline, because the demo shop is local.

## Honesty notes

- The demo shop is a controlled local fixture with a deliberate fault. Say so. Do not present it as a third-party site.
- “No longer observed” means the browser stopped reporting that finding. It does not mean the site is now accessible, and the interface says so on screen.
- The model proposes; it does not apply. The button that repairs the demo shop is labelled **Apply the demo repair** for exactly that reason.
- The Hacker News scan is a recording, not a live scan. Say the date.
- The counts in this script are the values the current build produces. Re-check them after any change to the fixture.
- This is a recording guide, not evidence that a submission video has been recorded or uploaded.
