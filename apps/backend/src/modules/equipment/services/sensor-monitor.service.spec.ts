import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SensorMonitorService } from './sensor-monitor.service';
import { SensorDataLog } from '../../../entities/sensor-data-log.entity';
import { EquipConditionRule } from '../../../entities/equip-condition-rule.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { PmPlan } from '../../../entities/pm-plan.entity';
import { PmWorkOrder } from '../../../entities/pm-work-order.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('SensorMonitorService', () => {
  let target: SensorMonitorService;
  let sensorRepo: DeepMocked<Repository<SensorDataLog>>;
  let ruleRepo: DeepMocked<Repository<EquipConditionRule>>;
  let equipRepo: DeepMocked<Repository<EquipMaster>>;
  let pmPlanRepo: DeepMocked<Repository<PmPlan>>;
  let pmWorkOrderRepo: DeepMocked<Repository<PmWorkOrder>>;

  const queryBuilder = (rows: unknown[] = []) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
      getOne: jest.fn().mockResolvedValue(null),
    };
    return qb;
  };

  beforeEach(async () => {
    sensorRepo = createMock<Repository<SensorDataLog>>();
    ruleRepo = createMock<Repository<EquipConditionRule>>();
    equipRepo = createMock<Repository<EquipMaster>>();
    pmPlanRepo = createMock<Repository<PmPlan>>();
    pmWorkOrderRepo = createMock<Repository<PmWorkOrder>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SensorMonitorService,
        { provide: getRepositoryToken(SensorDataLog), useValue: sensorRepo },
        { provide: getRepositoryToken(EquipConditionRule), useValue: ruleRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: equipRepo },
        { provide: getRepositoryToken(PmPlan), useValue: pmPlanRepo },
        { provide: getRepositoryToken(PmWorkOrder), useValue: pmWorkOrderRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();

    target = module.get(SensorMonitorService);
    sensorRepo.create.mockImplementation((value: any) => value);
    sensorRepo.save.mockResolvedValue([] as any);
    ruleRepo.createQueryBuilder.mockReturnValue(queryBuilder([]));
    pmPlanRepo.find.mockResolvedValue([{ planCode: 'PM-001' }] as any);
    pmPlanRepo.update.mockResolvedValue({ affected: 1 } as any);
  });

  it('updates usage based PM plans within tenant only', async () => {
    await target.receiveSensorData(
      { items: [{ equipCode: 'EQ-001', sensorType: 'SHOT_COUNT', value: 120 }] } as any,
      'CO',
      'P01',
    );

    expect(pmPlanRepo.find).not.toHaveBeenCalled();
    expect(pmPlanRepo.update).toHaveBeenCalledWith(
      {
        equipCode: 'EQ-001',
        pmType: 'USAGE_BASED',
        usageField: 'SHOT_COUNT',
        useYn: 'Y',
        company: 'CO',
        plant: 'P01',
      },
      { currentUsage: 120 },
    );
  });

  it('rejects sensor rule evaluation when rule tenant differs from request tenant', async () => {
    ruleRepo.createQueryBuilder.mockReturnValue(queryBuilder([
      {
        ruleId: 1,
        equipCode: 'EQ-001',
        sensorType: 'TEMP',
        criticalValue: 80,
        compareOp: 'GT',
        actionType: 'INTERLOCK',
        company: 'OTHER',
        plant: 'P01',
        useYn: 'Y',
      },
    ]));

    await expect(
      target.receiveSensorData(
        { items: [{ equipCode: 'EQ-001', sensorType: 'TEMP', value: 90 }] } as any,
        'CO',
        'P01',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(equipRepo.update).not.toHaveBeenCalled();
    expect(pmWorkOrderRepo.create).not.toHaveBeenCalled();
    expect(pmWorkOrderRepo.save).not.toHaveBeenCalled();
  });
});
