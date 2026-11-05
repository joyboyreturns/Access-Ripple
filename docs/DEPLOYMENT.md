# Run AccessRipple locally

The public hackathon demo has been retired. There is no maintained public demo or Funnel endpoint. AccessRipple needs a Node.js 22 process and Playwright Chromium; the optional Vercel AI Gateway supplies a model and does not host the scanner.

## Install and develop

```sh
git clone https://github.com/joyboyreturns/Access-Ripple.git
cd Access-Ripple
npm ci
npx playwright install chromium
npm run dev
```

Open http://127.0.0.1:5173/ for the studio, or http://127.0.0.1:5173/#walkthrough for the repair walkthrough. The API runs at http://127.0.0.1:4317/ and its health endpoint is `/api/health`. Keep the terminal open; Ctrl+C stops both development servers.

`npm run demo` starts the same servers and opens the built-in shop scan automatically. Use either `npm run dev` or `npm run demo`, one session at a time. After dependencies and Chromium are installed, the built-in shop and prepared repair need no network or API key. Optional AI requests and public-site scans use the network.

## Build and run without Vite

```sh
npm run build
npm start
```

Open http://127.0.0.1:4317/. The scanner serves the compiled studio and API together. Keep it bound to `127.0.0.1`; local use needs no reverse proxy, Tailscale Funnel, Docker container, or system service.

## Optional configuration

Copy `.env.example` to `.env` and fill in `ACCESSRIPPLE_AI_KEY` to use model-generated briefings, proposals, and predictions. See the [README AI setup](../README.md#optional-ai-briefing-and-proposed-changes). Keep credentials in the ignored `.env`, then restart the app after changing settings.

Leave `ACCESSRIPPLE_PUBLIC_DEMO=false` and `ACCESSRIPPLE_TRUSTED_HOSTS` empty for ordinary local use. If reusing configuration from a previous public deployment, remove its public hostname and public-demo settings first. Public-demo mode blocks local-network scanning.

Completed scans are saved under `.data/` by default (the newest 25). Stop the app and delete that directory to clear local history, or set `ACCESSRIPPLE_DATA_DIR` to use a different location. Demo-shop repairs are held in memory; scanning the shop again resets it to its broken state.

## Troubleshooting

- **Unsupported Node version:** run `node --version` and use Node 22.x, then rerun `npm ci`.
- **Chromium missing:** run `npx playwright install chromium`. On Linux, missing system libraries can be installed with `npx playwright install --with-deps chromium`; this may require sudo.
- **Port already in use:** stop an earlier AccessRipple session or the process using port 4317 or 5173, then restart. The development studio expects the API on port 4317.
- **Browser did not open:** open the printed localhost URL manually. An automatic browser opener is only a convenience.
- **Local website refused:** tick **Scan an address on my own computer** in the studio before scanning localhost or a private address. Cloud credential endpoints remain blocked.
- **AI unavailable:** the scanner and deterministic summary still work. Check the key and provider settings, restart after editing `.env`, and inspect the terminal for provider errors. The walkthrough labels its prepared repair when used.

## Verify a checkout

```sh
npm run typecheck
npm test
npm run build
```

For the full browser check, start `npm run dev` in another terminal, then run `npm run check:studio`.
