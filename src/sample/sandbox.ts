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
  if (!before.trim()) return null;
  const direct = source.indexOf(before);
  if (direct >= 0) return source.slice(0, direct) + after + source.slice(direct + before.length);
  const pattern = before.trim().split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const match = new RegExp(pattern).exec(source);
  if (!match) return null;
  return source.slice(0, match.index) + after + source.slice(match.index + match[0].length);
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
