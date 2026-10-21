import { describe as suite, it, expect } from 'vitest';
import { MODEL_WAIT_MS, SCAN_WAIT_MS } from '../../web/src/api.js';
import { DEFAULT_LIMITS } from '../../src/scan/worker.js';

suite('the browser never gives up before the work is done', () => {
  it('waits longer for a scan than the scanner is allowed to take', () => {
    expect(SCAN_WAIT_MS).toBeGreaterThan(DEFAULT_LIMITS.totalTimeoutMs);
  });

  it('waits longer for a model chain than the server allows for one model', () => {
    // The server may try several models in turn, so the browser has to wait
    // for more than one attempt.
    expect(MODEL_WAIT_MS).toBeGreaterThan(25_000 * 2);
  });
});
