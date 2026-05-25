import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

type UserRecord = {
  email: string;
  role: string;
  status: string;
  company: string;
  plant: string;
};

const createContext = (method: string, headers: Record<string, string> = {}): ExecutionContext => {
  const request = {
    method,
    headers: {
      authorization: 'Bearer viewer@example.com',
      ...headers,
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

  return {
    guard: new JwtAuthGuard(repository as any),
    repository,
  };
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
    const { guard } = createGuard(viewer);

    await expect(guard.canActivate(createContext(method))).resolves.toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('blocks VIEWER %s requests', async (method) => {
    const { guard } = createGuard(viewer);

    await expect(guard.canActivate(createContext(method))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows non-VIEWER mutation requests', async () => {
    const { guard } = createGuard({
      ...viewer,
      role: 'OPERATOR',
    });

    await expect(guard.canActivate(createContext('POST'))).resolves.toBe(true);
  });

  it('looks up bearer user within requested tenant headers', async () => {
    const { guard, repository } = createGuard({
      ...viewer,
      company: 'C1',
      plant: 'P1',
    });

    await expect(
      guard.canActivate(createContext('GET', { 'x-company': 'C1', 'x-plant': 'P1' })),
    ).resolves.toBe(true);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { email: 'viewer@example.com', company: 'C1', plant: 'P1' },
      select: ['email', 'role', 'status', 'company', 'plant'],
    });
  });
});
