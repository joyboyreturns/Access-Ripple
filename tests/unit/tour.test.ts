import { describe as suite, it, expect } from 'vitest';
import { TOUR, type TourContext } from '../../web/src/tour.js';

const context = (over: Partial<TourContext> = {}): TourContext => ({ hasScan: false, findingOpened: 0, journeyTraced: 0, changeProposed: 0, compared: 0, ...over });

suite('the guided tour', () => {
  it('gives every step a sentence to say, so a silent recording still tells the story', () => {
    expect(TOUR.length).toBeGreaterThanOrEqual(4);
    for (const step of TOUR) {
      expect(step.title.length).toBeGreaterThan(3);
      expect(step.say.length).toBeGreaterThan(60);
      expect(step.say.endsWith('.')).toBe(true);
    }
  });

  it('keeps the steps in the order of the core journey', () => {
    expect(TOUR.map((step) => step.id)).toEqual(['proof', 'scan', 'finding', 'journey', 'proposal', 'repair', 'limits']);
  });

  it('completes a step only after the viewer does the thing the step describes', () => {
    const [proof, scan, finding, journey, proposal, repair] = TOUR;
    expect(proof!.done(context())).toBe(false);
    expect(proof!.done(context({ compared: 1 }))).toBe(true);
    expect(scan!.done(context())).toBe(false);
    expect(scan!.done(context({ hasScan: true }))).toBe(true);
    expect(finding!.done(context({ findingOpened: 0 }))).toBe(false);
    expect(finding!.done(context({ findingOpened: 1 }))).toBe(true);
    expect(journey!.done(context({ journeyTraced: 1 }))).toBe(true);
    expect(proposal!.done(context({ changeProposed: 1 }))).toBe(true);
    expect(repair!.done(context({ compared: 1 }))).toBe(true);
  });

  it('ends on a step that waits for the viewer instead of running away', () => {
    const last = TOUR[TOUR.length - 1]!;
    expect(last.done(context({ hasScan: true, findingOpened: 1, journeyTraced: 1, changeProposed: 1, compared: 1 }))).toBe(false);
  });
});
