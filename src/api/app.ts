import Fastify, { LogController, type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertSafeUrl, safeDisplayUrl, UnsafeUrlError } from '../scan/url-safety.js';
import { performScan } from '../scan/worker.js';
import { scanStore } from '../store/memory.js';
import { compareScans } from '../graph/compare.js';
import { createObsidianZip } from '../export/obsidian.js';
import type { ScanResult } from '../graph/schema.js';

const createBody = z.union([
  z.object({ url: z.string().min(1).max(2048) }).strict(),
  z.object({ sample: z.literal('checkout') }).strict(),
]);
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
const SAMPLE_HOST = '127.0.0.1';
const jobs: Array<() => Promise<void>> = [];
let workerBusy = false;
const requestsByAddress = new Map<string, number[]>();

function schedule(job: () => Promise<void>): void {
  jobs.push(job);
  void pumpQueue();
}
async function pumpQueue(): Promise<void> {
  if (workerBusy) return;
  const next = jobs.shift();
  if (!next) return;
  workerBusy = true;
  try { await next(); } finally { workerBusy = false; void pumpQueue(); }
}

function canStartScan(address: string): boolean {
  const now = Date.now();
  const fresh = (requestsByAddress.get(address) ?? []).filter((time) => now - time < 60_000);
  if (fresh.length >= 5) { requestsByAddress.set(address, fresh); return false; }
  fresh.push(now);
  requestsByAddress.set(address, fresh);
  return true;
}

function launchScan(options: { url: string; sample?: 'checkout'; previousScanId?: string }, baseUrl: string): ScanResult {
  const id = randomUUID();
  const url = options.sample ? `${baseUrl}/sample/checkout` : options.url;
  const now = new Date().toISOString();
  const scan: ScanResult = {
    id, createdAt: now, updatedAt: now, status: 'queued', inputUrl: safeDisplayUrl(url), canonicalOrigin: new URL(url).origin,
    sample: options.sample, limits: { maxPages: 5, maxDepth: 2, navigationTimeoutMs: 20_000, totalTimeoutMs: 60_000, maxControlsPerPage: 200, maxRequestsPerPage: 300, maxFindingsPerPage: 100 },
    progress: { completedPages: 0, totalPageLimit: 5, message: 'Waiting for a scan worker.' }, pages: [], previousScanId: options.previousScanId,
  };
  scanStore.set(scan);
  schedule(async () => {
    const active = scanStore.get(id);
    if (!active) return;
    try {
      await performScan({ id, url, sample: options.sample, previousScanId: options.previousScanId, onUpdate: (updated) => scanStore.set(updated) });
    } catch (error) {
      scanStore.set({ ...active, status: 'failed', error: { code: 'SCAN_WORKER_FAILED', message: error instanceof Error ? error.message.slice(0, 240) : 'The scan worker could not start.', retryable: true }, updatedAt: new Date().toISOString() });
    }
  });
  return scan;
}

export interface AppOptions { baseUrl?: string; logger?: boolean; }

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ? { level: 'info', serializers: { req: (req) => ({ method: req.method, host: 'local', remoteAddress: req.socket.remoteAddress }) } } : false,
    bodyLimit: 16 * 1024,
    logController: new LogController({ disableRequestLogging: true }),
  });
  const baseUrl = options.baseUrl ?? 'http://127.0.0.1:4317';

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) return reply.code(403).send({ error: { code: 'ORIGIN_BLOCKED', message: 'Requests from this website are not allowed.', retryable: false } });
    if (origin) reply.header('access-control-allow-origin', origin).header('vary', 'Origin');
    if (request.method === 'OPTIONS') return reply.code(204).header('access-control-allow-methods', 'GET,POST,OPTIONS').header('access-control-allow-headers', 'content-type').send();
    const remote = request.ip.replace(/^::ffff:/, '');
    if (remote !== '127.0.0.1' && remote !== '::1') return reply.code(403).send({ error: { code: 'LOCAL_ONLY', message: 'The scanner is available only from this computer.', retryable: false } });
  });

  app.setErrorHandler((error, request, reply) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const statusCode = (err as Error & { statusCode?: number }).statusCode;
    request.log.error({ err: { name: err.name, code: (err as Error & { code?: string }).code } }, 'request failed');
    const status = statusCode && statusCode >= 400 && statusCode < 500 ? statusCode : 500;
    reply.code(status).send({ error: { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message: status === 500 ? 'The request could not be completed.' : err.message, retryable: status >= 500 } });
  });

  await app.register(swagger, {
    openapi: { info: { title: 'AccessRipple API', description: 'Local website scan, evidence graph, comparison, and export API.', version: '1.0.0' }, servers: [{ url: baseUrl }] },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/api/health', async () => ({ status: 'ok', localOnly: true, graphSchemaVersion: '1.0' }));

  app.get('/sample/checkout', async (_request, reply) => reply.type('text/html; charset=utf-8').send(await readFile(resolve(process.cwd(), 'src/sample/site/checkout.html'), 'utf8')));
  app.get('/sample/payment', async (_request, reply) => reply.type('text/html; charset=utf-8').send(await readFile(resolve(process.cwd(), 'src/sample/site/payment.html'), 'utf8')));

  app.post('/api/scans', async (request, reply) => {
    const body = createBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: { code: 'INVALID_SCAN_REQUEST', message: 'Provide either a public website URL or the built-in checkout sample.', retryable: false } });
    if (!canStartScan(request.ip)) return reply.code(429).send({ error: { code: 'SCAN_RATE_LIMIT', message: 'Too many scans were started. Wait a minute and try again.', retryable: true } });
    if ('sample' in body.data) {
      const scan = launchScan({ sample: 'checkout', url: '' }, baseUrl);
      return reply.code(202).send({ scanId: scan.id, status: scan.status, statusUrl: `/api/scans/${scan.id}` });
    }
    let url: URL;
    try { url = await assertSafeUrl(body.data.url); }
    catch (error) {
      const unsafe = error instanceof UnsafeUrlError ? error : new UnsafeUrlError('The website address is not allowed.');
      return reply.code(422).send({ error: { code: unsafe.code, message: unsafe.message, retryable: unsafe.code === 'HOST_NOT_FOUND' } });
    }
    const scan = launchScan({ url: url.toString() }, baseUrl);
    return reply.code(202).send({ scanId: scan.id, status: scan.status, statusUrl: `/api/scans/${scan.id}` });
  });

  app.get<{ Params: { scanId: string } }>('/api/scans/:scanId', async (request, reply) => {
    const scan = scanStore.get(request.params.scanId);
    if (!scan) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable. It may have expired after the service restarted.', retryable: false } });
    return scan;
  });

  app.get<{ Params: { scanId: string } }>('/api/scans/:scanId/graph', async (request, reply) => {
    const scan = scanStore.get(request.params.scanId);
    if (!scan) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable.', retryable: false } });
    if (!scan.graph) return reply.code(409).send({ error: { code: 'GRAPH_NOT_READY', message: 'The graph will be available after scanning finishes.', retryable: true } });
    return scan.graph;
  });

  app.post<{ Params: { scanId: string } }>('/api/scans/:scanId/rescan', async (request, reply) => {
    const previous = scanStore.get(request.params.scanId);
    if (!previous) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable.', retryable: false } });
    if (!canStartScan(request.ip)) return reply.code(429).send({ error: { code: 'SCAN_RATE_LIMIT', message: 'Too many scans were started. Wait a minute and try again.', retryable: true } });
    if (previous.sample) {
      const scan = launchScan({ sample: 'checkout', url: '', previousScanId: previous.id }, baseUrl);
      return reply.code(202).send({ scanId: scan.id, previousScanId: previous.id, status: scan.status, statusUrl: `/api/scans/${scan.id}` });
    }
    let url: URL;
    try { url = await assertSafeUrl(previous.inputUrl); }
    catch {
      return reply.code(422).send({ error: { code: 'URL_NO_LONGER_ALLOWED', message: 'The original address is no longer allowed by the scan safety policy.', retryable: false } });
    }
    const scan = launchScan({ url: url.toString(), previousScanId: previous.id }, baseUrl);
    return reply.code(202).send({ scanId: scan.id, previousScanId: previous.id, status: scan.status, statusUrl: `/api/scans/${scan.id}` });
  });

  app.get<{ Params: { scanId: string; otherScanId: string } }>('/api/scans/:scanId/compare/:otherScanId', async (request, reply) => {
    const current = scanStore.get(request.params.scanId);
    const previous = scanStore.get(request.params.otherScanId);
    if (!current || !previous) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'One of the scans is unavailable.', retryable: false } });
    if (!current.graph || !previous.graph) return reply.code(409).send({ error: { code: 'GRAPH_NOT_READY', message: 'Both scans must finish before comparison.', retryable: true } });
    if (current.canonicalOrigin !== previous.canonicalOrigin) return reply.code(400).send({ error: { code: 'SCAN_ORIGIN_MISMATCH', message: 'Only scans of the same site can be compared.', retryable: false } });
    return compareScans(previous, current);
  });

  app.get<{ Params: { scanId: string } }>('/api/scans/:scanId/export/obsidian', async (request, reply) => {
    const scan = scanStore.get(request.params.scanId);
    if (!scan) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable.', retryable: false } });
    if (!scan.graph) return reply.code(409).send({ error: { code: 'GRAPH_NOT_READY', message: 'The export will be available after scanning finishes.', retryable: true } });
    try {
      const archive = await createObsidianZip(scan);
      return reply.header('content-type', 'application/zip').header('content-disposition', `attachment; filename="accessripple-${scan.id.slice(0, 8)}.zip"`).send(archive);
    } catch (error) {
      request.log.error({ err: { name: (error as Error).name } }, 'export failed');
      return reply.code(500).send({ error: { code: 'EXPORT_FAILED', message: 'The vault could not be prepared. The scan is still available; please retry.', retryable: true } });
    }
  });

  app.get('/', async () => ({ name: 'AccessRipple API', docs: '/docs', health: '/api/health', sample: '/sample/checkout' }));
  return app;
}
