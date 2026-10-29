import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const {clearAuthCookies, callWorfApi, refreshAccessToken, getServerAccessToken, getServerRefreshToken} = vi.hoisted(
  () => ({
    clearAuthCookies: vi.fn(),
    callWorfApi: vi.fn(),
    refreshAccessToken: vi.fn(),
    getServerAccessToken: vi.fn(),
    getServerRefreshToken: vi.fn()
  })
);

vi.mock('@/lib/server/auth', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/server/auth')>()),
  clearAuthCookies
}));
vi.mock('@/lib/server/worf', () => ({callWorfApi}));
vi.mock('@/lib/server/session-refresh', () => ({refreshAccessToken}));
vi.mock('@/lib/utils/cookies', () => ({getServerAccessToken, getServerRefreshToken}));

import {POST} from '../route';

describe('POST /api/auth/logout', () => {
  const originalEnv = {...process.env};

  beforeEach(() => {
    process.env = {...originalEnv, WORF_CLIENT_ID: 'client-1', WORF_CLIENT_SECRET: 'secret-1'};
    getServerAccessToken.mockResolvedValue('access-1');
    getServerRefreshToken.mockResolvedValue('refresh-1');
    callWorfApi.mockResolvedValue({status: 200, data: {message: 'Kijelentkezés sikeres.'}});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = {...originalEnv};
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('revokes both tokens upstream with exactly the fields the backend accepts', async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(callWorfApi).toHaveBeenCalledWith('/v1/auth/logout', {
      method: 'POST',
      body: {
        grant_type: 'password',
        client_id: 'client-1',
        client_secret: 'secret-1',
        access_token: 'access-1',
        refresh_token: 'refresh-1'
      }
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(clearAuthCookies).toHaveBeenCalledTimes(1);
  });

  it('mints a fresh token pair first when the access cookie has already expired', async () => {
    getServerAccessToken.mockResolvedValue(undefined);
    refreshAccessToken.mockResolvedValue({
      status: 200,
      data: {access_token: 'access-2', refresh_token: 'refresh-2'}
    });

    await POST();

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(callWorfApi).toHaveBeenCalledWith(
      '/v1/auth/logout',
      expect.objectContaining({
        body: expect.objectContaining({access_token: 'access-2', refresh_token: 'refresh-2'})
      })
    );
    expect(clearAuthCookies).toHaveBeenCalledTimes(1);
  });

  it('skips the upstream call when the session can no longer be refreshed', async () => {
    getServerAccessToken.mockResolvedValue(undefined);
    refreshAccessToken.mockResolvedValue({status: 401, data: {detail: 'Invalid or expired token.'}});

    const response = await POST();

    expect(response.status).toBe(200);
    expect(callWorfApi).not.toHaveBeenCalled();
    expect(clearAuthCookies).toHaveBeenCalledTimes(1);
  });

  it('skips the upstream call when there is no refresh token to revoke', async () => {
    getServerRefreshToken.mockResolvedValue(undefined);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(callWorfApi).not.toHaveBeenCalled();
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(clearAuthCookies).toHaveBeenCalledTimes(1);
  });

  it('clears the auth cookies when the backend says the session is already invalid', async () => {
    callWorfApi.mockResolvedValue({status: 401, data: {detail: 'Invalid or expired token.'}});

    const response = await POST();

    expect(response.status).toBe(200);
    expect(clearAuthCookies).toHaveBeenCalledTimes(1);
  });

  it('still clears the auth cookies when the client credentials are not configured', async () => {
    delete process.env.WORF_CLIENT_SECRET;

    const response = await POST();

    expect(response.status).toBe(200);
    expect(callWorfApi).not.toHaveBeenCalled();
    expect(clearAuthCookies).toHaveBeenCalledTimes(1);
  });

  it('still clears the auth cookies when the upstream call fails', async () => {
    callWorfApi.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await POST();

    expect(response.status).toBe(200);
    expect(clearAuthCookies).toHaveBeenCalledTimes(1);
  });
});
