import { describe, expect, it } from 'vitest';
import { assertSafeUrl, isPublicIp, UnsafeUrlError } from '../../src/scan/url-safety.js';

describe('URL safety policy', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.20', '169.254.169.254', '::1', 'fc00::1', 'fe80::1', '2001:db8::1'])('rejects non-public address %s', (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows public address %s', (address) => {
    expect(isPublicIp(address)).toBe(true);
  });

  // A public website reached through IPv6 that carries an IPv4 address inside
  // it must not be mistaken for a private one. This is what refused ordinary
  // public sites on a network that reaches IPv4 through IPv6.
  it.each([
    ['64:ff9b::14cf:4952', 'NAT64 well-known prefix, public IPv4 inside'],
    ['64:ff9b:1::14cf:4952', 'NAT64 local-use prefix, public IPv4 inside'],
    ['::ffff:8.8.8.8', 'IPv4-mapped'],
    ['2002:14cf:4952::1', '6to4, public IPv4 inside'],
  ])('allows %s (%s)', (address) => {
    expect(isPublicIp(address)).toBe(true);
  });

  it.each([
    ['64:ff9b::7f00:1', 'NAT64 carrying 127.0.0.1'],
    ['64:ff9b::a00:1', 'NAT64 carrying 10.0.0.1'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:10.1.2.3', 'IPv4-mapped private address'],
    ['2002:7f00:1::1', '6to4 carrying 127.0.0.1'],
    ['2001:db8::1', 'documentation'],
    ['3fff::1', 'documentation'],
    ['2001:2::1', 'benchmarking'],
  ])('rejects %s (%s)', (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it('accepts a hostname whose NAT64 answer carries a public IPv4 address', async () => {
    const url = await assertSafeUrl('https://github.com/joyboyreturns', { resolveHostname: async () => [{ address: '64:ff9b::14cf:4952', family: 6 }, { address: '20.207.73.82', family: 4 }] });
    expect(url.hostname).toBe('github.com');
  });

  it('still rejects a NAT64 answer that carries a private IPv4 address', async () => {
    await expect(assertSafeUrl('https://internal.example', { resolveHostname: async () => [{ address: '64:ff9b::7f00:1', family: 6 }] })).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('accepts a public hostname when every resolved address is public', async () => {
    const url = await assertSafeUrl('https://example.com/start', { resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }] });
    expect(url.hostname).toBe('example.com');
  });

  it('rejects mixed public/private DNS answers', async () => {
    await expect(assertSafeUrl('https://example.com', { resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }] })).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('rejects unsupported schemes and URL credentials', async () => {
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toMatchObject({ code: 'UNSAFE_URL' });
    await expect(assertSafeUrl('https://person:secret@example.com')).rejects.toThrow(/usernames or passwords/);
  });

  it('allows only the exact local sample origin when explicitly enabled', async () => {
    await expect(assertSafeUrl('http://127.0.0.1:4317/sample/checkout', { allowLocalSample: true, sampleOrigin: 'http://127.0.0.1:4317' })).resolves.toBeInstanceOf(URL);
    await expect(assertSafeUrl('http://127.0.0.1:4318/sample/checkout', { allowLocalSample: true, sampleOrigin: 'http://127.0.0.1:4317' })).rejects.toThrow(/private/);
  });

  // A person may ask to scan a site running on their own computer. The
  // permission is explicit, and it lifts the private-network and port rules
  // and nothing else.
  describe('with the private-network permission', () => {
    it('accepts a loopback address on any port', async () => {
      await expect(assertSafeUrl('http://127.0.0.1:5173/', { allowPrivateNetwork: true })).resolves.toBeInstanceOf(URL);
      await expect(assertSafeUrl('http://localhost:3000/', { allowPrivateNetwork: true })).resolves.toBeInstanceOf(URL);
    });

    it('accepts a private network address', async () => {
      await expect(assertSafeUrl('http://10.81.11.168:8080/', { allowPrivateNetwork: true })).resolves.toBeInstanceOf(URL);
    });

    it('accepts a hostname that resolves to a private address', async () => {
      await expect(assertSafeUrl('http://my-machine.local:8080/', { allowPrivateNetwork: true, resolveHostname: async () => [{ address: '192.168.1.20', family: 4 }] })).resolves.toBeInstanceOf(URL);
    });

    it('still refuses the cloud credentials addresses', async () => {
      await expect(assertSafeUrl('http://169.254.169.254/', { allowPrivateNetwork: true })).rejects.toMatchObject({ code: 'NEVER_SCANNED' });
      await expect(assertSafeUrl('http://metadata.google.internal/', { allowPrivateNetwork: true })).rejects.toMatchObject({ code: 'NEVER_SCANNED' });
      await expect(assertSafeUrl('http://169.254.169.254/', { allowPrivateNetwork: true, resolveHostname: async () => [{ address: '169.254.169.254', family: 4 }] })).rejects.toMatchObject({ code: 'NEVER_SCANNED' });
    });

    it('still refuses a scheme other than http and https', async () => {
      await expect(assertSafeUrl('file:///etc/passwd', { allowPrivateNetwork: true })).rejects.toThrow();
    });
  });
});
