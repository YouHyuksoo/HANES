import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { SimulationService } from '../services/simulation.service';
import { SimulationController } from './simulation.controller';

describe('SimulationController', () => {
  let controller: SimulationController;
  let simulationService: DeepMocked<SimulationService>;

  beforeEach(() => {
    simulationService = createMock<SimulationService>();
    controller = new SimulationController(simulationService);
  });

  it('passes tenant scope to simulate', async () => {
    simulationService.simulate.mockResolvedValue({
      plans: [],
      schedule: [],
      summary: {
        totalPlans: 0,
        onTimeCount: 0,
        delayCount: 0,
        totalQty: 0,
        workDays: 0,
        utilizationRate: 0,
        requiredHours: 0,
        availableHours: 0,
      },
    } as any);

    await controller.simulate({ month: '2026-04', strategy: 'DUE_DATE' }, 'C1', 'P1');

    expect(simulationService.simulate).toHaveBeenCalledWith(
      '2026-04',
      'C1',
      'P1',
      'DUE_DATE',
      undefined,
      expect.any(Object),
    );
  });

  it('passes tenant scope to saveResult', async () => {
    simulationService.saveResult.mockResolvedValue(undefined);

    await controller.save(
      {
        month: '2026-04',
        strategy: 'DUE_DATE',
        result: {
          plans: [],
          schedule: [],
          summary: {
            totalPlans: 0,
            onTimeCount: 0,
            delayCount: 0,
            totalQty: 0,
            workDays: 0,
            utilizationRate: 0,
            requiredHours: 0,
            availableHours: 0,
          },
        },
      },
      'C1',
      'P1',
    );

    expect(simulationService.saveResult).toHaveBeenCalledWith(
      '2026-04',
      'DUE_DATE',
      expect.any(Object),
      'C1',
      'P1',
      expect.any(Object),
    );
  });

  it('returns success with null data when tenant has no latest result', async () => {
    simulationService.getLatest.mockResolvedValue(null);

    const res = await controller.getLatest('2026-04', 'C1', 'P1');

    expect(simulationService.getLatest).toHaveBeenCalledWith('2026-04', 'C1', 'P1');
    expect(res.success).toBe(true);
    expect(res.data).toBeNull();
  });
});
