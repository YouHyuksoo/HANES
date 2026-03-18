/**
 * @file src/modules/material/services/label-print.service.spec.ts
 * @description LabelPrintService 단위 테스트 - ZPL 변수 치환, TCP 전송, 발행 이력
 *
 * 초보자 가이드:
 * - generateZpl: 템플릿 ZPL에서 {{matUid}}, {{itemCode}} 등 변수 치환
 * - createLog: 라벨 발행 이력 저장
 * - findLogs: 발행 이력 조회 (페이지네이션)
 * - 실행: `npx jest --testPathPattern="label-print.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LabelPrintService } from './label-print.service';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { LabelTemplate } from '../../../entities/label-template.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('LabelPrintService', () => {
  let target: LabelPrintService;
  let mockPrintLogRepo: DeepMocked<Repository<LabelPrintLog>>;
  let mockTemplateRepo: DeepMocked<Repository<LabelTemplate>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;

  beforeEach(async () => {
    mockPrintLogRepo = createMock<Repository<LabelPrintLog>>();
    mockTemplateRepo = createMock<Repository<LabelTemplate>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabelPrintService,
        { provide: getRepositoryToken(LabelPrintLog), useValue: mockPrintLogRepo },
        { provide: getRepositoryToken(LabelTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<LabelPrintService>(LabelPrintService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── generateZpl ───
  describe('generateZpl', () => {
    it('템플릿의 변수를 LOT 데이터로 치환한다', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        templateName: 'TEST',
        zplCode: '^FO10,10^FD{{matUid}}^FS^FO10,30^FD{{itemName}}^FS',
      } as LabelTemplate);

      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        initQty: 100,
        vendor: 'VENDOR-A',
        recvDate: new Date('2026-01-01'),
      } as MatLot);

      mockPartMasterRepo.findOne.mockResolvedValue({
        itemCode: 'ITEM-001',
        itemName: '커넥터A',
        unit: 'EA',
      } as PartMaster);

      const result = await target.generateZpl({ templateId: 'TEST', matUids: ['MAT-001'] });

      expect(result.zplDataList).toHaveLength(1);
      expect(result.zplDataList[0]).toContain('MAT-001');
      expect(result.zplDataList[0]).toContain('커넥터A');
      expect(result.lotDetails).toHaveLength(1);
    });

    it('존재하지 않는 템플릿이면 NotFoundException', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        target.generateZpl({ templateId: 'NONE', matUids: ['MAT-001'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('ZPL 코드가 없는 템플릿이면 BadRequestException', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        templateName: 'TEST',
        zplCode: null,
      } as LabelTemplate);

      await expect(
        target.generateZpl({ templateId: 'TEST', matUids: ['MAT-001'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('LOT이 없으면 NotFoundException', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        templateName: 'TEST',
        zplCode: '^FD{{matUid}}^FS',
      } as LabelTemplate);
      mockMatLotRepo.findOne.mockResolvedValue(null);

      await expect(
        target.generateZpl({ templateId: 'TEST', matUids: ['NONE'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it(':: 구분자가 있는 templateId를 파싱한다', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        templateName: 'TEST',
        category: 'mat_lot',
        zplCode: '^FD{{matUid}}^FS',
      } as LabelTemplate);
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        initQty: 100,
      } as MatLot);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster);

      await target.generateZpl({ templateId: 'TEST::mat_lot', matUids: ['MAT-001'] });

      expect(mockTemplateRepo.findOne).toHaveBeenCalledWith({
        where: { templateName: 'TEST', category: 'mat_lot' },
      });
    });
  });

  // ─── createLog ───
  describe('createLog', () => {
    it('라벨 발행 이력을 저장한다', async () => {
      const log = { id: 1, category: 'mat_lot', labelCount: 2, status: 'SUCCESS' } as LabelPrintLog;
      mockPrintLogRepo.create.mockReturnValue(log);
      mockPrintLogRepo.save.mockResolvedValue(log);

      const result = await target.createLog({
        category: 'mat_lot',
        printMode: 'BROWSER',
        uidList: ['MAT-001'],
        labelCount: 2,
      } as any);

      expect(result.status).toBe('SUCCESS');
      expect(mockPrintLogRepo.save).toHaveBeenCalled();
    });
  });

  // ─── findLogs ───
  describe('findLogs', () => {
    it('발행 이력을 페이지네이션으로 조회한다', async () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
      };
      mockPrintLogRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await target.findLogs({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
