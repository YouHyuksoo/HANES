import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NcrAttachmentService, type UploadedFileInfo } from './ncr-attachment.service';
import { NcrAttachment } from '../../../../entities/ncr-attachment.entity';
import { NcrReport } from '../../../../entities/ncr-report.entity';
import { TransactionService } from '../../../../shared/transaction.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('NcrAttachmentService', () => {
  let target: NcrAttachmentService;
  let mockAttachRepo: DeepMocked<Repository<NcrAttachment>>;
  let mockNcrRepo: DeepMocked<Repository<NcrReport>>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQr: DeepMocked<QueryRunner>;
  /** run 이 롤백까지 대신하므로, 콜백이 던지면 그대로 전파되는지만 본다 */
  let txRolledBack: boolean;

  const file = (name: string, mimetype: string): UploadedFileInfo => ({
    originalname: name,
    filename: `ncr-1${name}`,
    path: `uploads/ncr-attachments/ncr-1${name}`,
    size: 1234,
    mimetype,
  });

  beforeEach(async () => {
    mockAttachRepo = createMock<Repository<NcrAttachment>>();
    mockNcrRepo = createMock<Repository<NcrReport>>();
    mockQr = createMock<QueryRunner>();
    txRolledBack = false;
    mockTx = createMock<TransactionService>();
    // TransactionService.run 의 실제 동작(성공 커밋 / 실패 롤백)을 흉내 낸다
    mockTx.run.mockImplementation(async (cb) => {
      try {
        return await cb(mockQr);
      } catch (err) {
        txRolledBack = true;
        throw err;
      }
    });

    mockNcrRepo.findOne.mockResolvedValue({ ncrNo: 'N1', status: 'OPEN' } as NcrReport);
    mockQr.manager.count.mockResolvedValue(0);
    mockQr.manager.create.mockImplementation((_e, v) => v as never);
    mockQr.manager.save.mockImplementation(async (v) => v as never);
    mockQr.query.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NcrAttachmentService,
        { provide: getRepositoryToken(NcrAttachment), useValue: mockAttachRepo },
        { provide: getRepositoryToken(NcrReport), useValue: mockNcrRepo },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(NcrAttachmentService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('등록', () => {
    /**
     * 복합 PK 컬럼(SEQ)에 DB DEFAULT 를 믿고 맡기면 TypeORM 이 INSERT 에 안 채워 ORA-01400 이 난다.
     * LABEL_PRINT_LOGS 에서 실제로 500 이 났던 유형이라 값이 채워지는지 못 박아 둔다.
     */
    it('SEQ 를 명시 계산해 채운다 — 복합 PK 라 DB DEFAULT 에 맡기면 INSERT 가 깨진다', async () => {
      mockQr.manager.count.mockResolvedValue(2);
      const saved = await target.create('N1', file('a.png', 'image/png'), undefined, 'W1', 'CO', 'P01');
      expect(saved.seq).toBe(3);
      expect(saved.company).toBe('CO');
      expect(saved.plant).toBe('P01');
      expect(saved.ncrNo).toBe('N1');
    });

    it('동시 업로드로 SEQ 가 겹치지 않게 보고서 행을 잠근 뒤 센다', async () => {
      await target.create('N1', file('a.png', 'image/png'), undefined, 'W1', 'CO', 'P01');
      expect(mockTx.run).toHaveBeenCalled();
      expect(mockQr.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        expect.arrayContaining(['CO', 'P01', 'N1']),
      );
    });

    it('이미지와 문서를 구분한다 — 인쇄 양식에 사진으로 실을지가 갈린다', async () => {
      const img = await target.create('N1', file('a.png', 'image/png'), undefined, 'W1', 'CO', 'P01');
      expect(img.kind).toBe('IMAGE');
      const doc = await target.create('N1', file('a.pdf', 'application/pdf'), undefined, 'W1', 'CO', 'P01');
      expect(doc.kind).toBe('DOC');
    });

    it('mimetype 이 비어도 확장자로 이미지를 알아본다', async () => {
      const saved = await target.create('N1', file('shot.JPG', ''), undefined, 'W1', 'CO', 'P01');
      expect(saved.kind).toBe('IMAGE');
    });

    it('종결된 보고서에는 첨부할 수 없다 — 본문만 막으면 증빙으로 우회된다', async () => {
      mockNcrRepo.findOne.mockResolvedValue({ ncrNo: 'N1', status: 'CLOSED' } as NcrReport);
      await expect(
        target.create('N1', file('a.png', 'image/png'), undefined, 'W1', 'CO', 'P01'),
      ).rejects.toThrow(/종결된 부적합 보고서는 첨부를 변경할 수 없습니다/);
      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('없는 보고서면 NotFound', async () => {
      mockNcrRepo.findOne.mockResolvedValue(null);
      await expect(
        target.create('없음', file('a.png', 'image/png'), undefined, 'W1', 'CO', 'P01'),
      ).rejects.toThrow(NotFoundException);
    });

    it('저장 중 오류가 나면 롤백한다', async () => {
      mockQr.manager.save.mockRejectedValue(new Error('ORA-00001'));
      await expect(
        target.create('N1', file('a.png', 'image/png'), undefined, 'W1', 'CO', 'P01'),
      ).rejects.toThrow('ORA-00001');
      expect(txRolledBack).toBe(true);
    });
  });

  describe('삭제', () => {
    it('종결된 보고서의 첨부는 지울 수 없다', async () => {
      mockNcrRepo.findOne.mockResolvedValue({ ncrNo: 'N1', status: 'CLOSED' } as NcrReport);
      await expect(target.remove('N1', 1, 'W1', 'CO', 'P01')).rejects.toThrow(BadRequestException);
    });

    it('없는 순번이면 NotFound', async () => {
      mockAttachRepo.findOne.mockResolvedValue(null);
      await expect(target.remove('N1', 9, 'W1', 'CO', 'P01')).rejects.toThrow(NotFoundException);
    });

    it('행을 지운 뒤 파일을 지운다 — 순서가 반대면 파일만 사라지고 행이 남는다', async () => {
      mockAttachRepo.findOne.mockResolvedValue({
        ncrNo: 'N1', seq: 1, filePath: 'uploads/ncr-attachments/없는파일.png',
      } as NcrAttachment);
      await expect(target.remove('N1', 1, 'W1', 'CO', 'P01')).resolves.toBeUndefined();
      expect(mockAttachRepo.remove).toHaveBeenCalled();
    });
  });

  describe('목록', () => {
    it('순번 오름차순으로 준다', async () => {
      mockAttachRepo.find.mockResolvedValue([]);
      await target.findAll('N1', 'CO', 'P01');
      expect(mockAttachRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { seq: 'ASC' } }),
      );
    });
  });
});
