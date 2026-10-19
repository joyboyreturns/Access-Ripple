import { buildApp } from './app.js';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 4317);
if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
  throw new Error('AccessRipple scans are local-only in this proof of concept. HOST must be a loopback address.');
}
const app = await buildApp({ baseUrl: `http://${host}:${port}`, logger: true });
await app.listen({ host, port });
app.log.info(`AccessRipple API is listening locally at http://${host}:${port}`);
