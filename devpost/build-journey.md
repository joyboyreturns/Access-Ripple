# How AccessRipple was built: the learning journey

This is the story of the build from the first commit (19 October 2026) to the latest, in the order it happened. It is written in the first person so it can be pasted into the Devpost form and spoken in the video. Edit anything that does not sound like you: the facts come from the commit history and the project's decision log, the wording is a draft.

## The short version (about 30 seconds, for the video)

I came in with a coding agent and no plan. The skill pack made me plan first: scope, then product definition, then spec. That is the part that changed my idea. I started with "a map of a website" and ended with "an AI that has to prove its accessibility fix". Building it taught me three things that no tutorial did. A reasoning model can spend its whole budget thinking and answer with nothing. A tool that reports a page it never checked as a page with a problem is lying. And the only honest way to trust an AI's fix is to make it commit to what it will change before anything changes, then measure it again with a real browser.

## What I learned, in five lessons

1. **Plan first, build second.** I started with no plan at all. Writing a scope, a PRD and a spec before code felt slow, then saved me from building the wrong thing twice.
2. **Real data finds bugs mocks never will.** Every serious bug in this project was found by running against something real: a real model, a real public site, a real rehearsal.
3. **An accessibility tool must never over-claim.** Several of the fixes below are about wording and counting honestly: "not rechecked" is not "fixed", "unchecked" is not "clear".
4. **The AI should be on trial, not on a pedestal.** The model proposes, a human decides, and the browser judges.
5. **A demo is a product too.** I redesigned the demo so a judge sees the result in the first ten seconds, needs no account, and cannot break it by being offline.

## The timeline

### 19 October: from "I don't have any plan" to a working scanner

- **Planning.** I ran the skill pack in order: `1-start` (who I am and my idea), `2-scope`, `3-prd`, `4-spec`. The learner profile records where I started: comfortable with coding agents, new to plan-first work. The documents are in `devpost/`.
- **The backend and graph.** First commit: a scanner that opens pages in a real Chromium browser, runs axe-core, and turns pages, controls and findings into one evidence graph. A redirected page was appearing twice, so the second commit deduplicates redirects.
- **The studio.** A React interface with a video-led landing page and a graph you can explore. A source map of the code (Graphify) and an Obsidian vault were generated alongside, so the project can be navigated without reading every file.
- **Journeys, not just lists.** The scanner now presses a bounded set of safe buttons once each in disposable pages and records what really happened. Form submits wait for permission, data-changing requests are always blocked, and consequential actions (pay, delete, send, sign out) are never pressed. A checkout fixture (catalogue to cart to checkout to payment) proved the whole chain. One discovery stayed with me: the cart link only exists after you click "Add to cart", so the scanner has to activate the button to find the next page.
- **First honesty fixes.** Links that leave the site are reported as blocked instead of being ignored. Skip links are activated by keyboard. Graph labels were rewritten to read like a person would say them.
- **A verified before/after repair loop** on the checkout fixture, so a fix could be measured, not just described.

### 21 October: the demo overhaul, the AI, and the real-world bugs

- **A demo that cannot fail.** The studio could only scan a public address, so a demo depended on a website being reachable. I added a built-in demo shop that always starts broken, a one-click "See it in 60 seconds", and a plain-language story at the top of every result.
- **A guided tour that doubles as captions.** Each step carries the sentence to say, moves the interface to the right place, and advances when the viewer acts. A tour that started after a scan existed got stuck on its first step, so it now opens on the first step the viewer has not reached.
- **The first AI feature, and its rules.** A model-written briefing of a finished scan, underneath the summary that already worked. The rules came from the start: the model only sees evidence the browser recorded, every sentence must cite an id that exists in the scan, and a sentence with an invalid citation is dropped.
- **A real model broke my assumptions.** Two bugs a mock could never have caught. A reasoning model spent its whole token budget thinking and returned nothing, so I asked for a low reasoning effort and a larger budget, and the answer went from about 21 seconds to about 3.5. And models write the citation after the full stop, which tore it off its sentence and left both halves ungrounded, so a citation-only fragment is now folded back.
- **A design review asked what would make a judge stop watching.** The answer was that the old demo delayed its payoff until 1:45. I moved the result to the first ten seconds and added the proof: the same page before and after one change, side by side, with the counts above it.
- **Three bugs found by building that.** The markup of a failing element was never recorded, so no fix could be grounded in it. Two different links could collapse into one node because the element path was too short (four links on Hacker News shared one id). A repaired page was never photographed.
- **Real websites.** I scanned ten famous sites. Stack Overflow and Devpost answer an automated browser with a challenge page, and the scan had reported them as inspected pages with a finding. That is a lie an accessibility tool cannot tell, so a refused site is now reported as refused. A heavy site (Wikipedia, GOV.UK, the BBC) used its whole time budget on one page, so interaction testing now gets a fixed 35 percent slice and the crawl keeps the rest.
- **The worst kind of bug for this product.** A strict Content Security Policy stopped the accessibility checks from running at all, and four of MDN's five pages then showed up as "4 findings". A page nobody checked is not a page with a problem. The checks are now installed before the site's own scripts run, MDN went from zero real findings to 40, and an unchecked page is a separate labelled item that is never counted.
- **A review of my own code found a fake.** The button said "Apply the demo repair" but the server swapped in a prewritten file, so the model's suggestion and the measured improvement were unrelated. It could have been faking it. Now an accepted change is applied to an in-memory copy of the fixture and the next scan reads that copy. I also reworded every claim that overreached: "nothing is sent" became "only reading requests are sent".
- **The model's promise becomes falsifiable.** Before a change is applied the model commits in writing to what it will fix and what will still be there. The rescan checks each commitment and reports it as held, failed or not rechecked. This is the idea the whole product is now built around.
- **The map answers "how do I reach this barrier?"** with routes to the finding's page, each marked observed or not tested.
- **Rehearsal bugs.** The demo shop spoiled the next take because an accepted change from an earlier take was still applied, so it now resets before every demo scan. Predictions are named after the finding they are about, even once that finding is fixed, and survive a restart.
- **Your own sites.** An address on my own computer is reachable only with an explicit tick, and the cloud credential addresses stay refused either way.

### 22 October: the ripple

- A finding's **ripple**: the page with the barrier in the middle and the pages one and two recorded actions away on rings around it, every arrow named after the control the browser activated. It only draws what the browser did, and it never claims a barrier stops a journey.
- Redirects are checked before the browser follows them, so a redirect cannot carry a scan to another server. A rehearsal also showed that the one-click demo failed with "Too many scans" after a few takes, so the rate limit no longer applies to the demo shop.

### 23 October: honesty, reach, and the first impression

- **Reach, not a score.** I chose counts (how many pages are reachable beyond a finding, how many recorded journeys pass through its page) over a made-up 0 to 100 number. A score would claim more than the browser observed.
- **A simulated patch on live sites.** On any site that is not the demo shop, a proposed change is only ever simulated inside the scanner's own browser, applied only if the element still has the recorded markup, and labelled SIMULATED PATCH everywhere.
- **A keyboard probe.** The scanner presses Tab on each page and reports keyboard traps and focus that cannot be seen, as things for a person to confirm.
- **Moved to the Vercel AI Gateway** and tested every proposal path in a real browser. A scan result now fits one screen.
- **A one-press judge walkthrough.** The whole loop (scan, propose, commit, apply, rescan, proof) in about twelve seconds, with a panel that shows the real time and says when the prepared fix stood in for a model.
- **Rehearsal found silent failures.** The dev server wraps functions in a helper that does not exist inside the browser page, so every keyboard finding and every simulated patch failed silently on a live site. A deterministic unit test could not see it. Rehearsing the whole route end to end did. The walkthrough also read the AI status before it had loaded and silently skipped the model.
- **The demo video.** Recorded as separate clips driven by a real browser, with animated diagrams between them, and an original canvas animation instead of a third-party landing video.
- **Learning from a judges' review.** After watching Devpost's "What do hackathon judges look for" session, I rewrote the landing page so it says who it is for and what it does in the first seconds ("Find the barrier that matters. Prove the fix worked."), kept the app free of any account or sign-up, and rebuilt the closing of the video around how I built this.

## Where I was stuck, and what got me out

| Stuck on | What got me unstuck |
| --- | --- |
| An empty answer from a reasoning model | Reading the raw response: `content: null` and a spent token budget. Lower the reasoning effort, raise the budget. |
| Every citation ungrounded | Printing where the model put it: after the full stop. Fold it back into its sentence. |
| Pages that "had findings" that were never checked | Scanning real sites, not the fixture. A strict Content Security Policy blocked the checks. |
| A demo that spoiled its own next take | Resetting the demo shop unconditionally before every demo scan. |
| Silent failures only in dev mode | Rehearsing the whole route end to end instead of trusting unit tests. |

## Honest note on AI help

AccessRipple was built with an AI coding agent guided by the Devpost Learn Skill Pack. The model inside the product is also an AI. Where the code says "the model proposes", that is literal: a human decides, and the browser, not the model, decides whether it worked. If I use an AI voice in the video I say so in the Devpost description.
