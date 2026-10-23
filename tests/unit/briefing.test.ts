import { describe as suite, it, expect } from 'vitest';
import { buildDigest, groundSentences, readAiConfig, aiStatus, requestHeaders } from '../../src/ai/briefing.js';
import type { ScanResult, SiteGraph } from '../../src/graph/schema.js';

const graph: SiteGraph = {
  schemaVersion: '1.0',
  nodes: [
    { id: 'site:1', kind: 'site', label: 'Northstar demo shop', evidenceLabel: 'observed', data: {} },
    { id: 'page:1', kind: 'page', label: 'Northstar · Secure checkout', evidenceLabel: 'observed', data: { url: 'http://127.0.0.1:4317/sample/checkout' } },
    { id: 'finding:1', kind: 'accessibility-finding', label: 'Images must have alternative text', status: 'detected', pageId: 'page:1', evidenceLabel: 'observed', data: { ruleId: 'image-alt', impact: 'critical', targets: ['img'] } },
    { id: 'runtime-error:1', kind: 'runtime-error', label: 'HTTP 404 response.', status: 'error', pageId: 'page:1', evidenceLabel: 'observed', data: { kind: 'http', statusCode: 404 } },
    { id: 'flow:1', kind: 'flow', label: 'Add to cart', pageId: 'page:1', evidenceLabel: 'observed', data: { outcome: 'navigated', steps: [{ controlId: 'c' }] } },
  ],
  edges: [],
};

const scan: ScanResult = {
  id: 's1', createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z', status: 'complete',
  inputUrl: 'http://127.0.0.1:4317/sample/checkout', canonicalOrigin: 'http://127.0.0.1:4317',
  limits: { maxPages: 5, maxDepth: 2, maxInteractions: 10 } as never,
  progress: { completedPages: 4, totalPageLimit: 5, message: 'done' },
  pages: [], graph,
  interactionPolicy: { mode: 'safe', tested: 9, skipped: 1 },
};

suite('the AI briefing digest', () => {
  it('reduces a scan to the evidence a summary is allowed to use', () => {
    const digest = buildDigest(scan, graph);
    const ids = digest.map((item) => item.id);
    expect(ids).toContain('finding:1');
    expect(ids).toContain('runtime-error:1');
    expect(ids).toContain('flow:1');
    expect(ids).toContain('page:1');
    expect(digest.find((item) => item.id === 'finding:1')?.detail).toContain('severity=critical');
    expect(digest.find((item) => item.id === 'runtime-error:1')?.detail).toContain('status=404');
  });

  it('includes what the scan did not check, so a summary cannot overstate the coverage', () => {
    const digest = buildDigest(scan, graph);
    const gaps = digest.filter((item) => item.gap === true);
    const ids = gaps.map((item) => item.id);
    expect(ids).toContain('gap:untested-controls');
    expect(ids).toContain('gap:manual-testing');
    expect(gaps.find((item) => item.id === 'gap:untested-controls')?.label).toContain('1 control');
  });

  it('reports the pages and links the scan never reached', () => {
    const partial = { ...scan, coverage: { pagesInspected: 2, pagesBlocked: 0, pagesFailed: 0, destinationsNotReached: 3, destinationsBeyondDepth: 2, stoppedBy: 'page-limit' as const, interactionsTested: 4, interactionsSkipped: 0 } };
    const ids = buildDigest(partial, graph).filter((item) => item.gap).map((item) => item.id);
    expect(ids).toContain('gap:destinations-not-reached');
    expect(ids).toContain('gap:beyond-depth-limit');
  });
});

suite('grounding the model summary', () => {
  const digest = buildDigest(scan, graph);

  it('keeps sentences whose citations exist in the scan', () => {
    const { sentences, citations } = groundSentences(
      'The checkout image has no text alternative [finding:1]. A product request returned 404 [runtime-error:1].',
      digest,
    );
    expect(sentences).toHaveLength(2);
    expect(citations.map((c) => c.id)).toEqual(['finding:1', 'runtime-error:1']);
  });

  it('drops a sentence that cites evidence the scan never recorded', () => {
    const { sentences, citations } = groundSentences(
      'The checkout image has no text alternative [finding:1]. Every user cannot complete the checkout [finding:invented].',
      digest,
    );
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain('no text alternative');
    expect(citations.map((c) => c.id)).toEqual(['finding:1']);
  });

  it('drops a sentence with no citation at all', () => {
    const { sentences } = groundSentences('The site is completely inaccessible to everyone. It has an image problem [finding:1].', digest);
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain('image problem');
  });

  it('keeps a citation that the model placed after the full stop', () => {
    // Models write the id after the sentence, which a plain split would tear away.
    const { sentences, citations } = groundSentences('The checkout image has no text alternative. [finding:1]', digest);
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain('no text alternative');
    expect(citations.map((c) => c.id)).toEqual(['finding:1']);
  });

  it('keeps several citations that trail one sentence', () => {
    const { sentences, citations } = groundSentences('Two pages were inspected. [page:1] [finding:1]', digest);
    expect(sentences).toHaveLength(1);
    expect(citations.map((c) => c.id).sort()).toEqual(['finding:1', 'page:1']);
  });

  it('drops a trailing citation that was cut off mid-id', () => {
    const { sentences } = groundSentences('A request failed. [runtime-error:trunca', digest);
    expect(sentences).toHaveLength(0);
  });

  it('returns nothing when the model invents every claim', () => {
    const { sentences } = groundSentences('Nothing was found [finding:made-up]. The site is fine [other:made-up].', digest);
    expect(sentences).toHaveLength(0);
  });

  it('strips the citation markers from the text it shows', () => {
    const { sentences } = groundSentences('An image needs a text alternative [finding:1].', digest);
    expect(sentences[0]).not.toContain('[');
  });
});

suite('provider configuration', () => {
  it('stays off until a key is present', () => {
    expect(readAiConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(aiStatus({} as NodeJS.ProcessEnv).configured).toBe(false);
  });

  it('reads the key, the endpoint, and the model', () => {
    const config = readAiConfig({ ACCESSRIPPLE_AI_KEY: 'secret', ACCESSRIPPLE_AI_BASE_URL: 'https://example.test/v1/', ACCESSRIPPLE_AI_MODEL: 'some/model' } as NodeJS.ProcessEnv);
    expect(config?.key).toBe('secret');
    expect(config?.baseUrl).toBe('https://example.test/v1');
    expect(config?.model).toBe('some/model');
    expect(aiStatus({ ACCESSRIPPLE_AI_KEY: 'secret' } as NodeJS.ProcessEnv).configured).toBe(true);
  });

  it('goes through the Vercel AI Gateway to MiniMax M3.1 Flash by default', () => {
    const config = readAiConfig({ ACCESSRIPPLE_AI_KEY: 'secret' } as NodeJS.ProcessEnv);
    expect(config?.baseUrl).toBe('https://ai-gateway.vercel.sh/v1');
    expect(config?.model).toBe('minimax/minimax-m3.1-flash');
    expect(config?.fallbackModels).toEqual([]);
    expect(readAiConfig({ ACCESSRIPPLE_AI_KEY: 'k', ACCESSRIPPLE_AI_FALLBACK_MODELS: 'deepseek/deepseek-v4.1-flash-1017' } as NodeJS.ProcessEnv)?.fallbackModels).toEqual(['deepseek/deepseek-v4.1-flash-1017']);
    expect(config?.reasoningEffort).toBe('low');
    expect(aiStatus({ ACCESSRIPPLE_AI_KEY: 'secret' } as NodeJS.ProcessEnv).provider).toBe('ai-gateway.vercel.sh');
  });

  it('reads the key under the name the AI Gateway documents', () => {
    expect(readAiConfig({ AI_GATEWAY_API_KEY: 'gateway' } as NodeJS.ProcessEnv)?.key).toBe('gateway');
    // The tool's own name wins when both are set.
    expect(readAiConfig({ AI_GATEWAY_API_KEY: 'gateway', ACCESSRIPPLE_AI_KEY: 'own' } as NodeJS.ProcessEnv)?.key).toBe('own');
  });

  it('sends attribution headers to OpenRouter only', () => {
    const gateway = requestHeaders({ key: 'k', baseUrl: 'https://ai-gateway.vercel.sh/v1', siteUrl: 'https://x.test' });
    expect(gateway.authorization).toBe('Bearer k');
    expect(gateway['HTTP-Referer']).toBeUndefined();
    expect(gateway['X-Title']).toBeUndefined();
    const openrouter = requestHeaders({ key: 'k', baseUrl: 'https://openrouter.ai/api/v1', siteUrl: 'https://x.test' });
    expect(openrouter['HTTP-Referer']).toBe('https://x.test');
    expect(openrouter['X-Title']).toBe('AccessRipple');
  });
});
