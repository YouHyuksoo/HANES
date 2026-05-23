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

  describe('issueFromRequest', () => {
    it('요청 품목 갱신과 실제 출고를 같은 트랜잭션에서 처리한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        jobOrderId: 'WO-001',
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
      });

      expect(tx.run).toHaveBeenCalledTimes(1);
      expect((matIssueService as any).createInTx).toHaveBeenCalledWith(queryRunner, expect.objectContaining({
        warehouseCode: 'WH-01',
        items: [{ matUid: 'MAT-001', issueQty: 8 }],
      }));
      expect(matIssueService.create).not.toHaveBeenCalled();
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('요청 항목을 찾을 수 없으면 출고를 차단한다', async () => {
      requestRepo.findOne.mockResolvedValue({
        requestNo: 'REQ-001',
        status: 'APPROVED',
        jobOrderId: null,
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
        jobOrderId: null,
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
