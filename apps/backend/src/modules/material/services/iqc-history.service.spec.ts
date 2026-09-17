import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { IqcHistoryService } from './iqc-history.service';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { IqcLogTarget } from '../../../entities/iqc-log-target.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { IqcRequestLot } from '../../../entities/iqc-request-lot.entity';
import { IqcRequestLotLine } from '../../../entities/iqc-request-lot-line.entity';
import { SysConfigService } from '../../system/services/sys-config.service';
import { AqlService } from '../../quality/aql/services/aql.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('IqcHistoryService cancel policy', () => {
  let target: IqcHistoryService;
  let mockIqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let mockIqcLogTargetRepo: DeepMocked<Repository<IqcLogTarget>>;
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
  let mockIqcRequestLotRepo: DeepMocked<Repository<IqcRequestLot>>;
  let mockIqcRequestLotLineRepo: DeepMocked<Repository<IqcRequestLotLine>>;
  let mockRequestLotLineQb: {
    innerJoin: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getRawMany: jest.Mock;
  };
  let mockAqlService: DeepMocked<AqlService>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockIqcLogRepo = createMock<Repository<IqcLog>>();
    mockIqcLogTargetRepo = createMock<Repository<IqcLogTarget>>();
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
      aqlSampleQty: 5,
      fullInspectQty: 0,
      defectCritical: 0,
      defectMajor: 0,
      defectMinor: 0,
      majorRule: { aqlCode: 'AQL-II-1.0', aqlValue: 1, codeLetter: 'A', sampleSize: 5, acceptQty: 0, rejectQty: 1 },
      minorRule: { aqlCode: 'AQL-II-2.5', aqlValue: 2.5, codeLetter: 'A', sampleSize: 5, acceptQty: 0, rejectQty: 1 },
      judgeReason: 'AQL 기준 합격',
    });
    // 불량수량 귀속 규칙은 AqlService 단위 테스트에서 검증하고, 여기서는 통과(pass-through)시킨다
    mockAqlService.attributeDefectQtyToFailedItems.mockImplementation((counts) => counts);
    mockAqlService.updateVendorInspectionModeAfterLot.mockResolvedValue(null);
    mockAqlService.revertVendorInspectionModeForCanceledLot.mockResolvedValue(null);

    // 의뢰 LOT 보유 가드용 QueryBuilder. 기본은 '어떤 의뢰에도 안 담김'이다.
    mockRequestLotLineQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    mockIqcRequestLotRepo = createMock<Repository<IqcRequestLot>>();
    mockIqcRequestLotLineRepo = createMock<Repository<IqcRequestLotLine>>();
    mockIqcRequestLotLineRepo.createQueryBuilder.mockReturnValue(mockRequestLotLineQb as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcHistoryService,
        { provide: getRepositoryToken(IqcLog), useValue: mockIqcLogRepo },
        { provide: getRepositoryToken(IqcLogTarget), useValue: mockIqcLogTargetRepo },
        { provide: getRepositoryToken(MatArrival), useValue: mockMatArrivalRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatReceiving), useValue: mockMatReceivingRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerMasterRepo },
        { provide: getRepositoryToken(IqcRequestLot), useValue: mockIqcRequestLotRepo },
        { provide: getRepositoryToken(IqcRequestLotLine), useValue: mockIqcRequestLotLineRepo },
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

    it('LOT 단건 IQC는 프론트 result가 아니라 AQL 판정을 저장한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        arrivalNo: 'ARR-001',
        initQty: 10,
        vendor: 'SUP-001',
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      mockIqcLogRepo.create.mockReturnValue({ matUid: 'MAT-001', itemCode: 'ITEM-001', result: 'FAIL' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001', result: 'FAIL' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);
      mockWarehouseRepo.findOne.mockResolvedValue(null);
      mockAqlService.resolveIqcPolicyByItem.mockResolvedValue({
        itemCode: 'ITEM-001',
        vendorCode: 'SUP-001',
        lotQty: 10,
        policyCode: 'AQLP-II-1.0-2.5',
        inspectionLevel: 'II',
        inspectionMode: 'NORMAL',
        result: 'FAIL',
        sampleQty: 5,
        aqlSampleQty: 5,
        fullInspectQty: 0,
        defectCritical: 0,
        defectMajor: 1,
        defectMinor: 0,
        majorRule: null,
        minorRule: null,
        judgeReason: 'Major 불량',
      } as any);

      await target.createResult({ matUid: 'MAT-001', result: 'PASS' } as any, 'HANES', 'P01');

      expect(mockAqlService.resolveIqcPolicyByItem).toHaveBeenCalled();
      expect(mockMatLotRepo.update).toHaveBeenCalledWith(
        { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
        { iqcStatus: 'FAIL' },
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

  describe('createArrivalResult defect-qty attribution (defect 03, 2026-09-09)', () => {
    it('passes the entered defect-code qty total into the AQL attribution before judging', async () => {
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'S-1', itemCode: 'ITEM-001', initQty: 8400, iqcStatus: 'PENDING', company: 'HANES', plant: 'P01', vendor: 'V1' } as any,
      ]);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Terminal', unit: 'EA' } as any);
      const details = JSON.stringify({ serials: [{ matUid: 'S-1', result: 'FAIL', items: [{ itemId: 'ITEM-001::1', judge: 'FAIL' }] }] });
      await target.createArrivalResult(
        { arrivalNo: 'ARR-1', itemCode: 'ITEM-001', result: 'FAIL', details, defects: [{ defectCode: 'D1', qty: 6 }] } as any,
        'HANES', 'P01',
      ).catch(() => undefined);
      expect(mockAqlService.attributeDefectQtyToFailedItems).toHaveBeenCalledWith({ 1: 1 }, 6);
    });
  });

  describe('resolveRequestTargetsByBarcode', () => {
    const qbWith = (rows: Array<{ arrivalNo: string; itemCode: string; iqcStatus: string | null }>) => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    });

    it('자재 시리얼(MAT_UID) 바코드는 해당 LOT의 입하번호+품목 그룹 1건으로 해석하고 검사상태를 함께 준다', async () => {
      mockMatLotRepo.createQueryBuilder.mockReturnValueOnce(qbWith([{ arrivalNo: 'ARR-001', itemCode: 'ITEM-001', iqcStatus: 'PASS' }]) as any);

      const result = await target.resolveRequestTargetsByBarcode('VH1-RM260911-00001', 'HANES', 'P01');

      expect(result.matchedBy).toBe('MAT_UID');
      expect(result.groups).toEqual([{ arrivalNo: 'ARR-001', itemCode: 'ITEM-001', iqcStatus: 'PASS' }]);
    });

    it('입하번호 바코드는 그 입하의 품목 그룹 전체를 검사 상태와 무관하게 반환한다(검사 완료 후 재발행)', async () => {
      mockMatLotRepo.createQueryBuilder
        .mockReturnValueOnce(qbWith([]) as any)
        .mockReturnValueOnce(qbWith([{ arrivalNo: 'ARR-002', itemCode: 'A', iqcStatus: 'PENDING' }, { arrivalNo: 'ARR-002', itemCode: 'B', iqcStatus: 'PASS' }]) as any);

      const result = await target.resolveRequestTargetsByBarcode('ARR-002', 'HANES', 'P01');

      expect(result.matchedBy).toBe('ARRIVAL_NO');
      expect(result.groups.map((g) => g.iqcStatus)).toEqual(['PENDING', 'PASS']);
    });

    it('어디에도 없는 바코드는 matchedBy null + 빈 그룹을 반환한다(예외 아님)', async () => {
      mockMatLotRepo.createQueryBuilder.mockReturnValue(qbWith([]) as any);

      const result = await target.resolveRequestTargetsByBarcode('UNKNOWN', 'HANES', 'P01');

      expect(result).toEqual({ barcode: 'UNKNOWN', matchedBy: null, groups: [] });
      expect(mockMatLotRepo.createQueryBuilder).toHaveBeenCalledTimes(3);
    });
  });

  describe('REQUESTED 의뢰 LOT 보유 행 가드', () => {
    const heldLot = {
      matUid: 'MAT-H1',
      arrivalNo: 'ARR-H',
      arrivalSeq: 3,
      itemCode: 'ITEM-001',
      iqcStatus: 'PENDING',
      vendor: 'SUP-001',
      initQty: 5,
      company: 'HANES',
      plant: 'P01',
    } as MatLot;

    const freeLot = {
      matUid: 'MAT-F1',
      arrivalNo: 'ARR-H',
      arrivalSeq: 4,
      itemCode: 'ITEM-001',
      iqcStatus: 'PENDING',
      vendor: 'SUP-001',
      initQty: 7,
      company: 'HANES',
      plant: 'P01',
    } as MatLot;

    it('REQUEST 모드는 의뢰에 담긴 행만 빼고 잔여 행을 판정한다', async () => {
      // 검사대기 목록이 잔여 행만 보여주므로 판정 대상도 같아야 한다.
      // 전체를 거절하면 화면에 보이는 잔여 행을 검사할 방법이 없어진다.
      mockSysConfigService.getValue.mockResolvedValue('REQUEST');
      mockMatLotRepo.find.mockResolvedValue([heldLot, freeLot]);
      mockRequestLotLineQb.getRawMany.mockResolvedValue([
        { requestNo: 'IQL20260916-0001', arrivalNo: 'ARR-H', arrivalSeq: 3 },
      ]);
      mockIqcLogRepo.create.mockReturnValue({ arrivalNo: 'ARR-H', itemCode: 'ITEM-001' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ arrivalNo: 'ARR-H', itemCode: 'ITEM-001' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);

      await target.createArrivalResult({ arrivalNo: 'ARR-H', itemCode: 'ITEM-001', result: 'PASS' } as any, 'HANES', 'P01');

      // 판정 모집단은 잔여 행(7)만이다. 담긴 행의 5는 들어가지 않는다
      const call = (mockAqlService.resolveIqcPolicyByItem as jest.Mock).mock.calls[0][0];
      expect(call.lotQty).toBe(7);
      // LOT 갱신 대상도 잔여 시리얼 하나뿐이다
      const lotUpdateWhere = (mockMatLotRepo.update as jest.Mock).mock.calls[0][0];
      expect(lotUpdateWhere.matUid._value ?? lotUpdateWhere.matUid).toEqual(['MAT-F1']);
      // 입하 행 갱신도 잔여 SEQ로 좁혀야 한다 — 안 그러면 판정 안 한 행까지 상태가 바뀐다
      const arrivalUpdateWhere = (mockMatArrivalRepo.update as jest.Mock).mock.calls[0][0];
      expect(arrivalUpdateWhere.seq).toBeDefined();
      expect(arrivalUpdateWhere.seq._value ?? arrivalUpdateWhere.seq).toEqual([4]);
    });

    it('REQUEST 모드에서 잔여 행이 하나도 없으면 거절한다', async () => {
      mockSysConfigService.getValue.mockResolvedValue('REQUEST');
      mockMatLotRepo.find.mockResolvedValue([heldLot]);
      mockRequestLotLineQb.getRawMany.mockResolvedValue([
        { requestNo: 'IQL20260916-0001', arrivalNo: 'ARR-H', arrivalSeq: 3 },
      ]);

      await expect(
        target.createArrivalResult({ arrivalNo: 'ARR-H', itemCode: 'ITEM-001', result: 'PASS' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(/IQL20260916-0001/);
      expect(mockAqlService.resolveIqcPolicyByItem).not.toHaveBeenCalled();
    });

    it('ARRIVAL 모드는 의뢰에 담긴 행이 섞여 있으면 전체를 거절한다', async () => {
      // 모드를 되돌린 상태다. 조용히 일부만 판정하지 않고 의뢰를 정리하게 한다
      mockSysConfigService.getValue.mockResolvedValue('ARRIVAL');
      mockMatLotRepo.find.mockResolvedValue([heldLot, freeLot]);
      mockRequestLotLineQb.getRawMany.mockResolvedValue([
        { requestNo: 'IQL20260916-0001', arrivalNo: 'ARR-H', arrivalSeq: 3 },
      ]);

      await expect(
        target.createArrivalResult({ arrivalNo: 'ARR-H', itemCode: 'ITEM-001', result: 'PASS' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(/IQL20260916-0001/);
      expect(mockAqlService.resolveIqcPolicyByItem).not.toHaveBeenCalled();
    });

    it('다른 SEQ 행이 담겨 있으면 이 행의 입하단위 판정은 막지 않는다', async () => {
      mockMatLotRepo.find.mockResolvedValue([heldLot]);
      mockRequestLotLineQb.getRawMany.mockResolvedValue([
        { requestNo: 'IQL20260916-0001', arrivalNo: 'ARR-H', arrivalSeq: 99 },
      ]);
      mockIqcLogRepo.create.mockReturnValue({ arrivalNo: 'ARR-H', itemCode: 'ITEM-001' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ arrivalNo: 'ARR-H', itemCode: 'ITEM-001' } as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);

      await target.createArrivalResult({ arrivalNo: 'ARR-H', itemCode: 'ITEM-001', result: 'PASS' } as any, 'HANES', 'P01');

      expect(mockAqlService.resolveIqcPolicyByItem).toHaveBeenCalled();
    });

    it('의뢰 LOT 판정은 IQC_LOGS.REQUEST_NO를 채우고 입하단위는 비운다', async () => {
      // REMARK의 '[IQL:...]' 문자열이 아니라 이 컬럼이 의뢰↔이력 역추적의 정본이다
      mockSysConfigService.getValue.mockResolvedValue('REQUEST');
      mockMatLotRepo.find.mockResolvedValue([freeLot]);
      mockRequestLotLineQb.getRawMany.mockResolvedValue([]);
      mockIqcLogRepo.create.mockImplementation((v) => v as IqcLog);
      mockIqcLogRepo.save.mockImplementation(async (v) => v as IqcLog);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);

      await target.createArrivalResult({ arrivalNo: 'ARR-H', itemCode: 'ITEM-001', result: 'PASS' } as any, 'HANES', 'P01');
      expect((mockIqcLogRepo.create as jest.Mock).mock.calls[0][0].requestNo).toBeNull();

      (mockIqcLogRepo.create as jest.Mock).mockClear();
      mockIqcRequestLotRepo.findOne.mockResolvedValue({
        requestNo: 'IQL20260916-0009',
        itemCode: 'ITEM-001',
        lotQty: 7,
        status: 'REQUESTED',
        company: 'HANES',
        plant: 'P01',
      } as never);
      mockIqcRequestLotLineRepo.find.mockResolvedValue([
        { requestNo: 'IQL20260916-0009', seq: 1, arrivalNo: 'ARR-H', arrivalSeq: 4, itemCode: 'ITEM-001', lineRole: 'SAMPLE' } as never,
      ]);
      mockIqcRequestLotRepo.save.mockImplementation(async (v) => v as never);

      await target.createRequestLotResult('IQL20260916-0009', { itemCode: 'ITEM-001', result: 'PASS' } as any, 'HANES', 'P01');

      const log = (mockIqcLogRepo.create as jest.Mock).mock.calls[0][0];
      expect(log.requestNo).toBe('IQL20260916-0009');
      // REMARK 접두어는 기존 조회 호환을 위해 그대로 남긴다
      expect(log.remark).toContain('[IQL:IQL20260916-0009]');
    });

    it('단건 판정도 REQUESTED 의뢰에 담긴 시리얼을 거절한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(heldLot);
      mockRequestLotLineQb.getRawMany.mockResolvedValue([
        { requestNo: 'IQL20260916-0002', arrivalNo: 'ARR-H', arrivalSeq: 3 },
      ]);

      await expect(
        target.createResult({ matUid: 'MAT-H1', result: 'PASS' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(/IQL20260916-0002/);
      expect(mockAqlService.resolveIqcPolicyByItem).not.toHaveBeenCalled();
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

      // LOT 갱신은 조회된 시리얼(matUid)로 한정한다. 의뢰 LOT 판정과 같은 코어를 쓰기 때문이다.
      expect(mockMatLotRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ iqcStatus: 'PENDING', company: 'HANES', plant: 'P01' }),
        { iqcStatus: 'PASS' },
      );
      expect(mockMatLotRepo.update.mock.calls[0][0]).toHaveProperty('matUid');
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
        aqlSampleQty: 20,
        fullInspectQty: 0,
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
        expect.objectContaining({ iqcStatus: 'PENDING', company: 'HANES', plant: 'P01' }),
        { iqcStatus: 'FAIL' },
      );
      expect(mockMatArrivalRepo.update).toHaveBeenCalledWith(
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
      find: jest.fn().mockResolvedValue([
        { arrivalNo: 'ARR-001', arrivalSeq: 1, itemCode: 'ITEM-001', matUid: 'MAT-001' },
      ]),
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
      save: jest.fn().mockImplementation(async (_entity: unknown, value: unknown) => value),
      create: jest.fn((_entity: unknown, value: unknown) => value),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
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
      { iqcStatus: 'PENDING', expireDate: null },
    );
  });

  it('의뢰 LOT 판정 취소는 담긴 행만 되돌리고 의뢰 헤더를 REQUESTED로 복원한다', async () => {
    // 실측 확인(2026-09-16): 헤더를 안 되돌리면 STATUS가 PASS로 남아 재검사가 영영 막힌다.
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-09-16'),
      seq: 1,
      arrivalNo: 'ARR-REQ',
      matUid: null,
      requestNo: 'IQL20260916-0009',
      itemCode: 'ITEM-001',
      result: 'PASS',
      status: 'DONE',
      company: 'HANES',
      plant: 'P01',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue(null);
    mockStockTxRepo.findOne.mockResolvedValue(null);

    const manager = {
      // 복원 범위 정본 = 판정 대상(IQC_LOG_TARGETS). 구성 라인이 아니다(ADR 0004).
      find: jest.fn().mockResolvedValue([
        { inspectDate: new Date('2026-09-16'), seq: 1, arrivalNo: 'ARR-REQ', arrivalSeq: 3, itemCode: 'ITEM-001', matUid: null },
      ]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async (_entity: unknown, value: unknown) => value),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    (mockQueryRunner as any).manager = manager;

    await target.cancel('2026-09-16', 1, { reason: 'retest' } as any);

    // 판정 대상 (ARRIVAL_NO, ARRIVAL_SEQ) 행만 되돌린다 — 대표 입하번호 전체가 아니다
    expect(manager.update).toHaveBeenCalledWith(
      MatLot,
      expect.objectContaining({ arrivalNo: 'ARR-REQ', arrivalSeq: 3, itemCode: 'ITEM-001', iqcStatus: 'PASS' }),
      { iqcStatus: 'PENDING', expireDate: null },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatArrival,
      expect.objectContaining({ arrivalNo: 'ARR-REQ', seq: 3, itemCode: 'ITEM-001', iqcStatus: 'PASS' }),
      { iqcStatus: 'PENDING' },
    );
    // 헤더 복원
    expect(manager.update).toHaveBeenCalledWith(
      IqcRequestLot,
      expect.objectContaining({ requestNo: 'IQL20260916-0009' }),
      { status: 'REQUESTED', sampleQty: null },
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
      find: jest.fn().mockResolvedValue([
        { arrivalNo: 'ARR-001', arrivalSeq: 1, itemCode: 'ITEM-001', matUid: null },
      ]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    const result = await target.cancel('2026-04-08', 1, { reason: 'retest' } as any);

    expect(result.status).toBe('CANCELED');
    expect(manager.update).toHaveBeenCalledWith(
      MatLot,
      { arrivalNo: 'ARR-001', arrivalSeq: 1, itemCode: 'ITEM-001', iqcStatus: 'PASS', company: 'HANES', plant: 'P01' },
      { iqcStatus: 'PENDING', expireDate: null },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatArrival,
      { arrivalNo: 'ARR-001', seq: 1, itemCode: 'ITEM-001', iqcStatus: 'PASS', company: 'HANES', plant: 'P01' },
      { iqcStatus: 'PENDING' },
    );
  });

  it('재검사(RETEST) 판정 취소는 판정 대상이 없어도 막히지 않는다', async () => {
    // RETEST는 시리얼 스코프 판정이라 ARRIVAL_NO도 IQC_LOG_TARGETS 행도 없다.
    // 판정 대상 가드를 무조건 걸면 재검사 취소가 영영 400이 된다.
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 9,
      arrivalNo: null,
      matUid: 'MAT-RETEST',
      itemCode: 'ITEM-001',
      inspectType: 'RETEST',
      result: 'PASS',
      status: 'DONE',
      company: 'HANES',
      plant: 'P01',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue(null);
    mockStockTxRepo.findOne.mockResolvedValue(null);

    const manager = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    const result = await target.cancel('2026-04-08', 9, { reason: 'retest' } as any);

    expect(result.status).toBe('CANCELED');
    // 판정 대상을 읽으러 가지도 않는다
    expect(manager.find).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(
      MatLot,
      { matUid: 'MAT-RETEST', company: 'HANES', plant: 'P01' },
      { iqcStatus: 'PENDING', expireDate: null },
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
      // 1회차 = 판정 대상 조회, 이후 = 대상 행의 FAIL 시리얼 조회(없음)
      find: jest
        .fn()
        .mockResolvedValueOnce([{ arrivalNo: 'ARR-001', arrivalSeq: 1, itemCode: 'ITEM-001', matUid: null }])
        .mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.cancel('2026-04-08', 1, { reason: 'retest' } as any);

    // 이 판정이 만든 모드 이력만 되돌리도록 검사일시를 함께 넘긴다
    expect(mockAqlService.revertVendorInspectionModeForCanceledLot).toHaveBeenCalledWith({
      vendorCode: 'SUP-001',
      arrivalNo: 'ARR-001',
      itemCode: 'ITEM-001',
      inspectedAt: expect.any(Date),
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

  it('MANUAL(기본) 모드에서는 FAIL 저장 시 재고를 이동하지 않는다 — 불량창고 수동입고 화면에서 처리(2026-09-11 06번)', async () => {
    mockSysConfigService.getValue.mockResolvedValue(null);
    mockMatLotRepo.find.mockResolvedValue([
      { matUid: 'S-1', itemCode: 'ITEM-001', initQty: 10, iqcStatus: 'PENDING', company: 'HANES', plant: 'P01', vendor: 'V1' } as any,
    ]);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as any);
    mockAqlService.resolveIqcPolicyByItem.mockResolvedValue({ result: 'FAIL', sampleQty: 0, judgeReason: 'x', itemResults: [], majorRule: null, minorRule: null } as any);
    await target.createArrivalResult({ arrivalNo: 'ARR-M', itemCode: 'ITEM-001', result: 'FAIL', defects: [{ defectCode: 'D', qty: 1 }] } as any, 'HANES', 'P01').catch(() => undefined);
    expect(mockWarehouseRepo.findOne).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ warehouseType: 'DEFECT' }) }));
  });

  it('moves failed IQC stock through TransactionService', async () => {
    mockSysConfigService.getValue.mockResolvedValue('AUTO'); // 자동이동 모드에서만 이동(기본 MANUAL은 수동입고)
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
    mockAqlService.resolveIqcPolicyByItem.mockResolvedValue({
      itemCode: 'ITEM-001',
      vendorCode: null,
      lotQty: 1,
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      inspectionMode: 'NORMAL',
      result: 'FAIL',
      sampleQty: 5,
      aqlSampleQty: 5,
      fullInspectQty: 0,
      defectCritical: 0,
      defectMajor: 1,
      defectMinor: 0,
      majorRule: null,
      minorRule: null,
      judgeReason: 'FAIL',
    } as any);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (_entity: unknown, value: unknown) => value),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createResult({ matUid: 'MAT-001', result: 'FAIL' } as any);

    expect(mockWarehouseRepo.findOne).toHaveBeenCalledWith({
      where: { warehouseType: 'DEFECT', useYn: 'Y', isDefault: 'Y', company: 'HANES', plant: 'P01' },
    });
    expect(mockMatStockRepo.findOne).toHaveBeenCalledWith({
      where: { matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'WH-NORMAL', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 0 },
    );
    // 판정 저장(IQC_LOGS + IQC_LOG_TARGETS)과 불량창고 이동이 각각 트랜잭션을 연다
    expect(mockTx.run).toHaveBeenCalledTimes(2);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(StockTransaction, expect.objectContaining({
      transNo: 'TX-IQC-FAIL',
      refType: 'IQC_FAIL',
    }));
  });

  it('moves failed IQC arrival stock to defect warehouse when MAT_STOCKS is empty', async () => {
    mockSysConfigService.getValue.mockResolvedValue('AUTO'); // 자동이동 모드에서만 이동(기본 MANUAL은 수동입고)
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
    mockMatStockRepo.findOne.mockResolvedValue(null);
    mockDataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        qty: 10,
        availableQty: 10,
        warehouseCode: 'ARR-WH',
        company: 'HANES',
        plant: 'P01',
      }),
    } as any);
    mockNumbering.nextInTx.mockResolvedValue('TX-IQC-FAIL-ARR');
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as ItemMaster);
    mockAqlService.resolveIqcPolicyByItem.mockResolvedValue({
      itemCode: 'ITEM-001',
      vendorCode: null,
      lotQty: 1,
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      inspectionMode: 'NORMAL',
      result: 'FAIL',
      sampleQty: 5,
      aqlSampleQty: 5,
      fullInspectQty: 0,
      defectCritical: 0,
      defectMajor: 1,
      defectMinor: 0,
      majorRule: null,
      minorRule: null,
      judgeReason: 'FAIL',
    } as any);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (_entity: unknown, value: unknown) => value),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createResult({ matUid: 'MAT-001', result: 'FAIL' } as any);

    // 판정 저장(IQC_LOGS + IQC_LOG_TARGETS)과 불량창고 이동이 각각 트랜잭션을 연다
    expect(mockTx.run).toHaveBeenCalledTimes(2);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ matUid: 'MAT-001' }),
      expect.objectContaining({ qty: 0, status: 'DEPLETED' }),
    );
    expect(manager.save).toHaveBeenCalledWith(MatStock, expect.objectContaining({
      warehouseCode: 'WH-DEFECT',
      matUid: 'MAT-001',
      qty: 10,
    }));
    expect(manager.save).toHaveBeenCalledWith(StockTransaction, expect.objectContaining({
      transNo: 'TX-IQC-FAIL-ARR',
      refType: 'IQC_FAIL',
      fromWarehouseId: 'ARR-WH',
      toWarehouseId: 'WH-DEFECT',
      qty: 10,
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
      save: jest.fn().mockImplementation(async (_entity: unknown, value: unknown) => value),
      create: jest.fn((_entity: unknown, value: unknown) => value),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createResult({ matUid: 'MAT-001', result: 'PASS', destructSampleQty: 2 } as any);

    // 판정 저장(IQC_LOGS + IQC_LOG_TARGETS)과 시료 자동출고가 각각 트랜잭션을 연다
    expect(mockTx.run).toHaveBeenCalledTimes(2);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(StockTransaction, expect.objectContaining({
      transNo: 'TX-IQC-DESTRUCT',
      refType: 'IQC_DESTRUCT',
    }));
  });
});
