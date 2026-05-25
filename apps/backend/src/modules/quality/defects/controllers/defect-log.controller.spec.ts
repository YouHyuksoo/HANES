import { DefectLogController } from './defect-log.controller';
import { DefectLogService } from '../services/defect-log.service';

describe('DefectLogController', () => {
  let controller: DefectLogController;
  let service: jest.Mocked<DefectLogService>;

  beforeEach(() => {
    service = {
      getPendingDefects: jest.fn().mockResolvedValue([]),
      getStatsByDefectType: jest.fn().mockResolvedValue([]),
      getStatsByStatus: jest.fn().mockResolvedValue([]),
      getDailyDefectTrend: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DefectLogService>;
    controller = new DefectLogController(service);
  });

  it('passes tenant to pending defect lookup', async () => {
    await controller.getPendingDefects('HANES', 'P01');

    expect(service.getPendingDefects).toHaveBeenCalledWith('HANES', 'P01');
  });

  it('passes tenant to defect type stats', async () => {
    await controller.getStatsByType('2026-03-01', '2026-03-31', 'HANES', 'P01');

    expect(service.getStatsByDefectType).toHaveBeenCalledWith('2026-03-01', '2026-03-31', 'HANES', 'P01');
  });

  it('passes tenant to defect status stats', async () => {
    await controller.getStatsByStatus('2026-03-01', '2026-03-31', 'HANES', 'P01');

    expect(service.getStatsByStatus).toHaveBeenCalledWith('2026-03-01', '2026-03-31', 'HANES', 'P01');
  });

  it('passes tenant to daily defect trend', async () => {
    await controller.getDailyTrend('14', 'HANES', 'P01');

    expect(service.getDailyDefectTrend).toHaveBeenCalledWith(14, 'HANES', 'P01');
  });
});
