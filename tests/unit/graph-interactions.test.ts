import { describe, expect, it } from 'vitest';
import { buildExplorerScene, explainEdge, explorerFacets, explorerNodeColor } from '../../web/src/graph-explorer.js';
import { traceJourney } from '../../web/src/presentation.js';
import type { GraphEdge, GraphNode, SiteGraph } from '../../web/src/types.js';

const node = (id: string, kind: GraphNode['kind'], data: Record<string, unknown> = {}, pageId?: string): GraphNode => ({ id, kind, label: id, evidenceLabel: 'observed', data, ...(pageId ? { pageId } : {}) });
const edge = (source: string, target: string, kind = 'has-finding', evidenceLabel: GraphEdge['evidenceLabel'] = 'observed'): GraphEdge => ({ id: `${source}/${kind}/${target}`, source, target, kind, evidenceLabel });
const graph = (nodes: GraphNode[], edges: GraphEdge[] = []): SiteGraph => ({ schemaVersion: '1.0', nodes, edges });
const site = node('site', 'site');
const home = node('home', 'page', { url: 'https://example.com/' });
const checkout = node('checkout', 'page', { url: 'https://example.com/checkout' });
const finding = (id: string, impact = 'serious', pageId = 'checkout', ruleId = 'label') => node(id, 'accessibility-finding', { ruleId, impact, targets: [`#${id}`], tags: ['wcag2a'] }, pageId);
const ids = (scene: ReturnType<typeof buildExplorerScene>) => scene.nodes.map(item => item.id);

describe('graph exploration filters and evidence context', () => {
  it('combines page, severity, rule and query filters while retaining only recorded context', () => {
    const target = finding('email');
    const g = graph([site, home, checkout, target, finding('phone', 'minor'), finding('name', 'serious', 'home')], [edge('site', 'checkout', 'contains'), edge('checkout', 'email'), edge('checkout', 'phone')]);
    const result = buildExplorerScene(g, { kind: 'issues', pageId: 'checkout', severity: 'serious', category: 'label', query: '#EMAIL' });
    expect(ids(result)).toEqual(['site', 'checkout', 'email']);
    expect(result.matchedCount).toBe(1);
    expect(result.edges.map(item => [item.source, item.target])).toEqual([['site', 'checkout'], ['checkout', 'email']]);
    expect(result.hiddenCount).toBe(0);
    expect(buildExplorerScene(g, { category: 'wcag2a', query: '#phone' }).matchedCount).toBe(1);
  });

  it('treats no matching findings as empty, rather than showing all pages as matches', () => {
    const g = graph([site, home, checkout, finding('email')]);
    const result = buildExplorerScene(g, { severity: 'critical' });
    expect(ids(result)).toEqual(['site']);
    expect(result.matchedCount).toBe(0);
    expect(buildExplorerScene(g, { severity: 'info' }).matchedCount).toBe(0);
    expect(buildExplorerScene(graph([])).nodes).toEqual([]);
  });

  it('searches controls and flows from the overview while respecting an explicit kind filter', () => {
    const g = graph([site, home, node('Search button', 'control', {}, 'home'), node('Search result', 'flow', {}, 'home')]);
    expect(ids(buildExplorerScene(g, { query: 'search' }))).toEqual(['site', 'home', 'Search button', 'Search result']);
    expect(ids(buildExplorerScene(g, { query: 'search', kind: 'controls' }))).toEqual(['site', 'home', 'Search button']);
  });

  it('resolves a missing page id using an existing ownership edge, without attaching disconnected evidence', () => {
    const owned = finding('owned'); delete owned.pageId;
    const disconnected = finding('disconnected'); delete disconnected.pageId;
    const g = graph([site, home, owned, disconnected], [edge('home', 'owned')]);
    expect(ids(buildExplorerScene(g, { pageId: 'home' }))).toEqual(['site', 'home', 'owned']);
    const result = buildExplorerScene(g, { query: 'disconnected' });
    expect(ids(result)).toEqual(['site', 'disconnected']);
    expect(result.edges).toEqual([]);
  });

  it('keeps a selected late node and focuses its actual neighborhood before applying the display cap', () => {
    const controls = Array.from({ length: 150 }, (_, i) => node(`control-${i}`, 'control', { selector: `#c${i}` }, 'home'));
    const flow = node('last-outcome', 'flow', { tested: true }, 'home');
    const g = graph([site, home, ...controls, flow], [...controls.map(item => edge('home', item.id, 'has-control')), edge('control-149', flow.id, 'may-lead-to')]);
    expect(ids(buildExplorerScene(g, { kind: 'controls', selectedId: 'control-149', limit: 5 }))).toContain('control-149');
    const focused = buildExplorerScene(g, { focusId: 'control-149', selectedId: 'control-149', limit: 5 });
    expect(ids(focused)).toEqual(['site', 'home', 'control-149', 'last-outcome']);
    expect(focused.edges).toHaveLength(2);
  });

  it('gives high-severity findings space before lower-severity findings without reordering retained points', () => {
    const low = Array.from({ length: 80 }, (_, i) => finding(`low-${i}`, 'minor', 'home', `rule-${i}`));
    const critical = finding('critical-last', 'critical', 'home');
    const result = buildExplorerScene(graph([site, home, ...low, critical]), { limit: 4 });
    expect(ids(result)).toEqual(['site', 'home', 'low-0', 'critical-last']);
    expect(result.hiddenCount).toBe(79);
  });
});

describe('group expansion and incomplete graph defense', () => {
  it('expands and collapses repeated findings without mutating the scan or losing endpoint mappings', () => {
    const first = finding('first'), second = finding('second');
    const g = graph([site, checkout, first, second], [edge('site', 'checkout', 'contains'), edge('checkout', 'first'), edge('checkout', 'second')]);
    const original = JSON.stringify(g);
    const collapsed = buildExplorerScene(g, { selectedId: 'second' });
    expect(collapsed.nodes.find(item => item.id === 'first')?.memberIds).toEqual(['first', 'second']);
    expect(collapsed.groupedCount).toBe(1);
    expect(collapsed.edges).toHaveLength(2);
    const expanded = buildExplorerScene(g, { expandedGroupIds: ['first'] });
    expect(ids(expanded)).toEqual(['site', 'checkout', 'first', 'second']);
    expect(expanded.nodes.find(item => item.id === 'second')?.data.expandedGroupId).toBe('first');
    expect(expanded.groupedCount).toBe(0);
    expect(expanded.edges).toHaveLength(3);
    expect(JSON.stringify(g)).toBe(original);
  });

  it('does not merge different severity, status or provenance into a misleading representative', () => {
    const review = { ...finding('review'), status: 'needs-review' as const };
    const inferred = { ...finding('inferred'), evidenceLabel: 'inferred' as const };
    const result = buildExplorerScene(graph([site, checkout, finding('serious'), finding('minor', 'minor'), review, inferred]));
    expect(result.nodes).toHaveLength(6);
    expect(result.groupedCount).toBe(0);
  });

  it('drops duplicate node ids, dangling edges and self-loops while preserving contradictory provenance', () => {
    const first = finding('first');
    const duplicate = { ...first, label: 'wrong duplicate' };
    const g = graph([site, checkout, first, duplicate], [edge('checkout', 'first'), edge('checkout', 'first'), edge('checkout', 'first', 'has-finding', 'inferred'), edge('missing', 'first'), edge('first', 'first')]);
    const result = buildExplorerScene(g);
    expect(ids(result)).toEqual(['site', 'checkout', 'first']);
    expect(result.nodes.find(item => item.id === 'first')?.label).toBe('first');
    expect(result.edges).toHaveLength(2);
    expect(new Set(result.edges.map(item => item.id)).size).toBe(2);
    expect(result.edges.map(item => item.evidenceLabel)).toEqual(['observed', 'inferred']);
  });

  it('handles incomplete evidence data and invalid display bounds without crashing', () => {
    const missingData = { ...finding('unknown'), data: null } as unknown as GraphNode;
    const g = graph([site, checkout, missingData]);
    expect(buildExplorerScene(g, { query: 'unknown', limit: NaN }).matchedCount).toBe(1);
    expect(buildExplorerScene(g, { limit: -100 }).nodes).toHaveLength(1);
  });

  it('keeps unchecked checks visible as coverage while excluding them from finding filters and categories', () => {
    const unchecked = finding('unchecked', 'info', 'home', 'accessibility-check-incomplete');
    const g = graph([site, home, unchecked], [edge('home', 'unchecked')]);
    expect(ids(buildExplorerScene(g))).toContain('unchecked');
    expect(buildExplorerScene(g, { kind: 'issues' }).matchedCount).toBe(0);
    expect(buildExplorerScene(g, { severity: 'info' }).matchedCount).toBe(0);
    expect(explorerFacets(g).categories).toEqual([]);
    expect(explainEdge(g.edges[0]!, g).explanation).toContain('coverage gap, not a detected barrier');
  });
});

describe('relationship explanations and visual states', () => {
  const control = node('Continue', 'control');
  const flow = node('Navigation', 'flow');
  const signal = node('404', 'runtime-error', { statusCode: 404 });
  const g = graph([site, home, checkout, control, flow, signal, finding('email')]);

  it('distinguishes observed navigation, inferred destinations and unchecked actions', () => {
    const observed = explainEdge(edge('Navigation', 'checkout', 'links-to'), g);
    expect(observed.explanation).toContain('browser recorded navigation');
    expect(observed.explanation).toContain('complete visitor task were not tested');
    expect(observed.evidence).toBe('observed');
    const inferred = explainEdge(edge('Continue', 'Navigation', 'may-lead-to', 'inferred'), g);
    expect(inferred.explanation).toContain('derived from page markup');
    expect(inferred.explanation).toContain('does not show a completed user journey');
    expect(explainEdge(edge('Continue', 'Navigation', 'may-lead-to', 'untested'), g).explanation).toContain('not tested');
  });

  it('explains ownership, detection and diagnostic attribution without inventing causal impact', () => {
    expect(explainEdge(edge('home', 'Continue', 'has-control'), g).explanation).toContain('does not mean its behavior was tested');
    expect(explainEdge(edge('checkout', 'email'), g).explanation).toContain('effect on task completion still needs a human check');
    expect(explainEdge(edge('Navigation', '404', 'failed-at'), g).explanation).toContain('does not by itself prove');
    expect(explainEdge(edge('home', '404', 'has-error'), g).explanation).toContain('diagnostic signal alone');
    expect(explainEdge(edge('site', 'home', 'contains'), g).explanation).toContain('coverage');
    expect(explainEdge(edge('missing', 'home', 'contains'), g).explanation).toContain('endpoint is missing');
  });

  it('encodes severity and uncertainty without coloring an inspected page as a passed accessibility test', () => {
    expect(explorerNodeColor(finding('critical', 'critical'))).not.toBe(explorerNodeColor(finding('minor', 'minor')));
    expect(explorerNodeColor({ ...finding('review'), status: 'needs-review' })).toBe('#98adbb');
    expect(explorerNodeColor({ ...home, data: { status: 'skipped' } })).toBe('#98adbb');
    expect(explorerNodeColor({ ...home, data: { ruleId: 'accessibility-check-incomplete' } })).toBe('#98adbb');
    expect(explorerNodeColor(home)).toBe('#b5a5f5');
  });

  it('exposes real rule categories and severity values in stable menu order', () => {
    const facets = explorerFacets(graph([home, checkout, finding('minor', 'minor'), finding('critical', 'critical'), signal]));
    expect(facets.pages.map(item => item.id)).toEqual(['home', 'checkout']);
    expect(facets.severities).toEqual(['critical', 'minor', 'diagnostic']);
    expect(facets.categories).toEqual([{ id: 'label', label: 'Unlabeled form field' }]);
  });
});

describe('journey observation branches', () => {
  it('connects findings on the selected control and destination while excluding unrelated starting-page evidence', () => {
    const control = node('continue', 'control', {}, 'home');
    const flow = node('navigation', 'flow', { tested: true, steps: [{ controlId: 'continue', label: 'Continue', action: 'click', outcome: 'navigated', summary: 'Navigated to checkout.', destinationUrl: 'https://example.com/checkout', errorIds: [] }] }, 'home');
    const exact = finding('control-label', 'serious', 'home');
    const destination = finding('destination-label');
    const unrelated = finding('unrelated', 'minor', 'home');
    const g = graph([site, home, checkout, control, flow, exact, destination, unrelated], [
      edge('home', 'continue', 'has-control'), edge('continue', 'navigation', 'may-lead-to'), edge('navigation', 'checkout', 'links-to'),
      edge('home', exact.id), edge('continue', exact.id), edge('checkout', destination.id), edge('home', unrelated.id),
    ]);
    const journey = traceJourney(g, 'continue')!;
    expect(journey.findings.map(item => item.node.id)).toEqual(['control-label', 'destination-label']);
    expect(journey.edges.some(item => item.source === 'continue' && item.target === exact.id)).toBe(true);
    expect(journey.edges.some(item => item.source === 'checkout' && item.target === destination.id)).toBe(true);
    expect(journey.edges.some(item => item.target === unrelated.id)).toBe(false);
    expect(journey.edges.some(item => item.source === 'home' && item.target === exact.id)).toBe(false);
  });
});

describe('bounded scenes at realistic and stress-test sizes', () => {
  it.each([12, 400, 3000])('keeps a %i-node dense/disconnected dataset bounded, deterministic and internally valid', count => {
    const controls = Array.from({ length: count }, (_, i) => node(`control-${i}`, 'control', { selector: `#c${i}` }, i % 7 === 0 ? undefined : 'home'));
    const connections: GraphEdge[] = [];
    for (let i = 0; i < controls.length; i++) {
      // Every seventh point is disconnected. Others have dense local edges,
      // repeated records, an observed edge and a distinct inferred edge.
      if (i % 7 === 0) continue;
      connections.push(edge('home', controls[i]!.id, 'has-control'));
      for (let j = Math.max(0, i - 5); j < i; j++) if (j % 7 !== 0) connections.push(edge(controls[j]!.id, controls[i]!.id, 'related', 'inferred'));
      connections.push(edge('home', controls[i]!.id, 'has-control'));
    }
    connections.push(edge('absent', 'home'));
    const g = graph([site, home, ...controls], connections);
    const started = performance.now();
    const result = buildExplorerScene(g, { kind: 'controls', selectedId: controls.at(-1)!.id, limit: 60 });
    const elapsed = performance.now() - started;
    expect(result.nodes.length).toBeLessThanOrEqual(60);
    expect(ids(result)).toContain(controls.at(-1)!.id);
    const visible = new Set(ids(result));
    expect(result.edges.every(item => visible.has(item.source) && visible.has(item.target))).toBe(true);
    expect(new Set(result.edges.map(item => item.id)).size).toBe(result.edges.length);
    expect(buildExplorerScene(g, { kind: 'controls', selectedId: controls.at(-1)!.id, limit: 60 })).toEqual(result);
    // This is a generous regression guard for accidental per-node edge scans,
    // not a claim about browser animation or all hardware configurations.
    expect(elapsed).toBeLessThan(2500);
  });
});
