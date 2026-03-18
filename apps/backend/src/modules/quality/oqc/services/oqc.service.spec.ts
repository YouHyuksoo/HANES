/**
 * @file oqc.service.spec.ts
 * @description OqcService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { OqcService } from './oqc.service';
import { OqcRequest } from '../../../../entities/oqc-request.entity';
import { OqcRequestBox } from '../../../../entities/oqc-request-box.entity';
import { BoxMaster } from '../../../../entities/box-master.entity';
import { PartMaster } from '../../../../entities/part-master.entity';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('OqcService', () => {
  let target: OqcService;
  let mockOqcRepo: DeepMocked<Repository<OqcRequest>>;
  let mockOqcBoxRepo: DeepMocked<Repository<OqcRequestBox>>;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockOqcRepo = createMock<Repository<OqcRequest>>();
    mockOqcBoxRepo = createMock<Repository<OqcRequestBox>>();
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    const mockQr = createMock<QueryRunner>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQr);
    mockQr.connect.mockResolvedValue(undefined);
    mockQr.startTransaction.mockResolvedValue(undefined);
    mockQr.commitTransaction.mockResolvedValue(undefined);
    mockQr.rollbackTransaction.mockResolvedValue(undefined);
    mockQr.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OqcService,
        { provide: getRepositoryToken(OqcRequest), useValue: mockOqcRepo },
        { provide: getRepositoryToken(OqcRequestBox), useValue: mockOqcBoxRepo },
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<OqcService>(OqcService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return OQC request with part', async () => {
      mockOqcRepo.findOne.mockResolvedValue({ requestNo: 'OQC-001', itemCode: 'IT001' } as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'IT001', itemName: 'Part A' } as any);
      const r = await target.findById('OQC-001');
      expect(r.requestNo).toBe('OQC-001');
    });
    it('should throw NotFoundException', async () => {
      mockOqcRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('executeInspection', () => {
    it('should throw when not PENDING or IN_PROGRESS', async () => {
      mockOqcRepo.findOne.mockResolvedValue({ requestNo: 'OQC-001', status: 'PASS', boxes: [] } as any);
      await expect(target.executeInspection('OQC-001', { result: 'PASS' } as any)).rejects.toThrow(BadRequestException);
    });
  });
});
