import { describe as suite, it, expect } from 'vitest';
import { scanStory } from '../../web/src/presentation.js';
import type { ScanResult, SiteGraph } from '../../web/src/types.js';

const refusedScan = (): ScanResult => ({
  id: 's1', status: 'partial', inputUrl: 'https://stackoverflow.com/',
  progress: { completedPages: 0, totalPageLimit: 5, message: 'done' },
  pages: [{ id: 'p1', url: 'https://stackoverflow.com/', title: 'Just a moment...', status: 'skipped', findings: [], controls: [] }],
  interactionPolicy: { mode: 'safe', tested: 0, skipped: 0 },
  coverage: { pagesInspected: 0, pagesBlocked: 1, pagesFailed: 0, destinationsNotReached: 0, destinationsBeyondDepth: 0, stoppedBy: null, interactionsTested: 0, interactionsSkipped: 0 },
});

const emptyGraph: SiteGraph = { schemaVersion: '1.0', nodes: [{ id: 'site:1', kind: 'site', label: 'stackoverflow.com', evidenceLabel: 'observed', data: {} }], edges: [] };

suite('a site that refuses the scanner', () => {
  it('is not reported as an inspected site', () => {
    const story = scanStory(refusedScan(), emptyGraph);
    expect(story.headline).toContain('refused the automated browser');
    expect(story.headline).not.toContain('inspected 0 pages');
    expect(story.detail).toContain('challenge page');
  });

  it('does not claim it found nothing when it never looked', () => {
    const story = scanStory(refusedScan(), emptyGraph);
    expect(story.headline).not.toContain('found no accessibility');
  });
});
