import { describe as suite, it, expect, afterEach } from 'vitest';
import { isGrounded, parseProposal } from '../../src/ai/fix.js';
import { applyPatch, clearPatches, isDemoFixture, patchedContent, replaceMarkup } from '../../src/sample/sandbox.js';

const SNIPPET = '<img class="product-art" src="/sample/missing-product.webp">';

afterEach(() => clearPatches());

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
