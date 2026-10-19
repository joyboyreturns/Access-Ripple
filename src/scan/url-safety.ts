import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

export class UnsafeUrlError extends Error {
  constructor(message: string, public readonly code = 'UNSAFE_URL') {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const blockedHostSuffixes = ['.localhost', '.local', '.internal', '.home.arpa'];
const blockedHostnames = new Set(['localhost', 'metadata.google.internal', 'metadata']);

function inV4Range(address: string, base: string, mask: number): boolean {
  const value = address.split('.').reduce((acc, part) => (acc << 8n) | BigInt(Number(part)), 0n);
  const network = base.split('.').reduce((acc, part) => (acc << 8n) | BigInt(Number(part)), 0n);
  const shift = 32n - BigInt(mask);
  return (value >> shift) === (network >> shift);
}

export function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const blocked: Array<[string, number]> = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
      ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
    ];
    return !blocked.some(([base, mask]) => inV4Range(address, base, mask));
  }
  if (version !== 6) return false;

  const words = parseIpv6(address);
  if (!words) return false;
  const first = words[0]!;
  // Only global unicast 2000::/3 is eligible; also reject transition/documentation ranges.
  if ((first & 0xe000) !== 0x2000) return false;
  if (words[0] === 0x2001 && words[1] === 0x0db8) return false; // documentation
  if (words[0] === 0x2002) return false; // 6to4 embeds IPv4 destinations
  if (words[0] === 0x2001 && words[1] === 0x0010) return false; // ORCHID
  return true;
}

function parseIpv6(input: string): number[] | null {
  let address = input.toLowerCase().split('%')[0] ?? '';
  if (address.includes('.')) {
    const lastColon = address.lastIndexOf(':');
    const ipv4 = address.slice(lastColon + 1);
    if (isIP(ipv4) !== 4) return null;
    const octets = ipv4.split('.').map(Number);
    const tail = [((octets[0]! << 8) | octets[1]!), ((octets[2]! << 8) | octets[3]!)];
    address = `${address.slice(0, lastColon)}:${tail[0]!.toString(16)}:${tail[1]!.toString(16)}`;
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0]!.split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1]!.split(':') : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const fillCount = 8 - left.length - right.length;
  if (fillCount < 0 || (halves.length === 2 && fillCount < 1)) return null;
  const chunks = [...left, ...Array.from({ length: fillCount }, () => '0'), ...right];
  const words = chunks.map((chunk) => Number.parseInt(chunk, 16));
  return words.length === 8 && words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff) ? words : null;
}

export interface UrlSafetyOptions {
  allowLocalSample?: boolean;
  sampleOrigin?: string;
  resolveHostname?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
}

export async function assertSafeUrl(rawUrl: string, options: UrlSafetyOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Enter a complete website address beginning with http:// or https://.', 'INVALID_URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only public HTTP and HTTPS pages can be scanned.');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('Website addresses containing usernames or passwords are not accepted.');
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (options.allowLocalSample && options.sampleOrigin) {
    const sample = new URL(options.sampleOrigin);
    if (url.origin === sample.origin) return url;
  }
  if (blockedHostnames.has(hostname) || blockedHostSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    throw new UnsafeUrlError('Local and private network addresses cannot be scanned.');
  }
  const ipVersion = isIP(hostname);
  if (ipVersion && !isPublicIp(hostname)) throw new UnsafeUrlError('Local, private, and reserved IP addresses cannot be scanned.');
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new UnsafeUrlError('Custom port numbers are not supported in this scan.');
  }
  if (ipVersion) return url;
  const resolver = options.resolveHostname ?? ((host: string) => lookup(host, { all: true, verbatim: true }));
  let records: Array<{ address: string; family: number }>;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    records = await Promise.race([
      resolver(hostname),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('DNS timeout')), 3_000); }),
    ]);
  } catch {
    throw new UnsafeUrlError('The website address could not be resolved.', 'HOST_NOT_FOUND');
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  if (records.length === 0 || records.some((record) => !isPublicIp(record.address))) {
    throw new UnsafeUrlError('This website resolves to a local, private, or reserved network address.');
  }
  return url;
}

export function safeDisplayUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return rawUrl.slice(0, 300);
  }
}
