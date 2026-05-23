import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
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
