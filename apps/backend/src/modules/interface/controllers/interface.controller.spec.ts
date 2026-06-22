import { InterfaceController } from './interface.controller';
import { InterfaceService } from '../services/interface.service';
import { parseDateStart } from '../../../shared/date.util';

describe('InterfaceController', () => {
  let controller: InterfaceController;
  let service: jest.Mocked<InterfaceService>;

  beforeEach(() => {
    service = {
      findAllLogs: jest.fn(),
      findLogById: jest.fn(),
      retryLog: jest.fn(),
      bulkRetry: jest.fn(),
      receiveJobOrder: jest.fn(),
      syncBom: jest.fn(),
      syncPart: jest.fn(),
      scheduledSyncItemMaster: jest.fn(),
      sendProdResult: jest.fn(),
      getSummary: jest.fn(),
      getFailedLogs: jest.fn(),
      getRecentLogs: jest.fn(),
    } as unknown as jest.Mocked<InterfaceService>;

    controller = new InterfaceController(service);
  });

  it('passes tenant to log detail lookup', async () => {
    service.findLogById.mockResolvedValue({ seq: 1 } as any);

    await controller.findLogById('2026-05-23', '1', 'C1', 'P1');

    // 컨트롤러는 parseDateStart로 로컬 자정 Date를 만들어 전달한다 (UTC off-by-one 방지)
    expect(service.findLogById).toHaveBeenCalledWith(parseDateStart('2026-05-23'), 1, 'C1', 'P1');
  });

  it('passes tenant to single retry', async () => {
    service.retryLog.mockResolvedValue({ seq: 1 } as any);

    await controller.retryLog('2026-05-23', '1', 'C1', 'P1');

    expect(service.retryLog).toHaveBeenCalledWith(parseDateStart('2026-05-23'), 1, 'C1', 'P1');
  });

  it('passes tenant to bulk retry', async () => {
    service.bulkRetry.mockResolvedValue([{ success: true }] as any);

    await controller.bulkRetry({ logIds: [{ transDate: '2026-05-23', seq: 1 }] } as any, 'C1', 'P1');

    expect(service.bulkRetry).toHaveBeenCalledWith(
      [{ transDate: parseDateStart('2026-05-23'), seq: 1 }],
      'C1',
      'P1',
    );
  });

  it('passes tenant to summary and log widgets', async () => {
    service.getSummary.mockResolvedValue({ total: 0 } as any);
    service.getFailedLogs.mockResolvedValue([] as any);
    service.getRecentLogs.mockResolvedValue([] as any);

    await controller.getSummary('C1', 'P1');
    await controller.getFailedLogs('C1', 'P1');
    await controller.getRecentLogs(5, 'C1', 'P1');

    expect(service.getSummary).toHaveBeenCalledWith('C1', 'P1');
    expect(service.getFailedLogs).toHaveBeenCalledWith('C1', 'P1');
    expect(service.getRecentLogs).toHaveBeenCalledWith(5, 'C1', 'P1');
  });
});
