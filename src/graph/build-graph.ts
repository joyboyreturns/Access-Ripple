import { createHash } from 'node:crypto';
import type { AccessibilityEvidence, GraphEdge, GraphNode, PageEvidence, ScanResult, SiteGraph } from './schema.js';
import { safeDisplayUrl } from '../scan/url-safety.js';

function id(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha1').update(value).digest('hex').slice(0, 14)}`;
}

export function buildGraph(scan: ScanResult): SiteGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const origin = scan.canonicalOrigin ?? new URL(scan.inputUrl).origin;
  const siteId = id('site', origin);
  nodes.push({ id: siteId, kind: 'site', label: new URL(origin).hostname, evidenceLabel: 'observed', data: { origin } });

  const pageIds = new Map<string, string>();
  for (const page of scan.pages) {
    const pageId = id('page', page.url);
    pageIds.set(page.url, pageId);
    nodes.push({ id: pageId, kind: 'page', label: page.title || new URL(page.url).pathname || '/', status: page.status === 'failed' ? 'error' : 'clear', evidenceLabel: 'observed', pageId, data: { url: page.url, depth: page.depth, status: page.status, errorMessage: page.errorMessage } });
    edges.push({ id: id('edge', `${siteId}|contains|${pageId}`), kind: 'contains', source: siteId, target: pageId, evidenceLabel: 'observed' });
  }

  const addFinding = (page: PageEvidence, finding: AccessibilityEvidence): string => {
    const findingId = id('finding', `${page.url}|${finding.ruleId}|${finding.targets.join(',')}`);
    nodes.push({ id: findingId, kind: 'accessibility-finding', label: finding.help, status: finding.status === 'detected' ? 'detected' : 'needs-review', evidenceLabel: 'observed', pageId: page.id, data: { ...finding, snippet: finding.snippet?.slice(0, 220) } });
    const pageId = pageIds.get(page.url)!;
    edges.push({ id: id('edge', `${pageId}|has-finding|${findingId}`), kind: 'has-finding', source: pageId, target: findingId, evidenceLabel: 'observed' });
    for (const controlId of finding.affectedControlIds ?? []) {
      if (!page.controls.some(control => control.id === controlId)) continue;
      edges.push({ id:id('edge', `${controlId}|has-finding|${findingId}`), kind:'has-finding', source:controlId, target:findingId, evidenceLabel:'observed' });
    }
    return findingId;
  };

  for (const page of scan.pages) {
    const pageId = pageIds.get(page.url)!;
    for (const control of page.controls) {
      const controlId = control.id;
      nodes.push({ id: controlId, kind: 'control', label: control.accessibleName || control.role, status: control.href || control.formAction ? 'clear' : 'untested', evidenceLabel: 'observed', pageId: page.id, data: { ...control, href: control.href ? safeDisplayUrl(control.href) : undefined, formAction: control.formAction ? safeDisplayUrl(control.formAction) : undefined } });
      edges.push({ id: id('edge', `${pageId}|has-control|${controlId}`), kind: 'has-control', source: pageId, target: controlId, evidenceLabel: 'observed' });
      const target = control.href || control.formAction;
      if (target) {
        let targetUrl: string;
        try { targetUrl = safeDisplayUrl(new URL(target, page.url).toString()); } catch { continue; }
        const flowId = id('flow', `${controlId}|${targetUrl}`);
        nodes.push({ id: flowId, kind: 'flow', label: `May lead to ${new URL(targetUrl).pathname || '/'}`, status: 'untested', evidenceLabel: control.href ? 'inferred' : 'untested', pageId: page.id, data: { sourceControlId: controlId, sourceUrl: page.url, destinationUrl: targetUrl, outcome: 'destination-not-activated' } });
        edges.push({ id: id('edge', `${controlId}|may-lead-to|${flowId}`), kind: 'may-lead-to', source: controlId, target: flowId, evidenceLabel: control.href ? 'inferred' : 'untested' });
        const destinationPage = pageIds.get(targetUrl);
        if (destinationPage) edges.push({ id: id('edge', `${flowId}|links-to|${destinationPage}`), kind: 'links-to', source: flowId, target: destinationPage, evidenceLabel: 'inferred' });
      }
    }
    for (const error of new Map(page.errors.map((item) => [item.id, item])).values()) {
      const errorId = error.id;
      nodes.push({ id: errorId, kind: 'runtime-error', label: error.message.slice(0, 100), status: 'error', evidenceLabel: 'observed', pageId: page.id, data: { ...error, url: error.url ? safeDisplayUrl(error.url) : undefined } });
      edges.push({ id: id('edge', `${pageId}|has-error|${errorId}`), kind: error.kind === 'request' || error.kind === 'http' ? 'failed-at' : 'has-error', source: pageId, target: errorId, evidenceLabel: 'observed' });
    }
    for (const finding of page.findings) addFinding(page, finding);
  }

  // Keep the clickable path connected to errors observed on its destination page.
  // The relationship remains inferred because the external control was not activated.
  for (const flow of nodes.filter((node) => node.kind === 'flow')) {
    const destinationUrl = flow.data.destinationUrl;
    if (typeof destinationUrl !== 'string') continue;
    const destinationPageId = pageIds.get(destinationUrl);
    if (!destinationPageId) continue;
    for (const error of nodes.filter((node) => node.kind === 'runtime-error' && node.pageId === destinationPageId)) {
      edges.push({ id: id('edge', `${flow.id}|failed-at|${error.id}`), kind: 'failed-at', source: flow.id, target: error.id, evidenceLabel: 'inferred' });
    }
  }

  return { schemaVersion: '1.0', nodes, edges };
}
