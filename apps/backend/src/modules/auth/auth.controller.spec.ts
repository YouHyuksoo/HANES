import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(() => {
    service = {
      login: jest.fn(),
      register: jest.fn(),
      me: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    controller = new AuthController(service);
  });

  it('passes token and tenant headers to current user lookup', async () => {
    service.me.mockResolvedValue({ email: 'user@test.com' } as any);

    await controller.me({
      headers: {
        authorization: 'Bearer user@test.com',
        'x-company': 'C1',
        'x-plant': 'P1',
      },
    } as any);

    expect(service.me).toHaveBeenCalledWith('user@test.com', 'C1', 'P1');
  });

  it('rejects missing bearer token', async () => {
    await expect(controller.me({ headers: {} } as any)).rejects.toThrow(UnauthorizedException);
  });
});
