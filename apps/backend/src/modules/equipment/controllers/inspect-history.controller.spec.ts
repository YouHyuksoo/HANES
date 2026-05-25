import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { InspectHistoryController } from './inspect-history.controller';
import { EquipInspectService } from '../services/equip-inspect.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('InspectHistoryController', () => {
  let controller: InspectHistoryController;
  let equipInspectService: DeepMocked<EquipInspectService>;

  beforeEach(async () => {
    equipInspectService = createMock<EquipInspectService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InspectHistoryController],
      providers: [{ provide: EquipInspectService, useValue: equipInspectService }],
    })
      .setLogger(new MockLoggerService())
      .compile();

    controller = module.get(InspectHistoryController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass tenant to history list lookup', async () => {
    equipInspectService.findAll.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    await controller.findAll({ page: 1, limit: 10 } as any, 'CO', 'P01');

    expect(equipInspectService.findAll).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      'CO',
      'P01',
    );
  });

  it('should pass tenant to summary lookup', async () => {
    equipInspectService.getSummary.mockResolvedValue({ total: 0, byResult: [] });

    await controller.getSummary('CO', 'P01');

    expect(equipInspectService.getSummary).toHaveBeenCalledWith(undefined, 'CO', 'P01');
  });
});
