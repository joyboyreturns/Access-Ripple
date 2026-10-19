import { describe, expect, it } from 'vitest';
import { classifyAction, summarizeInteraction } from '../../src/scan/interaction.js';
import type { ControlEvidence, InteractionStep } from '../../src/graph/schema.js';

const control = (overrides: Partial<ControlEvidence>): ControlEvidence => ({ id: 'c', role: 'button', accessibleName: 'Continue', evidenceLabel: 'observed', ...overrides });

describe('interaction safety policy', () => {
  it('never activates consequential actions, even with authorization', () => {
    expect(classifyAction(control({ accessibleName: 'Delete account' }), { isSample: false })).toBe('consequential');
    expect(classifyAction(control({ accessibleName: 'Place order', formAction: 'https://shop.example/pay' }), { isSample: false })).toBe('consequential');
    expect(classifyAction(control({ accessibleName: 'Send message' }), { isSample: false })).toBe('consequential');
    expect(classifyAction(control({ accessibleName: 'Sign out' }), { isSample: true })).toBe('consequential');
  });

  it('requires explicit authorization before a submit control can be activated', () => {
    expect(classifyAction(control({ role: 'submit', accessibleName: 'Check details', formAction: 'https://shop.example/search' }), { isSample: false })).toBe('requires-authorization');
    expect(classifyAction(control({ role: 'image', accessibleName: 'Search', formAction: 'https://shop.example/search' }), { isSample: false })).toBe('requires-authorization');
  });

  it('ignores form fields that have no meaningful click outcome', () => {
    expect(classifyAction(control({ role: 'email', accessibleName: '' }), { isSample: false })).toBe('ignored');
    expect(classifyAction(control({ role: 'textarea', accessibleName: 'Notes' }), { isSample: false })).toBe('ignored');
    expect(classifyAction(control({ role: 'checkbox', accessibleName: 'Remember me' }), { isSample: false })).toBe('ignored');
  });

  it('keeps links to payment or checkout paths untested on external sites but allows the owned sample', () => {
    const checkout = control({ role: 'link', accessibleName: 'Checkout', href: 'https://shop.example/checkout' });
    expect(classifyAction(checkout, { isSample: false })).toBe('consequential');
    expect(classifyAction(checkout, { isSample: true })).toBe('safe');
  });

  it('treats ordinary script-driven buttons and reading links as safe', () => {
    expect(classifyAction(control({ accessibleName: 'Apply promo code' }), { isSample: false })).toBe('safe');
    expect(classifyAction(control({ role: 'link', accessibleName: 'About', href: 'https://shop.example/about' }), { isSample: false })).toBe('safe');
  });
});

describe('interaction summaries', () => {
  it('describes observed steps in plain language, including a followed reveal', () => {
    const steps: InteractionStep[] = [
      { controlId: 'c1', label: 'Add to cart', action: 'click', outcome: 'content-changed', summary: '', revealed: [{ name: 'View cart', role: 'link', href: 'https://shop.example/cart' }], errorIds: [] },
      { controlId: 'c2', label: 'View cart', action: 'click', outcome: 'navigated', summary: '', destinationUrl: 'https://shop.example/cart', errorIds: [] },
    ];
    const summary = summarizeInteraction(steps);
    expect(summary).toContain('Add to cart');
    expect(summary).toContain('View cart');
    expect(summary).toContain('/cart');
    expect(summary).toContain('; then');
  });

  it('states blocked and failed outcomes without overclaiming', () => {
    expect(summarizeInteraction([{ controlId: 'c', label: 'Save', action: 'click', outcome: 'blocked', summary: '', errorIds: [] }])).toContain('blocked');
    expect(summarizeInteraction([{ controlId: 'c', label: 'Save', action: 'click', outcome: 'failed', summary: '', errorIds: [] }])).toContain('could not be activated');
  });
});
