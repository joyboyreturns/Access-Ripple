import { describe as suite, it, expect, afterEach } from 'vitest';
import { buildPatchExport } from '../../src/export/patch.js';
import { addVirtualPatch, allVirtualPatches, clearVirtualPatches, virtualPatchesFor } from '../../src/sample/sandbox.js';

afterEach(() => clearVirtualPatches());

const virtual = (scanId: string, after = '<img src="a.png" alt="A">') => addVirtualPatch({ scanId, pageUrl: 'https://shop.example/', ruleId: 'image-alt', nodeId: 'f1', selector: 'img', before: '<img src="a.png">', after, summary: 'Add alternative text.' });

suite('changes simulated on a live site', () => {
  it('are kept per scan, and a second change to one element replaces the first', () => {
    virtual('scan-1');
    virtual('scan-1', '<img src="a.png" alt="Better">');
    virtual('scan-2');
    expect(virtualPatchesFor('scan-1')).toHaveLength(1);
    expect(virtualPatchesFor('scan-1')[0]?.after).toContain('Better');
    expect(allVirtualPatches()).toHaveLength(2);
    clearVirtualPatches('scan-1');
    expect(virtualPatchesFor('scan-1')).toEqual([]);
  });
});

suite('exporting accepted changes', () => {
  it('writes a demo shop change as a diff at its real line', () => {
    const result = buildPatchExport({ fixture: [{ file: 'src/sample/site/checkout.html', summary: 'Add alt text.', before: '<img class="product-art" src="/sample/missing-product.webp">', after: '<img class="product-art" src="/sample/missing-product.webp" alt="Product">', appliedAt: '' }], simulated: [], outcomes: [] });
    expect(result.patch).toMatch(/^--- a\/src\/sample\/site\/checkout.html\n\+\+\+ b\/src\/sample\/site\/checkout.html\n@@ -\d+,1 \+\d+,1 @@\n-<img/);
    expect(result.markdown).toContain('## Applied to the demo shop');
  });

  it('says plainly that a live-site change was only simulated, and reports each verdict', () => {
    const result = buildPatchExport({ fixture: [], simulated: [virtual('scan-1')], outcomes: [
      { issueId: 'f1', expected: 'absent', reason: '', label: 'Images must have alternative text', observed: 'absent', outcome: 'supported', simulated: true },
      { issueId: 'e1', expected: 'absent', reason: '', label: 'HTTP 404 | missing', observed: 'not rechecked', outcome: 'not rechecked' },
    ] });
    expect(result.patch).toContain('--- a/shop.example/index.html');
    expect(result.markdown).toContain('The site was not changed.');
    expect(result.markdown).toContain('| Images must have alternative text | gone | gone (simulated) | held |');
    expect(result.markdown).toContain('| HTTP 404 \\| missing | gone | not checked again | unknown |');
  });

  it('says when nothing has been accepted', () => {
    const result = buildPatchExport({ fixture: [], simulated: [], outcomes: [] });
    expect(result.patch).toBe('');
    expect(result.markdown).toContain('No change has been accepted yet.');
  });
});
