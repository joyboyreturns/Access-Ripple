import type { ScanResult } from '../graph/schema.js';

const MAX_SCANS = 20;
const scans = new Map<string, ScanResult>();

export const scanStore = {
  get(id: string): ScanResult | undefined {
    return scans.get(id);
  },
  set(scan: ScanResult): void {
    scans.set(scan.id, scan);
    while (scans.size > MAX_SCANS) {
      const oldest = [...scans.values()].find((item) => item.status !== 'queued' && item.status !== 'running');
      if (!oldest) break;
      scans.delete(oldest.id);
    }
  },
  list(): ScanResult[] {
    return [...scans.values()];
  },
  clear(): void {
    scans.clear();
  },
};
