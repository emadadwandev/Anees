import { describe, expect, it } from '@jest/globals';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('RolesGuard super-admin boundary', () => {
  it('allows only a super_admin request through a super-admin handler', () => {
    const reflector = {
      getAllAndOverride: () => [Role.super_admin],
    };
    const guard = new RolesGuard(reflector as never);
    const context = {
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.super_admin } }) }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
    expect(guard.canActivate({
      ...context,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.admin } }) }),
    } as never)).toBe(false);
  });
});
