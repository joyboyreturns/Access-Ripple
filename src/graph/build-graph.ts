import { createHash } from 'node:crypto';
import type { AccessibilityEvidence, GraphEdge, GraphNode, InteractionEvidence, InteractionStep, PageEvidence, RuntimeErrorEvidence, ScanResult, SiteGraph } from './schema.js';
import { safeDisplayUrl } from '../scan/url-safety.js';
import { outcomeLabel, summarizeInteraction } from '../scan/interaction.js';

function id(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha1').update(value).digest('hex').slice(0, 14)}`;
}

function lastStep(interaction: InteractionEvidence): InteractionStep | undefined {
  return interaction.steps[interaction.steps.length - 1];
}

function outcomeStatus(outcome: InteractionStep['outcome'] | undefined): GraphNode['status'] {
  if (outcome === 'failed') return 'error';
  if (outcome === 'blocked' || outcome === 'no-visible-change' || outcome === undefined) return 'untested';
  return 'clear';
}

function exclusionLabel(reason: string | undefined): string {
  if (reason === 'requires-authorization') return 'Form control needs your permission to test';
  if (reason === 'consequential-action') return 'Not activated: consequential action';
  return 'Not tested in this scan';
}

/** Describe where an untested link points without exposing raw script or email addresses. */
function linkLabel(target: string): string {
  try {
    const url = new URL(target);
    if (url.protocol === 'javascript:') return 'May run a script on this page';
    if (url.protocol === 'mailto:') return 'May open an email draft';
    if (url.protocol === 'tel:') return 'May start a phone call';
    return `May lead to ${url.pathname || '/'}`;
  } catch {
    return 'May lead to another page';
  }
}

export function buildGraph(scan: ScanResult): SiteGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  // A graph node id has to be unique. Two records that resolve to the same id
  // describe the same thing, so the first one wins and the rest are dropped.
  const seen = new Set<string>();
  const addNode = (node: GraphNode): boolean => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    nodes.push(node);
    return true;
  };
  const origin = scan.canonicalOrigin ?? new URL(scan.inputUrl).origin;
  const siteId = id('site', origin);
  // The built-in demo shop runs on loopback, so name it instead of showing a raw address.
  const siteLabel = scan.sample === 'checkout' ? 'Northstar demo shop' : new URL(origin).hostname;
  addNode({ id: siteId, kind: 'site', label: siteLabel, evidenceLabel: 'observed', data: { origin } });

  const pageIds = new Map<string, string>();
  for (const page of scan.pages) {
    const pageId = id('page', page.url);
    pageIds.set(page.url, pageId);
    addNode({ id: pageId, kind: 'page', label: page.title || new URL(page.url).pathname || '/', status: page.status === 'failed' ? 'error' : 'clear', evidenceLabel: 'observed', pageId, data: { url: page.url, depth: page.depth, status: page.status, errorMessage: page.errorMessage } });
    edges.push({ id: id('edge', `${siteId}|contains|${pageId}`), kind: 'contains', source: siteId, target: pageId, evidenceLabel: 'observed' });
  }

  const addFinding = (page: PageEvidence, finding: AccessibilityEvidence): string => {
    const findingId = id('finding', `${page.url}|${finding.ruleId}|${finding.targets.join(',')}`);
    const pageId = pageIds.get(page.url)!;
    addNode({ id: findingId, kind: 'accessibility-finding', label: finding.help, status: finding.status === 'detected' ? 'detected' : 'needs-review', evidenceLabel: 'observed', pageId: page.id, data: { ...finding, snippet: finding.snippet?.slice(0, 220) } });
    edges.push({ id: id('edge', `${pageId}|has-finding|${findingId}`), kind: 'has-finding', source: pageId, target: findingId, evidenceLabel: 'observed' });
    for (const controlId of finding.affectedControlIds ?? []) {
      if (!page.controls.some(control => control.id === controlId)) continue;
      edges.push({ id:id('edge', `${controlId}|has-finding|${findingId}`), kind:'has-finding', source:controlId, target:findingId, evidenceLabel:'observed' });
    }
    return findingId;
  };

  const errorIds = new Set<string>();
  const addErrorNode = (page: PageEvidence, error: RuntimeErrorEvidence): void => {
    if (errorIds.has(error.id)) return;
    errorIds.add(error.id);
    const pageId = pageIds.get(page.url)!;
    addNode({ id: error.id, kind: 'runtime-error', label: error.message.slice(0, 100), status: 'error', evidenceLabel: 'observed', pageId: page.id, data: { ...error, url: error.url ? safeDisplayUrl(error.url) : undefined } });
    edges.push({ id: id('edge', `${pageId}|has-error|${error.id}`), kind: error.kind === 'request' || error.kind === 'http' ? 'failed-at' : 'has-error', source: pageId, target: error.id, evidenceLabel: 'observed' });
  };

  for (const page of scan.pages) {
    const pageId = pageIds.get(page.url)!;
    for (const control of page.controls) {
      const controlId = control.id;
      const interaction = page.interactions.find((item) => item.rootControlId === controlId);
      const exclusion = page.interactionExclusions?.find((item) => item.controlId === controlId);
      const step = interaction ? lastStep(interaction) : undefined;
      const interactionData = interaction
        ? { tested: true, outcome: step?.outcome, summary: summarizeInteraction(interaction.steps).slice(0, 220) }
        : exclusion ? { tested: false, reason: exclusion.reason } : undefined;
      const status = interaction ? outcomeStatus(step?.outcome) : control.href || control.formAction ? 'clear' : 'untested';
      addNode({ id: controlId, kind: 'control', label: control.accessibleName || control.role, status, evidenceLabel: 'observed', pageId: page.id, data: { ...control, href: control.href ? safeDisplayUrl(control.href) : undefined, formAction: control.formAction ? safeDisplayUrl(control.formAction) : undefined, interaction: interactionData } });
      edges.push({ id: id('edge', `${pageId}|has-control|${controlId}`), kind: 'has-control', source: pageId, target: controlId, evidenceLabel: 'observed' });
      if (interaction) continue;
      const target = control.href || control.formAction;
      if (target) {
        let targetUrl: string;
        try { targetUrl = safeDisplayUrl(new URL(target, page.url).toString()); } catch { continue; }
        const flowId = id('flow', `${controlId}|${targetUrl}`);
        addNode({ id: flowId, kind: 'flow', label: linkLabel(targetUrl), status: 'untested', evidenceLabel: control.href ? 'inferred' : 'untested', pageId: page.id, data: { sourceControlId: controlId, sourceUrl: page.url, destinationUrl: targetUrl, outcome: 'not-tested', reason: exclusion?.reason } });
        edges.push({ id: id('edge', `${controlId}|may-lead-to|${flowId}`), kind: 'may-lead-to', source: controlId, target: flowId, evidenceLabel: control.href ? 'inferred' : 'untested' });
        const destinationPage = pageIds.get(targetUrl);
        if (destinationPage) edges.push({ id: id('edge', `${flowId}|links-to|${destinationPage}`), kind: 'links-to', source: flowId, target: destinationPage, evidenceLabel: 'inferred' });
      } else if (exclusion) {
        const flowId = id('flow', `${controlId}|not-tested`);
        addNode({ id: flowId, kind: 'flow', label: exclusionLabel(exclusion.reason), status: 'untested', evidenceLabel: 'untested', pageId: page.id, data: { sourceControlId: controlId, sourceUrl: page.url, outcome: 'not-tested', reason: exclusion.reason } });
        edges.push({ id: id('edge', `${controlId}|may-lead-to|${flowId}`), kind: 'may-lead-to', source: controlId, target: flowId, evidenceLabel: 'untested' });
      }
    }

    // Observed interactions replace inference: the control was activated and its outcome recorded.
    for (const interaction of page.interactions) {
      const control = page.controls.find((item) => item.id === interaction.rootControlId);
      if (!control) continue;
      const step = lastStep(interaction);
      if (!step) continue;
      const flowId = id('flow', `${interaction.rootControlId}|observed|${step.outcome}`);
      const attributionIds = [...new Set(interaction.steps.flatMap((item) => item.errorIds))];
      const destinationUrl = step.destinationUrl ?? interaction.steps[0]?.destinationUrl;
      addNode({
        id: flowId, kind: 'flow', label: outcomeLabel(step), status: outcomeStatus(step.outcome), evidenceLabel: 'observed', pageId: page.id,
        data: {
          sourceControlId: interaction.rootControlId,
          sourceUrl: page.url,
          outcome: step.outcome,
          destinationUrl,
          summary: summarizeInteraction(interaction.steps),
          steps: interaction.steps,
          mode: interaction.mode,
          tested: true,
          errorIds: attributionIds,
        },
      });
      edges.push({ id: id('edge', `${interaction.rootControlId}|may-lead-to|${flowId}`), kind: 'may-lead-to', source: interaction.rootControlId, target: flowId, evidenceLabel: 'observed' });
      const destinationPage = destinationUrl ? pageIds.get(destinationUrl) : undefined;
      if (destinationPage) edges.push({ id: id('edge', `${flowId}|links-to|${destinationPage}`), kind: 'links-to', source: flowId, target: destinationPage, evidenceLabel: 'observed' });
      for (const errorId of attributionIds) {
        edges.push({ id: id('edge', `${flowId}|failed-at|${errorId}`), kind: 'failed-at', source: flowId, target: errorId, evidenceLabel: 'observed' });
      }
    }

    for (const error of new Map(page.errors.map((item) => [item.id, item])).values()) addErrorNode(page, error);
    for (const finding of page.findings) addFinding(page, finding);
  }

  // Keep untested paths connected to errors observed on their destination page.
  // The relationship remains inferred because the control was not activated.
  for (const flow of nodes.filter((node) => node.kind === 'flow' && node.data.tested !== true)) {
    const destinationUrl = flow.data.destinationUrl;
    if (typeof destinationUrl !== 'string') continue;
    const destinationPage = scan.pages.find((page) => page.url === destinationUrl);
    if (!destinationPage) continue;
    for (const error of nodes.filter((node) => node.kind === 'runtime-error' && node.pageId === destinationPage.id)) {
      edges.push({ id: id('edge', `${flow.id}|failed-at|${error.id}`), kind: 'failed-at', source: flow.id, target: error.id, evidenceLabel: 'inferred' });
    }
  }

  return { schemaVersion: '1.0', nodes, edges };
}
