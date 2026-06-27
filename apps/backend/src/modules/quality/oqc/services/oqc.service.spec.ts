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
import { ItemMaster } from '../../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../../shared/transaction.service';

describe('OqcService', () => {
  let target: OqcService;
  let mockOqcRepo: DeepMocked<Repository<OqcRequest>>;
  let mockOqcBoxRepo: DeepMocked<Repository<OqcRequestBox>>;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQr: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockOqcRepo = createMock<Repository<OqcRequest>>();
    mockOqcBoxRepo = createMock<Repository<OqcRequestBox>>();
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQr = createMock<QueryRunner>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQr);
    mockTx.run.mockImplementation(async (callback) => callback(mockQr));
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
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<OqcService>(OqcService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('검사 모달 requestId로 사용할 id에 requestNo를 함께 반환한다', async () => {
      const qb: any = {
        leftJoinAndMapOne: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ requestNo: 'OQC-001', itemCode: 'IT001' }], 1]),
      };
      mockOqcRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await target.findAll({ page: 1, limit: 50 } as any);

      expect(result.data[0]).toEqual(expect.objectContaining({ id: 'OQC-001', requestNo: 'OQC-001' }));
    });
  });

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
    it('should find request and part within tenant only', async () => {
      mockOqcRepo.findOne.mockResolvedValue({ requestNo: 'OQC-001', itemCode: 'IT001', company: 'C1', plant: 'P1' } as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'IT001', itemName: 'Part A', company: 'C1', plant: 'P1' } as any);

      await target.findById('OQC-001', 'C1', 'P1');

      expect(mockOqcRepo.findOne).toHaveBeenCalledWith({
        where: { requestNo: 'OQC-001', company: 'C1', plant: 'P1' },
        relations: ['boxes'],
      });
      expect(mockPartRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'IT001', company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('createRequest', () => {
    it('should create request through TransactionService', async () => {
      const boxes = [{ boxNo: 'BOX-001', qty: 10, status: 'CLOSED', oqcStatus: null, company: 'C1', plant: 'P1' }];
      mockBoxRepo.find.mockResolvedValue(boxes as any);
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockOqcRepo.createQueryBuilder.mockReturnValue(qb);
      mockQr.manager.create.mockImplementation((_entity, payload) => payload as any);
      mockQr.manager.save
        .mockResolvedValueOnce({ requestNo: 'OQC-20260523-001' } as any)
        .mockResolvedValueOnce([] as any);
      mockOqcRepo.findOne.mockResolvedValue({ requestNo: 'OQC-20260523-001', itemCode: 'ITEM-001' } as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as any);

      await target.createRequest({ itemCode: 'ITEM-001', boxIds: ['BOX-001'] } as any, 'C1', 'P1', 'user1');

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('creates request only from boxes in the request tenant', async () => {
      const boxes = [{ boxNo: 'BOX-001', qty: 10, status: 'CLOSED', oqcStatus: null, company: 'C1', plant: 'P1' }];
      mockBoxRepo.find.mockResolvedValue(boxes as any);
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockOqcRepo.createQueryBuilder.mockReturnValue(qb);
      mockQr.manager.create.mockImplementation((_entity, payload) => payload as any);
      mockQr.manager.save
        .mockResolvedValueOnce({ requestNo: 'OQC-20260523-001' } as any)
        .mockResolvedValueOnce([] as any);
      mockOqcRepo.findOne.mockResolvedValue({ requestNo: 'OQC-20260523-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as any);

      await target.createRequest({ itemCode: 'ITEM-001', boxIds: ['BOX-001'] } as any, 'C1', 'P1', 'user1');

      expect(mockBoxRepo.find).toHaveBeenCalledWith({
        where: { boxNo: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(mockQr.manager.create).toHaveBeenCalledWith(
        OqcRequestBox,
        expect.objectContaining({ requestNo: 'OQC-20260523-001', boxNo: 'BOX-001', company: 'C1', plant: 'P1' }),
      );
      expect(mockQr.manager.update).toHaveBeenCalledWith(
        BoxMaster,
        { boxNo: expect.anything(), company: 'C1', plant: 'P1' },
        { oqcStatus: 'PENDING' },
      );
    });

    it('rejects create when a selected box belongs to a different tenant', async () => {
      mockBoxRepo.find.mockResolvedValue([
        { boxNo: 'BOX-001', qty: 10, status: 'CLOSED', oqcStatus: null, company: 'OTHER', plant: 'P1' },
      ] as any);

      await expect(
        target.createRequest({ itemCode: 'ITEM-001', boxIds: ['BOX-001'] } as any, 'C1', 'P1', 'user1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.run).not.toHaveBeenCalled();
    });
  });

  describe('executeInspection', () => {
    it('should execute inspection through TransactionService', async () => {
      mockOqcRepo.findOne
        .mockResolvedValueOnce({
          requestNo: 'OQC-001',
          status: 'PENDING',
          itemCode: 'ITEM-001',
          boxes: [{ boxNo: 'BOX-001' }],
        } as any)
        .mockResolvedValueOnce({ requestNo: 'OQC-001', itemCode: 'ITEM-001' } as any);
      mockBoxRepo.find.mockResolvedValue([{ boxNo: 'BOX-001', status: 'CLOSED' }] as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as any);

      await target.executeInspection('OQC-001', { result: 'PASS' } as any, 'user1');

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('should execute inspection within tenant only', async () => {
      mockOqcRepo.findOne
        .mockResolvedValueOnce({
          requestNo: 'OQC-001',
          status: 'PENDING',
          itemCode: 'ITEM-001',
          company: 'C1',
          plant: 'P1',
          boxes: [{ boxNo: 'BOX-001' }],
        } as any)
        .mockResolvedValueOnce({ requestNo: 'OQC-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as any);
      mockBoxRepo.find.mockResolvedValue([{ boxNo: 'BOX-001', status: 'CLOSED' }] as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as any);

      await target.executeInspection('OQC-001', { result: 'PASS', sampleBoxIds: ['BOX-001'] } as any, 'user1', 'C1', 'P1');

      expect(mockOqcRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { requestNo: 'OQC-001', company: 'C1', plant: 'P1' },
        relations: ['boxes'],
      });
      expect(mockQr.manager.update).toHaveBeenCalledWith(
        OqcRequestBox,
        { requestNo: 'OQC-001', boxNo: expect.anything(), company: 'C1', plant: 'P1' },
        { isSample: 'Y' },
      );
      expect(mockQr.manager.update).toHaveBeenCalledWith(
        OqcRequest,
        { requestNo: 'OQC-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ status: 'PASS', result: 'PASS' }),
      );
      expect(mockQr.manager.update).toHaveBeenCalledWith(
        BoxMaster,
        { boxNo: expect.anything(), company: 'C1', plant: 'P1' },
        { oqcStatus: 'PASS' },
      );
    });

    it('should throw when not PENDING or IN_PROGRESS', async () => {
      mockOqcRepo.findOne.mockResolvedValue({ requestNo: 'OQC-001', status: 'PASS', boxes: [] } as any);
      await expect(target.executeInspection('OQC-001', { result: 'PASS' } as any)).rejects.toThrow(BadRequestException);
    });

    it('should block inspection when downstream has already progressed', async () => {
      mockOqcRepo.findOne.mockResolvedValue({
        requestNo: 'OQC-001',
        status: 'PENDING',
        boxes: [{ boxNo: 'BOX-001' }],
      } as any);
      mockBoxRepo.find.mockResolvedValue([
        { boxNo: 'BOX-001', palletNo: 'PALLET-001', status: 'CLOSED' } as any,
      ]);

      await expect(target.executeInspection('OQC-001', { result: 'PASS' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateResult', () => {
    it('should update result through TransactionService', async () => {
      mockOqcRepo.findOne
        .mockResolvedValueOnce({
          requestNo: 'OQC-001',
          status: 'PENDING',
          itemCode: 'ITEM-001',
          boxes: [{ boxNo: 'BOX-001' }],
        } as any)
        .mockResolvedValueOnce({ requestNo: 'OQC-001', itemCode: 'ITEM-001' } as any);
      mockBoxRepo.find.mockResolvedValue([{ boxNo: 'BOX-001', status: 'CLOSED' }] as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as any);

      await target.updateResult('OQC-001', { result: 'PASS' } as any, 'user1');

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('should update result within tenant only', async () => {
      mockOqcRepo.findOne
        .mockResolvedValueOnce({
          requestNo: 'OQC-001',
          status: 'PENDING',
          itemCode: 'ITEM-001',
          company: 'C1',
          plant: 'P1',
          boxes: [{ boxNo: 'BOX-001' }],
        } as any)
        .mockResolvedValueOnce({ requestNo: 'OQC-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as any);
      mockBoxRepo.find.mockResolvedValue([{ boxNo: 'BOX-001', status: 'CLOSED' }] as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as any);

      await target.updateResult('OQC-001', { result: 'FAIL' } as any, 'user1', 'C1', 'P1');

      expect(mockOqcRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { requestNo: 'OQC-001', company: 'C1', plant: 'P1' },
        relations: ['boxes'],
      });
      expect(mockQr.manager.update).toHaveBeenCalledWith(
        OqcRequest,
        { requestNo: 'OQC-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ status: 'FAIL', result: 'FAIL' }),
      );
      expect(mockQr.manager.update).toHaveBeenCalledWith(
        BoxMaster,
        { boxNo: expect.anything(), company: 'C1', plant: 'P1' },
        { oqcStatus: 'FAIL' },
      );
    });

    it('should block result changes after downstream progress', async () => {
      mockOqcRepo.findOne.mockResolvedValue({
        requestNo: 'OQC-001',
        status: 'PASS',
        boxes: [{ boxNo: 'BOX-001' }],
      } as any);
      mockBoxRepo.find.mockResolvedValue([
        { boxNo: 'BOX-001', palletNo: 'PALLET-001', status: 'CLOSED' } as any,
      ]);

      await expect(
        target.updateResult('OQC-001', { result: 'FAIL' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
