/**
 * @file src/shared/numbering.service.spec.ts
 * @description NumberingService 파사드 단위 테스트 - 채번 유형별 라우팅 검증
 *
 * 초보자 가이드:
 * - SEQ_TYPES → SeqGeneratorService.getNo() 호출
 * - RULE_TYPES → NumRuleService.nextNumber()/nextNumberInTx() 호출
 * - 실행: `pnpm test -- -t "NumberingService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, QueryRunner } from 'typeorm';
import { NumberingService } from './numbering.service';
import { SeqGeneratorService } from './seq-generator.service';
import { NumRuleService } from '../modules/num-rule/num-rule.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('NumberingService', () => {
  let target: NumberingService;
  let mockSeqGenerator: DeepMocked<SeqGeneratorService>;
  let mockNumRule: DeepMocked<NumRuleService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockDataSource: { manager: { query: jest.Mock } };

  beforeEach(async () => {
    mockSeqGenerator = createMock<SeqGeneratorService>();
    mockNumRule = createMock<NumRuleService>();
    mockQueryRunner = createMock<QueryRunner>();
    mockDataSource = { manager: { query: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumberingService,
        { provide: SeqGeneratorService, useValue: mockSeqGenerator },
        { provide: NumRuleService, useValue: mockNumRule },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<NumberingService>(NumberingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SEQ_TYPES routing', () => {
    it.each([
      'MAT_UID', 'PRD_UID', 'CON_UID', 'FG_BARCODE',
      'JOB_ORDER', 'OQC_REQ', 'MAT_REQ', 'SHIPMENT',
      'SUBCON', 'INSPECT_RESULT', 'PROD_RESULT',
    ])('should route %s to SeqGeneratorService', async (type) => {
      // Arrange
      mockSeqGenerator.getNo.mockResolvedValue(`${type}-001`);

      // Act
      const result = await target.next(type);

      // Assert
      expect(result).toBe(`${type}-001`);
      expect(mockSeqGenerator.getNo).toHaveBeenCalledWith(type, undefined);
      expect(mockNumRule.nextNumber).not.toHaveBeenCalled();
    });
  });

  describe('RULE_TYPES routing', () => {
    it.each([
      'ARRIVAL', 'RECEIVING', 'MAT_ISSUE',
      'SCRAP', 'RECEIPT_CANCEL', 'ISSUE_REQUEST',
      'STOCK_TX', 'CANCEL_TX', 'RECEIVE',
    ])('should route %s to NumRuleService.nextNumber without qr', async (type) => {
      // Arrange
      mockNumRule.nextNumber.mockResolvedValue(`${type}-001`);

      // Act
      const result = await target.next(type);

      // Assert
      expect(result).toBe(`${type}-001`);
      expect(mockNumRule.nextNumber).toHaveBeenCalledWith(type, undefined);
      expect(mockSeqGenerator.getNo).not.toHaveBeenCalled();
    });

    it('should route RULE_TYPE to NumRuleService.nextNumberInTx with qr', async () => {
      // Arrange
      mockNumRule.nextNumberInTx.mockResolvedValue('ARR20260318-0001');

      // Act
      const result = await target.next('ARRIVAL', mockQueryRunner, 'admin');

      // Assert
      expect(result).toBe('ARR20260318-0001');
      expect(mockNumRule.nextNumberInTx).toHaveBeenCalledWith(
        mockQueryRunner, 'ARRIVAL', 'admin',
      );
    });
  });

  describe('unknown type fallback', () => {
    it('should fallback to SeqGenerator for unknown types', async () => {
      // Arrange
      mockSeqGenerator.getNo.mockResolvedValue('CUSTOM-001');

      // Act
      const result = await target.next('CUSTOM_TYPE');

      // Assert
      expect(result).toBe('CUSTOM-001');
      expect(mockSeqGenerator.getNo).toHaveBeenCalledWith('CUSTOM_TYPE', undefined);
    });
  });

  describe('nextInTx', () => {
    it('should pass QueryRunner to next()', async () => {
      // Arrange
      mockSeqGenerator.getNo.mockResolvedValue('MAT-UID-001');

      // Act
      const result = await target.nextInTx(mockQueryRunner, 'MAT_UID');

      // Assert
      expect(result).toBe('MAT-UID-001');
      expect(mockSeqGenerator.getNo).toHaveBeenCalledWith('MAT_UID', mockQueryRunner);
    });
  });

  describe('convenience methods', () => {
    it('should call next with correct type', async () => {
      // Arrange
      mockSeqGenerator.getNo.mockResolvedValue('RM20260318-0001');

      // Act
      const result = await target.nextMatUid();

      // Assert
      expect(result).toBe('RM20260318-0001');
      expect(mockSeqGenerator.getNo).toHaveBeenCalledWith('MAT_UID', undefined);
    });
  });

  describe('IQC005 Phase A — application-level format channels', () => {
    const fixedDate = new Date('2026-05-26T12:00:00+09:00');

    it('nextMatSerial: VH1-RM + YYMMDD + 5-digit zero pad', async () => {
      mockDataSource.manager.query.mockResolvedValueOnce([{ NEXT_SEQ: 7 }]);
      const result = await target.nextMatSerial(undefined, fixedDate);
      expect(result).toBe('VH1-RM260526-00007');
      expect(mockDataSource.manager.query).toHaveBeenCalledWith(
        'SELECT SEQ_MAT_SERIAL_DAILY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
      );
    });

    it('nextMatSerial: handles seq = 1 with full zero-pad', async () => {
      mockDataSource.manager.query.mockResolvedValueOnce([{ NEXT_SEQ: 1 }]);
      const result = await target.nextMatSerial(undefined, fixedDate);
      expect(result).toBe('VH1-RM260526-00001');
    });

    it('nextArrivalNoV2: R + YYMMDD + 5-digit (no separator)', async () => {
      mockDataSource.manager.query.mockResolvedValueOnce([{ NEXT_SEQ: 3 }]);
      const result = await target.nextArrivalNoV2(undefined, fixedDate);
      expect(result).toBe('R26052600003');
      expect(mockDataSource.manager.query).toHaveBeenCalledWith(
        'SELECT SEQ_ARRIVAL_NO_DAILY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
      );
    });

    it('nextMatSerial: uses queryRunner.manager when qr passed', async () => {
      const qrManagerQuery = jest.fn().mockResolvedValueOnce([{ NEXT_SEQ: 42 }]);
      const qr = { manager: { query: qrManagerQuery } } as unknown as QueryRunner;
      const result = await target.nextMatSerial(qr, fixedDate);
      expect(result).toBe('VH1-RM260526-00042');
      expect(qrManagerQuery).toHaveBeenCalled();
      // dataSource는 호출되지 않아야 함
      expect(mockDataSource.manager.query).not.toHaveBeenCalled();
    });
  });
});
