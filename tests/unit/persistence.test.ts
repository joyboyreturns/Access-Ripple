import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diskStore, summarizeScan } from '../../src/store/disk.js';
import type { ScanResult } from '../../src/graph/schema.js';

function scan(id: string, createdAt: string): ScanResult {
  return {
    id, createdAt, updatedAt: createdAt, status: 'complete', inputUrl: 'https://shop.example/', canonicalOrigin: 'https://shop.example',
    limits: { maxPages: 5, maxDepth: 2, navigationTimeoutMs: 20_000, totalTimeoutMs: 60_000, maxControlsPerPage: 200, maxRequestsPerPage: 300, maxFindingsPerPage: 100, maxInteractionsPerPage: 4, maxInteractionsPerScan: 10 },
    progress: { completedPages: 1, totalPageLimit: 5, message: 'done' },
    pages: [{ id: 'p1', url: 'https://shop.example/', title: 'Shop', status: 'complete', depth: 0, controls: [], errors: [], findings: [], outgoingLinks: [], interactions: [] }],
    interactionPolicy: { mode: 'safe', tested: 2, skipped: 1 },
  };
}

const uuidFor = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;

describe('local scan history', () => {
  let dir: string;
  beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'accessripple-history-')); process.env.ACCESSRIPPLE_DATA_DIR = dir; });
  afterAll(async () => { delete process.env.ACCESSRIPPLE_DATA_DIR; await rm(dir, { recursive: true, force: true }); });

  it('saves, lists, and reloads a finished scan with a compact summary', async () => {
    const saved = scan(uuidFor(1), '2026-10-19T10:00:00.000Z');
    await diskStore.save(saved);
    const loaded = await diskStore.load(saved.id);
    expect(loaded?.id).toBe(saved.id);
    expect(loaded?.pages).toHaveLength(1);
    const summaries = await diskStore.list();
    expect(summaries[0]).toMatchObject({ id: saved.id, pages: 1, actionsTested: 2, status: 'complete' });
    expect(summarizeScan(saved)).toEqual(summaries[0]);
  });

  it('refuses malformed identifiers and skips unreadable files', async () => {
    expect(await diskStore.load('../../etc/hosts')).toBeUndefined();
    expect(await diskStore.load('not-a-uuid')).toBeUndefined();
    await writeFile(join(dir, 'scans', 'broken.json'), 'not json at all');
    const summaries = await diskStore.list();
    expect(summaries.some((item) => item.id === 'broken')).toBe(false);
  });

  it('keeps the newest scans and prunes the rest', async () => {
    for (let index = 0; index < 27; index++) {
      const minute = String(index).padStart(2, '0');
      await diskStore.save(scan(uuidFor(100 + index), `2026-09-01T10:${minute}:00.000Z`));
    }
    const summaries = await diskStore.list();
    expect(summaries).toHaveLength(25);
    expect(summaries[0]!.id).toBe(uuidFor(1));
    expect(summaries[1]!.createdAt).toBe('2026-09-01T10:26:00.000Z');
    expect(await diskStore.load(uuidFor(100))).toBeUndefined();
    expect(await diskStore.load(uuidFor(102))).toBeUndefined();
    expect(await diskStore.load(uuidFor(103))).toBeDefined();
    expect(await diskStore.load(uuidFor(126))).toBeDefined();
  });
});
