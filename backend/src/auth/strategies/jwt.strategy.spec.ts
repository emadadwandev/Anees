import { describe, expect, it } from '@jest/globals';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('exposes both id and sub aliases for existing controller conventions', async () => {
    const strategy = new JwtStrategy({ get: (key: string) => key === 'JWT_ACCESS_SECRET' ? 'secret' : undefined } as never);

    await expect(strategy.validate({ sub: 'user-1', role: 'super_admin', iat: 1, exp: 2 }))
      .resolves.toEqual({ id: 'user-1', sub: 'user-1', role: 'super_admin' });
  });
});
