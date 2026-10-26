# Hosting the public demo

AccessRipple needs a persistent Node 22 process and Playwright Chromium. The
scanner is not a static site or a Vercel serverless function. The Vercel AI
Gateway supplies the optional model; it does not host the scanner.

## Build and run

```sh
npm ci
npx playwright install --with-deps chromium
npm run typecheck
npm test
npm run build
```

Keep the process bound to `127.0.0.1:4317`. Configure these server-side settings
in an ignored `.env` or in the process manager:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4317
ACCESSRIPPLE_PUBLIC_DEMO=true
ACCESSRIPPLE_TRUSTED_HOSTS=home-pc.tail601a7c.ts.net
ACCESSRIPPLE_DATA_DIR=.data/public-demo
```

Use a new, empty data directory for public hosting so private local scan
history is not published. Public visitors share scan history, the demo shop,
and accepted changes; the studio displays this explicitly. Do not use private
URLs or confidential page content on the shared demo. Use the local app for
private work.

Public-demo mode refuses private-network opt-ins, does not inherit old private
scan permissions, and only accepts demo-shop edits previously proposed by the
server. It admits a new scan when the worker is idle. Model requests are
serialized and limited to twelve starts per minute across the demo. The model
provider's own budget and rate limits still apply.

Optional model settings are documented in `.env.example`. Use a Vercel **AI
Gateway API key**, stored only on the server as `ACCESSRIPPLE_AI_KEY` (or
`AI_GATEWAY_API_KEY`); a Vercel deployment token is a different credential.
Without a model, the judge walkthrough uses and labels the prepared repair.

```sh
npm start
```

## Home PC and Tailscale Funnel

The Home PC checkout is `/mnt/cloud_storage/AccessRipple`; its system service
is `accessripple.service`. Use its installed Node 22 runtime. Keep the service
enabled, with `Restart=always`, so it starts after a reboot and recovers after
a crash. After updating code and rebuilding:

```sh
sudo systemctl restart accessripple
curl --fail http://127.0.0.1:4317/api/health
sudo tailscale funnel --bg --https=443 http://127.0.0.1:4317
tailscale funnel status
```

Funnel terminates HTTPS and forwards to the loopback service. Add only its
exact hostname to `ACCESSRIPPLE_TRUSTED_HOSTS`. Do not expose the scanner's raw
port or change `HOST` to `0.0.0.0`.

Check `/api/health` from outside the tailnet, then open `/#walkthrough` in a
fresh browser session. Confirm that the proof labels the repair source,
screenshots load, exports download, and private scans are refused. Keep the PC
awake and connected throughout judging. To turn off public HTTPS access:

```sh
sudo tailscale funnel --https=443 off
```

The pre-existing tailnet-only TCP mapping on port 4318 can remain in place.
