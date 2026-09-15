import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LabelReprintService } from './label-reprint.service';
import { SgLabel } from '../../../entities/sg-label.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('LabelReprintService', () => {
  let target: LabelReprintService;
  let mockSgRepo: DeepMocked<Repository<SgLabel>>;
  let mockFgRepo: DeepMocked<Repository<FgLabel>>;
  let mockLogRepo: DeepMocked<Repository<LabelPrintLog>>;

  beforeEach(async () => {
    mockSgRepo = createMock<Repository<SgLabel>>();
    mockFgRepo = createMock<Repository<FgLabel>>();
    mockLogRepo = createMock<Repository<LabelPrintLog>>();
    mockLogRepo.create.mockImplementation((v) => v as LabelPrintLog);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabelReprintService,
        { provide: getRepositoryToken(SgLabel), useValue: mockSgRepo },
        { provide: getRepositoryToken(FgLabel), useValue: mockFgRepo },
        { provide: getRepositoryToken(LabelPrintLog), useValue: mockLogRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(LabelReprintService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('reprint — SG', () => {
    it('인쇄 이력을 남기고 출력용 데이터를 돌려준다', async () => {
      mockSgRepo.find.mockResolvedValue([
        { sgBarcode: 'SG-1', itemCode: 'IT-1', orderNo: 'WO-1', initQty: 5, issueProcessCode: 'CUT', status: 'IN_STOCK' },
      ] as SgLabel[]);

      const result = await target.reprint('SG', ['SG-1'], 'W1', 'CO', 'P01');

      expect(result).toEqual([
        { barcode: 'SG-1', itemCode: 'IT-1', orderNo: 'WO-1', qty: 5, processCode: 'CUT' },
      ]);
      expect(mockLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'SG', printMode: 'REPRINT', uidList: 'SG-1', labelCount: 1 }),
      );
    });

    it('인쇄 이력에 복합 PK(PRINTED_AT+SEQ)를 채운다', async () => {
      // LABEL_PRINT_LOGS 는 PRINTED_AT + SEQ 가 복합 PK 다. 엔티티에 default 가 있어도
      // TypeORM 이 INSERT 에 채워주지 않아, 비워두면 실제 Oracle 에서 PK 위반으로 500 이 난다.
      mockSgRepo.find.mockResolvedValue([{ sgBarcode: 'SG-1', status: 'IN_STOCK' }] as SgLabel[]);
      mockLogRepo.count.mockResolvedValue(2);

      await target.reprint('SG', ['SG-1'], undefined, 'CO', 'P01');

      const saved = mockLogRepo.save.mock.calls[0][0] as { printedAt?: Date; seq?: number };
      expect(saved.printedAt).toBeInstanceOf(Date);
      expect(saved.seq).toBe(3); // 같은 시각 기존 2건 뒤
    });

    it('취소된 라벨은 거부한다', async () => {
      mockSgRepo.find.mockResolvedValue([{ sgBarcode: 'SG-1', status: 'VOIDED' }] as SgLabel[]);
      await expect(target.reprint('SG', ['SG-1'], undefined, 'CO', 'P01'))
        .rejects.toThrow(BadRequestException);
      expect(mockLogRepo.save).not.toHaveBeenCalled();
    });

    it('없는 바코드는 이름을 대고 거부한다', async () => {
      mockSgRepo.find.mockResolvedValue([{ sgBarcode: 'SG-1', status: 'IN_STOCK' }] as SgLabel[]);
      await expect(target.reprint('SG', ['SG-1', 'SG-없음'], undefined, 'CO', 'P01'))
        .rejects.toThrow(/SG-없음/);
    });
  });

  describe('reprint — FG', () => {
    it('REPRINT_COUNT 를 올리고 이력도 남긴다', async () => {
      const row = { fgBarcode: 'FG-1', itemCode: 'IT-1', orderNo: 'WO-1', status: 'ISSUED', reprintCount: 2 };
      mockFgRepo.find.mockResolvedValue([row] as FgLabel[]);

      await target.reprint('FG', ['FG-1'], 'W1', 'CO', 'P01');

      expect(row.reprintCount).toBe(3);
      expect(mockFgRepo.save).toHaveBeenCalledWith([row]);
      expect(mockLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'FG', printMode: 'REPRINT' }),
      );
    });

    it('reprintCount 가 비어 있어도 1 로 올린다', async () => {
      const row = { fgBarcode: 'FG-1', status: 'ISSUED' } as FgLabel;
      mockFgRepo.find.mockResolvedValue([row]);
      await target.reprint('FG', ['FG-1'], undefined, 'CO', 'P01');
      expect(row.reprintCount).toBe(1);
    });
  });

  it('선택이 비면 거부한다 — 빈 요청으로 이력만 쌓이지 않게', async () => {
    await expect(target.reprint('SG', ['  '], undefined, 'CO', 'P01'))
      .rejects.toThrow(BadRequestException);
    expect(mockSgRepo.find).not.toHaveBeenCalled();
  });

  it('없는 FG 바코드는 NotFound 로 알린다', async () => {
    mockFgRepo.find.mockResolvedValue([]);
    await expect(target.reprint('FG', ['FG-없음'], undefined, 'CO', 'P01'))
      .rejects.toThrow(NotFoundException);
  });
});
