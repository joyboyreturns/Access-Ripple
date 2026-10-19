import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScan, rescan } from '../../web/src/api.js';

afterEach(()=>vi.unstubAllGlobals());
describe('studio API requests',()=>{
  it('does not label a bodyless rescan as JSON, which Fastify rejects',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({scanId:'next'})});
    vi.stubGlobal('fetch',fetch);
    await expect(rescan('old')).resolves.toEqual({scanId:'next'});
    const init=fetch.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has('content-type')).toBe(false);
  });
  it('sends a new URL scan as a JSON body',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({scanId:'new'})});
    vi.stubGlobal('fetch',fetch);
    await createScan({url:'https://example.com/'});
    const init=fetch.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({url:'https://example.com/'});
  });
  it('carries the form-testing permission into new scans and rescans',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({scanId:'next'})});
    vi.stubGlobal('fetch',fetch);
    await createScan({url:'https://example.com/',authorizeSubmit:true});
    expect(JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body))).toEqual({url:'https://example.com/',authorizeSubmit:true});
    await rescan('old',{authorizeSubmit:false});
    const init=fetch.mock.calls[1]![1] as RequestInit;
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({authorizeSubmit:false});
  });
});
