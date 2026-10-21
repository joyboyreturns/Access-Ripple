import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { RepairContract } from '../ai/contract.js';

/**
 * The commitments a model made about a scan.
 *
 * They are kept on this computer so a restart does not lose them. Without
 * them the rescan would have nothing to check the prediction against, and
 * the whole point of the prediction would be lost halfway through.
 */
const FILE = 'contracts.json';

function contractPath(): string {
  const base = process.env.ACCESSRIPPLE_DATA_DIR ? resolve(process.env.ACCESSRIPPLE_DATA_DIR) : resolve(process.cwd(), '.data');
  return join(base, FILE);
}

async function readAll(): Promise<Record<string, RepairContract>> {
  try {
    return JSON.parse(await readFile(contractPath(), 'utf8')) as Record<string, RepairContract>;
  } catch {
    return {};
  }
}

export const contractStore = {
  async get(key: string): Promise<RepairContract | undefined> {
    return (await readAll())[key];
  },
  async all(): Promise<Record<string, RepairContract>> {
    return readAll();
  },
  async set(key: string, contract: RepairContract): Promise<void> {
    try {
      const all = await readAll();
      all[key] = contract;
      await mkdir(resolve(contractPath(), '..'), { recursive: true });
      await writeFile(contractPath(), JSON.stringify(all));
    } catch { /* Best-effort. A lost contract only means an unchecked prediction. */ }
  },
};
