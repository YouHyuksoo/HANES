import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DeepMocked<DashboardService>;

  beforeEach(async () => {
    service = createMock<DashboardService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    })
      .setLogger(new MockLoggerService())
      .compile();

    controller = module.get(DashboardController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass tenant to KPI lookup', async () => {
    service.getKpi.mockResolvedValue({} as any);

    await controller.getKpi('CO', 'P01');

    expect(service.getKpi).toHaveBeenCalledWith('CO', 'P01');
  });

  it('should pass tenant to summary lookup', async () => {
    service.getSummary.mockResolvedValue({} as any);

    await controller.getSummary('2026-05-23', 'CO', 'P01');

    expect(service.getSummary).toHaveBeenCalledWith('2026-05-23', 'CO', 'P01');
  });

  it('should pass tenant to recent productions lookup', async () => {
    service.getRecentProductions.mockResolvedValue([]);

    await controller.getRecentProductions('CO', 'P01');

    expect(service.getRecentProductions).toHaveBeenCalledWith('CO', 'P01');
  });
});
