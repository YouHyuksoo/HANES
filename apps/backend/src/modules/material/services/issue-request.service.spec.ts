import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, MoreThanOrEqual, QueryRunner, Repository } from 'typeorm';
import { IssueRequestService } from './issue-request.service';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatIssueService } from './mat-issue.service';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('IssueRequestService', () => {
  let service: IssueRequestService;
  let requestRepo: DeepMocked<Repository<MatIssueRequest>>;
  let requestItemRepo: DeepMocked<Repository<MatIssueRequestItem>>;
  let itemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let jobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let bomRepo: DeepMocked<Repository<BomMaster>>;
  let matIssueRepo: DeepMocked<Repository<MatIssue>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let matIssueService: DeepMocked<MatIssueService>;
  let numbering: DeepMocked<NumberingService>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    requestRepo = createMock<Repository<MatIssueRequest>>();
    requestItemRepo = createMock<Repository<MatIssueRequestItem>>();
    itemMasterRepo = createMock<Repository<ItemMaster>>();
    jobOrderRepo = createMock<Repository<JobOrder>>();
    bomRepo = createMock<Repository<BomMaster>>();
    matIssueRepo = createMock<Repository<MatIssue>>();
    matStockRepo = createMock<Repository<MatStock>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    matIssueService = createMock<MatIssueService>();
    numbering = createMock<NumberingService>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueRequestService,
        { provide: getRepositoryToken(MatIssueRequest), useValue: requestRepo },
        { provide: getRepositoryToken(MatIssueRequestItem), useValue: requestItemRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemMasterRepo },
        { provide: getRepositoryToken(JobOrder), useValue: jobOrderRepo },
        { provide: getRepositoryToken(BomMaster), useValue: bomRepo },
        { provide: getRepositoryToken(MatIssue), useValue: matIssueRepo },
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: MatIssueService, useValue: matIssueService },
        { provide: NumberingService, useValue: numbering },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(IssueRequestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('품목 마스터가 누락되어도 출고요청 품목 원본 itemCode는 유지한다', async () => {
      requestRepo.find.mockResolvedValue([
        { requestNo: 'REQ-001', status: 'REQUESTED', requester: 'SYSTEM' } as MatIssueRequest,
      ]);
      requestRepo.count.mockResolvedValue(1);
      requestItemRepo.find.mockResolvedValue([
        {
          requestId: 'REQ-001',
          seq: 1,
          itemCode: 'ITEM-MISSING',
          requestQty: 5,
          issuedQty: 0,
          unit: null,
        } as unknown as MatIssueRequestItem,
      ]);
      itemMasterRepo.find.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data[0].items[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('목록 조회의 요청품목과 품목마스터 보강도 요청 테넌트 범위로 제한한다', async () => {
      requestRepo.find.mockResolvedValue([
        { requestNo: 'REQ-001', status: 'REQUESTED', requester: 'SYSTEM', company: 'C1', plant: 'P1' } as MatIssueRequest,
      ]);
      requestRepo.count.mockResolvedValue(1);
      requestItemRepo.find.mockResolvedValue([
        {
          requestId: 'REQ-001',
          seq: 1,
          itemCode: 'ITEM-001',
          requestQty: 5,
          issuedQty: 0,
          company: 'C1',
          plant: 'P1',
        } as unknown as MatIssueRequestItem,
      ]);
      itemMasterRepo.find.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(requestItemRepo.find).toHaveBeenCalledWith({
        where: { requestId: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(itemMasterRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('findByRequestNo', () => {
    it('품목 마스터가 누락되어도 출고요청 상세 품목 원본 itemCode는 유지한다', async () => {
      requestRepo.findOne.mockResolvedValue({ requestNo: 'REQ-001', status: 'REQUESTED' } as MatIssueRequest);
      requestItemRepo.find.mockResolvedValue([
        {
          requestId: 'REQ-001',
          seq: 1,
          itemCode: 'ITEM-MISSING',
          requestQty: 5,
          issuedQty: 0,
          unit: null,
        } as unknown as MatIssueRequestItem,
      ]);
      itemMasterRepo.find.mockResolvedValue([]);

      const result = await service.findByRequestNo('REQ-001');

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('상세 조회도 요청 헤더 회사/공장 범위에서 품목과 품목마스터를 조회한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'REQUESTED',
        company: 'C1',
        plant: 'P1',
      } as MatIssueRequest);
      requestItemRepo.find.mockResolvedValue([
        {
          requestId: 'REQ-001',
          seq: 1,
          itemCode: 'ITEM-001',
          requestQty: 5,
          issuedQty: 0,
          company: 'C1',
          plant: 'P1',
        } as unknown as MatIssueRequestItem,
      ]);
      itemMasterRepo.find.mockResolvedValue([]);

      await service.findByRequestNo('REQ-001', 'C1', 'P1');

      expect(requestRepo.findOne).toHaveBeenCalledWith({
        where: { requestNo: 'REQ-001', company: 'C1', plant: 'P1' },
      });
      expect(requestItemRepo.find).toHaveBeenCalledWith({
        where: { requestId: 'REQ-001', company: 'C1', plant: 'P1' },
      });
      expect(itemMasterRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
      });
    });

    it('상세 조회 응답에 품목 포장단위(minPackQty)를 포함한다', async () => {
      requestRepo.findOne.mockResolvedValue({ requestNo: 'REQ-001', status: 'REQUESTED' } as MatIssueRequest);
      requestItemRepo.find.mockResolvedValue([
        {
          requestId: 'REQ-001',
          seq: 1,
          itemCode: 'ITEM-001',
          requestQty: 5,
          issuedQty: 0,
          unit: 'EA',
        } as unknown as MatIssueRequestItem,
      ]);
      itemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: 'Raw A', unit: 'EA', minPackQty: 6 } as ItemMaster,
      ]);

      const result = await service.findByRequestNo('REQ-001');

      expect(result.items[0]).toEqual(
        expect.objectContaining({ itemCode: 'ITEM-001', minPackQty: 6 }),
      );
    });
  });

  describe('create', () => {
    it('동일 작업지시·품목에 미완료 출고요청이 있으면 중복 생성을 차단한다', async () => {
      requestRepo.find.mockResolvedValue([
        { requestNo: 'REQ-EXIST', orderNo: 'WO-001', status: 'APPROVED', company: 'C1', plant: 'P1' } as MatIssueRequest,
      ]);
      requestItemRepo.find.mockResolvedValue([
        { requestId: 'REQ-EXIST', seq: 1, itemCode: 'RM-001' } as unknown as MatIssueRequestItem,
      ]);

      await expect(
        service.create({
          orderNo: 'WO-001',
          issueType: 'PRODUCTION',
          items: [{ itemCode: 'RM-001', requestQty: 5 }],
        } as any, 'C1', 'P1'),
      ).rejects.toThrow(BadRequestException);

      expect(numbering.next).not.toHaveBeenCalled();
    });

    it('기존 요청이 완료/반려 상태면 같은 품목 재요청을 허용한다', async () => {
      requestRepo.find.mockResolvedValue([
        { requestNo: 'REQ-DONE', orderNo: 'WO-001', status: 'COMPLETED', company: 'C1', plant: 'P1' } as MatIssueRequest,
      ]);
      requestItemRepo.find
        .mockResolvedValueOnce([
          { requestId: 'REQ-DONE', seq: 1, itemCode: 'RM-001' } as unknown as MatIssueRequestItem,
        ])
        .mockResolvedValue([]);
      numbering.next.mockResolvedValue('REQ-002');
      queryRunner.manager.create.mockImplementation((_entity, value: any) => value);
      queryRunner.manager.save
        .mockResolvedValueOnce({ requestNo: 'REQ-002', company: 'C1', plant: 'P1' } as MatIssueRequest)
        .mockResolvedValueOnce([] as any);
      requestRepo.findOne.mockResolvedValue({ requestNo: 'REQ-002', company: 'C1', plant: 'P1' } as MatIssueRequest);

      await service.create({
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
        items: [{ itemCode: 'RM-001', requestQty: 5 }],
      } as any, 'C1', 'P1');

      expect(numbering.next).toHaveBeenCalled();
    });

    it('ORDER_NO를 orderNo 엔티티 속성으로 저장한다', async () => {
      numbering.next.mockResolvedValue('REQ-001');
      queryRunner.manager.create.mockImplementation((_entity, value: any) => value);
      queryRunner.manager.save
        .mockResolvedValueOnce({ requestNo: 'REQ-001' } as MatIssueRequest)
        .mockResolvedValueOnce([] as any);
      requestRepo.findOne.mockResolvedValue({ requestNo: 'REQ-001', orderNo: 'WO-001', company: 'C1', plant: 'P1' } as MatIssueRequest);
      requestItemRepo.find.mockResolvedValue([]);

      await service.create({
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
        items: [{ itemCode: 'ITEM-001', requestQty: 5 }],
      } as any, 'C1', 'P1');

      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        MatIssueRequest,
        expect.objectContaining({
          orderNo: 'WO-001',
          company: 'C1',
          plant: 'P1',
        }),
      );
      expect(queryRunner.manager.create).not.toHaveBeenCalledWith(
        MatIssueRequest,
        expect.objectContaining({
          jobOrderId: 'WO-001',
        }),
      );
    });

    it('BOM 기준 자동 산출 필드를 요청품목에 저장한다', async () => {
      numbering.next.mockResolvedValue('REQ-001');
      queryRunner.manager.create.mockImplementation((_entity, value: any) => value);
      queryRunner.manager.save
        .mockResolvedValueOnce({ requestNo: 'REQ-001', company: 'C1', plant: 'P1' } as MatIssueRequest)
        .mockResolvedValueOnce([] as any);
      requestRepo.findOne.mockResolvedValue({ requestNo: 'REQ-001', company: 'C1', plant: 'P1' } as MatIssueRequest);
      requestItemRepo.find.mockResolvedValue([]);

      await service.create({
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
        items: [{
          itemCode: 'RM-001',
          requestQty: 13,
          unit: 'EA',
          bomReqQty: 20,
          prevIssueQty: 4,
          floorStockQty: 3,
        }],
      } as any, 'C1', 'P1');

      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        MatIssueRequestItem,
        expect.objectContaining({
          itemCode: 'RM-001',
          requestQty: 13,
          bomReqQty: 20,
          prevIssueQty: 4,
          floorStockQty: 3,
          company: 'C1',
          plant: 'P1',
        }),
      );
    });

    it('생성 직후 상세 조회는 트랜잭션 커밋 이후 외부 repository로 수행한다', async () => {
      let inTransaction = false;
      tx.run.mockImplementation(async (callback: any) => {
        inTransaction = true;
        const result = await callback(queryRunner);
        inTransaction = false;
        return result;
      });
      numbering.next.mockResolvedValue('REQ-001');
      queryRunner.manager.create.mockImplementation((_entity, value: any) => value);
      queryRunner.manager.save
        .mockResolvedValueOnce({ requestNo: 'REQ-001', company: 'C1', plant: 'P1' } as MatIssueRequest)
        .mockResolvedValueOnce([] as any);
      requestRepo.findOne.mockImplementation(async () => {
        if (inTransaction) throw new Error('uncommitted row is not visible from external repository');
        return { requestNo: 'REQ-001', company: 'C1', plant: 'P1' } as MatIssueRequest;
      });
      requestItemRepo.find.mockResolvedValue([]);

      await service.create({
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
        items: [{ itemCode: 'ITEM-001', requestQty: 5, unit: 'EA' }],
      } as any, 'C1', 'P1');

      expect(requestRepo.findOne).toHaveBeenCalledWith({
        where: { requestNo: 'REQ-001', company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('buildBomRequestItems', () => {
    const bomEffectiveDate = new Date(2026, 3, 15);
    const createQueryBuilder = (rows: Array<Record<string, unknown>>) => {
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rows),
      };
      return qb;
    };

    it('작업지시 완제품의 BOM 직하위 원자재만 출고예정 품목으로 산출한다', async () => {
      jobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'WO-001',
        itemCode: 'FG-001',
        planQty: 10,
        planDate: bomEffectiveDate,
        company: 'C1',
        plant: 'P1',
      } as JobOrder);
      bomRepo.find.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 2, seq: 1, useYn: 'Y' },
        { parentItemCode: 'FG-001', childItemCode: 'WIP-001', qtyPer: 1, seq: 2, useYn: 'Y' },
      ] as BomMaster[]);
      itemMasterRepo.find.mockResolvedValue([
        { itemCode: 'RM-001', itemName: 'Raw A', itemType: 'RAW', unit: 'EA', minPackQty: 5 },
        { itemCode: 'WIP-001', itemName: 'Semi A', itemType: 'WIP', unit: 'EA' },
      ] as ItemMaster[]);
      matIssueRepo.createQueryBuilder.mockReturnValue(createQueryBuilder([{ itemCode: 'RM-001', qty: '4' }]) as any);
      matStockRepo.createQueryBuilder
        .mockReturnValueOnce(createQueryBuilder([{ itemCode: 'RM-001', qty: '3' }]) as any)
        .mockReturnValueOnce(createQueryBuilder([{ itemCode: 'RM-001', qty: '18' }]) as any);

      const result = await service.buildBomRequestItems('WO-001', 'C1', 'P1');

      expect(jobOrderRepo.findOne).toHaveBeenCalledWith({
        where: { orderNo: 'WO-001', company: 'C1', plant: 'P1' },
      });
      expect(bomRepo.find).toHaveBeenCalledWith({
        where: {
          parentItemCode: 'FG-001',
          useYn: 'Y',
          validFrom: LessThanOrEqual(bomEffectiveDate),
          validTo: MoreThanOrEqual(bomEffectiveDate),
          company: 'C1',
          plant: 'P1',
        },
        order: { seq: 'ASC' },
      });
      expect(result).toEqual([
        expect.objectContaining({
          itemCode: 'RM-001',
          itemName: 'Raw A',
          unit: 'EA',
          currentStock: 18,
          bomReqQty: 20,
          prevIssueQty: 4,
          floorStockQty: 3,
          requestQty: 13,
          minPackQty: 5,
        }),
      ]);
    });

    it('작업지시 계획일이 없으면 BOM 기준 출고예정 품목을 산출하지 않는다', async () => {
      jobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'WO-001',
        itemCode: 'FG-001',
        planQty: 10,
        company: 'C1',
        plant: 'P1',
      } as JobOrder);

      await expect(service.buildBomRequestItems('WO-001', 'C1', 'P1')).rejects.toThrow(
        '작업지시 계획일이 없어 BOM 기준일을 결정할 수 없습니다',
      );
      expect(bomRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('approve/reject', () => {
    it('승인/반려는 요청 회사/공장 범위에서 상태를 갱신한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'REQUESTED',
        company: 'C1',
        plant: 'P1',
      } as MatIssueRequest);
      requestItemRepo.find.mockResolvedValue([]);

      await service.approve('REQ-001', 'C1', 'P1');

      expect(requestRepo.findOne).toHaveBeenCalledWith({
        where: { requestNo: 'REQ-001', company: 'C1', plant: 'P1' },
      });
      expect(requestRepo.update).toHaveBeenCalledWith(
        { requestNo: 'REQ-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ status: 'APPROVED' }),
      );

      await service.reject('REQ-001', { reason: 'reject' } as any, 'C1', 'P1');

      expect(requestRepo.update).toHaveBeenCalledWith(
        { requestNo: 'REQ-001', company: 'C1', plant: 'P1' },
        { status: 'REJECTED', rejectReason: 'reject' },
      );
    });

    it('승인은 조회된 요청 테넌트가 요청 테넌트와 다르면 상태를 갱신하지 않는다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'REQUESTED',
        company: 'OTHER',
        plant: 'P1',
      } as MatIssueRequest);

      await expect(service.approve('REQ-001', 'C1', 'P1')).rejects.toThrow(BadRequestException);

      expect(requestRepo.update).not.toHaveBeenCalled();
      expect(requestItemRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('issueFromRequest', () => {
    it('요청 품목 갱신과 실제 출고를 같은 트랜잭션에서 처리한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
        company: 'C1',
        plant: 'P1',
      } as MatIssueRequest);
      (matIssueService as any).createInTx = jest.fn().mockResolvedValue([{ issueNo: 'ISSUE-001' }]);
      requestItemRepo.find.mockResolvedValue([
        { requestId: 'REQ-001', seq: 1, itemCode: 'ITEM-001', requestQty: 10, issuedQty: 2 } as MatIssueRequestItem,
      ]);
      queryRunner.manager.find.mockResolvedValue([{
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
      } as MatLot]);

      await service.issueFromRequest('REQ-001', {
        warehouseCode: 'WH-01',
        issueType: 'PRODUCTION',
        workerId: 'user',
        items: [{ requestItemId: '1', matUid: 'MAT-001', issueQty: 8 }],
      }, 'C1', 'P1');

      expect(tx.run).toHaveBeenCalledTimes(1);
      expect((matIssueService as any).createInTx).toHaveBeenCalledWith(queryRunner, expect.objectContaining({
        orderNo: 'WO-001',
        warehouseCode: 'WH-01',
        items: [{ matUid: 'MAT-001', issueQty: 8 }],
      }), 'C1', 'P1');
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatIssueRequestItem,
        { requestId: 'REQ-001', seq: 1, company: 'C1', plant: 'P1' },
        { issuedQty: 10 },
      );
      expect(matIssueService.create).not.toHaveBeenCalled();
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('요청 항목을 찾을 수 없으면 출고를 차단한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        orderNo: null,
        issueType: 'PRODUCTION',
      } as MatIssueRequest);
      (matIssueService as any).createInTx = jest.fn().mockResolvedValue({ issueNo: 'ISSUE-001' } as any);
      requestItemRepo.findOne.mockResolvedValue(null);

      await expect(
        service.issueFromRequest('REQ-001', {
          warehouseCode: 'WH-01',
          items: [{ requestItemId: '1', matUid: 'MAT-001', issueQty: 3 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('스캔 LOT 품목이 요청 품목과 다르면 실제 출고를 호출하지 않는다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        orderNo: null,
        issueType: 'PRODUCTION',
        company: 'C1',
        plant: 'P1',
      } as MatIssueRequest);
      (matIssueService as any).createInTx = jest.fn().mockResolvedValue({ issueNo: 'ISSUE-001' } as any);
      requestItemRepo.find.mockResolvedValue([{
        requestId: 'REQ-001',
        seq: 1,
        itemCode: 'ITEM-A',
        requestQty: 10,
        issuedQty: 0,
      } as MatIssueRequestItem]);
      queryRunner.manager.find.mockResolvedValue([{
        matUid: 'MAT-B',
        itemCode: 'ITEM-B',
      } as MatLot]);

      await expect(
        service.issueFromRequest('REQ-001', {
          warehouseCode: 'WH-01',
          items: [{ requestItemId: '1', matUid: 'MAT-B', issueQty: 3 }],
        }, 'C1', 'P1'),
      ).rejects.toThrow('출고요청 품목과 스캔 LOT 품목이 일치하지 않습니다');

      expect(tx.run).toHaveBeenCalledTimes(1);
      expect((matIssueService as any).createInTx).not.toHaveBeenCalled();
      expect(queryRunner.manager.update).not.toHaveBeenCalled();
    });

    it('실출고는 조회된 요청 테넌트가 요청 테넌트와 다르면 트랜잭션을 시작하지 않는다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
        company: 'C1',
        plant: 'OTHER',
      } as MatIssueRequest);

      await expect(
        service.issueFromRequest('REQ-001', {
          warehouseCode: 'WH-01',
          items: [{ requestItemId: '1', matUid: 'MAT-001', issueQty: 3 }],
        }, 'C1', 'P1'),
      ).rejects.toThrow(BadRequestException);

      expect(tx.run).not.toHaveBeenCalled();
      expect((matIssueService as any).createInTx).not.toHaveBeenCalled();
    });

    it('남은 요청 수량을 초과하면 출고를 차단한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        orderNo: null,
        issueType: 'PRODUCTION',
      } as MatIssueRequest);
      (matIssueService as any).createInTx = jest.fn().mockResolvedValue({ issueNo: 'ISSUE-001' } as any);
      requestItemRepo.findOne.mockResolvedValue({
        requestId: 'REQ-001',
        seq: 1,
        requestQty: 10,
        issuedQty: 8,
      } as MatIssueRequestItem);

      await expect(
        service.issueFromRequest('REQ-001', {
          warehouseCode: 'WH-01',
          items: [{ requestItemId: '1', matUid: 'MAT-001', issueQty: 3 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('포장단위가 있으면 올림 잔여 수량까지 출고를 허용한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
        company: 'C1',
        plant: 'P1',
      } as MatIssueRequest);
      (matIssueService as any).createInTx = jest.fn().mockResolvedValue([{ issueNo: 'ISSUE-001' }]);
      requestItemRepo.find.mockResolvedValue([
        { requestId: 'REQ-001', seq: 1, itemCode: 'ITEM-001', requestQty: 10, issuedQty: 0 } as MatIssueRequestItem,
      ]);
      // 포장단위 6 → 요청 10의 올림 잔여 = ceil(10/6)*6 = 12
      itemMasterRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', minPackQty: 6 } as ItemMaster]);
      queryRunner.manager.find.mockResolvedValue([{
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
      } as MatLot]);

      await service.issueFromRequest('REQ-001', {
        warehouseCode: 'WH-01',
        issueType: 'PRODUCTION',
        workerId: 'user',
        items: [{ requestItemId: '1', matUid: 'MAT-001', issueQty: 12 }],
      }, 'C1', 'P1');

      expect((matIssueService as any).createInTx).toHaveBeenCalledWith(
        queryRunner,
        expect.objectContaining({ items: [{ matUid: 'MAT-001', issueQty: 12 }] }),
        'C1',
        'P1',
      );
    });

    it('포장단위 올림 잔여 수량을 초과하면 출고를 차단한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        orderNo: null,
        issueType: 'PRODUCTION',
      } as MatIssueRequest);
      (matIssueService as any).createInTx = jest.fn().mockResolvedValue([{ issueNo: 'ISSUE-001' }]);
      requestItemRepo.findOne.mockResolvedValue({
        requestId: 'REQ-001',
        seq: 1,
        itemCode: 'ITEM-001',
        requestQty: 10,
        issuedQty: 0,
      } as MatIssueRequestItem);
      itemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', minPackQty: 6 } as ItemMaster);
      queryRunner.manager.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
      } as MatLot);

      // 올림 잔여 12 초과 13 → 차단
      await expect(
        service.issueFromRequest('REQ-001', {
          warehouseCode: 'WH-01',
          items: [{ requestItemId: '1', matUid: 'MAT-001', issueQty: 13 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect((matIssueService as any).createInTx).not.toHaveBeenCalled();
    });

    it('부분 출고 시 요청 상태를 PARTIAL로 갱신한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
        company: 'C1',
        plant: 'P1',
      } as MatIssueRequest);
      (matIssueService as any).createInTx = jest.fn().mockResolvedValue([{ issueNo: 'ISSUE-001' }]);
      requestItemRepo.find.mockResolvedValue([
        { requestId: 'REQ-001', seq: 1, itemCode: 'ITEM-001', requestQty: 10, issuedQty: 0 } as MatIssueRequestItem,
      ]);
      itemMasterRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', minPackQty: 0 } as ItemMaster]);
      queryRunner.manager.find.mockResolvedValue([{
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
      } as MatLot]);

      // 요청 10 중 4만 출고 → 잔여 6 → PARTIAL
      await service.issueFromRequest('REQ-001', {
        warehouseCode: 'WH-01',
        issueType: 'PRODUCTION',
        workerId: 'user',
        items: [{ requestItemId: '1', matUid: 'MAT-001', issueQty: 4 }],
      }, 'C1', 'P1');

      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatIssueRequest,
        { requestNo: 'REQ-001', company: 'C1', plant: 'P1' },
        { status: 'PARTIAL' },
      );
    });

    it('PARTIAL 상태에서도 잔여를 출고할 수 있고 전량 채우면 COMPLETED가 된다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'PARTIAL',
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
        company: 'C1',
        plant: 'P1',
      } as MatIssueRequest);
      (matIssueService as any).createInTx = jest.fn().mockResolvedValue([{ issueNo: 'ISSUE-002' }]);
      requestItemRepo.find.mockResolvedValue([
        { requestId: 'REQ-001', seq: 1, itemCode: 'ITEM-001', requestQty: 10, issuedQty: 4 } as MatIssueRequestItem,
      ]);
      itemMasterRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', minPackQty: 0 } as ItemMaster]);
      queryRunner.manager.find.mockResolvedValue([{
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
      } as MatLot]);

      // 잔여 6 전량 출고 → COMPLETED
      await service.issueFromRequest('REQ-001', {
        warehouseCode: 'WH-01',
        items: [{ requestItemId: '1', matUid: 'MAT-001', issueQty: 6 }],
      }, 'C1', 'P1');

      expect((matIssueService as any).createInTx).toHaveBeenCalled();
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatIssueRequest,
        { requestNo: 'REQ-001', company: 'C1', plant: 'P1' },
        { status: 'COMPLETED' },
      );
    });
  });
});
