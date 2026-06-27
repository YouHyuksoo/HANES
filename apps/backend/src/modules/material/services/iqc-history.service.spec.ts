import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { IqcHistoryService } from './iqc-history.service';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { SysConfigService } from '../../system/services/sys-config.service';
import { AqlService } from '../../quality/aql/services/aql.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('IqcHistoryService cancel policy', () => {
  let target: IqcHistoryService;
  let mockIqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let mockMatArrivalRepo: DeepMocked<Repository<MatArrival>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatReceivingRepo: DeepMocked<Repository<MatReceiving>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerMasterRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockSysConfigService: DeepMocked<SysConfigService>;
  let mockAqlService: DeepMocked<AqlService>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockIqcLogRepo = createMock<Repository<IqcLog>>();
    mockMatArrivalRepo = createMock<Repository<MatArrival>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatReceivingRepo = createMock<Repository<MatReceiving>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockPartnerMasterRepo = createMock<Repository<PartnerMaster>>();
    mockPartnerMasterRepo.find.mockResolvedValue([]);
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();
    mockSysConfigService = createMock<SysConfigService>();
    mockAqlService = createMock<AqlService>();
    mockTx = createMock<TransactionService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);
    mockAqlService.resolveIqcPolicyByItem.mockResolvedValue({
      itemCode: 'ITEM-001',
      vendorCode: 'SUP-001',
      lotQty: 10,
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      inspectionMode: 'NORMAL',
      result: 'PASS',
      sampleQty: 5,
      defectCritical: 0,
      defectMajor: 0,
      defectMinor: 0,
      majorRule: { aqlCode: 'AQL-II-1.0', aqlValue: 1, codeLetter: 'A', sampleSize: 5, acceptQty: 0, rejectQty: 1 },
      minorRule: { aqlCode: 'AQL-II-2.5', aqlValue: 2.5, codeLetter: 'A', sampleSize: 5, acceptQty: 0, rejectQty: 1 },
      judgeReason: 'AQL 기준 합격',
    });
    mockAqlService.updateVendorInspectionModeAfterLot.mockResolvedValue(null);
    mockAqlService.revertVendorInspectionModeForCanceledLot.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcHistoryService,
        { provide: getRepositoryToken(IqcLog), useValue: mockIqcLogRepo },
        { provide: getRepositoryToken(MatArrival), useValue: mockMatArrivalRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatReceiving), useValue: mockMatReceivingRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerMasterRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: SysConfigService, useValue: mockSysConfigService },
        { provide: AqlService, useValue: mockAqlService },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(IqcHistoryService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('품목 마스터가 누락되어도 IQC 이력 원본 itemCode는 유지한다', async () => {
      const qb = createMock<any>();
      qb.andWhere.mockReturnValue(qb);
      qb.orderBy.mockReturnValue(qb);
      qb.skip.mockReturnValue(qb);
      qb.take.mockReturnValue(qb);
      qb.getMany.mockResolvedValue([
        {
          inspectDate: new Date('2026-04-08'),
          seq: 1,
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          result: 'PASS',
          status: 'DONE',
        } as IqcLog,
      ]);
      qb.getCount.mockResolvedValue(1);
      mockIqcLogRepo.createQueryBuilder.mockReturnValue(qb);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('IQC 이력 품목 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const qb = createMock<any>();
      qb.andWhere.mockReturnValue(qb);
      qb.orderBy.mockReturnValue(qb);
      qb.skip.mockReturnValue(qb);
      qb.take.mockReturnValue(qb);
      qb.getMany.mockResolvedValue([
        {
          inspectDate: new Date('2026-04-08'),
          itemCode: 'ITEM-001',
          result: 'PASS',
          company: 'C1',
          plant: 'P1',
        } as IqcLog,
      ]);
      qb.getCount.mockResolvedValue(1);
      mockIqcLogRepo.createQueryBuilder.mockReturnValue(qb);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });

    it('날짜만 넘어온 조회 종료일은 해당 일자 전체를 포함한다', async () => {
      const qb = createMock<any>();
      qb.andWhere.mockReturnValue(qb);
      qb.orderBy.mockReturnValue(qb);
      qb.skip.mockReturnValue(qb);
      qb.take.mockReturnValue(qb);
      qb.getMany.mockResolvedValue([]);
      qb.getCount.mockResolvedValue(0);
      mockIqcLogRepo.createQueryBuilder.mockReturnValue(qb);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10, fromDate: '2026-06-08', toDate: '2026-06-08' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        "iqc.inspectDate >= TO_DATE(:fromDate, 'YYYY-MM-DD') AND iqc.inspectDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1",
        { fromDate: '2026-06-08', toDate: '2026-06-08' },
      );
    });
  });

  describe('createResult', () => {
    it('요청 회사/공장과 다른 LOT에는 IQC 결과를 등록하지 않는다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        arrivalNo: 'ARR-001',
        company: 'OTHER',
        plant: 'P01',
      } as MatLot);
      mockIqcLogRepo.create.mockReturnValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);

      await expect(
        target.createResult({ matUid: 'MAT-001', result: 'PASS' } as any, 'HANES', 'P01'),
      ).rejects.toThrow('회사 정보가 일치하지 않습니다');

      expect(mockMatLotRepo.update).not.toHaveBeenCalled();
      expect(mockIqcLogRepo.save).not.toHaveBeenCalled();
    });

    it('IQC 결과 등록은 LOT 회사/공장 범위에서 LOT와 품목을 조회/갱신한다', async () => {
      const lot = {
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        arrivalNo: 'ARR-001',
        company: 'HANES',
        plant: 'P01',
      } as MatLot;
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockIqcLogRepo.create.mockReturnValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);

      await target.createResult({ matUid: 'MAT-001', result: 'PASS' } as any, 'HANES', 'P01');

      expect(mockMatLotRepo.findOne).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      });
      expect(mockMatLotRepo.update).toHaveBeenCalledWith(
        { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
        { iqcStatus: 'PASS' },
      );
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' },
      });
    });

    it('품목 마스터가 누락되어도 IQC 결과 응답의 LOT 원본 itemCode는 유지한다', async () => {
      const lot = {
        matUid: 'MAT-001',
        itemCode: 'ITEM-MISSING',
        arrivalNo: 'ARR-001',
        company: 'HANES',
        plant: 'P01',
      } as MatLot;
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockIqcLogRepo.create.mockReturnValue({ matUid: 'MAT-001', itemCode: 'ITEM-MISSING' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-MISSING' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue(null);

      const result = await target.createResult({ matUid: 'MAT-001', result: 'PASS' } as any);

      expect(result).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
        }),
      );
    });
  });

  describe('findPendingArrivals', () => {
    it('검사 대상 목록과 함께 실제 QueryBuilder SQL과 파라미터를 반환한다', async () => {
      const qb: any = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            arrivalNo: 'ARR-001',
            itemCode: 'ITEM-001',
            itemName: 'Item',
            unit: 'EA',
            inspectMethod: 'FULL',
            vendor: 'VENDOR-A',
            totalQty: '20',
            serialCount: '2',
            recvDate: new Date('2026-06-13'),
            createdAt: new Date('2026-06-13T01:00:00Z'),
          },
        ]),
        getSql: jest.fn().mockReturnValue('SELECT ... FROM MAT_LOTS lot WHERE lot.IQC_STATUS = ?'),
        getParameters: jest.fn().mockReturnValue({ iqcStatus: 'PENDING', company: 'HANES', plant: 'P01' }),
      };
      mockMatLotRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await target.findPendingArrivals({ iqcStatus: 'PENDING' }, 'HANES', 'P01');

      expect(result.data).toHaveLength(1);
      expect(result.debugSql).toEqual({
        sql: 'SELECT ... FROM MAT_LOTS lot WHERE lot.IQC_STATUS = ?',
        parameters: { iqcStatus: 'PENDING', company: 'HANES', plant: 'P01' },
      });
    });
  });

  describe('createArrivalResult', () => {
    it('입하단위 IQC 판정은 LOT과 입하 행 상태를 같은 결과로 갱신한다', async () => {
      mockMatLotRepo.find.mockResolvedValue([
        {
          matUid: 'MAT-001',
          arrivalNo: 'ARR-001',
          itemCode: 'ITEM-001',
          iqcStatus: 'PENDING',
          vendor: 'SUP-001',
          initQty: 5,
          company: 'HANES',
          plant: 'P01',
        } as MatLot,
        {
          matUid: 'MAT-002',
          arrivalNo: 'ARR-001',
          itemCode: 'ITEM-001',
          iqcStatus: 'PENDING',
          vendor: 'SUP-001',
          initQty: 5,
          company: 'HANES',
          plant: 'P01',
        } as MatLot,
      ]);
      mockIqcLogRepo.create.mockReturnValue({ arrivalNo: 'ARR-001', itemCode: 'ITEM-001' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ arrivalNo: 'ARR-001', itemCode: 'ITEM-001' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);

      const result = await target.createArrivalResult({
        arrivalNo: 'ARR-001',
        itemCode: 'ITEM-001',
        result: 'PASS',
      } as any, 'HANES', 'P01');

      expect(mockMatLotRepo.update).toHaveBeenCalledWith(
        { arrivalNo: 'ARR-001', itemCode: 'ITEM-001', iqcStatus: 'PENDING', company: 'HANES', plant: 'P01' },
        { iqcStatus: 'PASS' },
      );
      expect(mockMatArrivalRepo.update).toHaveBeenCalledWith(
        { arrivalNo: 'ARR-001', itemCode: 'ITEM-001', iqcStatus: 'PENDING', company: 'HANES', plant: 'P01' },
        { iqcStatus: 'PASS' },
      );
      expect(result).toEqual(expect.objectContaining({ affectedSerials: 2 }));
    });

    it('details.destructive의 불량을 파괴검사 판정에 합류시킨다', async () => {
      const details = JSON.stringify({
        type: 'SERIAL_INSPECTION',
        serials: [{ matUid: 'S1', result: 'PASS', items: [{ itemId: 'CBL-A::1', judge: 'PASS' }] }],
        destructive: [{ seq: 2, inspItemCode: 'IQC-PULL', requiredQty: 5, inspectedQty: 5, defectQty: 1, result: 'FAIL' }],
      });
      mockMatLotRepo.find.mockResolvedValue([
        {
          matUid: 'MAT-001',
          arrivalNo: 'A1',
          itemCode: 'CBL-A',
          iqcStatus: 'PENDING',
          vendor: 'SUP-001',
          initQty: 5,
          company: '40',
          plant: '1000',
        } as MatLot,
      ]);
      mockIqcLogRepo.create.mockReturnValue({ arrivalNo: 'A1', itemCode: 'CBL-A' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ arrivalNo: 'A1', itemCode: 'CBL-A' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'CBL-A', itemName: 'Cable A' } as ItemMaster);

      await target.createArrivalResult({ arrivalNo: 'A1', itemCode: 'CBL-A', result: 'PASS', details } as any, '40', '1000');

      const call = (mockAqlService.resolveIqcPolicyByItem as jest.Mock).mock.calls[0][0];
      expect(call.itemDefectCounts[2]).toBe(1);        // 파괴 불량 합류
      expect(call.itemInspectedCounts[2]).toBe(5);     // 검사수량 합류
    });

    it('입하단위 IQC 저장은 요청 result가 아니라 서버 AQL 판정 결과를 저장한다', async () => {
      mockMatLotRepo.find.mockResolvedValue([
        {
          matUid: 'MAT-001',
          arrivalNo: 'ARR-001',
          itemCode: 'ITEM-001',
          iqcStatus: 'PENDING',
          vendor: 'SUP-001',
          initQty: 100,
          company: 'HANES',
          plant: 'P01',
        } as MatLot,
      ]);
      mockAqlService.resolveIqcPolicyByItem.mockResolvedValue({
        itemCode: 'ITEM-001',
        vendorCode: 'SUP-001',
        lotQty: 100,
        policyCode: 'AQLP-II-1.0-2.5',
        inspectionLevel: 'II',
        inspectionMode: 'NORMAL',
        result: 'FAIL',
        sampleQty: 20,
        defectCritical: 0,
        defectMajor: 2,
        defectMinor: 0,
        majorRule: { aqlCode: 'AQL-II-1.0', aqlValue: 1, codeLetter: 'F', sampleSize: 20, acceptQty: 1, rejectQty: 2 },
        minorRule: null,
        judgeReason: 'Major 불량 2건이 Ac 1 초과',
      });
      mockIqcLogRepo.create.mockReturnValue({ arrivalNo: 'ARR-001', itemCode: 'ITEM-001', result: 'FAIL' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ arrivalNo: 'ARR-001', itemCode: 'ITEM-001', result: 'FAIL' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);
      mockWarehouseRepo.findOne.mockResolvedValue(null);

      const result = await target.createArrivalResult({
        arrivalNo: 'ARR-001',
        itemCode: 'ITEM-001',
        result: 'PASS',
        defectMajor: 2,
      } as any, 'HANES', 'P01');

      expect(mockMatLotRepo.update).toHaveBeenCalledWith(
        { arrivalNo: 'ARR-001', itemCode: 'ITEM-001', iqcStatus: 'PENDING', company: 'HANES', plant: 'P01' },
        { iqcStatus: 'FAIL' },
      );
      expect(mockIqcLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        result: 'FAIL',
        vendorCode: 'SUP-001',
        defectMajor: 2,
        aqlMajorCode: 'AQL-II-1.0',
        aqlMajorAc: 1,
        aqlMajorRe: 2,
      }));
      expect(result).toEqual(expect.objectContaining({ result: 'FAIL' }));
    });

    it('입하단위 IQC 저장은 긴 시리얼 목록을 SAMPLE_BARCODE 500바이트 이내로 요약한다', async () => {
      const scanned = Array.from({ length: 80 }, (_, i) => `MAT-TRACE-${String(i + 1).padStart(4, '0')}`);
      const details = JSON.stringify({
        type: 'SERIAL_INSPECTION',
        serials: scanned.map((matUid) => ({ matUid, result: 'PASS', items: [] })),
      });
      mockMatLotRepo.find.mockResolvedValue([
        {
          matUid: 'MAT-TRACE-0001',
          arrivalNo: 'ARR-TRACE',
          itemCode: 'ITEM-TRACE',
          iqcStatus: 'PENDING',
          vendor: 'SUP-001',
          initQty: 1,
          company: 'HANES',
          plant: 'P01',
        } as MatLot,
      ]);
      mockIqcLogRepo.create.mockImplementation((input) => input as IqcLog);
      mockIqcLogRepo.save.mockImplementation(async (input) => input as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-TRACE', itemName: 'Trace Item' } as ItemMaster);

      await target.createArrivalResult({
        arrivalNo: 'ARR-TRACE',
        itemCode: 'ITEM-TRACE',
        result: 'PASS',
        details,
        sampleBarcode: scanned.join(','),
      } as any, 'HANES', 'P01');

      const saved = (mockIqcLogRepo.create as jest.Mock).mock.calls[0][0];
      expect(Buffer.byteLength(saved.sampleBarcode, 'utf8')).toBeLessThanOrEqual(500);
      expect(saved.sampleBarcode).toContain('MAT-TRACE-0001');
      expect(saved.sampleBarcode).toMatch(/\(\+\d+ more\)$/);
    });

    it('details가 모두 PASS인데 불량코드만 입력된 입하단위 IQC 저장은 차단한다', async () => {
      const details = JSON.stringify({
        type: 'SERIAL_INSPECTION',
        serials: [{ matUid: 'MAT-001', result: 'PASS', items: [{ itemId: 'ITEM-001::1', judge: 'PASS' }] }],
      });
      mockMatLotRepo.find.mockResolvedValue([
        {
          matUid: 'MAT-001',
          arrivalNo: 'ARR-001',
          itemCode: 'ITEM-001',
          iqcStatus: 'PENDING',
          vendor: 'SUP-001',
          initQty: 10,
          company: 'HANES',
          plant: 'P01',
        } as MatLot,
      ]);

      await expect(target.createArrivalResult({
        arrivalNo: 'ARR-001',
        itemCode: 'ITEM-001',
        result: 'PASS',
        details,
        defects: [{ defectCode: 'SCRATCH', qty: 1 }],
      } as any, 'HANES', 'P01')).rejects.toThrow('불량코드는 FAIL 판정 항목과 함께 입력해야 합니다');

      expect(mockAqlService.resolveIqcPolicyByItem).not.toHaveBeenCalled();
      expect(mockIqcLogRepo.save).not.toHaveBeenCalled();
    });

    it('검사항목 없는 수동 FAIL은 불량코드 입력과 함께 저장 경로를 허용한다', async () => {
      const details = JSON.stringify({
        type: 'SERIAL_INSPECTION',
        serials: [{ matUid: 'MAT-001', result: 'FAIL', items: [] }],
      });
      mockMatLotRepo.find.mockResolvedValue([
        {
          matUid: 'MAT-001',
          arrivalNo: 'ARR-001',
          itemCode: 'ITEM-001',
          iqcStatus: 'PENDING',
          vendor: 'SUP-001',
          initQty: 10,
          company: 'HANES',
          plant: 'P01',
        } as MatLot,
      ]);
      mockIqcLogRepo.create.mockReturnValue({ arrivalNo: 'ARR-001', itemCode: 'ITEM-001' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ arrivalNo: 'ARR-001', itemCode: 'ITEM-001' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);

      await target.createArrivalResult({
        arrivalNo: 'ARR-001',
        itemCode: 'ITEM-001',
        result: 'FAIL',
        details,
        defects: [{ defectCode: 'SCRATCH', qty: 1 }],
      } as any, 'HANES', 'P01');

      expect(mockAqlService.resolveIqcPolicyByItem).toHaveBeenCalledWith(expect.objectContaining({
        fallbackDefectCodes: [{ defectCode: 'SCRATCH', qty: 1 }],
      }));
    });
  });

  it('blocks cancel when receiving already exists', async () => {
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 1,
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      result: 'PASS',
      status: 'DONE',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'DONE' } as any);

    await expect(target.cancel('2026-04-08', 1, { reason: 'retest' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('blocks cancel when destruct sample issue already exists', async () => {
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 1,
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      result: 'PASS',
      status: 'DONE',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue(null);
    mockStockTxRepo.findOne.mockResolvedValue({
      transNo: 'TX-001',
      refType: 'IQC_DESTRUCT',
      status: 'DONE',
    } as any);

    await expect(target.cancel('2026-04-08', 1, { reason: 'retest' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('blocks arrival-level PASS cancel when destructive sample issue exists for an arrival lot', async () => {
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 1,
      arrivalNo: 'ARR-001',
      matUid: null,
      itemCode: 'ITEM-001',
      vendorCode: 'SUP-001',
      result: 'PASS',
      status: 'DONE',
      company: 'HANES',
      plant: 'P01',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue(null);
    mockMatLotRepo.find.mockResolvedValue([
      { matUid: 'MAT-001', itemCode: 'ITEM-001', arrivalNo: 'ARR-001', company: 'HANES', plant: 'P01' } as MatLot,
    ]);
    mockStockTxRepo.findOne.mockResolvedValue({
      transNo: 'TX-IQC-DESTRUCT',
      refType: 'IQC_DESTRUCT',
      status: 'DONE',
    } as any);

    await expect(target.cancel('2026-04-08', 1, { reason: 'retest' } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockTx.run).not.toHaveBeenCalled();
  });

  it('reverses IQC fail move before canceling the result', async () => {
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 1,
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      result: 'FAIL',
      status: 'DONE',
      company: 'HANES',
      plant: 'P01',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue(null);
    mockNumbering.nextInTx.mockResolvedValue('TX-CANCEL-001');

    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          transNo: 'TX-FAIL-001',
          fromWarehouseId: 'WH-NORMAL',
          toWarehouseId: 'WH-DEFECT',
          qty: 5,
        })
        .mockResolvedValueOnce({ warehouseCode: 'WH-DEFECT', qty: 5 })
        .mockResolvedValueOnce({ warehouseCode: 'WH-NORMAL', qty: 0 }),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    const result = await target.cancel('2026-04-08', 1, { reason: 'retest' } as any);

    expect(result.status).toBe('CANCELED');
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(
      StockTransaction,
      expect.objectContaining({
        refType: 'IQC_FAIL_CANCEL',
        cancelRefId: 'TX-FAIL-001',
      }),
    );
    expect(manager.findOne).toHaveBeenCalledWith(StockTransaction, {
      where: expect.objectContaining({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' }),
      order: { createdAt: 'DESC' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      IqcLog,
      { inspectDate: new Date('2026-04-08'), seq: 1, company: 'HANES', plant: 'P01' },
      { status: 'CANCELED', remark: 'retest' },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatLot,
      { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { iqcStatus: 'PENDING' },
    );
  });

  it('입하단위 IQC 취소는 LOT과 입하 행 상태를 함께 PENDING으로 복원한다', async () => {
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 1,
      arrivalNo: 'ARR-001',
      matUid: null,
      itemCode: 'ITEM-001',
      result: 'PASS',
      status: 'DONE',
      company: 'HANES',
      plant: 'P01',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue(null);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    const result = await target.cancel('2026-04-08', 1, { reason: 'retest' } as any);

    expect(result.status).toBe('CANCELED');
    expect(manager.update).toHaveBeenCalledWith(
      MatLot,
      { arrivalNo: 'ARR-001', itemCode: 'ITEM-001', iqcStatus: 'PASS', company: 'HANES', plant: 'P01' },
      { iqcStatus: 'PENDING', expireDate: null },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatArrival,
      { arrivalNo: 'ARR-001', itemCode: 'ITEM-001', iqcStatus: 'PASS', company: 'HANES', plant: 'P01' },
      { iqcStatus: 'PENDING' },
    );
  });

  it('IQC 판정 취소 후 업체 검사강도 변경 이력을 원복한다', async () => {
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 1,
      arrivalNo: 'ARR-001',
      matUid: null,
      itemCode: 'ITEM-001',
      vendorCode: 'SUP-001',
      result: 'FAIL',
      status: 'DONE',
      company: 'HANES',
      plant: 'P01',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue(null);
    mockNumbering.nextInTx.mockResolvedValue('TX-CANCEL-001');

    const manager = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.cancel('2026-04-08', 1, { reason: 'retest' } as any);

    expect(mockAqlService.revertVendorInspectionModeForCanceledLot).toHaveBeenCalledWith({
      vendorCode: 'SUP-001',
      arrivalNo: 'ARR-001',
      itemCode: 'ITEM-001',
      company: 'HANES',
      plant: 'P01',
    });
  });

  it('성적서 업로드는 API ISO inspectDate를 Oracle 로컬 timestamp로 매칭한다', async () => {
    const findQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        inspectDate: new Date('2026-06-19T07:56:27.354Z'),
        seq: 1,
        arrivalNo: 'R26061900020',
        itemCode: 'CBL-B',
        result: 'PASS',
        status: 'DONE',
        company: '40',
        plant: '1000',
      } as IqcLog),
    };
    const updateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockIqcLogRepo.findOne.mockResolvedValue(null);
    mockIqcLogRepo.createQueryBuilder
      .mockReturnValueOnce(findQb as any)
      .mockReturnValueOnce(updateQb as any);

    const result = await target.uploadCert(
      '2026-06-19T07:56:27.354Z',
      1,
      'C:/Project/HANES/apps/backend/uploads/iqc-certs/cert.pdf',
      '40',
      '1000',
    );

    expect(findQb.where).toHaveBeenCalledWith(
      "iqc.inspectDate = TO_TIMESTAMP(:inspectTs, 'YYYY-MM-DD HH24:MI:SS.FF3')",
      { inspectTs: '2026-06-19 16:56:27.354' },
    );
    expect(updateQb.where).toHaveBeenCalledWith(
      "INSPECT_DATE = TO_TIMESTAMP(:inspectTs, 'YYYY-MM-DD HH24:MI:SS.FF3')",
      { inspectTs: '2026-06-19 16:56:27.354' },
    );
    expect(result.certFilePath).toBe('C:/Project/HANES/apps/backend/uploads/iqc-certs/cert.pdf');
  });

  it('moves failed IQC stock through TransactionService', async () => {
    const lot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      arrivalNo: 'ARR-001',
      company: 'HANES',
      plant: 'P01',
    } as MatLot;
    mockMatLotRepo.findOne.mockResolvedValue(lot);
    mockIqcLogRepo.create.mockReturnValue({ seq: 1 } as IqcLog);
    mockIqcLogRepo.save.mockResolvedValue({ seq: 1 } as IqcLog);
    mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-DEFECT', company: 'HANES', plant: 'P01' } as Warehouse);
    mockMatStockRepo.findOne.mockResolvedValue({
      warehouseCode: 'WH-NORMAL',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 5,
      company: 'HANES',
      plant: 'P01',
    } as MatStock);
    mockNumbering.nextInTx.mockResolvedValue('TX-IQC-FAIL');
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createResult({ matUid: 'MAT-001', result: 'FAIL' } as any);

    expect(mockWarehouseRepo.findOne).toHaveBeenCalledWith({
      where: { warehouseType: 'DEFECT', useYn: 'Y', company: 'HANES', plant: 'P01' },
    });
    expect(mockMatStockRepo.findOne).toHaveBeenCalledWith({
      where: { matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'WH-NORMAL', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 0 },
    );
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(StockTransaction, expect.objectContaining({
      transNo: 'TX-IQC-FAIL',
      refType: 'IQC_FAIL',
    }));
  });

  it('auto-issues destructive sample through TransactionService', async () => {
    const lot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      arrivalNo: 'ARR-001',
      company: 'HANES',
      plant: 'P01',
    } as MatLot;
    mockMatLotRepo.findOne.mockResolvedValue(lot);
    mockIqcLogRepo.create.mockReturnValue({ seq: 1 } as IqcLog);
    mockIqcLogRepo.save.mockResolvedValue({ seq: 1 } as IqcLog);
    mockSysConfigService.getValue.mockResolvedValue('AUTO_ISSUE');
    mockMatStockRepo.findOne.mockResolvedValue({
      warehouseCode: 'WH-NORMAL',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 10,
      company: 'HANES',
      plant: 'P01',
    } as MatStock);
    mockNumbering.nextInTx.mockResolvedValue('TX-IQC-DESTRUCT');
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createResult({ matUid: 'MAT-001', result: 'PASS', destructSampleQty: 2 } as any);

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(StockTransaction, expect.objectContaining({
      transNo: 'TX-IQC-DESTRUCT',
      refType: 'IQC_DESTRUCT',
    }));
  });
});
