import { createHash } from 'node:crypto';
import { safeDisplayUrl } from './url-safety.js';
import type { RuntimeErrorEvidence } from '../graph/schema.js';

export function stableId(prefix: string, text: string): string {
  return `${prefix}:${createHash('sha1').update(text).digest('hex').slice(0, 14)}`;
}

export function redactMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s"'<>]+/gi, (value) => safeDisplayUrl(value).replace(/[),.;]+$/, ''))
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .slice(0, 240);
}

export function errorEvidence(kind: RuntimeErrorEvidence['kind'], message: string, url?: string, statusCode?: number): RuntimeErrorEvidence {
  return {
    id: stableId('runtime-error', `${kind}|${url ? safeDisplayUrl(url) : ''}|${redactMessage(message)}`), kind, message: redactMessage(message),
    url: url ? safeDisplayUrl(url) : undefined,
    statusCode, evidenceLabel: 'observed',
  };
}
