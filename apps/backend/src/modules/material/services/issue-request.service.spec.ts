import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { IssueRequestService } from './issue-request.service';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MatIssueService } from './mat-issue.service';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('IssueRequestService', () => {
  let service: IssueRequestService;
  let requestRepo: DeepMocked<Repository<MatIssueRequest>>;
  let requestItemRepo: DeepMocked<Repository<MatIssueRequestItem>>;
  let partMasterRepo: DeepMocked<Repository<PartMaster>>;
  let matIssueService: DeepMocked<MatIssueService>;
  let numbering: DeepMocked<NumberingService>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    requestRepo = createMock<Repository<MatIssueRequest>>();
    requestItemRepo = createMock<Repository<MatIssueRequestItem>>();
    partMasterRepo = createMock<Repository<PartMaster>>();
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
        { provide: getRepositoryToken(PartMaster), useValue: partMasterRepo },
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
      partMasterRepo.find.mockResolvedValue([]);

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
      partMasterRepo.find.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(requestItemRepo.find).toHaveBeenCalledWith({
        where: { requestId: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(partMasterRepo.find).toHaveBeenCalledWith({
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
      partMasterRepo.find.mockResolvedValue([]);

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
      partMasterRepo.find.mockResolvedValue([]);

      await service.findByRequestNo('REQ-001', 'C1', 'P1');

      expect(requestRepo.findOne).toHaveBeenCalledWith({
        where: { requestNo: 'REQ-001', company: 'C1', plant: 'P1' },
      });
      expect(requestItemRepo.find).toHaveBeenCalledWith({
        where: { requestId: 'REQ-001', company: 'C1', plant: 'P1' },
      });
      expect(partMasterRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('create', () => {
    it('ORDER_NO를 orderNo 엔티티 속성으로 저장한다', async () => {
      numbering.next.mockResolvedValue('REQ-001');
      queryRunner.manager.create.mockImplementation((_entity, value: any) => value);
      queryRunner.manager.save
        .mockResolvedValueOnce({ requestNo: 'REQ-001' } as MatIssueRequest)
        .mockResolvedValueOnce([] as any);
      requestRepo.findOne.mockResolvedValue({ requestNo: 'REQ-001', orderNo: 'WO-001' } as MatIssueRequest);
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
  });

  describe('issueFromRequest', () => {
    it('요청 품목 갱신과 실제 출고를 같은 트랜잭션에서 처리한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        orderNo: 'WO-001',
        issueType: 'PRODUCTION',
      } as MatIssueRequest);
      (matIssueService as any).createInTx = jest.fn().mockResolvedValue([{ issueNo: 'ISSUE-001' }]);
      requestItemRepo.findOne.mockResolvedValue({
        requestId: 'REQ-001',
        seq: 1,
        requestQty: 10,
        issuedQty: 2,
      } as MatIssueRequestItem);
      requestItemRepo.find.mockResolvedValue([
        { requestId: 'REQ-001', seq: 1, requestQty: 10, issuedQty: 2 } as MatIssueRequestItem,
      ]);

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
      expect(requestItemRepo.findOne).toHaveBeenCalledWith({
        where: { requestId: 'REQ-001', seq: 1, company: 'C1', plant: 'P1' },
      });
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
  });
});
