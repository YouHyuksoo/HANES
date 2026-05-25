import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import {
  SimulationHeader,
  SimulationPlan,
  SimulationSchedule,
} from '../../../entities/simulation-result.entity';
import { SimulationDataService } from './simulation-data.service';
import { SimulationResult, SimulationService } from './simulation.service';

describe('SimulationService', () => {
  let service: SimulationService;
  let planRepo: DeepMocked<Repository<ProdPlan>>;
  let headerRepo: DeepMocked<Repository<SimulationHeader>>;
  let simPlanRepo: DeepMocked<Repository<SimulationPlan>>;
  let simScheduleRepo: DeepMocked<Repository<SimulationSchedule>>;
  let dataService: DeepMocked<SimulationDataService>;

  beforeEach(async () => {
    planRepo = createMock<Repository<ProdPlan>>();
    headerRepo = createMock<Repository<SimulationHeader>>();
    simPlanRepo = createMock<Repository<SimulationPlan>>();
    simScheduleRepo = createMock<Repository<SimulationSchedule>>();
    dataService = createMock<SimulationDataService>();

    headerRepo.create.mockImplementation((v: any) => v);
    simPlanRepo.create.mockImplementation((v: any) => v);
    simScheduleRepo.create.mockImplementation((v: any) => v);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulationService,
        { provide: getRepositoryToken(ProdPlan), useValue: planRepo },
        { provide: getRepositoryToken(SimulationHeader), useValue: headerRepo },
        { provide: getRepositoryToken(SimulationPlan), useValue: simPlanRepo },
        { provide: getRepositoryToken(SimulationSchedule), useValue: simScheduleRepo },
        { provide: SimulationDataService, useValue: dataService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get<SimulationService>(SimulationService);
  });

  it('applies tenant scope in simulate plan query', async () => {
    planRepo.find.mockResolvedValue([] as ProdPlan[]);

    const result = await service.simulate('2026-04', 'C1', 'P1');

    expect(planRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { planMonth: '2026-04', company: 'C1', plant: 'P1' },
      }),
    );
    expect(result).toEqual(expect.objectContaining({ plans: [], schedule: [] }));
  });

  it('uses tenant scope in getLatest header lookup', async () => {
    headerRepo.findOne.mockResolvedValue(null);

    const result = await service.getLatest('2026-04', 'C1', 'P1');

    expect(headerRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { simMonth: '2026-04', company: 'C1', plant: 'P1' },
      }),
    );
    expect(result).toBeNull();
  });

  it('returns latest result only from tenant-matched header', async () => {
    headerRepo.findOne.mockResolvedValue({
      simId: 'SIM-202604-101010',
      totalPlans: 1,
      onTimeCount: 1,
      delayCount: 0,
      totalQty: 100,
      workDays: 20,
      utilizationRate: 85,
      requiredHours: 120,
      availableHours: 140,
    } as any);
    simPlanRepo.find.mockResolvedValue([
      {
        simId: 'SIM-202604-101010',
        planNo: 'PLAN-1',
        itemCode: 'ITEM-1',
        itemName: 'ITEM NAME',
        itemType: 'FINISHED',
        customer: 'CUST',
        customerName: 'CUSTOMER',
        planQty: 100,
        dueDate: '2026-04-25',
        priority: 1,
        startDate: '2026-04-01',
        endDate: '2026-04-10',
        onTime: 'Y',
        delayDays: 0,
        requiredDays: 5,
        bottleneckProcess: 'PROC-A',
        dailyCapa: 20,
      },
    ] as any);

    const result = await service.getLatest('2026-04', 'C1', 'P1');

    expect(simPlanRepo.find).toHaveBeenCalledWith({
      where: { simId: 'SIM-202604-101010' },
    });
    expect(result?.plans).toHaveLength(1);
    expect(result?.summary.totalPlans).toBe(1);
  });

  it('stores tenant values in saveResult header', async () => {
    const payload: SimulationResult = {
      plans: [
        {
          planNo: 'PLAN-1',
          itemCode: 'ITEM-1',
          itemName: 'ITEM NAME',
          itemType: 'FINISHED',
          customer: 'CUST',
          customerName: 'CUSTOMER',
          planQty: 100,
          dueDate: '2026-04-25',
          priority: 1,
          startDate: '2026-04-01',
          endDate: '2026-04-10',
          onTime: true,
          delayDays: 0,
          requiredDays: 5,
          bottleneckProcess: 'PROC-A',
          dailyCapa: 20,
        },
      ],
      schedule: [
        {
          date: '2026-04-01',
          dayOfWeek: 'WED',
          items: [
            {
              planNo: 'PLAN-1',
              itemCode: 'ITEM-1',
              processCode: 'PROC-A',
              processName: 'PROC A',
              qty: 50,
              cumQty: 50,
            },
          ],
        },
      ],
      summary: {
        totalPlans: 1,
        onTimeCount: 1,
        delayCount: 0,
        totalQty: 100,
        workDays: 20,
        utilizationRate: 85,
        requiredHours: 120,
        availableHours: 140,
      },
    };

    await service.saveResult('2026-04', 'DUE_DATE', payload, 'C1', 'P1');

    expect(headerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        simMonth: '2026-04',
        company: 'C1',
        plant: 'P1',
      }),
    );
    expect(simPlanRepo.insert).toHaveBeenCalled();
    expect(simScheduleRepo.insert).toHaveBeenCalled();
  });
});
