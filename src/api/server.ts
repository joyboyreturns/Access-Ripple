import { buildApp } from './app.js';

// Optional local settings, such as a model provider key for the AI briefing.
// The file stays on this computer and is ignored by git.
try { process.loadEnvFile?.(); } catch { /* There is no .env file, which is fine. */ }

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 4317);
if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
  throw new Error('AccessRipple scans are local-only in this proof of concept. HOST must be a loopback address.');
}
// Names the studio may be opened by through a private proxy on this computer, e.g. `tailscale serve`.
const trustedHosts = (process.env.ACCESSRIPPLE_TRUSTED_HOSTS ?? '').split(',').map((name) => name.trim()).filter(Boolean);
const app = await buildApp({ baseUrl: `http://${host}:${port}`, logger: true, trustedHosts, publicDemo: process.env.ACCESSRIPPLE_PUBLIC_DEMO === 'true' });
await app.listen({ host, port });
app.log.info(`AccessRipple API is listening locally at http://${host}:${port}`);
