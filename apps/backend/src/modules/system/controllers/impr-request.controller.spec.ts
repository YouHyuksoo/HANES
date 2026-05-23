import { ImprRequestController } from './impr-request.controller';
import { ImprRequestService } from '../services/impr-request.service';

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
});
