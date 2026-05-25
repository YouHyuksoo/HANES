import { ImprRequestController } from './impr-request.controller';
import { ImprRequestService } from '../services/impr-request.service';
import { BadRequestException } from '@nestjs/common';

describe('ImprRequestController', () => {
  it('findAll uses JwtAuthGuard user company and plant when tenant headers are absent', async () => {
    const service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    } as unknown as ImprRequestService;
    const controller = new ImprRequestController(service);

    await controller.findAll({} as any, {
      headers: {},
      user: { company: 'C1', plant: 'P1' },
    } as any);

    expect(service.findAll).toHaveBeenCalledWith(expect.anything(), 'C1', 'P1');
  });

  it('create uses JwtAuthGuard user id instead of raw bearer token when present', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ imprId: 'REQ-1' }),
    } as unknown as ImprRequestService;
    const controller = new ImprRequestController(service);

    await controller.create({ description: 'fix', pageUrl: '/dashboard' } as any, {
      headers: { authorization: 'Bearer stale-token@test.com' },
      user: { id: 'guard-user@test.com', company: 'C1', plant: 'P1' },
    } as any);

    expect(service.create).toHaveBeenCalledWith(
      expect.anything(),
      'guard-user@test.com',
      null,
      'C1',
      'P1',
    );
  });

  it('does not silently default missing tenant to JSHANES', async () => {
    const service = {
      findAll: jest.fn(),
    } as unknown as ImprRequestService;
    const controller = new ImprRequestController(service);

    await expect(controller.findAll({} as any, { headers: {} } as any)).rejects.toThrow(BadRequestException);
    expect(service.findAll).not.toHaveBeenCalled();
  });
});
