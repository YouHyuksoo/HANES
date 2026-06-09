import { DailyInspectController } from './daily-inspect.controller';
import { EquipInspectService } from '../services/equip-inspect.service';

describe('DailyInspectController', () => {
  it('keeps WORKER inspect type for input kiosk worker inspection saves', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({
        equipCode: 'EQ-CUT-01',
        inspectType: 'WORKER',
        overallResult: 'PASS',
      }),
    } as unknown as jest.Mocked<EquipInspectService>;
    const controller = new DailyInspectController(service);

    const response = await controller.create({
      equipCode: 'EQ-CUT-01',
      inspectType: 'WORKER',
      inspectDate: '2026-06-09',
      inspectorName: '홍길동',
      overallResult: 'PASS',
      details: { items: [{ seq: 1, result: 'OK' }] },
    } as any, '40', '1000');

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
      equipCode: 'EQ-CUT-01',
      inspectType: 'WORKER',
      details: { items: [{ seq: 1, result: 'OK' }] },
    }), { company: '40', plant: '1000' });
    expect(response.message).toBe('작업자설비점검이 등록되었습니다.');
  });

  it('defaults non-worker saves to DAILY', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({
        equipCode: 'EQ-CUT-01',
        inspectType: 'DAILY',
        overallResult: 'PASS',
      }),
    } as unknown as jest.Mocked<EquipInspectService>;
    const controller = new DailyInspectController(service);

    await controller.create({
      equipCode: 'EQ-CUT-01',
      inspectType: 'PERIODIC',
      inspectDate: '2026-06-09',
    } as any, '40', '1000');

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
      inspectType: 'DAILY',
    }), { company: '40', plant: '1000' });
  });
});
