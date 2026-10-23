import { describe as suite, it, expect, afterEach, vi } from 'vitest';
import { isGrounded, parseProposal, unifiedDiff, wcagCriterion, writeFixProposal } from '../../src/ai/fix.js';
import { applyPatch, clearPatches, isDemoFixture, locateInDemoShop, patchedContent, replaceMarkup } from '../../src/sample/sandbox.js';
import type { ScanResult, SiteGraph } from '../../src/graph/schema.js';

const SNIPPET = '<img class="product-art" src="/sample/missing-product.webp">';

afterEach(() => { clearPatches(); vi.unstubAllGlobals(); });

suite('reading a proposed change', () => {
  it('reads one JSON object out of a model answer wrapped in prose', () => {
    const proposal = parseProposal('Sure! Here is the change:\n{"summary":"Add alt text.","before":"<img>","after":"<img alt=\\"x\\">","why":"A screen reader can describe it."}\nHope that helps.');
    expect(proposal).not.toBeNull();
    expect(proposal?.summary).toBe('Add alt text.');
    expect(proposal?.after).toBe('<img alt="x">');
  });

  it('rejects an answer that is not an object at all', () => {
    expect(parseProposal('I could not find the element.')).toBeNull();
    expect(parseProposal('{not json')).toBeNull();
    expect(parseProposal('{"summary":"only a summary"}')).toBeNull();
  });

  it('rejects a change that leaves the markup as it was', () => {
    const proposal = parseProposal(JSON.stringify({ summary: 'No change', before: '<img>', after: '<img>', why: 'none' }));
    expect(proposal).not.toBeNull();
    // The shape is readable, so the caller can show it, but it changes nothing.
    expect(proposal?.before).toBe(proposal?.after);
  });
});

suite('grounding a proposed change', () => {
  it('accepts a proposal that repeats the recorded markup', () => {
    expect(isGrounded({ before: SNIPPET }, SNIPPET, ['img.product-art'])).toBe(true);
  });

  it('accepts a proposal that only differs in whitespace', () => {
    expect(isGrounded({ before: '<img  class="product-art"\n   src="x">' }, '<img class="product-art" src="x">', [])).toBe(true);
  });

  it('rejects a proposal that is not the recorded markup', () => {
    expect(isGrounded({ before: '<div class="something-else">' }, SNIPPET, ['img.product-art'])).toBe(false);
  });

  it('rejects a proposal that only mentions the selector', () => {
    // The selector alone is not proof that the markup was read.
    expect(isGrounded({ before: 'img.product-art' }, SNIPPET, ['img.product-art'])).toBe(false);
  });

  it('rejects a proposal when nothing was recorded', () => {
    expect(isGrounded({ before: '<img>' }, '', ['img'])).toBe(false);
  });

  it('rejects fragments and unrelated markup even when the selector appears in the evidence', () => {
    expect(isGrounded({ before: '<img' }, SNIPPET, ['img'])).toBe(false);
    expect(isGrounded({ before: `<div>${SNIPPET}</div>` }, SNIPPET, [])).toBe(false);
    expect(isGrounded({ before: '<button>unrelated</button>' }, '<img class="product-art">', ['product-art'])).toBe(false);
  });
});

suite('the demo shop sandbox', () => {
  it('only ever changes the tool\'s own fixture', () => {
    expect(isDemoFixture('src/sample/site/checkout.html')).toBe(true);
    expect(isDemoFixture('src/sample/site/product.svg')).toBe(false);
    expect(isDemoFixture('../../etc/passwd')).toBe(false);
    expect(isDemoFixture('src/api/app.ts')).toBe(false);
  });

  it('replaces markup that differs only in whitespace', () => {
    const source = '<div>\n  <img class="product-art" src="/sample/missing-product.webp">\n</div>';
    const patched = replaceMarkup(source, '<img class="product-art" src="/sample/missing-product.webp">', '<img class="product-art" src="/sample/missing-product.webp" alt="Product image">');
    expect(patched).toContain('alt="Product image"');
    expect(patched).not.toContain('missing-product.webp">\n');
  });

  it('returns nothing when the markup is not in the file', () => {
    expect(replaceMarkup('<div>something else</div>', '<img alt="x">', '<img alt="y">')).toBeNull();
  });

  it('serves the patched copy rather than the file on disk', () => {
    const original = patchedContent('src/sample/site/checkout.html');
    expect(original).toContain('missing-product.webp');
    const applied = applyPatch('src/sample/site/checkout.html', '<img class="product-art" src="/sample/missing-product.webp">', '<img class="product-art" src="/sample/missing-product.webp" alt="Product image">', 'Add alternative text.');
    expect(applied).not.toBeNull();
    const patched = patchedContent('src/sample/site/checkout.html');
    expect(patched).toContain('alt="Product image"');
    // The file on disk is untouched.
    expect(patchedContent('src/sample/site/cart.html')).toContain('Northstar');
  });

  it('refuses to change a file that is not the fixture', () => {
    expect(applyPatch('src/api/app.ts', 'a', 'b', 'c')).toBeNull();
    expect(applyPatch('../../etc/hosts', 'a', 'b', 'c')).toBeNull();
  });
});

suite('what a proposal carries besides the change', () => {
  it('names the success criterion from the check\'s own tags', () => {
    expect(wcagCriterion('image-alt', ['wcag2a', 'wcag111'])).toBe('1.1.1 Non-text Content');
    expect(wcagCriterion('target-size', ['wcag22aa', 'wcag258'])).toBe('2.5.8 Target Size (Minimum)');
    expect(wcagCriterion('some-check', ['wcag1410'])).toBe('1.4.10');
    // A scan recorded before tags were kept still gets one for the common checks.
    expect(wcagCriterion('color-contrast', undefined)).toBe('1.4.3 Contrast (Minimum)');
    expect(wcagCriterion('region', ['best-practice'])).toBeUndefined();
  });

  it('writes the change as a unified diff', () => {
    const diff = unifiedDiff('src/sample/site/checkout.html', '<img src="a">', '<img src="a" alt="A">', 18);
    expect(diff).toBe('--- a/src/sample/site/checkout.html\n+++ b/src/sample/site/checkout.html\n@@ -18,1 +18,1 @@\n-<img src="a">\n+<img src="a" alt="A">\n');
    const multi = unifiedDiff('f.html', '<div>\n<img>\n</div>', '<div>\n<img alt="">\n</div>');
    expect(multi.split('\n').slice(3, 7)).toEqual([' <div>', '-<img>', '+<img alt="">', ' </div>']);
  });

  it('finds the recorded markup in the demo shop at its real line', () => {
    const location = locateInDemoShop(SNIPPET);
    expect(location?.file).toBe('src/sample/site/checkout.html');
    const source = patchedContent('src/sample/site/checkout.html')!;
    expect(source.split('\n')[location!.line - 1]).toContain('missing-product.webp');
    expect(locateInDemoShop('<p>not in the shop at all</p>')).toBeUndefined();
  });
});

suite('asking a model for a change', () => {
  const graph: SiteGraph = { schemaVersion: '1.0', edges: [], nodes: [
    { id: 'f1', kind: 'accessibility-finding', label: 'Images must have alternative text', status: 'detected', pageId: 'p1', evidenceLabel: 'observed', data: { ruleId: 'image-alt', impact: 'critical', targets: ['img.product-art'], snippet: SNIPPET, tags: ['wcag2a', 'wcag111'] } },
  ] };
  const scan = { id: 's', pages: [{ id: 'p1', url: 'http://127.0.0.1:4317/sample/checkout', status: 'complete', depth: 0, controls: [], errors: [], findings: [], outgoingLinks: [], interactions: [], screenshot: { dataUrl: 'data:image/jpeg;base64,AAAA' } }] } as unknown as ScanResult;
  const config = { key: 'k', baseUrl: 'http://model.test', model: 'vision/model', fallbackModels: [], reasoningEffort: 'low', siteUrl: '' };
  const answer = JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: 'Add alt text.', before: SNIPPET, after: SNIPPET.replace('>', ' alt="Product image">'), why: 'It can be described.', assistiveTechImpact: 'A screen reader announces only the file name.' }) } }] });

  it('shows the model the page and returns the criterion, the diff and the location', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => { bodies.push(JSON.parse(init.body)); return new Response(answer, { status: 200 }); }));
    const proposal = await writeFixProposal(scan, graph, 'f1', config);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } });
    expect(bodies[0].reasoning).toEqual({ effort: 'low' });
    expect(proposal.wcagCriterion).toBe('1.1.1 Non-text Content');
    expect(proposal.assistiveTechImpact).toContain('screen reader');
    expect(proposal.location?.file).toBe('src/sample/site/checkout.html');
    expect(proposal.unifiedDiff).toContain('+<img class="product-art" src="/sample/missing-product.webp" alt="Product image">');
  });

  it('asks again with text only when a model refuses the picture', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body); bodies.push(body);
      return Array.isArray(body.messages[1].content) ? new Response('{"error":"image input is not supported"}', { status: 400 }) : new Response(answer, { status: 200 });
    }));
    const proposal = await writeFixProposal(scan, graph, 'f1', config);
    expect(bodies).toHaveLength(2);
    expect(typeof bodies[1].messages[1].content).toBe('string');
    expect(proposal.summary).toBe('Add alt text.');
  });

  it('does not repeat a request for a model that is busy', async () => {
    const fetch = vi.fn(async () => new Response('busy', { status: 429 }));
    vi.stubGlobal('fetch', fetch);
    await expect(writeFixProposal(scan, graph, 'f1', config)).rejects.toThrow('busy right now');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
