/**
 * @file src/modules/material/services/receive-label.service.spec.ts
 * @description ReceiveLabelService 단위 테스트 - matUid 채번 + MatLot 생성 + 라벨 발행
 *
 * 초보자 가이드:
 * - findLabelableArrivals: IQC PASS 입하건 조회
 * - createMatLabels: matUid 채번 → MatLot 생성 → 인쇄 로그 저장
 * - NumberingService.nextMatUid()로 채번
 * - 실행: `npx jest --testPathPattern="receive-label.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ReceiveLabelService } from './receive-label.service';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ReceiveLabelService', () => {
  let target: ReceiveLabelService;
  let mockArrivalRepo: DeepMocked<Repository<MatArrival>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPrintLogRepo: DeepMocked<Repository<LabelPrintLog>>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockArrivalRepo = createMock<Repository<MatArrival>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
    mockPrintLogRepo = createMock<Repository<LabelPrintLog>>();
    mockNumbering = createMock<NumberingService>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiveLabelService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: getRepositoryToken(MatArrival), useValue: mockArrivalRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(LabelPrintLog), useValue: mockPrintLogRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ReceiveLabelService>(ReceiveLabelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findLabelableArrivals ───
  describe('findLabelableArrivals', () => {
    it('IQC PASS 입하건 목록을 반환한다', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { arrivalNo: 'ARR-001', seq: 1, itemCode: 'ITEM-001', qty: 100, iqcStatus: 'PASS', poNo: 'PO-001', vendorName: 'V-A', arrivalDate: new Date() } as MatArrival,
        ]),
      };
      mockArrivalRepo.createQueryBuilder.mockReturnValue(mockQb as any);
      mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster]);
      mockPrintLogRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);
      mockMatLotRepo.find.mockResolvedValue([]);

      const result = await target.findLabelableArrivals();

      expect(result).toHaveLength(1);
      expect(result[0].itemName).toBe('커넥터A');
    });

    it('라벨 발행 가능 입하건 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            arrivalNo: 'ARR-001',
            seq: 1,
            itemCode: 'ITEM-001',
            qty: 100,
            iqcStatus: 'PASS',
            poNo: 'PO-001',
            company: 'C1',
            plant: 'P1',
          } as MatArrival,
        ]),
      };
      mockArrivalRepo.createQueryBuilder.mockReturnValue(mockQb as any);
      mockPartRepo.find.mockResolvedValue([]);
      mockPrintLogRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ uidList: JSON.stringify(['MAT-001']), status: 'SUCCESS' } as LabelPrintLog]),
      } as any);
      mockMatLotRepo.find.mockResolvedValue([]);

      await target.findLabelableArrivals('C1', 'P1');

      expect(mockQb.andWhere).toHaveBeenCalledWith('a.company = :company', { company: 'C1' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('a.plant = :plant', { plant: 'P1' });
      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockMatLotRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  // ─── createMatLabels ───
  describe('createMatLabels', () => {
    it('입하건이 존재하지 않으면 NotFoundException', async () => {
      mockArrivalRepo.findOne.mockResolvedValue(null);

      await expect(
        target.createMatLabels({ arrivalId: 'NONE', qty: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('IQC 미합격이면 NotFoundException', async () => {
      mockArrivalRepo.findOne.mockResolvedValue({
        arrivalNo: 'ARR-001', seq: 1, iqcStatus: 'PENDING',
      } as MatArrival);

      await expect(
        target.createMatLabels({ arrivalId: 'ARR-001', qty: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('정상적으로 MatLot을 생성하고 라벨을 발행한다', async () => {
      const arrival = {
        arrivalNo: 'ARR-001', seq: 1, iqcStatus: 'PASS',
        itemCode: 'ITEM-001', poNo: 'PO-001', vendorName: 'V-A',
        company: 'HANES', plant: 'P01', supUid: null,
      } as MatArrival;
      const part = { itemCode: 'ITEM-001', itemName: '커넥터A' } as ItemMaster;

      mockArrivalRepo.findOne.mockResolvedValue(arrival);
      mockPartRepo.findOne.mockResolvedValue(part);
      mockNumbering.nextMatUid.mockResolvedValue('MAT-20260318-001');
      mockQueryRunner.manager.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);

      const result = await target.createMatLabels({ arrivalId: 'ARR-001', arrivalSeq: 1, qty: 2 } as any);

      expect(result).toHaveLength(2);
      expect(mockNumbering.nextMatUid).toHaveBeenCalledTimes(2);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('라벨 생성도 입하건/품목 보강 조회를 요청 테넌트 범위로 제한한다', async () => {
      const arrival = {
        arrivalNo: 'ARR-001', seq: 1, iqcStatus: 'PASS',
        itemCode: 'ITEM-001', poNo: 'PO-001', vendorName: 'V-A',
        company: 'C1', plant: 'P1', supUid: null,
      } as MatArrival;
      mockArrivalRepo.findOne.mockResolvedValue(arrival);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', company: 'C1', plant: 'P1' } as ItemMaster);
      mockNumbering.nextMatUid.mockResolvedValue('MAT-20260318-001');
      mockQueryRunner.manager.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);

      await target.createMatLabels({ arrivalId: 'ARR-001', arrivalSeq: 1, qty: 1 } as any, 'C1', 'P1');

      expect(mockArrivalRepo.findOne).toHaveBeenCalledWith({
        where: { arrivalNo: 'ARR-001', seq: 1, company: 'C1', plant: 'P1' },
      });
      expect(mockPartRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
    });

    it('요청 테넌트와 입하건 테넌트가 다르면 라벨 생성을 차단한다', async () => {
      mockArrivalRepo.findOne.mockResolvedValue({
        arrivalNo: 'ARR-001',
        seq: 1,
        iqcStatus: 'PASS',
        itemCode: 'ITEM-001',
        company: 'OTHER',
        plant: 'P1',
      } as MatArrival);

      await expect(
        target.createMatLabels({ arrivalId: 'ARR-001', arrivalSeq: 1, qty: 1 } as any, 'C1', 'P1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).not.toHaveBeenCalled();
      expect(mockNumbering.nextMatUid).not.toHaveBeenCalled();
    });
  });
});
