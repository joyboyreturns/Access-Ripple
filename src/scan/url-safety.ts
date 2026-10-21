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

/**
 * These are never scanned, even when the private-network opt-in is on. They
 * hand out cloud credentials, and no personal page lives at one of them.
 */
const neverScanHostnames = new Set(['metadata.google.internal', 'metadata']);
const neverScanAddresses = new Set(['169.254.169.254', 'fd00:ec2::254']);

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
  const second = words[1]!;
  const third = words[2]!;

  // Some public IPv6 addresses carry an IPv4 address inside them. They are
  // not private, and treating them as private refuses ordinary public
  // websites on a network that reaches IPv4 through IPv6.
  //
  // IPv4-mapped (::ffff:a.b.c.d) and the deprecated IPv4-compatible form
  // (::a.b.c.d) keep the IPv4 address in the last 32 bits. ::1 lands here as
  // 0.0.0.1, which is refused below like any other loopback address.
  if (first === 0 && second === 0 && third === 0 && words[3] === 0 && words[4] === 0 && (words[5] === 0xffff || words[5] === 0)) {
    return isPublicIp(ipv4FromWords(words, 6));
  }

  // NAT64 well-known prefix 64:ff9b::/96, and the local-use prefix
  // 64:ff9b:1::/48, translate IPv4 into IPv6. The IPv4 address is in the last
  // 32 bits, so the answer is the answer for that IPv4 address.
  if (first === 0x0064 && second === 0xff9b && (third === 0 || third === 1)) {
    return isPublicIp(ipv4FromWords(words, 6));
  }

  // 6to4 (2002::/16) embeds the IPv4 address in bytes two to five.
  if (first === 0x2002) {
    return isPublicIp(ipv4FromWords(words, 1));
  }

  // Teredo (2001:0000::/32) hides the server IPv4 address in bytes eight to
  // eleven and the client IPv4 address, inverted, in the last 32 bits.
  if (first === 0x2001 && second === 0x0000) {
    return isPublicIp(ipv4FromWords(words, 4)) && isPublicIp(invertedIpv4FromWords(words, 6));
  }

  // Only global unicast 2000::/3 is eligible; also reject transition/documentation ranges.
  if ((first & 0xe000) !== 0x2000) return false;
  if (first === 0x2001 && second === 0x0db8) return false; // documentation
  if (first === 0x3fff && (second & 0xf000) === 0x0000) return false; // documentation
  if (first === 0x2001 && second === 0x0002) return false; // benchmarking
  if (first === 0x2001 && second === 0x0010) return false; // ORCHID
  if (first === 0x2001 && (second & 0xfff0) === 0x0020) return false; // ORCHIDv2
  return true;
}

/**
 * The IPv4 address held in two 16-bit words, most significant byte first.
 */
function ipv4FromWords(words: number[], offset: number): string {
  const bytes: number[] = [];
  for (let index = offset; index < offset + 2; index += 1) {
    const word = words[index]!;
    bytes.push((word >> 8) & 0xff, word & 0xff);
  }
  return bytes.join('.');
}

/**
 * Teredo hides the client IPv4 address in the last 32 bits, with every bit
 * inverted.
 */
function invertedIpv4FromWords(words: number[], offset: number): string {
  return ipv4FromWords(words, offset)
    .split('.')
    .map((part) => 255 - Number(part))
    .join('.');
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
  /**
   * Set only when the person scanning asked to reach an address on their own
   * computer. It lifts the private-network and custom-port rules, and nothing
   * else: the cloud metadata addresses stay refused either way.
   */
  allowPrivateNetwork?: boolean;
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
  if (neverScanHostnames.has(hostname)) {
    throw new UnsafeUrlError('That address is never scanned. It is not a website.', 'NEVER_SCANNED');
  }
  const privateNetwork = options.allowPrivateNetwork === true;
  if (blockedHostnames.has(hostname) || blockedHostSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    if (!privateNetwork) throw new UnsafeUrlError('Local and private network addresses cannot be scanned.');
  }
  const ipVersion = isIP(hostname);
  if (ipVersion && neverScanAddresses.has(hostname)) {
    throw new UnsafeUrlError('That address is never scanned. It is not a website.', 'NEVER_SCANNED');
  }
  if (ipVersion && !isPublicIp(hostname) && !privateNetwork) {
    throw new UnsafeUrlError('Local, private, and reserved IP addresses cannot be scanned.');
  }
  if (url.port && !['80', '443'].includes(url.port) && !privateNetwork) {
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
  if (records.length === 0) {
    throw new UnsafeUrlError('The website address could not be resolved.', 'HOST_NOT_FOUND');
  }
  if (records.every((record) => neverScanAddresses.has(record.address))) {
    throw new UnsafeUrlError('That address is never scanned. It is not a website.', 'NEVER_SCANNED');
  }
  if (!privateNetwork && records.some((record) => !isPublicIp(record.address))) {
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
