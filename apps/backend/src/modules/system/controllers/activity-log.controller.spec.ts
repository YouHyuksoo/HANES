import { ActivityLogController } from './activity-log.controller';
import { ActivityLogService } from '../services/activity-log.service';

describe('ActivityLogController', () => {
  it('create uses JwtAuthGuard user tenant when tenant headers are absent', async () => {
    const service = {
      logActivity: jest.fn().mockResolvedValue(undefined),
    } as unknown as ActivityLogService;
    const controller = new ActivityLogController(service);

    await controller.create({ activityType: 'VIEW', pagePath: '/dashboard' } as any, {
      headers: { authorization: 'Bearer user@test.com' },
      user: { company: 'C1', plant: 'P1' },
      ip: '127.0.0.1',
    } as any);

    expect(service.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ company: 'C1', plant: 'P1' }),
    );
  });

  it('create uses JwtAuthGuard user id instead of raw bearer token when present', async () => {
    const service = {
      logActivity: jest.fn().mockResolvedValue(undefined),
    } as unknown as ActivityLogService;
    const controller = new ActivityLogController(service);

    await controller.create({ activityType: 'VIEW', pagePath: '/dashboard' } as any, {
      headers: { authorization: 'Bearer stale-token@test.com' },
      user: { id: 'guard-user@test.com', company: 'C1', plant: 'P1' },
      ip: '127.0.0.1',
    } as any);

    expect(service.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'guard-user@test.com', company: 'C1', plant: 'P1' }),
    );
  });

  it('findAll uses JwtAuthGuard user tenant when tenant headers are absent', async () => {
    const service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    } as unknown as ActivityLogService;
    const controller = new ActivityLogController(service);

    await controller.findAll({} as any, {
      headers: {},
      user: { company: 'C1', plant: 'P1' },
    } as any);

    expect(service.findAll).toHaveBeenCalledWith(expect.anything(), 'C1', 'P1');
  });
});
