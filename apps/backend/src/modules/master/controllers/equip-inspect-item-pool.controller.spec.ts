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

  it('uploadImage stores the uploaded image URL on the item master', async () => {
    const service = {
      updateImage: jest.fn().mockResolvedValue({
        itemCode: 'EIP-001',
        imageUrl: '/uploads/equip-inspect-items/equip-inspect-item-1.png',
      }),
    } as unknown as EquipInspectItemPoolService;
    const controller = new EquipInspectItemPoolController(service);

    const result = await (controller as any).uploadImage(
      'EIP-001',
      { filename: 'equip-inspect-item-1.png' },
      {
        headers: {},
        user: { company: 'C1', plant: 'P1' },
      },
    );

    expect(service.updateImage).toHaveBeenCalledWith(
      'EIP-001',
      '/uploads/equip-inspect-items/equip-inspect-item-1.png',
      'C1',
      'P1',
    );
    expect(result.data.imageUrl).toBe('/uploads/equip-inspect-items/equip-inspect-item-1.png');
  });
});
