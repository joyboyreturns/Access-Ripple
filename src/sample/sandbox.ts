import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The demo shop sandbox.
 *
 * A proposed change is only worth anything if applying it changes what the
 * scanner observes. So an accepted proposal is applied to an in-memory copy
 * of the tool's own fixture, and the next scan reads that copy. Nothing on
 * disk changes, and nothing outside the fixture can be touched.
 */
export interface AppliedPatch {
  file: string;
  content: string;
  summary: string;
  before: string;
  after: string;
  appliedAt: string;
}

const patches = new Map<string, AppliedPatch>();

/** Only the tool's own fixture may ever be changed. */
export function isDemoFixture(file: string): boolean {
  return /^src\/sample\/site\/[a-z0-9-]+\.html$/.test(file);
}

/**
 * Replace markup in a source file. The browser reports the markup it saw,
 * which may differ from the file only in whitespace, so the match allows for
 * that but for nothing else.
 */
export function replaceMarkup(source: string, before: string, after: string): string | null {
  const found = findMarkup(source, before);
  if (!found) return null;
  return source.slice(0, found.index) + after + source.slice(found.index + found.length);
}

/** Where `before` sits in `source`, allowing for whitespace differences only. */
function findMarkup(source: string, before: string): { index: number; length: number } | null {
  if (!before.trim()) return null;
  const direct = source.indexOf(before);
  if (direct >= 0) return { index: direct, length: before.length };
  const pattern = before.trim().split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const match = new RegExp(pattern).exec(source);
  return match ? { index: match.index, length: match[0].length } : null;
}

const DEMO_SHOP_FILES = ['checkout.html', 'checkout-fixed.html', 'catalog.html', 'cart.html', 'payment.html'];

/**
 * Find the recorded markup in the demo shop's source, so a proposal can point
 * at a real file and line. Only the tool's own fixture is searched, and the
 * copy a scan actually read (patched or not) is the one searched.
 */
export function locateInDemoShop(snippet: string): { file: string; line: number } | undefined {
  if (snippet.replace(/\s+/g, ' ').trim().length < 12) return undefined;
  for (const name of DEMO_SHOP_FILES) {
    const file = `src/sample/site/${name}`;
    const text = patchedContent(file);
    if (text === null) continue;
    const found = findMarkup(text, snippet);
    if (found) return { file, line: text.slice(0, found.index).split('\n').length };
  }
  return undefined;
}

/** The line `markup` starts on in the fixture file on disk, for a diff header. */
export function fixtureLine(file: string, markup: string): number | undefined {
  const source = readFixture(file);
  const found = source === null ? null : findMarkup(source, markup);
  return found ? source!.slice(0, found.index).split('\n').length : undefined;
}

export function readFixture(file: string): string | null {
  if (!isDemoFixture(file)) return null;
  try {
    return readFileSync(resolve(process.cwd(), file), 'utf8');
  } catch {
    return null;
  }
}

/** Apply an accepted proposal to an in-memory copy of the fixture. */
export function applyPatch(file: string, before: string, after: string, summary: string): AppliedPatch | null {
  if (!isDemoFixture(file)) return null;
  const original = readFixture(file);
  if (original === null) return null;
  const source = patches.get(file)?.content ?? original;
  const content = replaceMarkup(source, before, after);
  if (content === null) return null;
  const patch: AppliedPatch = { file, content, summary, before, after, appliedAt: new Date().toISOString() };
  patches.set(file, patch);
  return patch;
}

/** The patched copy of a fixture, or the original when nothing has been applied. */
export function patchedContent(file: string): string | null {
  const patch = patches.get(file);
  if (patch) return patch.content;
  return readFixture(file);
}

export function appliedPatches(): Array<Omit<AppliedPatch, 'content'>> {
  return [...patches.values()].map(({ content, ...rest }) => rest);
}

export function clearPatches(): void {
  patches.clear();
}

/**
 * A change simulated on a live website.
 *
 * The tool never edits a scanned website. What it can do is apply a grounded
 * proposal inside its own disposable browser on the next scan of that page, so
 * the model's prediction can be tested beyond the demo shop. The page the
 * browser then checks is a simulation, and is labelled as one everywhere.
 */
export interface VirtualPatch {
  id: string;
  /** The scan the change was proposed on. */
  scanId: string;
  pageUrl: string;
  ruleId: string;
  /** The finding the change targets. */
  nodeId: string;
  selector: string;
  before: string;
  after: string;
  summary: string;
  appliedAt: string;
}

const virtual = new Map<string, VirtualPatch[]>();

/** Record a change to simulate on the next scan of this page. A second change to the same element replaces the first. */
export function addVirtualPatch(patch: Omit<VirtualPatch, 'id' | 'appliedAt'>): VirtualPatch {
  const entry: VirtualPatch = { ...patch, id: `simulated:${patch.scanId.slice(0, 8)}:${patch.nodeId}`, appliedAt: new Date().toISOString() };
  const list = (virtual.get(patch.scanId) ?? []).filter((item) => item.selector !== patch.selector || item.pageUrl !== patch.pageUrl);
  virtual.set(patch.scanId, [...list, entry]);
  return entry;
}

/** The changes recorded on one scan, which its rescan simulates. */
export function virtualPatchesFor(scanId: string): VirtualPatch[] {
  return virtual.get(scanId) ?? [];
}

export function allVirtualPatches(): VirtualPatch[] {
  return [...virtual.values()].flat();
}

export function clearVirtualPatches(scanId?: string): void {
  if (scanId) virtual.delete(scanId);
  else virtual.clear();
}
