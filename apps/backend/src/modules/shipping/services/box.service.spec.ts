/**
 * @file src/modules/shipping/services/box.service.spec.ts
 * @description BoxService 단위 테스트 - 박스 CRUD + 시리얼 + 상태 + 팔레트 할당
 *
 * 초보자 가이드:
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - 실행: `pnpm test -- -t "BoxService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { BoxService } from './box.service';
import { BoxMaster } from '../../../entities/box-master.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('BoxService', () => {
  let target: BoxService;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockPalletRepo: DeepMocked<Repository<PalletMaster>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockLotRepo: DeepMocked<Repository<MatLot>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockPalletRepo = createMock<Repository<PalletMaster>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockLotRepo = createMock<Repository<MatLot>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoxService,
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxRepo },
        { provide: getRepositoryToken(PalletMaster), useValue: mockPalletRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockLotRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<BoxService>(BoxService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return box when found', async () => {
      const box = { boxNo: 'BOX-001', status: 'OPEN' } as BoxMaster;
      mockBoxRepo.findOne.mockResolvedValue(box);
      const result = await target.findById('BOX-001');
      expect(result.boxNo).toBe('BOX-001');
    });

    it('should throw NotFoundException when not found', async () => {
      mockBoxRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a box', async () => {
      mockBoxRepo.findOne.mockResolvedValue(null);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as PartMaster);
      const created = { boxNo: 'BOX-001', status: 'OPEN' } as BoxMaster;
      mockBoxRepo.create.mockReturnValue(created);
      mockBoxRepo.save.mockResolvedValue(created);

      const result = await target.create({ boxNo: 'BOX-001', itemCode: 'ITEM-001', qty: 10 } as any);
      expect(result.boxNo).toBe('BOX-001');
    });

    it('should throw ConflictException on duplicate boxNo', async () => {
      mockBoxRepo.findOne.mockResolvedValue({ boxNo: 'BOX-001' } as BoxMaster);
      await expect(target.create({ boxNo: 'BOX-001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete an OPEN box without pallet', async () => {
      mockBoxRepo.findOne.mockResolvedValue({ boxNo: 'BOX-001', status: 'OPEN', palletNo: null } as any);
      mockBoxRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const result = await target.delete('BOX-001');
      expect(result.deleted).toBe(true);
    });

    it('should throw BadRequestException when SHIPPED', async () => {
      mockBoxRepo.findOne.mockResolvedValue({ boxNo: 'BOX-001', status: 'SHIPPED' } as any);
      await expect(target.delete('BOX-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeBox', () => {
    it('should close an OPEN box with qty > 0', async () => {
      const box = { boxNo: 'BOX-001', status: 'OPEN', qty: 5 } as any;
      mockBoxRepo.findOne.mockResolvedValue(box);
      mockBoxRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.closeBox('BOX-001');
      expect(mockBoxRepo.update).toHaveBeenCalled();
    });

    it('should throw when box is empty', async () => {
      mockBoxRepo.findOne.mockResolvedValue({ boxNo: 'BOX-001', status: 'OPEN', qty: 0 } as any);
      await expect(target.closeBox('BOX-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated boxes', async () => {
      mockBoxRepo.find.mockResolvedValue([]);
      mockBoxRepo.count.mockResolvedValue(0);
      const result = await target.findAll({} as any);
      expect(result.data).toEqual([]);
    });
  });
});
