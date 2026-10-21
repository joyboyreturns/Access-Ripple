import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ScanResult } from '../graph/schema.js';

/**
 * Best-effort local persistence so scans survive a service restart.
 * Files stay on this computer; the scanner remains local-only.
 */
const MAX_PERSISTED = 25;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function scanDirectory(): string {
  const base = process.env.ACCESSRIPPLE_DATA_DIR ? resolve(process.env.ACCESSRIPPLE_DATA_DIR) : resolve(process.cwd(), '.data');
  return join(base, 'scans');
}

function scanPath(id: string): string | null {
  if (!UUID.test(id)) return null;
  return join(scanDirectory(), `${id}.json`);
}

export interface ScanSummary {
  id: string;
  inputUrl: string;
  status: string;
  createdAt: string;
  sample?: string;
  previousScanId?: string;
  pages: number;
  actionsTested: number;
  addressScope?: 'public' | 'private';
}

export function summarizeScan(scan: ScanResult): ScanSummary {
  return {
    id: scan.id,
    inputUrl: scan.inputUrl,
    status: scan.status,
    createdAt: scan.createdAt,
    sample: scan.sample,
    previousScanId: scan.previousScanId,
    pages: scan.pages?.length ?? 0,
    actionsTested: scan.interactionPolicy?.tested ?? 0,
    addressScope: scan.addressScope,
  };
}

async function allSummaries(): Promise<ScanSummary[]> {
  let files: string[];
  try { files = (await readdir(scanDirectory())).filter((file) => file.endsWith('.json')); }
  catch { return []; }
  const items: ScanSummary[] = [];
  for (const file of files) {
    try {
      const scan = JSON.parse(await readFile(join(scanDirectory(), file), 'utf8')) as ScanResult;
      if (scan?.id) items.push(summarizeScan(scan));
    } catch { /* Skip unreadable files; they do not block history. */ }
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const diskStore = {
  async save(scan: ScanResult): Promise<void> {
    const path = scanPath(scan.id);
    if (!path) return;
    try {
      await mkdir(scanDirectory(), { recursive: true });
      await writeFile(path, JSON.stringify(scan));
      await this.prune();
    } catch { /* Persistence is best-effort; the in-memory scan stays available. */ }
  },
  async load(id: string): Promise<ScanResult | undefined> {
    const path = scanPath(id);
    if (!path) return undefined;
    try { return JSON.parse(await readFile(path, 'utf8')) as ScanResult; }
    catch { return undefined; }
  },
  async list(): Promise<ScanSummary[]> {
    return (await allSummaries()).slice(0, MAX_PERSISTED);
  },
  async prune(): Promise<void> {
    const items = await allSummaries();
    const keep = new Set(items.slice(0, MAX_PERSISTED).map((item) => item.id));
    // A comparison needs both scans. The earlier partner of a scan that is
    // kept is kept too, or the before-and-after proof can never be made
    // again for a repair that was recorded.
    for (const item of items.slice(0, MAX_PERSISTED)) {
      const scan = await this.load(item.id);
      if (scan?.previousScanId) keep.add(scan.previousScanId);
    }
    for (const item of items) {
      if (keep.has(item.id)) continue;
      const path = scanPath(item.id);
      if (path) await unlink(path).catch(() => undefined);
    }
  },
};
