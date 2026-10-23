/**
 * A repair contract.
 *
 * A suggested change is not worth much on its own: a model can write a
 * plausible replacement for a missing image description without ever
 * checking whether it works. So before the change is applied, the model is
 * asked to commit, in writing, to what the change will and will not fix.
 *
 * The browser then checks those commitments against the rescan. A prediction
 * that holds is supported. A prediction that fails is contradicted, and the
 * tool says so rather than hiding it. A prediction about something that was
 * not checked again is unknown, and unknown is never counted as a pass.
 */
import type { GraphNode, ScanResult } from '../graph/schema.js';
import type { SiteGraph } from '../graph/schema.js';
import { matchIssues } from '../graph/compare.js';
import { z } from 'zod';
import { DEFAULT_BASE_URL, requestHeaders } from './briefing.js';

/** What the model expects to be true after the change is applied. */
export type PredictionExpectation = 'absent' | 'present';

/** One commitment the model makes about the result of its own change. */
export interface RepairPrediction {
  /** The id of the finding or signal this prediction is about. */
  issueId: string;
  /** Whether the model expects this to be gone, or to still be there. */
  expected: PredictionExpectation;
  /** The model's reason. A hypothesis, and labelled as one. */
  reason: string;
}

export interface RepairContract {
  predictions: RepairPrediction[];
  model: string;
}

/** What the browser actually recorded when the prediction was checked. */
export type PredictionOutcome = 'supported' | 'contradicted' | 'not rechecked';

export interface CheckedPrediction extends RepairPrediction {
  /** What the model said, in the tool's words. */
  label: string;
  /** What the browser recorded: gone, still there, or not looked at again. */
  observed: PredictionExpectation | 'not rechecked';
  outcome: PredictionOutcome;
  /** True when the page was checked with the change simulated in the scanner's browser, not on the site. */
  simulated?: boolean;
}

const MODEL_TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT = [
  'You commit, in advance, to what a proposed change will and will not fix.',
  'You are given one proposed change and a list of recorded findings and browser signals, each with an id.',
  'Rules you must follow:',
  '1. Predict only for the ids you were given. Never invent an id.',
  '2. For each id, say whether you expect it to be "absent" (the browser will stop reporting it) or "present" (it will still be reported).',
  '3. You must include a prediction for the finding the change targets. You may add at most two more.',
  '4. A change that adds a description does not bring back a missing file. Predict "present" for anything your change does not address, even when it is tempting to predict otherwise.',
  '5. Give a short reason for each prediction. It is a hypothesis, not a guarantee.',
  '6. Reply with JSON only: {"predictions":[{"issueId":"...","expected":"absent","reason":"..."}]}',
].join('\n');

export class ContractError extends Error {
  constructor(message: string, public readonly code: 'NOT_CONFIGURED' | 'REQUEST_FAILED' | 'NO_PREDICTION') {
    super(message);
    this.name = 'ContractError';
  }
}

// The shape a model answer must have. Each prediction is checked on its own,
// so one malformed entry is dropped without losing the others. Only the two
// expectations are allowed, so a model cannot invent a third.
const contractShape = z.object({ predictions: z.array(z.unknown()) });
const predictionShape = z.object({
  issueId: z.union([z.string(), z.number()]).transform((value) => String(value).trim()).pipe(z.string().min(1)),
  expected: z.enum(['absent', 'present']),
  reason: z.unknown().optional().transform((value) => String(value ?? '').trim().slice(0, 240)),
});

/**
 * Read the model's answer. Every prediction must name an id that was given
 * to the model, must use one of the two allowed expectations, and the
 * targeted finding must be covered. Anything else is discarded.
 */
export function parseContract(text: string, allowedIds: string[], targetId: string): RepairPrediction[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  const shape = contractShape.safeParse(parsed);
  if (!shape.success) return [];
  const allowed = new Set(allowedIds);
  const seen = new Set<string>();
  const kept: RepairPrediction[] = [];
  for (const entry of shape.data.predictions) {
    const prediction = predictionShape.safeParse(entry);
    if (!prediction.success) continue;
    const { issueId, expected, reason } = prediction.data;
    if (!allowed.has(issueId) || seen.has(issueId)) continue;
    seen.add(issueId);
    kept.push({ issueId, expected, reason });
  }
  if (!kept.some((prediction) => prediction.issueId === targetId)) return [];
  // Keep the mandatory target even if a model lists it after its side claims.
  return [kept.find((prediction) => prediction.issueId === targetId)!, ...kept.filter((prediction) => prediction.issueId !== targetId)].slice(0, 3);
}

/** The findings and signals on the page the change is aimed at. */
export function issuesOnPage(graph: SiteGraph, pageId: string | undefined): GraphNode[] {
  return graph.nodes.filter((node) => (node.kind === 'accessibility-finding' || node.kind === 'runtime-error') && node.data.ruleId !== 'accessibility-check-incomplete' && node.pageId === pageId);
}

function contractUserPrompt(proposal: { summary: string; before: string; after: string }, targetId: string, issues: GraphNode[]): string {
  const lines = issues.map((node) => `- id=${node.id} | kind=${node.kind} | label=${node.label}`);
  return [
    'The change that is proposed:',
    `summary: ${proposal.summary}`,
    `markup now: ${proposal.before}`,
    `markup after: ${proposal.after}`,
    '',
    `The finding this change targets: id=${targetId}`,
    '',
    'The recorded findings and browser signals on the same page:',
    ...lines,
    '',
    'Predict, for each id above, whether it will be absent or present after this change is applied.',
  ].join('\n');
}

/**
 * Ask the configured model to commit to what its change will achieve.
 * The model chain and its fallbacks are the same ones used for the proposal.
 */
export async function writeRepairContract(
  proposal: { summary: string; before: string; after: string },
  targetId: string,
  issues: GraphNode[],
  config: { model: string; fallbackModels: string[]; key: string; baseUrl?: string; reasoningEffort?: string },
): Promise<RepairContract> {
  const models = [config.model, ...config.fallbackModels].filter(Boolean);
  if (!models.length) throw new ContractError('No model provider is configured.', 'NOT_CONFIGURED');
  const allowedIds = issues.map((node) => node.id);
  let lastError: ContractError = new ContractError('The model did not answer.', 'REQUEST_FAILED');
  for (const model of models) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
      const body: Record<string, unknown> = {
        model,
        temperature: 0,
        // A reasoning model spends its budget thinking before it answers, so a
        // small budget returns no content at all. Same settings as the proposal.
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: contractUserPrompt(proposal, targetId, issues) },
        ],
      };
      if (config.reasoningEffort) body.reasoning = { effort: config.reasoningEffort };
      try {
        const response = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: requestHeaders(config),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) throw new ContractError(response.status === 429 ? 'The model is busy right now. Ask again in a moment.' : `The model returned ${response.status}.`, 'REQUEST_FAILED');
        const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = payload.choices?.[0]?.message?.content ?? '';
        const predictions = parseContract(text, allowedIds, targetId);
        if (!predictions.length) throw new ContractError('The model did not make a usable prediction.', 'NO_PREDICTION');
        return { predictions, model };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      lastError = error instanceof ContractError ? error : new ContractError(error instanceof Error ? error.message : String(error), 'REQUEST_FAILED');
    }
  }
  throw lastError;
}

/**
 * Check the model's commitments against what the browser recorded.
 *
 * A finding that is no longer reported is only "absent" when its page was
 * looked at again. Otherwise it is unknown, and unknown is not a pass.
 */
export function checkPredictions(
  contract: RepairContract,
  previous: ScanResult,
  current: ScanResult,
): CheckedPrediction[] {
  const before = new Map((previous.graph?.nodes ?? []).map((node) => [node.id, node]));
  // The same pairing the comparison uses, so a finding whose path moved is still the same finding.
  const after = matchIssues(previous, current);
  const inspectedBefore = new Set(previous.pages.filter((page) => page.status === 'complete').map((page) => page.id));
  const inspectedAfter = new Set(current.pages.filter((page) => page.status === 'complete').map((page) => page.id));
  const incomplete = (nodes: GraphNode[]) => new Set(nodes.filter((node) => node.kind === 'accessibility-finding' && node.data.ruleId === 'accessibility-check-incomplete' && node.pageId).map((node) => node.pageId as string));
  const checksFailedBefore = incomplete(previous.graph?.nodes ?? []);
  const checksFailedAfter = incomplete(current.graph?.nodes ?? []);

  return contract.predictions.map((prediction) => {
    const node = before.get(prediction.issueId);
    const label = node?.label ?? prediction.issueId;
    const pageId = node?.pageId;
    const rechecked = !node || node.data.ruleId === 'accessibility-check-incomplete' ? false : pageId
      ? inspectedBefore.has(pageId) && inspectedAfter.has(pageId) && !(node?.kind === 'accessibility-finding' && (checksFailedBefore.has(pageId) || checksFailedAfter.has(pageId)))
      : true;
    if (!rechecked) return { ...prediction, label, observed: 'not rechecked' as const, outcome: 'not rechecked' as const };
    const observed: PredictionExpectation = after.has(prediction.issueId) ? 'present' : 'absent';
    const simulated = current.pages.some((page) => page.id === pageId && page.simulatedPatches?.some((patch) => patch.applied));
    return { ...prediction, label, observed, outcome: observed === prediction.expected ? 'supported' as const : 'contradicted' as const, ...(simulated ? { simulated: true } : {}) };
  });
}
