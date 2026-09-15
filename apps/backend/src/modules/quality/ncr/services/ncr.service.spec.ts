import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NcrService } from './ncr.service';
import { NcrReport } from '../../../../entities/ncr-report.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('NcrService', () => {
  let target: NcrService;
  let mockRepo: DeepMocked<Repository<NcrReport>>;
  let mockSeq: DeepMocked<SeqGeneratorService>;

  const baseDto = { targetType: 'RAW_MATERIAL', foundStage: 'IQC', itemCode: 'IT-1' };

  beforeEach(async () => {
    mockRepo = createMock<Repository<NcrReport>>();
    mockSeq = createMock<SeqGeneratorService>();
    mockSeq.getNo.mockResolvedValue('NCR-260915-001');
    mockRepo.create.mockImplementation((v) => v as NcrReport);
    mockRepo.save.mockImplementation(async (v) => v as NcrReport);
    mockRepo.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NcrService,
        { provide: getRepositoryToken(NcrReport), useValue: mockRepo },
        { provide: SeqGeneratorService, useValue: mockSeq },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(NcrService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('발행', () => {
    it('채번 규칙으로 번호를 받아 OPEN 으로 발행한다', async () => {
      const saved = await target.create(baseDto as never, 'W1', 'CO', 'P01');
      expect(mockSeq.getNo).toHaveBeenCalledWith('NCR_NO');
      expect(saved.ncrNo).toBe('NCR-260915-001');
      expect(saved.status).toBe('OPEN');
      expect(saved.writerCode).toBe('W1');
    });

    it('같은 출처로 이미 발행된 건이면 거부한다', async () => {
      mockRepo.findOne.mockResolvedValue({ ncrNo: 'NCR-260915-001' } as NcrReport);
      await expect(
        target.create({ ...baseDto, sourceType: 'IQC_LOG', sourceId: 'IQC-1' } as never, 'W1', 'CO', 'P01'),
      ).rejects.toThrow(/이미 부적합 보고서가 발행된 건입니다/);
      expect(mockSeq.getNo).not.toHaveBeenCalled();
    });

    it('출처가 없으면 중복 검사를 건너뛴다', async () => {
      await target.create(baseDto as never, 'W1', 'CO', 'P01');
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('상태 전이', () => {
    it('처리방안을 확정하면 IN_PROGRESS 가 된다', async () => {
      mockRepo.findOne.mockResolvedValue({ ncrNo: 'N1', status: 'OPEN' } as NcrReport);
      const saved = await target.setDisposition(
        'N1', { disposition: 'REWORK', responsibleCode: 'W2' } as never, 'W1', 'CO', 'P01',
      );
      expect(saved.status).toBe('IN_PROGRESS');
      expect(saved.disposition).toBe('REWORK');
      expect(saved.respondedAt).toBeInstanceOf(Date);
    });

    it('종결된 건은 수정할 수 없다 — 품질기록이라 사후 변경을 막는다', async () => {
      mockRepo.findOne.mockResolvedValue({ ncrNo: 'N1', status: 'CLOSED' } as NcrReport);
      await expect(target.update('N1', { itemCode: 'IT-2' } as never, 'W1', 'CO', 'P01'))
        .rejects.toThrow(/종결된 부적합 보고서는 수정할 수 없습니다/);
      await expect(target.setDisposition('N1', { disposition: 'SCRAP' } as never, 'W1', 'CO', 'P01'))
        .rejects.toThrow(/종결된/);
    });

    it('없는 번호는 NotFound', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(target.findOne('N-없음', 'CO', 'P01')).rejects.toThrow(NotFoundException);
    });
  });

  describe('종결', () => {
    it('처리방안이 없으면 종결할 수 없다', async () => {
      mockRepo.findOne.mockResolvedValue({ ncrNo: 'N1', status: 'IN_PROGRESS', rootCause: '원인' } as NcrReport);
      await expect(target.close('N1', { approverCode: 'QA1' } as never, 'W1', 'CO', 'P01'))
        .rejects.toThrow(/처리방안을 먼저 확정/);
    });

    it('발생 원인이 없으면 종결할 수 없다 — 무엇을 했는지 모르는 기록을 막는다', async () => {
      mockRepo.findOne.mockResolvedValue({ ncrNo: 'N1', status: 'IN_PROGRESS', disposition: 'SCRAP' } as NcrReport);
      await expect(target.close('N1', { approverCode: 'QA1' } as never, 'W1', 'CO', 'P01'))
        .rejects.toThrow(/발생 원인을 기재/);
    });

    it('둘 다 채워지면 승인자와 함께 종결한다', async () => {
      mockRepo.findOne.mockResolvedValue({
        ncrNo: 'N1', status: 'IN_PROGRESS', disposition: 'REWORK', rootCause: '압착 치공구 마모',
      } as NcrReport);
      const saved = await target.close('N1', { approverCode: 'QA1' } as never, 'W1', 'CO', 'P01');
      expect(saved.status).toBe('CLOSED');
      expect(saved.approverCode).toBe('QA1');
      expect(saved.closedAt).toBeInstanceOf(Date);
    });

    it('이미 종결된 건은 다시 종결하지 않는다', async () => {
      mockRepo.findOne.mockResolvedValue({ ncrNo: 'N1', status: 'CLOSED' } as NcrReport);
      await expect(target.close('N1', { approverCode: 'QA1' } as never, 'W1', 'CO', 'P01'))
        .rejects.toThrow(BadRequestException);
    });
  });
});
