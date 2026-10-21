# AccessRipple — a demo in about 2 minutes 45 seconds

## Before you press record

- [ ] `npm run demo` starts the app and opens the studio straight into a demo-shop scan.
- [ ] The studio header shows **Local scanner ready**.
- [ ] The **▶ guided tour** button opens a caption bar, and the caption bar advances on its own as you scan, open a barrier, follow a journey, and run the repair loop.
- [ ] You have read `devpost/learner-profile.md` and confirmed the repository contains nothing private. It is ignored by git by default, but check before publishing.
- [ ] The public repository is up to date. It was last pushed on 19 October, before the observed-journey work and the repair loop.
- [ ] You have rehearsed the whole route once without recording.

## Prepare

Start the app with `npm run demo` (or `npm run dev` and open `http://127.0.0.1:5173/#demo`). The whole demo now runs on the built-in demo shop, so it needs no internet connection and returns the same numbers every time you record.

Check the demo shop is in its broken state before you start. Press **Scan the demo shop** in the studio: it always resets the shop to that broken state first, so you do not need a terminal to prepare anything. If you want to confirm it yourself, `curl http://127.0.0.1:4317/api/sample/state` should report `{"variant":"before"}`.

Export the vault once before recording so the download is not a surprise. Close unrelated windows. The demo guide inside the studio (the ▶ button in the header) repeats these four beats, and the guided tour carries the sentence to say for each step.

## Recording route

- **0:00–0:15 — The idea.** Show the video-led introduction. “AccessRipple turns a website into a map of its pages, journeys, and accessibility barriers — and every point on that map is backed by something a real browser actually recorded.” Press **See it in 60 seconds**.
- **0:15–0:40 — A real scan, in ten seconds.** The studio opens and scans the demo shop on its own. “This is a real Chromium session. It opened four pages, activated nine safe controls once each in a disposable browser, and recorded what happened.” Point at the story paragraph: it states the numbers in one sentence. Mention that form and submit controls need explicit permission and that data-changing requests stay blocked.
- **0:40–1:10 — Understand the barrier.** Click **Open “An image needs a text alternative”**. Read the human impact and the suggested change. Open **Developer evidence** to show the real target. Rotate the map and focus the neighbourhood. “The same point carries the rule, the element, and the evidence — that is what a linked map buys you over a list of warnings.”
- **1:10–1:45 — Follow an observed journey.** Open **Controls**, choose **Add to cart**, and walk the numbered route. “Each step says it was observed in a disposable browser, and the pulse travels the exact path that was recorded.” Point out that steps beyond the recorded route stay untested, and that the payment step was never submitted.
- **1:45–2:20 — Prove a repair.** In **Prove a repair**, press **Repair the demo shop**, then **Rescan and compare**. “The image now loads and carries a text alternative. Three items stop being observed — the missing image description and its two failed requests — with nothing new and nothing changed.” Say plainly: a comparison is evidence of what the browser no longer sees, not a certification.
- **2:20–2:45 — The purpose and the boundary.** “Automated checks start the conversation. Keyboard, screen-reader, and human testing complete it. Everything runs on this computer, and nothing on a scanned site is sent or changed.”

## Optional beat: the model-written read

If a model provider is configured, the studio also shows **A model read of this scan** under the summary. Press **Write a briefing** and read it aloud: “A model writes this, but it only ever sees the evidence the browser recorded, and every sentence has to cite an id that exists in the scan. Click a citation and it opens the evidence the sentence came from.”

This is the strongest beat for a “Build With AI” brief, and it is also the riskiest: it needs a provider key and a working network at recording time. The summary above it is generated locally and always works, so if the model call is slow or fails, the demo simply continues. Configure it before recording, never during.

## Optional extra

If you have a few seconds, show **Export vault** and open the downloaded zip: every node becomes a linked note in an Obsidian vault, and the raw graph ships with it. That is the artefact a developer keeps after the meeting.

## Honesty notes

- The demo shop is a controlled local fixture that ships with a deliberate fault. Say so; do not present it as a third-party site.
- Counts in this script are the values the current build produces for the demo shop. Re-check them once after any change to the fixture.
- If you also want to show a public website, scan it separately and present it as a second, optional example. Do not make the live demo depend on it.
- This is a recording guide, not evidence that a submission video has been recorded or uploaded.
