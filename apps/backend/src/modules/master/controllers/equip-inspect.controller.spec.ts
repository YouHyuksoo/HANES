import { EquipInspectController } from './equip-inspect.controller';
import { EquipInspectService } from '../services/equip-inspect.service';

describe('EquipInspectController', () => {
  it('findAll uses JwtAuthGuard user tenant when tenant headers are absent', async () => {
    const service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    } as unknown as EquipInspectService;
    const controller = new EquipInspectController(service);

    await controller.findAll({} as any, {
      headers: {},
      user: { company: 'C1', plant: 'P1' },
    } as any);

    expect(service.findAll).toHaveBeenCalledWith(expect.anything(), 'C1', 'P1');
  });
});
