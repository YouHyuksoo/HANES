import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ProdPlanService } from './prod-plan.service';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProdPlanService', () => {
  let service: ProdPlanService;
  let planRepo: DeepMocked<Repository<ProdPlan>>;
  let partRepo: DeepMocked<Repository<PartMaster>>;
  let jobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let routingGroupRepo: DeepMocked<Repository<RoutingGroup>>;
  let bomMasterRepo: DeepMocked<Repository<BomMaster>>;
  let numbering: DeepMocked<NumberingService>;
  let dataSource: DeepMocked<DataSource>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    planRepo = createMock<Repository<ProdPlan>>();
    partRepo = createMock<Repository<PartMaster>>();
    jobOrderRepo = createMock<Repository<JobOrder>>();
    routingGroupRepo = createMock<Repository<RoutingGroup>>();
    bomMasterRepo = createMock<Repository<BomMaster>>();
    numbering = createMock<NumberingService>();
    dataSource = createMock<DataSource>();
    queryRunner = createMock<QueryRunner>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdPlanService,
        { provide: getRepositoryToken(ProdPlan), useValue: planRepo },
        { provide: getRepositoryToken(PartMaster), useValue: partRepo },
        { provide: getRepositoryToken(JobOrder), useValue: jobOrderRepo },
        { provide: getRepositoryToken(RoutingGroup), useValue: routingGroupRepo },
        { provide: getRepositoryToken(BomMaster), useValue: bomMasterRepo },
        { provide: NumberingService, useValue: numbering },
        { provide: DataSource, useValue: dataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(ProdPlanService);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates plan', async () => {
    partRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-1' } as any);
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any;
    planRepo.createQueryBuilder.mockReturnValue(qb);
    planRepo.create.mockReturnValue({ planNo: 'PP-202603-001' } as any);
    planRepo.save.mockResolvedValue({ planNo: 'PP-202603-001' } as any);
    planRepo.findOne.mockResolvedValue({ planNo: 'PP-202603-001' } as any);

    const result = await service.create({
      planMonth: '2026-03',
      itemCode: 'ITEM-1',
      itemType: 'FINISHED',
      planQty: 10,
    } as any, 'C1', 'P1');

    expect(result?.planNo).toBe('PP-202603-001');
  });

  it('throws when part missing', async () => {
    partRepo.findOne.mockResolvedValue(null);
    await expect(service.create({ itemCode: 'X' } as any)).rejects.toThrow(NotFoundException);
  });

  it('updates only draft plan with tenant scope', async () => {
    planRepo.findOne
      .mockResolvedValueOnce({ planNo: 'PP-1', status: 'DRAFT' } as any)
      .mockResolvedValueOnce({ planNo: 'PP-1', status: 'DRAFT', planQty: 30 } as any);
    planRepo.update.mockResolvedValue({ affected: 1 } as any);

    await service.update('PP-1', { planQty: 30 } as any, 'C1', 'P1');

    expect(planRepo.update).toHaveBeenCalledWith(
      { planNo: 'PP-1', company: 'C1', plant: 'P1' },
      expect.objectContaining({ planQty: 30 }),
    );
  });

  it('bulk confirm updates only draft plans', async () => {
    planRepo.find.mockResolvedValue([
      { planNo: 'PP-1', status: 'DRAFT' },
      { planNo: 'PP-2', status: 'CONFIRMED' },
    ] as any);
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    } as any;
    planRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.bulkConfirm(['PP-1', 'PP-2'], 'C1', 'P1');

    expect(result.count).toBe(1);
    expect(qb.andWhere).toHaveBeenCalled();
  });

  it('close rejects non-confirmed', async () => {
    planRepo.findOne.mockResolvedValue({ planNo: 'PP-1', status: 'DRAFT' } as any);
    await expect(service.close('PP-1', 'C1', 'P1')).rejects.toThrow(BadRequestException);
  });
});
