import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Repository, getMetadataArgsStorage } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { WarehouseTransferRule } from '../../../entities/warehouse-transfer-rule.entity';
import { TransferRuleService } from './transfer-rule.service';

describe('TransferRuleService', () => {
  let target: TransferRuleService;
  let mockRuleRepo: DeepMocked<Repository<WarehouseTransferRule>>;

  beforeEach(async () => {
    mockRuleRepo = createMock<Repository<WarehouseTransferRule>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferRuleService,
        { provide: getRepositoryToken(WarehouseTransferRule), useValue: mockRuleRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();

    target = module.get<TransferRuleService>(TransferRuleService);
  });

  afterEach(() => jest.clearAllMocks());

  it('includes tenant columns in transfer rule primary key metadata', () => {
    const primaryColumnNames = getMetadataArgsStorage()
      .columns
      .filter((column) => column.target === WarehouseTransferRule && column.options.primary)
      .map((column) => column.propertyName);

    expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plant']));
  });

  describe('findAll', () => {
    it('joins warehouse names by tenant-scoped warehouse keys', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({ raw: [], entities: [] }),
      };
      mockRuleRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.findAll({ page: 1, limit: 10 }, 'TESTV', 'WAREHOUSES');

    expect(qb.leftJoin).toHaveBeenCalledWith(
      'WAREHOUSES',
      'fw',
      'fw.WAREHOUSE_CODE = rule.FROM_WAREHOUSE_ID AND fw.COMPANY = rule.COMPANY AND fw.PLANT_CD = rule.PLANT_CD',
    );
    expect(qb.leftJoin).toHaveBeenCalledWith(
      'WAREHOUSES',
      'tw',
      'tw.WAREHOUSE_CODE = rule.TO_WAREHOUSE_ID AND tw.COMPANY = rule.COMPANY AND tw.PLANT_CD = rule.PLANT_CD',
    );
    });
  });

  describe('create', () => {
    it('persists company and plant from tenant context', async () => {
      const dto = {
        fromWarehouseId: 'RAW',
        toWarehouseId: 'LINE',
        allowYn: 'Y',
        remark: 'allow raw to line',
      };
      const created = { ...dto, company: 'TESTV', plant: 'WAREHOUSES' } as WarehouseTransferRule;

      mockRuleRepo.findOne.mockResolvedValue(null);
      mockRuleRepo.create.mockReturnValue(created);
      mockRuleRepo.save.mockResolvedValue(created);

      const result = await target.create(dto, 'TESTV', 'WAREHOUSES');

      expect(result).toBe(created);
      expect(mockRuleRepo.findOne).toHaveBeenCalledWith({
        where: {
          fromWarehouseId: 'RAW',
          toWarehouseId: 'LINE',
          company: 'TESTV',
          plant: 'WAREHOUSES',
        },
      });
      expect(mockRuleRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        fromWarehouseId: 'RAW',
        toWarehouseId: 'LINE',
        allowYn: 'Y',
        remark: 'allow raw to line',
        company: 'TESTV',
        plant: 'WAREHOUSES',
      }));
    });

    it('throws ConflictException when same tenant already has the rule', async () => {
      mockRuleRepo.findOne.mockResolvedValue({ fromWarehouseId: 'RAW', toWarehouseId: 'LINE' } as WarehouseTransferRule);

      await expect(target.create({ fromWarehouseId: 'RAW', toWarehouseId: 'LINE' }, 'TESTV', 'WAREHOUSES'))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('findByCompositeKey', () => {
    it('filters by tenant when tenant context is provided', async () => {
      const rule = { fromWarehouseId: 'RAW', toWarehouseId: 'LINE', company: 'TESTV', plant: 'WAREHOUSES' } as WarehouseTransferRule;
      mockRuleRepo.findOne.mockResolvedValue(rule);

      const result = await target.findByCompositeKey('RAW', 'LINE', 'TESTV', 'WAREHOUSES');

      expect(result).toBe(rule);
      expect(mockRuleRepo.findOne).toHaveBeenCalledWith({
        where: {
          fromWarehouseId: 'RAW',
          toWarehouseId: 'LINE',
          company: 'TESTV',
          plant: 'WAREHOUSES',
        },
      });
    });

    it('throws NotFoundException when rule does not exist in tenant', async () => {
      mockRuleRepo.findOne.mockResolvedValue(null);

      await expect(target.findByCompositeKey('RAW', 'LINE', 'TESTV', 'WAREHOUSES'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
