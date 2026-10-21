import type { FixProposal, SampleInfo, ScanComparison, ScanResult, ScanSummary, SiteGraph } from './types.js';

export interface AiStatus { configured: boolean; model: string; provider: string }
export interface Briefing { text: string; citations: Array<{ id: string; label: string; gap?: boolean }>; model: string; source: 'ai'; /** What the scan did not check. Always shown, because it is evidence too. */ gaps?: Array<{ id: string; label: string }> }

/**
 * The scanner allows a scan to run for 100 seconds, and the server allows a
 * model call up to 25 seconds per model in a chain of three. The waits here
 * are deliberately longer than both, so the browser never gives up while the
 * work is still running.
 */
export const SCAN_WAIT_MS = 140_000;
export const MODEL_WAIT_MS = 100_000;
export const DEFAULT_WAIT_MS = 20_000;

export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); this.name = 'ApiError'; }
}

async function request<T>(path: string, init?: RequestInit, options?: { timeout?: number }): Promise<T> {
  const response = await fetch(path, { ...init, signal: init?.signal ?? AbortSignal.timeout(options?.timeout ?? DEFAULT_WAIT_MS), headers: { ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}), ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `Request failed (${response.status}).`;
    throw new ApiError(message, response.status, body?.error?.code || 'REQUEST_FAILED');
  }
  return body as T;
}

export function checkApi() {
  return request<{ status: string; localOnly: boolean }>('/api/health');
}

export function createScan(input: { url: string; authorizeSubmit?: boolean; allowPrivateNetwork?: boolean } | { sample: 'checkout'; authorizeSubmit?: boolean; allowPrivateNetwork?: boolean }) {
  return request<{ scanId: string; status: string }>('/api/scans', { method: 'POST', body: JSON.stringify(input) });
}

/** Describes the built-in demo site, so the studio can offer a scan that needs no network. */
export function getSampleInfo() {
  return request<SampleInfo>('/api/sample/info');
}

/** Switches the demo site between its broken and repaired state so a rescan can prove a fix. */
export function setSampleState(variant: 'before' | 'after') {
  return request<{ variant: 'before' | 'after' }>('/api/sample/state', { method: 'POST', body: JSON.stringify({ variant }) });
}

/** Whether a model provider is configured for the optional AI briefing. */
export function getAiStatus() {
  return request<AiStatus>('/api/ai/status');
}

/** The newest repair comparison this computer has on record. */
export function getProof() {
  return request<{ comparison: ScanComparison; currentScanId: string; previousScanId: string }>('/api/proof');
}

/** Ask the configured model for a grounded plain-language read of the scan. */
export function writeBriefing(scanId: string) {
  return request<Briefing>(`/api/scans/${encodeURIComponent(scanId)}/briefing`, { method: 'POST', body: '{}' }, { timeout: MODEL_WAIT_MS });
}

/** Apply an accepted proposal to the built-in demo shop, so the next scan measures it. */
export function applyProposal(input: { file: string; before: string; after: string; summary?: string }) {
  return request<{ applied: boolean; file: string; summary: string; before: string; after: string; appliedAt: string }>('/api/sample/apply', { method: 'POST', body: JSON.stringify(input) });
}

/** Put the demo shop back the way it was. */
export function resetDemoShop() {
  return request<{ reset: boolean }>('/api/sample/reset', { method: 'POST', body: '{}' });
}

/** Ask the configured model for a concrete change that fixes one finding. */
export interface RepairPrediction { issueId: string; expected: 'absent' | 'present'; reason: string; label?: string; observed?: 'absent' | 'present' | 'not rechecked'; outcome?: 'supported' | 'contradicted' | 'not rechecked' }
export interface RepairContract { predictions: RepairPrediction[]; model: string }

/** Ask the model to commit, in advance, to what its change will fix. */
export function writeContract(scanId: string, nodeId: string) {
  return request<RepairContract>(`/api/scans/${encodeURIComponent(scanId)}/contract`, { method: 'POST', body: JSON.stringify({ nodeId }) }, { timeout: MODEL_WAIT_MS });
}

export function proposeFix(scanId: string, nodeId: string) {
  return request<FixProposal>(`/api/scans/${encodeURIComponent(scanId)}/fix`, { method: 'POST', body: JSON.stringify({ nodeId }) }, { timeout: MODEL_WAIT_MS });
}

export function readScan(scanId: string, signal?: AbortSignal) {
  return request<ScanResult>(`/api/scans/${encodeURIComponent(scanId)}`, { signal });
}

export function readGraph(scanId: string) {
  return request<SiteGraph>(`/api/scans/${encodeURIComponent(scanId)}/graph`);
}

export function listScans() {
  return request<{ scans: ScanSummary[] }>('/api/scans');
}

export function rescan(scanId: string, input?: { authorizeSubmit?: boolean; allowPrivateNetwork?: boolean }) {
  return request<{ scanId: string }>(`/api/scans/${encodeURIComponent(scanId)}/rescan`, { method: 'POST', ...(input ? { body: JSON.stringify(input) } : {}) });
}

export function compareScans(currentId: string, previousId: string) {
  return request<ScanComparison>(`/api/scans/${encodeURIComponent(currentId)}/compare/${encodeURIComponent(previousId)}`);
}

export async function waitForScan(scanId: string, onProgress: (scan: ScanResult) => void, signal: AbortSignal) {
  const deadline = Date.now() + SCAN_WAIT_MS;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const scan = await readScan(scanId, AbortSignal.any([signal, AbortSignal.timeout(SCAN_WAIT_MS)]));
    onProgress(scan);
    if (['complete', 'partial', 'failed'].includes(scan.status)) return scan;
    await new Promise<void>((resolve, reject) => { const done=()=>{signal.removeEventListener('abort',abort);resolve();};const timer=window.setTimeout(done,800);const abort=()=>{window.clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};signal.addEventListener('abort',abort,{once:true}); });
  }
  throw new Error('The scan is taking longer than expected. Reload this studio to reconnect to its progress.');
}

export async function downloadVault(scanId: string) {
  const response = await fetch(`/api/scans/${encodeURIComponent(scanId)}/export/obsidian`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(response.status === 404 ? 'This scan expired after the scanner restarted. Run a new scan, then export its vault.' : body?.error?.message || 'The vault could not be downloaded. Please retry.');
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'access-ripple-scan-vault.zip';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}
