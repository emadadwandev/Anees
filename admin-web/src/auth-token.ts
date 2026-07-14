export function getJwtExpiryMs(accessToken: string): number | null {
  try {
    const encodedPayload = accessToken.split('.')[1];
    if (!encodedPayload) return null;
    const base64Payload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=');
    const payload = JSON.parse(atob(paddedPayload)) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(accessToken: string, now = Date.now(), skewMs = 30_000): boolean {
  const expiresAt = getJwtExpiryMs(accessToken);
  return expiresAt === null || expiresAt <= now + skewMs;
}

export async function refreshAccessToken(
  input: { userId: string; accessToken: string; refreshToken: string },
  fetcher: typeof fetch = fetch,
  baseUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000',
) {
  const response = await fetcher(`${baseUrl}/v1/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: input.userId, refreshToken: input.refreshToken }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof body.message === 'string' ? body.message : `Token refresh failed (${response.status})`);
  }
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
  const accessTokenExpiresAt = getJwtExpiryMs(accessToken);
  if (!accessToken || accessTokenExpiresAt === null) throw new Error('Token refresh returned an invalid access token');
  return {
    accessToken,
    refreshToken: typeof body.refreshToken === 'string' ? body.refreshToken : input.refreshToken,
    accessTokenExpiresAt,
  };
}
