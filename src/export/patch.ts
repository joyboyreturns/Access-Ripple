import { unifiedDiff } from '../ai/fix.js';
import type { CheckedPrediction } from '../ai/contract.js';
import { fixtureLine, type AppliedPatch, type VirtualPatch } from '../sample/sandbox.js';

export interface PatchExport {
  patch: string;
  markdown: string;
}

const outcomeWord: Record<CheckedPrediction['outcome'], string> = { supported: 'held', contradicted: 'failed', 'not rechecked': 'unknown' };

/** A path a diff header can carry for a page on a live site. */
function pagePath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === '/' ? '/index.html' : parsed.pathname}`;
  } catch {
    return 'page.html';
  }
}

/**
 * Every accepted change as one unified diff, and a summary a person can paste
 * into a pull request. Changes to the demo shop are real edits to its
 * fixture; changes to a live site were only simulated in the scanner's
 * browser, and the summary says so, because the site's own source was never
 * read and the diff is against the markup the browser recorded.
 */
export function buildPatchExport(input: { fixture: Array<Omit<AppliedPatch, 'content'>>; simulated: VirtualPatch[]; outcomes: CheckedPrediction[] }): PatchExport {
  const diffs = [
    ...input.fixture.map((patch) => unifiedDiff(patch.file, patch.before, patch.after, fixtureLine(patch.file, patch.before))),
    ...input.simulated.map((patch) => unifiedDiff(pagePath(patch.pageUrl), patch.before, patch.after)),
  ];
  const lines = ['# Accessibility changes from AccessRipple', ''];
  if (!input.fixture.length && !input.simulated.length) lines.push('No change has been accepted yet.', '');
  if (input.fixture.length) {
    lines.push('## Applied to the demo shop', '');
    for (const patch of input.fixture) lines.push(`- **${patch.summary}** — \`${patch.file}\``);
    lines.push('');
  }
  if (input.simulated.length) {
    lines.push('## Simulated on a live site', '', 'These changes were applied only inside the scanner\'s own browser, to test the model\'s prediction. The site was not changed. Make each change in the site\'s source, where the markup may differ from what the browser recorded.', '');
    for (const patch of input.simulated) lines.push(`- **${patch.summary}** — \`${patch.selector}\` on ${patch.pageUrl}`);
    lines.push('');
  }
  if (input.outcomes.length) {
    lines.push('## What the model committed to, and what the browser recorded', '', '| Finding | Model said | Browser recorded | Verdict |', '| --- | --- | --- | --- |');
    for (const outcome of input.outcomes) {
      const said = outcome.expected === 'absent' ? 'gone' : 'still there';
      const seen = outcome.observed === 'not rechecked' ? 'not checked again' : outcome.observed === 'absent' ? 'gone' : 'still there';
      lines.push(`| ${outcome.label.replace(/\|/g, '\\|')} | ${said} | ${seen}${outcome.simulated ? ' (simulated)' : ''} | ${outcomeWord[outcome.outcome]} |`);
    }
    lines.push('', 'A prediction about a page that was not checked again is unknown, and unknown is never a pass.', '');
  }
  if (diffs.length) lines.push('## Diff', '', '```diff', ...diffs.map((diff) => diff.trimEnd()), '```', '');
  return { patch: diffs.join(''), markdown: lines.join('\n') };
}
