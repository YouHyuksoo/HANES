/**
 * @file src/modules/material/services/issue-request.service.spec.ts
 * @description IssueRequestService 단위 테스트 - 출고요청 생성, 승인, 반려, 실출고
 *
 * 초보자 가이드:
 * - 상태 흐름: REQUESTED -> APPROVED -> COMPLETED (또는 REJECTED)
 * - SeqGeneratorService로 요청번호 채번
 * - MatIssueService.create()로 실출고 위임
 * - 실행: `npx jest --testPathPattern="issue-request.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { IssueRequestService } from './issue-request.service';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MatIssueService } from './mat-issue.service';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('IssueRequestService', () => {
  let target: IssueRequestService;
  let mockRequestRepo: DeepMocked<Repository<MatIssueRequest>>;
  let mockRequestItemRepo: DeepMocked<Repository<MatIssueRequestItem>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockMatIssueService: DeepMocked<MatIssueService>;
  let mockSeqGenerator: DeepMocked<SeqGeneratorService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  const createRequest = (overrides: Partial<MatIssueRequest> = {}): MatIssueRequest =>
    ({
      requestNo: 'REQ-001',
      status: 'REQUESTED',
      requester: 'SYSTEM',
      jobOrderId: null,
      issueType: null,
      remark: null,
      requestDate: new Date(),
      ...overrides,
    }) as MatIssueRequest;

  beforeEach(async () => {
    mockRequestRepo = createMock<Repository<MatIssueRequest>>();
    mockRequestItemRepo = createMock<Repository<MatIssueRequestItem>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockMatIssueService = createMock<MatIssueService>();
    mockSeqGenerator = createMock<SeqGeneratorService>();
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
        IssueRequestService,
        { provide: getRepositoryToken(MatIssueRequest), useValue: mockRequestRepo },
        { provide: getRepositoryToken(MatIssueRequestItem), useValue: mockRequestItemRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: MatIssueService, useValue: mockMatIssueService },
        { provide: SeqGeneratorService, useValue: mockSeqGenerator },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<IssueRequestService>(IssueRequestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findByRequestNo ───
  describe('findByRequestNo', () => {
    it('요청번호로 출고요청을 반환한다', async () => {
      mockRequestRepo.findOne.mockResolvedValue(createRequest());
      mockRequestItemRepo.find.mockResolvedValue([]);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.findByRequestNo('REQ-001');

      expect(result.requestNo).toBe('REQ-001');
    });

    it('존재하지 않는 요청이면 NotFoundException', async () => {
      mockRequestRepo.findOne.mockResolvedValue(null);

      await expect(target.findByRequestNo('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── approve ───
  describe('approve', () => {
    it('REQUESTED 상태 요청을 승인한다', async () => {
      mockRequestRepo.findOne.mockResolvedValue(createRequest());
      mockRequestRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRequestItemRepo.find.mockResolvedValue([]);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.approve('REQ-001');

      expect(mockRequestRepo.update).toHaveBeenCalled();
    });

    it('REQUESTED가 아닌 상태이면 BadRequestException', async () => {
      mockRequestRepo.findOne.mockResolvedValue(createRequest({ status: 'APPROVED' }));

      await expect(target.approve('REQ-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── reject ───
  describe('reject', () => {
    it('REQUESTED 상태 요청을 반려한다', async () => {
      mockRequestRepo.findOne.mockResolvedValue(createRequest());
      mockRequestRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRequestItemRepo.find.mockResolvedValue([]);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.reject('REQ-001', { reason: '사유' });

      expect(mockRequestRepo.update).toHaveBeenCalled();
    });

    it('REQUESTED가 아닌 상태이면 BadRequestException', async () => {
      mockRequestRepo.findOne.mockResolvedValue(createRequest({ status: 'COMPLETED' }));

      await expect(target.reject('REQ-001', { reason: '사유' })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── issueFromRequest ───
  describe('issueFromRequest', () => {
    it('APPROVED가 아닌 상태이면 BadRequestException', async () => {
      mockRequestRepo.findOne.mockResolvedValue(createRequest({ status: 'REQUESTED' }));

      await expect(
        target.issueFromRequest('REQ-001', { items: [], warehouseCode: 'WH-01' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
