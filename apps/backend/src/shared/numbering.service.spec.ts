/**
 * @file src/shared/numbering.service.spec.ts
 * @description NumberingService 파사드 단위 테스트 - 채번 유형별 라우팅 검증
 *
 * 초보자 가이드:
 * - SEQ_TYPES → SeqGeneratorService.getNo() 호출
 * - 레거시 번호 형식 → 전용 Oracle SEQUENCE.NEXTVAL 호출
 * - 실행: `pnpm test -- -t "NumberingService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, QueryRunner } from 'typeorm';
import { NumberingService } from './numbering.service';
import { SeqGeneratorService } from './seq-generator.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('NumberingService', () => {
  let target: NumberingService;
  let mockSeqGenerator: DeepMocked<SeqGeneratorService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockDataSource: { manager: { query: jest.Mock } };

  beforeEach(async () => {
    mockSeqGenerator = createMock<SeqGeneratorService>();
    mockQueryRunner = createMock<QueryRunner>();
    mockDataSource = { manager: { query: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumberingService,
        { provide: SeqGeneratorService, useValue: mockSeqGenerator },
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
      'ADJ_TX', 'MISC_TX', 'PHYS_CNT_TX', 'INV_TX', 'PRODUCT_TX',
      'AUDIT_NO', 'FAI_NO', 'COMPLAINT_NO', 'ECN_NO', 'CAPA_CA', 'CAPA_PA',
      'SPC_CHART', 'CALIBRATION', 'CONTROL_PLAN', 'REWORK_NO', 'PPAP_NO',
      'DOC_NO', 'OQC_REQUEST',
    ])('should route %s to SeqGeneratorService', async (type) => {
      // Arrange
      mockSeqGenerator.getNo.mockResolvedValue(`${type}-001`);

      // Act
      const result = await target.next(type);

      // Assert
      expect(result).toBe(`${type}-001`);
      expect(mockSeqGenerator.getNo).toHaveBeenCalledWith(type, undefined);
    });
  });

  describe('legacy-format global sequences', () => {
    it.each([
      ['ARRIVAL', 'SEQ_LEGACY_ARRIVAL', 'ARR20260318-0007'],
      ['MAT_ISSUE', 'SEQ_LEGACY_MAT_ISSUE', 'ISS20260318-0007'],
      ['STOCK_TX', 'SEQ_LEGACY_STOCK_TX', 'TX20260318-00007'],
      ['CANCEL_TX', 'SEQ_LEGACY_CANCEL_TX', 'CTX20260318-00007'],
      ['RECEIVE', 'SEQ_LEGACY_RECEIVE', 'RCV20260318-0007'],
    ])('formats %s without a mutable counter row', async (type, sequenceName, expected) => {
      mockQueryRunner.manager.query.mockResolvedValueOnce([{ NEXT_SEQ: 7 }]);

      await expect(target.next(type, mockQueryRunner, 'admin', new Date('2026-03-18T12:00:00+09:00')))
        .resolves.toBe(expected);
      expect(mockQueryRunner.manager.query).toHaveBeenCalledWith(
        `SELECT ${sequenceName}.NEXTVAL AS "NEXT_SEQ" FROM DUAL`,
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

  describe('global sequence scoped-date formats', () => {
    it('nextProdPlanNo uses a global sequence while preserving the requested month', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ NEXT_SEQ: 42 }]);

      const result = await target.nextProdPlanNo(mockQueryRunner, '2026-09');

      expect(result).toBe('PP-202609-042');
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        'SELECT SEQ_PROD_PLAN_NO.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
      );
    });

    it('nextPmWoNo uses a global sequence while preserving kind and requested date', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ NEXT_SEQ: 1002 }]);

      const result = await target.nextPmWoNo(mockQueryRunner, '20260903', 'CBM');

      expect(result).toBe('CBM-20260903-1002');
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        'SELECT SEQ_PM_WORK_ORDER_NO.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
      );
    });
  });
});
