import { describe, expect, it } from 'vitest';
import { assertSafeUrl, isPublicIp, UnsafeUrlError } from '../../src/scan/url-safety.js';

describe('URL safety policy', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.20', '169.254.169.254', '::1', 'fc00::1', 'fe80::1', '2001:db8::1'])('rejects non-public address %s', (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows public address %s', (address) => {
    expect(isPublicIp(address)).toBe(true);
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
});
