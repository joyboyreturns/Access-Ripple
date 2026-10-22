import { describe, expect, it } from 'vitest';
import { barrierRipple, byPriority, rippleReach, whoItProtects, withoutSharedAffix } from '../../web/src/presentation.js';
import { explainEdge } from '../../web/src/graph-explorer.js';
import type { GraphEdge, GraphNode, SiteGraph } from '../../web/src/types.js';

const page = (id: string, depth: number): GraphNode => ({ id, kind: 'page', label: `Shop · ${id}`, pageId: id, evidenceLabel: 'observed', data: { depth, url: `https://shop.test/${id}` } });
const finding = (id: string, pageId: string, ruleId: string, impact: string, groupCount?: number): GraphNode => ({ id, kind: 'accessibility-finding', label: ruleId, pageId, evidenceLabel: 'observed', data: { ruleId, impact, ...(groupCount ? { groupCount } : {}) } });

/** A shop whose pages link in a loop, like a real one: cart ⇄ checkout, catalogue → checkout, cart → thanks. */
function shop(): SiteGraph {
  const nodes: GraphNode[] = [{ id: 'site', kind: 'site', label: 'shop.test', evidenceLabel: 'observed', data: {} }, page('checkout', 0), page('cart', 1), page('catalogue', 1), page('thanks', 2), page('help', 1)];
  const edges: GraphEdge[] = [];
  const action = (id: string, from: string, to: string, tested = true) => {
    nodes.push({ id: `c-${id}`, kind: 'control', label: id, pageId: from, evidenceLabel: 'observed', data: {} });
    nodes.push({ id: `f-${id}`, kind: 'flow', label: `Leads to /${to}`, evidenceLabel: tested ? 'observed' : 'inferred', data: tested ? { tested: true, steps: [{ outcome: 'navigated', destinationUrl: `https://shop.test/${to}` }] } : { destinationUrl: `https://shop.test/${to}` } });
    edges.push({ id: `hc-${id}`, kind: 'has-control', source: from, target: `c-${id}`, evidenceLabel: 'observed' });
    edges.push({ id: `ml-${id}`, kind: 'may-lead-to', source: `c-${id}`, target: `f-${id}`, evidenceLabel: tested ? 'observed' : 'inferred' });
    edges.push({ id: `lt-${id}`, kind: 'links-to', source: `f-${id}`, target: to, evidenceLabel: tested ? 'observed' : 'inferred' });
  };
  action('Proceed to checkout', 'cart', 'checkout');
  action('Back to cart', 'checkout', 'cart');
  action('Buy now', 'catalogue', 'checkout');
  action('Place order', 'cart', 'thanks');
  // A link the browser never activated is a possible route, never part of a ripple.
  action('Need help?', 'help', 'checkout', false);
  nodes.push(finding('alt', 'checkout', 'image-alt', 'critical'), finding('contrast', 'thanks', 'color-contrast', 'critical', 4), finding('lonely', 'help', 'label', 'serious'));
  return { schemaVersion: '1.0', nodes, edges };
}

describe('the ripple of a barrier', () => {
  it('places a barrier among the pages the browser actually moved between', () => {
    const ripple = barrierRipple(shop(), 'alt')!;
    expect(ripple.page.id).toBe('checkout');
    expect(ripple.rings.map(r => [r.page.id, r.distance])).toEqual([['cart', 1], ['catalogue', 1], ['thanks', 2]]);
    expect(ripple.arriving).toBe(2);
    expect(ripple.leaving).toBe(1);
    expect(ripple.isStart).toBe(true);
  });

  it('draws every action into and out of the page, both directions of a loop included', () => {
    const ripple = barrierRipple(shop(), 'alt')!;
    const drawn = ripple.hops.map(h => `${h.from.id}>${h.to.id}@${h.distance}`).sort();
    expect(drawn).toEqual(['cart>checkout@1', 'cart>thanks@2', 'catalogue>checkout@1', 'checkout>cart@1']);
  });

  it('never counts a link the browser did not activate', () => {
    const ripple = barrierRipple(shop(), 'alt')!;
    expect(ripple.rings.some(r => r.page.id === 'help')).toBe(false);
    expect(ripple.hops.some(h => h.from.id === 'help')).toBe(false);
  });

  it('says plainly when no recorded journey reaches the page', () => {
    const ripple = barrierRipple(shop(), 'lonely')!;
    expect(ripple.hops).toEqual([]);
    expect(ripple.summary).toContain('cannot place the barrier on a journey');
  });

  it('never claims that a barrier stops a journey', () => {
    expect(barrierRipple(shop(), 'alt')!.summary).toContain('not that it stops one');
  });

  it('is only drawn for an accessibility finding', () => {
    expect(barrierRipple(shop(), 'checkout')).toBeNull();
    expect(barrierRipple(shop(), 'missing')).toBeNull();
  });
});

describe('the review order', () => {
  it('orders by severity, then by recorded actions through the page, then by elements', () => {
    const graph = shop();
    const order = graph.nodes.filter(n => n.kind === 'accessibility-finding').sort(byPriority(graph)).map(n => n.id);
    // Both critical: the checkout barrier has three recorded actions through its page, the thanks page one.
    expect(rippleReach(graph, 'alt')).toBe(3);
    expect(rippleReach(graph, 'contrast')).toBe(1);
    expect(order).toEqual(['alt', 'contrast', 'lonely']);
  });
});

describe('ripple wording', () => {
  it('names who a check protects, and nothing for a check it does not know', () => {
    expect(whoItProtects(finding('a', 'p', 'image-alt', 'critical'))).toContain('screen reader');
    expect(whoItProtects(finding('b', 'p', 'some-new-rule', 'minor'))).toBe('');
  });

  it('drops the site name every page shares, and only then', () => {
    const labels = ['Northstar · Your cart', 'Northstar · Catalogue'];
    expect(withoutSharedAffix('Northstar · Your cart', labels)).toBe('Your cart');
    expect(withoutSharedAffix('Pricing | Acme', ['Pricing | Acme', 'Docs | Acme'])).toBe('Pricing');
    expect(withoutSharedAffix('Home', ['Home', 'About · Acme'])).toBe('Home');
  });

  it('explains a drawn action with the control the browser activated', () => {
    const graph = shop();
    const copy = explainEdge({ id: 'ripple:x', kind: 'links-to', source: 'cart', target: 'checkout', evidenceLabel: 'observed', via: 'Proceed to checkout' }, graph);
    expect(copy.title).toBe('Recorded action → page');
    expect(copy.explanation).toContain('activated “Proceed to checkout”');
    expect(copy.explanation).toContain('does not show that a visitor completed a task');
  });
});
