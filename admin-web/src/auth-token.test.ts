import { describe, expect, it, vi } from 'vitest';
import { getJwtExpiryMs, isAccessTokenExpired, refreshAccessToken } from './auth-token';

function tokenWithExpiry(exp: number) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `header.${payload}.signature`;
}

describe('admin access-token lifecycle', () => {
  it('reads JWT expiry and treats an expired token as refreshable', () => {
    const token = tokenWithExpiry(1_700_000_000);
    expect(getJwtExpiryMs(token)).toBe(1_700_000_000_000);
    expect(isAccessTokenExpired(token, 1_700_000_000_000)).toBe(true);
  });

  it('refreshes an expired access token through the backend auth endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      accessToken: tokenWithExpiry(1_800_000_000),
      refreshToken: 'rotated-refresh-token',
    }), { status: 200 }));

    await expect(refreshAccessToken({
      userId: 'admin-user',
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
    }, fetcher, 'http://backend:3000')).resolves.toEqual({
      accessToken: expect.stringContaining('header.'),
      refreshToken: 'rotated-refresh-token',
      accessTokenExpiresAt: 1_800_000_000_000,
    });

    expect(fetcher).toHaveBeenCalledWith('http://backend:3000/v1/auth/refresh', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ userId: 'admin-user', refreshToken: 'old-refresh-token' }),
    }));
  });
});
