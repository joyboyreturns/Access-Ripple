import Fastify, { LogController, type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertSafeUrl, safeDisplayUrl, UnsafeUrlError } from '../scan/url-safety.js';
import { aiStatus, BriefingError, readAiConfig, writeBriefing } from '../ai/briefing.js';
import { readFixConfig, writeFixProposal } from '../ai/fix.js';
import { addVirtualPatch, allVirtualPatches, appliedPatches, applyPatch, clearPatches, clearVirtualPatches, isDemoFixture, locateInDemoShop, patchedContent, virtualPatchesFor } from '../sample/sandbox.js';
import { checkPredictions, issuesOnPage, writeRepairContract, type CheckedPrediction, type RepairContract } from '../ai/contract.js';
import { buildPatchExport } from '../export/patch.js';
import { contractStore } from '../store/contracts.js';
import { performScan, DEFAULT_LIMITS } from '../scan/worker.js';
import { scanStore } from '../store/memory.js';
import { diskStore, summarizeScan, type ScanSummary } from '../store/disk.js';
import { compareScans } from '../graph/compare.js';
import { createObsidianZip } from '../export/obsidian.js';
import type { InteractionMode, ScanResult } from '../graph/schema.js';

const createBody = z.union([
  z.object({ url: z.string().min(1).max(2048), authorizeSubmit: z.boolean().optional(), allowPrivateNetwork: z.boolean().optional() }).strict(),
  z.object({ sample: z.literal('checkout'), authorizeSubmit: z.boolean().optional(), allowPrivateNetwork: z.boolean().optional() }).strict(),
]);
const rescanBody = z.object({ authorizeSubmit: z.boolean().optional(), allowPrivateNetwork: z.boolean().optional() }).strict();
const fixBody = z.object({ nodeId: z.string().min(1).max(200) }).strict();
// The contracts a model committed to, kept per scan and finding so the
// rescan can check them. They are written to this computer as well, so a
// restart does not lose a prediction that is waiting to be checked.
const contractKey = (scanId: string, nodeId: string) => `${scanId}:${nodeId}`;
const lastProposals = new Map<string, { summary: string; before: string; after: string }>();
const contractsFor = async (scanId: string): Promise<RepairContract[]> => {
  const all = await contractStore.all();
  return Object.entries(all).filter(([key]) => key.startsWith(`${scanId}:`)).map(([, contract]) => contract);
};
const applyBody = z.object({ file: z.string().min(1).max(200), before: z.string().min(1).max(4000), after: z.string().min(1).max(4000), summary: z.string().max(300).optional() }).strict();
const sampleStateBody = z.object({ variant: z.enum(['before', 'after']) }).strict();
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const SAMPLE_HOST = '127.0.0.1';
const jobs: Array<() => Promise<void>> = [];
let workerBusy = false;

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

function canStartScan(address: string, requestsByAddress: Map<string, number[]>): boolean {
  const now = Date.now();
  const fresh = (requestsByAddress.get(address) ?? []).filter((time) => now - time < 60_000);
  if (fresh.length >= 5) { requestsByAddress.set(address, fresh); return false; }
  fresh.push(now);
  requestsByAddress.set(address, fresh);
  return true;
}

/**
 * The changes a rescan of `previous` simulates: the ones it already carried,
 * and the ones accepted on it since. A later change to the same element wins.
 */
function simulationsFor(previous: ScanResult): NonNullable<ScanResult['simulatedPatches']> {
  const merged = new Map<string, NonNullable<ScanResult['simulatedPatches']>[number]>();
  for (const patch of [...(previous.simulatedPatches ?? []), ...virtualPatchesFor(previous.id)]) merged.set(`${patch.pageUrl}|${patch.selector}`, patch);
  return [...merged.values()];
}

function launchScan(options: { url: string; sample?: 'checkout'; previousScanId?: string; interactionMode?: InteractionMode; allowPrivateNetwork?: boolean; simulatedPatches?: ScanResult['simulatedPatches'] }, baseUrl: string): ScanResult {
  const id = randomUUID();
  const url = options.sample ? `${baseUrl}/sample/checkout` : options.url;
  const now = new Date().toISOString();
  const mode: InteractionMode = options.interactionMode ?? 'safe';
  const scan: ScanResult = {
    id, createdAt: now, updatedAt: now, status: 'queued', inputUrl: safeDisplayUrl(url), canonicalOrigin: new URL(url).origin,
    sample: options.sample, limits: { ...DEFAULT_LIMITS },
    progress: { completedPages: 0, totalPageLimit: DEFAULT_LIMITS.maxPages, message: 'Waiting for a scan worker.' }, pages: [], previousScanId: options.previousScanId,
    interactionPolicy: { mode, tested: 0, skipped: 0 },
    addressScope: options.allowPrivateNetwork ? 'private' : 'public',
    simulatedPatches: options.simulatedPatches?.length ? options.simulatedPatches : undefined,
  };
  scanStore.set(scan);
  schedule(async () => {
    const active = scanStore.get(id);
    if (!active) return;
    try {
      await performScan({ id, url, sample: options.sample, previousScanId: options.previousScanId, interactionMode: mode, allowPrivateNetwork: options.allowPrivateNetwork, simulatedPatches: options.simulatedPatches, onUpdate: (updated) => scanStore.set(updated) });
    } catch (error) {
      scanStore.set({ ...active, status: 'failed', error: { code: 'SCAN_WORKER_FAILED', message: error instanceof Error ? error.message.slice(0, 240) : 'The scan worker could not start.', retryable: true }, updatedAt: new Date().toISOString() });
    } finally {
      const finished = scanStore.get(id);
      if (finished && finished.status !== 'queued' && finished.status !== 'running') await diskStore.save(finished);
    }
  });
  return scan;
}

/** Read a scan from memory, falling back to this computer's saved history. */
async function getScan(id: string): Promise<ScanResult | undefined> {
  const inMemory = scanStore.get(id);
  if (inMemory) return inMemory;
  const loaded = await diskStore.load(id);
  if (loaded) scanStore.set(loaded);
  return loaded;
}

export interface AppOptions { baseUrl?: string; logger?: boolean; }

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const requestsByAddress = new Map<string, number[]>();
  const app = Fastify({
    logger: options.logger ? { level: 'info', serializers: { req: (req) => ({ method: req.method, host: 'local', remoteAddress: req.socket.remoteAddress }) } } : false,
    bodyLimit: 16 * 1024,
    logController: new LogController({ disableRequestLogging: true }),
  });
  const baseUrl = options.baseUrl ?? 'http://127.0.0.1:4317';
  // The studio is served from the development server in development, and from
  // this same address once it has been built. Both are allowed.
  const allowedOrigins = new Set(DEFAULT_ORIGINS);
  try { allowedOrigins.add(new URL(baseUrl).origin); } catch { /* The base address is not a URL. */ }
  // The checkout sample ships in two states so you can demo a real before/after repair loop.
  let sampleVariant: 'before' | 'after' = 'before';

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

  // The optional AI briefing. It is off unless a provider key is configured,
  // and the deterministic scan story always remains available without one.
  app.get('/api/ai/status', async () => aiStatus());

  // The proof: the newest comparison this computer has on record. It is a
  // property of the saved history rather than of the open tab, so a fresh
  // window can open straight on it.
  app.get('/api/proof', async (_request, reply) => {
    const memory = scanStore.list().map(summarizeScan);
    const disk = await diskStore.list();
    const merged = new Map<string, ScanSummary>();
    for (const item of [...disk, ...memory]) merged.set(item.id, item);
    const candidates = [...merged.values()]
      .filter((item) => item.previousScanId && item.status !== 'failed' && item.status !== 'queued' && item.status !== 'running')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    let fallback: { comparison: ReturnType<typeof compareScans>; currentScanId: string; previousScanId: string } | undefined;
    for (const candidate of candidates) {
      const current = await getScan(candidate.id);
      const previous = await getScan(candidate.previousScanId!);
      if (!current?.graph || !previous?.graph) continue;
      if (current.canonicalOrigin !== previous.canonicalOrigin) continue;
      const comparison = compareScans(previous, current);
      // Any prediction the model made about the earlier scan is checked here
      // too, so the proof carries the verdicts as well as the counts.
      const predictions = (await contractsFor(previous.id)).map((contract) => checkPredictions(contract, previous, current)).flat();
      const withPredictions = { ...comparison, predictions };
      // A comparison that actually shows a repair is the one worth opening,
      // and one that carries the model's own verdict is worth more still.
      if (comparison.resolved.length && predictions.length) return { comparison: withPredictions, currentScanId: current.id, previousScanId: previous.id };
      if (comparison.resolved.length) return { comparison: withPredictions, currentScanId: current.id, previousScanId: previous.id };
      fallback = { comparison: withPredictions, currentScanId: current.id, previousScanId: previous.id };
    }
    if (fallback) return fallback;
    return reply.code(404).send({ error: { code: 'NO_PROOF_YET', message: 'No repair has been compared on this computer yet.', retryable: false } });
  });

  app.post<{ Params: { scanId: string } }>('/api/scans/:scanId/briefing', async (request, reply) => {
    const scan = await getScan(request.params.scanId);
    if (!scan) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable.', retryable: false } });
    if (!scan.graph) return reply.code(409).send({ error: { code: 'GRAPH_NOT_READY', message: 'The briefing will be available after scanning finishes.', retryable: true } });
    const config = readAiConfig();
    if (!config) return reply.code(503).send({ error: { code: 'AI_NOT_CONFIGURED', message: 'No model provider is configured. The scan summary is still shown above.', retryable: false } });
    try {
      const briefing = await writeBriefing(scan, scan.graph, config);
      return { ...briefing, source: 'ai' as const };
    } catch (error) {
      const code = error instanceof BriefingError ? error.code : 'REQUEST_FAILED';
      request.log.warn({ err: { code } }, 'briefing failed');
      return reply.code(code === 'NO_GROUNDED_SENTENCE' ? 502 : 502).send({ error: { code: 'BRIEFING_FAILED', message: error instanceof Error ? error.message : 'The briefing could not be written.', retryable: true } });
    }
  });

  // The checkout sample can switch between its "before" and "fixed" states so a rescan
  // compares a real repair on a site you control. Everything else stays identical.
  app.get('/api/sample/state', async () => ({ variant: sampleVariant }));

  // Describes the built-in demo site so the studio can offer it without a network address.
  app.get('/api/sample/info', async () => ({
    id: 'checkout' as const,
    name: 'Northstar demo shop',
    tagline: 'A four-page checkout flow that ships with a real accessibility fault and a real 404.',
    url: `${baseUrl}/sample/checkout`,
    variant: sampleVariant,
    // A change accepted in the studio is still applied, so the demo shop is
    // not yet in its broken state and the interface has to say so.
    patched: appliedPatches().length > 0,
    brokenNote: 'The product image has no text alternative and its file is missing.',
    fixedNote: 'The product image loads and carries a text alternative.',
  }));

  app.post('/api/sample/state', async (request, reply) => {
    const body = sampleStateBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: { code: 'INVALID_SAMPLE_STATE', message: "Provide { \"variant\": 'before' } or { \"variant\": 'after' }.", retryable: false } });
    sampleVariant = body.data.variant;
    return { variant: sampleVariant };
  });

  app.get('/sample/checkout', async (_request, reply) => {
    // A patched demo shop is served instead of the file on disk, so the next
    // scan reads the change that was actually accepted.
    const file = `src/sample/site/${sampleVariant === 'after' ? 'checkout-fixed.html' : 'checkout.html'}`;
    const patched = patchedContent(file);
    if (patched !== null) return reply.type('text/html; charset=utf-8').send(patched);
    return reply.type('text/html; charset=utf-8').send(await readFile(resolve(process.cwd(), file), 'utf8'));
  });
  app.get('/sample/product.svg', async (_request, reply) => reply.type('image/svg+xml').send(await readFile(resolve(process.cwd(), 'src/sample/site/product.svg'), 'utf8')));
  for (const name of ['payment', 'catalog', 'cart']) {
    app.get(`/sample/${name}`, async (_request, reply) => reply.type('text/html; charset=utf-8').send(patchedContent(`src/sample/site/${name}.html`)));
  }

  app.post('/api/scans', async (request, reply) => {
    const body = createBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: { code: 'INVALID_SCAN_REQUEST', message: 'Provide either a public website URL or the built-in checkout sample.', retryable: false } });
    // The limit protects other people's websites from being hammered. The demo
    // shop is this tool's own page on this computer, and a rehearsal that scans
    // it five times in a minute must not end a recording on an error.
    if (!('sample' in body.data) && !canStartScan(request.ip, requestsByAddress)) return reply.code(429).send({ error: { code: 'SCAN_RATE_LIMIT', message: 'Too many scans were started. Wait a minute and try again.', retryable: true } });
    const interactionMode: InteractionMode = body.data.authorizeSubmit === true ? 'include-submits' : 'safe';
    const allowPrivateNetwork = body.data.allowPrivateNetwork === true;
    if ('sample' in body.data) {
      const scan = launchScan({ sample: 'checkout', url: '', interactionMode, allowPrivateNetwork }, baseUrl);
      return reply.code(202).send({ scanId: scan.id, status: scan.status, statusUrl: `/api/scans/${scan.id}` });
    }
    let url: URL;
    try { url = await assertSafeUrl(body.data.url, { allowPrivateNetwork }); }
    catch (error) {
      const unsafe = error instanceof UnsafeUrlError ? error : new UnsafeUrlError('The website address is not allowed.');
      return reply.code(422).send({ error: { code: unsafe.code, message: unsafe.message, retryable: unsafe.code === 'HOST_NOT_FOUND' } });
    }
    const scan = launchScan({ url: url.toString(), interactionMode, allowPrivateNetwork }, baseUrl);
    return reply.code(202).send({ scanId: scan.id, status: scan.status, statusUrl: `/api/scans/${scan.id}` });
  });

  app.get('/api/scans', async () => {
    const memory = scanStore.list().map(summarizeScan);
    const disk = await diskStore.list();
    const merged = new Map<string, ScanSummary>();
    for (const item of [...disk, ...memory]) merged.set(item.id, item);
    const scans = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
    return { scans };
  });

  app.get<{ Params: { scanId: string } }>('/api/scans/:scanId', async (request, reply) => {
    const scan = await getScan(request.params.scanId);
    if (!scan) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable. It may have been removed from the local history.', retryable: false } });
    return scan;
  });

  app.get<{ Params: { scanId: string } }>('/api/scans/:scanId/graph', async (request, reply) => {
    const scan = await getScan(request.params.scanId);
    if (!scan) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable.', retryable: false } });
    if (!scan.graph) return reply.code(409).send({ error: { code: 'GRAPH_NOT_READY', message: 'The graph will be available after scanning finishes.', retryable: true } });
    return scan.graph;
  });

  app.post<{ Params: { scanId: string } }>('/api/scans/:scanId/rescan', async (request, reply) => {
    const previous = await getScan(request.params.scanId);
    if (!previous) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable.', retryable: false } });
    const body = rescanBody.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: { code: 'INVALID_RESCAN_REQUEST', message: 'The rescan request could not be read.', retryable: false } });
    if (!previous.sample && !canStartScan(request.ip, requestsByAddress)) return reply.code(429).send({ error: { code: 'SCAN_RATE_LIMIT', message: 'Too many scans were started. Wait a minute and try again.', retryable: true } });
    const interactionMode: InteractionMode = body.data.authorizeSubmit === true ? 'include-submits'
      : body.data.authorizeSubmit === false ? 'safe'
      : previous.interactionPolicy?.mode ?? 'safe';
    // A rescan of a private address keeps the permission that address needed.
    const allowPrivateNetwork = body.data.allowPrivateNetwork === true ? true
      : body.data.allowPrivateNetwork === false ? false
      : previous.addressScope === 'private';
    if (previous.sample) {
      const scan = launchScan({ sample: 'checkout', url: '', previousScanId: previous.id, interactionMode, allowPrivateNetwork }, baseUrl);
      return reply.code(202).send({ scanId: scan.id, previousScanId: previous.id, status: scan.status, statusUrl: `/api/scans/${scan.id}` });
    }
    let url: URL;
    try { url = await assertSafeUrl(previous.inputUrl, { allowPrivateNetwork }); }
    catch {
      return reply.code(422).send({ error: { code: 'URL_NO_LONGER_ALLOWED', message: 'The original address is no longer allowed by the scan safety policy.', retryable: false } });
    }
    // A change accepted on a live site is simulated in the scanner's browser on
    // this rescan, and on every rescan after it, so the prediction can be checked.
    const scan = launchScan({ url: url.toString(), previousScanId: previous.id, interactionMode, allowPrivateNetwork, simulatedPatches: simulationsFor(previous) }, baseUrl);
    return reply.code(202).send({ scanId: scan.id, previousScanId: previous.id, status: scan.status, statusUrl: `/api/scans/${scan.id}`, simulatedPatches: scan.simulatedPatches?.length ?? 0 });
  });

  app.post<{ Params: { scanId: string } }>('/api/scans/:scanId/fix', async (request, reply) => {
    const scan = await getScan(request.params.scanId);
    if (!scan) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable.', retryable: false } });
    if (!scan.graph) return reply.code(409).send({ error: { code: 'GRAPH_NOT_READY', message: 'A change can only be proposed after the scan finishes.', retryable: true } });
    const body = fixBody.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: { code: 'INVALID_FIX_REQUEST', message: 'Provide the id of an accessibility finding.', retryable: false } });
    const config = readFixConfig();
    if (!config) return reply.code(503).send({ error: { code: 'AI_NOT_CONFIGURED', message: 'No model provider is configured. The suggested change is still shown without a model.', retryable: false } });
    try {
      const proposal = await writeFixProposal(scan, scan.graph, body.data.nodeId, config, scan.sample ? locateInDemoShop : () => undefined);
      // Kept so the prediction can be about this exact change.
      lastProposals.set(contractKey(request.params.scanId, body.data.nodeId), proposal);
      return proposal;
    } catch (error) {
      const code = error instanceof BriefingError ? error.code : 'REQUEST_FAILED';
      request.log.warn({ err: { code } }, 'fix proposal failed');
      return reply.code(502).send({ error: { code: 'FIX_PROPOSAL_FAILED', message: error instanceof Error ? error.message : 'A change could not be proposed.', retryable: true } });
    }
  });

  // The model commits, in advance, to what its change will and will not fix.
  // The browser checks those commitments against the rescan afterwards.
  app.post<{ Params: { scanId: string } }>('/api/scans/:scanId/contract', async (request, reply) => {
    const scan = await getScan(request.params.scanId);
    if (!scan) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable.', retryable: false } });
    if (!scan.graph) return reply.code(409).send({ error: { code: 'GRAPH_NOT_READY', message: 'A change can only be proposed after the scan finishes.', retryable: true } });
    const body = fixBody.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: { code: 'INVALID_CONTRACT_REQUEST', message: 'Provide the id of an accessibility finding.', retryable: false } });
    const config = readFixConfig();
    if (!config) return reply.code(503).send({ error: { code: 'AI_NOT_CONFIGURED', message: 'No model provider is configured, so there is no prediction to check.', retryable: false } });
    const target = scan.graph.nodes.find((node) => node.id === body.data.nodeId);
    if (!target || target.kind !== 'accessibility-finding') return reply.code(400).send({ error: { code: 'NOT_A_FINDING', message: 'That point is not an accessibility finding.', retryable: false } });
    // The change the model proposed, so the prediction is about that change.
    const proposal = lastProposals.get(contractKey(request.params.scanId, body.data.nodeId));
    if (!proposal) return reply.code(409).send({ error: { code: 'NO_PROPOSAL', message: 'Ask for a proposed change first, so the prediction is about it.', retryable: true } });
    try {
      const contract = await writeRepairContract(proposal, body.data.nodeId, issuesOnPage(scan.graph, target.pageId), { model: config.model, fallbackModels: config.fallbackModels, key: config.key, baseUrl: config.baseUrl, reasoningEffort: config.reasoningEffort });
      await contractStore.set(contractKey(request.params.scanId, body.data.nodeId), contract);
      return contract;
    } catch (error) {
      request.log.warn({ err: { code: error instanceof Error ? error.name : 'unknown' } }, 'repair contract failed');
      return reply.code(502).send({ error: { code: 'CONTRACT_FAILED', message: error instanceof Error ? error.message : 'The model did not make a prediction.', retryable: true } });
    }
  });

  // Applying an accepted proposal. Only the tool's own fixture may change,
  // and only in memory, so the next scan can measure the change.
  app.post('/api/sample/apply', async (request, reply) => {
    const body = applyBody.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: { code: 'INVALID_APPLY_REQUEST', message: 'Provide the file, the original markup, and the replacement.', retryable: false } });
    const { file, before, after, summary } = body.data;
    if (!isDemoFixture(file)) return reply.code(403).send({ error: { code: 'FIXTURE_ONLY', message: 'Only the built-in demo shop can be changed by the tool.', retryable: false } });
    const patch = applyPatch(file, before, after, summary ?? 'A change that was accepted in the studio.');
    if (!patch) return reply.code(422).send({ error: { code: 'PATCH_DOES_NOT_APPLY', message: 'The recorded markup was not found in that file, so the change was not applied.', retryable: false } });
    return { applied: true, file: patch.file, summary: patch.summary, before: patch.before, after: patch.after, appliedAt: patch.appliedAt };
  });

  app.get('/api/sample/patches', async () => ({ patches: appliedPatches() }));

  // On a live site the tool cannot and does not change anything. An accepted
  // proposal is recorded so the next rescan applies it inside the scanner's
  // own browser, and every page checked that way is labelled as simulated.
  app.post<{ Params: { scanId: string } }>('/api/scans/:scanId/simulate', async (request, reply) => {
    const scan = await getScan(request.params.scanId);
    if (!scan) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'This scan is unavailable.', retryable: false } });
    if (scan.sample) return reply.code(409).send({ error: { code: 'USE_DEMO_SHOP_APPLY', message: 'The demo shop changes for real. Apply the change to the demo shop instead.', retryable: false } });
    const body = fixBody.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: { code: 'INVALID_SIMULATE_REQUEST', message: 'Provide the id of an accessibility finding.', retryable: false } });
    const target = scan.graph?.nodes.find((node) => node.id === body.data.nodeId);
    if (!target || target.kind !== 'accessibility-finding') return reply.code(400).send({ error: { code: 'NOT_A_FINDING', message: 'That point is not an accessibility finding.', retryable: false } });
    const proposal = lastProposals.get(contractKey(scan.id, body.data.nodeId));
    if (!proposal) return reply.code(409).send({ error: { code: 'NO_PROPOSAL', message: 'Ask for a proposed change first, so there is something to simulate.', retryable: true } });
    const snippet = typeof target.data.snippet === 'string' ? target.data.snippet : '';
    const selector = Array.isArray(target.data.targets) && target.data.targets.length === 1 ? String(target.data.targets[0]) : '';
    const page = scan.pages.find((item) => item.id === target.pageId);
    if (!selector || !page) return reply.code(422).send({ error: { code: 'NOT_SIMULATABLE', message: 'This finding has no single element to change, so the change cannot be simulated.', retryable: false } });
    // The recorded markup is cut at 400 characters. A change grounded in a cut
    // copy could drop the rest of the element, so it is refused.
    if (snippet.length >= 400) return reply.code(422).send({ error: { code: 'MARKUP_TRUNCATED', message: 'The recorded markup was cut short, so the change cannot be simulated safely.', retryable: false } });
    const patch = addVirtualPatch({ scanId: scan.id, pageUrl: page.url, ruleId: String(target.data.ruleId ?? ''), nodeId: target.id, selector, before: proposal.before, after: proposal.after, summary: proposal.summary });
    return { simulated: true, patch, note: 'The next rescan applies this change inside the scanner\'s browser only. The site is not changed.' };
  });

  app.post<{ Params: { scanId: string } }>('/api/scans/:scanId/simulate/reset', async (request) => {
    clearVirtualPatches(request.params.scanId);
    return { reset: true };
  });

  // Every accepted change as a unified diff, or as a pull request summary
  // with what the model committed to and what the browser recorded.
  app.get<{ Querystring: { format?: string } }>('/api/applied-fixes/patch', async (request, reply) => {
    const scans = scanStore.list();
    const outcomes: CheckedPrediction[] = [];
    for (const [key, contract] of Object.entries(await contractStore.all())) {
      const scanId = key.split(':')[0]!;
      const previous = scans.find((scan) => scan.id === scanId);
      const rescan = scans.filter((scan) => scan.previousScanId === scanId && scan.graph).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (previous?.graph && rescan) outcomes.push(...checkPredictions(contract, previous, rescan));
    }
    const result = buildPatchExport({ fixture: appliedPatches(), simulated: allVirtualPatches(), outcomes });
    if (request.query.format === 'markdown') return reply.type('text/markdown; charset=utf-8').header('content-disposition', 'attachment; filename="accessripple-changes.md"').send(result.markdown);
    return reply.type('text/x-patch; charset=utf-8').header('content-disposition', 'attachment; filename="accessripple-changes.patch"').send(result.patch);
  });

  app.post('/api/sample/reset', async () => {
    clearPatches();
    return { reset: true };
  });

  app.get<{ Params: { scanId: string; otherScanId: string } }>('/api/scans/:scanId/compare/:otherScanId', async (request, reply) => {
    const current = await getScan(request.params.scanId);
    const previous = await getScan(request.params.otherScanId);
    if (!current || !previous) return reply.code(404).send({ error: { code: 'SCAN_NOT_FOUND', message: 'One of the scans is unavailable.', retryable: false } });
    if (!current.graph || !previous.graph) return reply.code(409).send({ error: { code: 'GRAPH_NOT_READY', message: 'Both scans must finish before comparison.', retryable: true } });
    if (current.canonicalOrigin !== previous.canonicalOrigin) return reply.code(400).send({ error: { code: 'SCAN_ORIGIN_MISMATCH', message: 'Only scans of the same site can be compared.', retryable: false } });
    const comparison = compareScans(previous, current);
    // Any prediction the model made about this scan is now checked against
    // what the browser actually recorded.
    const checked = (await contractsFor(previous.id)).map((contract) => checkPredictions(contract, previous, current)).flat();
    return { ...comparison, predictions: checked };
  });

  app.get<{ Params: { scanId: string } }>('/api/scans/:scanId/export/obsidian', async (request, reply) => {
    const scan = await getScan(request.params.scanId);
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

  // When the studio has been built, serve it from this same address, so one
  // command gives a working application rather than an API with no interface.
  const webRoot = resolve(process.cwd(), 'dist/web');
  const studioBuilt = existsSync(join(webRoot, 'index.html'));
  if (studioBuilt) {
    await app.register(fastifyStatic, { root: webRoot, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/sample') || request.url.startsWith('/docs')) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'That address does not exist.', retryable: false } });
      }
      return reply.type('text/html; charset=utf-8').send(readFileSync(join(webRoot, 'index.html')));
    });
  } else {
    app.get('/', async () => ({ name: 'AccessRipple API', docs: '/docs', health: '/api/health', sample: '/sample/checkout' }));
  }
  return app;
}
