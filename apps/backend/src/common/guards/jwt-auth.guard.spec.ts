import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

type UserRecord = {
  email: string;
  role: string;
  status: string;
  company: string;
  plant: string;
};

const createContext = (method: string): ExecutionContext => {
  const request = {
    method,
    headers: {
      authorization: 'Bearer viewer@example.com',
    },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
};

const createGuard = (user: UserRecord) => {
  const repository = {
    findOne: jest.fn().mockResolvedValue(user),
  };

  return new JwtAuthGuard(repository as any);
};

describe('JwtAuthGuard viewer read-only policy', () => {
  const viewer: UserRecord = {
    email: 'viewer@example.com',
    role: 'VIEWER',
    status: 'ACTIVE',
    company: 'HANES',
    plant: 'P01',
  };

  it.each(['GET', 'HEAD', 'OPTIONS'])('allows VIEWER %s requests', async (method) => {
    const guard = createGuard(viewer);

    await expect(guard.canActivate(createContext(method))).resolves.toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('blocks VIEWER %s requests', async (method) => {
    const guard = createGuard(viewer);

    await expect(guard.canActivate(createContext(method))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows non-VIEWER mutation requests', async () => {
    const guard = createGuard({
      ...viewer,
      role: 'OPERATOR',
    });

    await expect(guard.canActivate(createContext('POST'))).resolves.toBe(true);
  });
});
