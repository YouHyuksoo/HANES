/**
 * @file src/shared/seq-generator.service.spec.ts
 * @description SeqGeneratorService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "SeqGeneratorService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SeqGeneratorService } from './seq-generator.service';
import { MockLoggerService } from '../common/test/mock-logger.service';

describe('SeqGeneratorService', () => {
  let target: SeqGeneratorService;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeqGeneratorService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<SeqGeneratorService>(SeqGeneratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getNo ───
  describe('getNo', () => {
    it('should return generated number from Oracle package', async () => {
      // Arrange
      mockDataSource.manager = {
        query: jest.fn().mockResolvedValue([{ no: 'MAT20260318-0001' }]),
      } as any;

      // Act
      const result = await target.getNo('MAT_UID');

      // Assert
      expect(result).toBe('MAT20260318-0001');
    });

    it('should throw InternalServerErrorException on failure', async () => {
      // Arrange
      mockDataSource.manager = {
        query: jest.fn().mockRejectedValue(new Error('ORA-20001')),
      } as any;

      // Act & Assert
      await expect(target.getNo('INVALID')).rejects.toThrow(InternalServerErrorException);
    });

    it('should use QueryRunner manager when provided', async () => {
      // Arrange
      const mockQr = {
        manager: {
          query: jest.fn().mockResolvedValue([{ no: 'FG20260318-0001' }]),
        },
      };

      // Act
      const result = await target.getNo('FG_BARCODE', mockQr as any);

      // Assert
      expect(result).toBe('FG20260318-0001');
      expect(mockQr.manager.query).toHaveBeenCalled();
    });
  });

  // ─── convenience methods ───
  describe('convenience methods', () => {
    beforeEach(() => {
      mockDataSource.manager = {
        query: jest.fn().mockResolvedValue([{ no: 'TEST-001' }]),
      } as any;
    });

    it('nextMatUid should call getNo with MAT_UID', async () => {
      const result = await target.nextMatUid();
      expect(result).toBe('TEST-001');
    });

    it('nextPrdUid should call getNo with PRD_UID', async () => {
      const result = await target.nextPrdUid();
      expect(result).toBe('TEST-001');
    });

    it('nextConUid should call getNo with CON_UID', async () => {
      const result = await target.nextConUid();
      expect(result).toBe('TEST-001');
    });

    it('nextFgBarcode should call getNo with FG_BARCODE', async () => {
      const result = await target.nextFgBarcode();
      expect(result).toBe('TEST-001');
    });

    it('nextJobOrderNo should call getNo with JOB_ORDER', async () => {
      const result = await target.nextJobOrderNo();
      expect(result).toBe('TEST-001');
    });

    it('nextOqcReqNo should call getNo with OQC_REQ', async () => {
      const result = await target.nextOqcReqNo();
      expect(result).toBe('TEST-001');
    });

    it('nextMatReqNo should call getNo with MAT_REQ', async () => {
      const result = await target.nextMatReqNo();
      expect(result).toBe('TEST-001');
    });

    it('nextArrivalNo should call getNo with ARRIVAL', async () => {
      const result = await target.nextArrivalNo();
      expect(result).toBe('TEST-001');
    });

    it('nextShipmentNo should call getNo with SHIPMENT', async () => {
      const result = await target.nextShipmentNo();
      expect(result).toBe('TEST-001');
    });

    it('nextSubconNo should call getNo with SUBCON', async () => {
      const result = await target.nextSubconNo();
      expect(result).toBe('TEST-001');
    });

    it('nextProdResultNo should call getNo with PROD_RESULT', async () => {
      const result = await target.nextProdResultNo();
      expect(result).toBe('TEST-001');
    });

    it('nextInspectResultNo should call getNo with INSPECT_RESULT', async () => {
      const result = await target.nextInspectResultNo();
      expect(result).toBe('TEST-001');
    });
  });
});
