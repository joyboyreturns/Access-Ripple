# AccessRipple — a demo in about 2 minutes 40 seconds

## Prepare

Start the full app with `npm run dev`. Run a real Google scan once and keep the scanner running. This supplies the previous result for comparison; do not present it as a scan that just occurred. Check the internet connection and export once before recording. Results and counts can change as Google changes its rendered content. Confirm the sample is in its broken state with `curl http://127.0.0.1:4317/api/sample/state` (expect `{"variant":"before"}`); after recording set it back with `curl -X POST http://127.0.0.1:4317/api/sample/state -H 'content-type: application/json' -d '{"variant":"before"}'`.

## Recording route

- **0:00–0:15 — The idea.** Show the video-led introduction. “AccessRipple helps developers see website journeys and accessibility barriers as connected, understandable evidence.”
- **0:15–1:00 — A real browser scan.** Open the studio and choose **Rescan and compare**. “This earlier result came from a real scan. I’m checking the same public URL again now.” Allow up to a minute for the bounded scan; narrate the five-page limit, that safe controls are activated once each in a disposable browser while form submissions need permission, and open **What this scan covered — and what it left out** to show that skipped destinations and untested controls are explained, not hidden. Mention that scans are saved on this computer, so **Recent scans** survives restarts.
- **1:00–1:30 — Understand an issue.** Select a grouped finding. Read its human impact and suggested change. Open developer evidence to show its real target. Rotate the map and focus the neighborhood.
- **1:30–1:55 — Follow an observed journey.** Switch to **Controls** and select a button such as **Add to cart** or **Continue to payment**. Walk the numbered route: “activated in a controlled browser”, “observed navigation”, “destination independently inspected”. Point out the pulse that travels the recorded route and that steps beyond it stay untested.
- **1:55–2:25 — Fix something you own and prove it.** On the built-in checkout sample: “The product image has no alternative text and its file is missing.” Run the one-line state toggle to apply the fixed sample, rescan from the same result, and open the comparison: “Three items resolved — the missing image description and two 404 signals — nothing new, nothing changed.” Explain that a comparison is evidence of what the browser no longer observes, not a certification.
- **2:25–2:40 — The purpose and boundary.** “The goal is a web that more people can use. Automated checks help us start; keyboard, screen-reader, and human testing complete the picture.”

This is a recording guide, not evidence that a submission video has been recorded or uploaded. If the live site is slow or unavailable, state the limitation and use the previously exported real result transparently. The sample repair loop is a mechanical before/after on a controlled fixture; record it honestly as such.
