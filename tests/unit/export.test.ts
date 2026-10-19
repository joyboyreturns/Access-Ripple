import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createObsidianZip } from '../../src/export/obsidian.js';
import { buildGraph } from '../../src/graph/build-graph.js';
import type { ScanResult } from '../../src/graph/schema.js';

const scan: ScanResult = {
  id: 'export-scan', createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z', status: 'complete', inputUrl: 'https://shop.example/', canonicalOrigin: 'https://shop.example',
  limits: { maxPages: 5, maxDepth: 2, navigationTimeoutMs: 20_000, totalTimeoutMs: 60_000, maxControlsPerPage: 200, maxRequestsPerPage: 300, maxFindingsPerPage: 100, maxInteractionsPerPage: 4, maxInteractionsPerScan: 10 }, progress: { completedPages: 1, totalPageLimit: 5, message: 'done' }, pages: [{ id: 'page1', url: 'https://shop.example/', title: 'Shop', status: 'complete', depth: 0, controls: [], errors: [], findings: [], outgoingLinks: [], interactions: [] }],
};

describe('Obsidian export', () => {
  it('creates linked notes plus machine-readable graph data', async () => {
    scan.graph = buildGraph(scan);
    const buffer = await createObsidianZip(scan);
    const zip = await JSZip.loadAsync(buffer);
    const start = await zip.file('AccessRipple Vault/AccessRipple Start.md')!.async('string');
    expect(start).toContain('[[Shop|Shop]]');
    expect(zip.file('AccessRipple Vault/graph.json')).toBeTruthy();
    expect(Object.keys(zip.files).some((name) => name.endsWith('.md') && name !== 'AccessRipple Vault/AccessRipple Start.md')).toBe(true);
  });
});
