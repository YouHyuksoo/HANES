import { EquipInspectItemPoolController } from './equip-inspect-item-pool.controller';
import { EquipInspectItemPoolService } from '../services/equip-inspect-item-pool.service';

describe('EquipInspectItemPoolController', () => {
  it('findAll uses JwtAuthGuard user tenant when tenant headers are absent', async () => {
    const service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    } as unknown as EquipInspectItemPoolService;
    const controller = new EquipInspectItemPoolController(service);

    await controller.findAll({} as any, {
      headers: {},
      user: { company: 'C1', plant: 'P1' },
    } as any);

    expect(service.findAll).toHaveBeenCalledWith(expect.anything(), 'C1', 'P1');
  });
});
