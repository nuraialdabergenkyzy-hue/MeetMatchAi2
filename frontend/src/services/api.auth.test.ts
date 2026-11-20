import { afterEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth } }));
import { request } from './api';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('authenticated API requests', () => {
  it('attaches the current SDK session bearer only in the request header', async () => {
    auth.getSession.mockResolvedValue({data:{session:{access_token:'test-session-only'}}});
    const fetch = vi.fn().mockResolvedValue(new Response('{"status":"ok"}'));
    vi.stubGlobal('fetch',fetch);
    await request('/api/health');
    expect(fetch).toHaveBeenCalledWith('/api/health',expect.objectContaining({headers:{'Content-Type':'application/json',Authorization:'Bearer test-session-only'},body:undefined}));
  });
  it.each([401,403])('clears the session and signals login on %i', async status => {
    auth.getSession.mockResolvedValue({data:{session:null}});
    auth.signOut.mockResolvedValue({error:null});
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window',{dispatchEvent});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status})));
    await expect(request('/api/profile/me')).rejects.toMatchObject({status,message:'errors.auth'});
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({type:'meetmatch:unauthorized'}));
  });
});
