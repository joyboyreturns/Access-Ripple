import type { ScanComparison, ScanResult, SiteGraph } from './types.js';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); this.name = 'ApiError'; }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000), headers: { ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}), ...init?.headers } });
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

export function createScan(input: { url: string; authorizeSubmit?: boolean } | { sample: 'checkout' }) {
  return request<{ scanId: string; status: string }>('/api/scans', { method: 'POST', body: JSON.stringify(input) });
}

export function readScan(scanId: string, signal?: AbortSignal) {
  return request<ScanResult>(`/api/scans/${encodeURIComponent(scanId)}`, { signal });
}

export function readGraph(scanId: string) {
  return request<SiteGraph>(`/api/scans/${encodeURIComponent(scanId)}/graph`);
}

export function rescan(scanId: string, input?: { authorizeSubmit?: boolean }) {
  return request<{ scanId: string }>(`/api/scans/${encodeURIComponent(scanId)}/rescan`, { method: 'POST', ...(input ? { body: JSON.stringify(input) } : {}) });
}

export function compareScans(currentId: string, previousId: string) {
  return request<ScanComparison>(`/api/scans/${encodeURIComponent(currentId)}/compare/${encodeURIComponent(previousId)}`);
}

export async function waitForScan(scanId: string, onProgress: (scan: ScanResult) => void, signal: AbortSignal) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const scan = await readScan(scanId, AbortSignal.any([signal, AbortSignal.timeout(15000)]));
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
