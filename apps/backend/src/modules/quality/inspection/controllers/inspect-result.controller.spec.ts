import { InspectResultController } from './inspect-result.controller';
import { InspectResultService } from '../services/inspect-result.service';

describe('InspectResultController', () => {
  let controller: InspectResultController;
  let service: jest.Mocked<InspectResultService>;

  beforeEach(() => {
    service = {
      getPassRate: jest.fn().mockResolvedValue({}),
      getStatsByType: jest.fn().mockResolvedValue([]),
      getDailyPassRateTrend: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<InspectResultService>;
    controller = new InspectResultController(service);
  });

  it('passes tenant to pass-rate stats', async () => {
    await controller.getPassRate('2026-03-01', '2026-03-31', 'OQC', 'C1', 'P1');

    expect(service.getPassRate).toHaveBeenCalledWith('2026-03-01', '2026-03-31', 'OQC', 'C1', 'P1');
  });

  it('passes tenant to inspection type stats', async () => {
    await controller.getStatsByType('2026-03-01', '2026-03-31', 'C1', 'P1');

    expect(service.getStatsByType).toHaveBeenCalledWith('2026-03-01', '2026-03-31', 'C1', 'P1');
  });

  it('passes tenant to daily trend stats', async () => {
    await controller.getDailyTrend('14', 'C1', 'P1');

    expect(service.getDailyPassRateTrend).toHaveBeenCalledWith(14, 'C1', 'P1');
  });
});
