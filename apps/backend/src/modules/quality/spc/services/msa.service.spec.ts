/**
 * @file msa.service.spec.ts
 * @description MsaService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MsaService } from './msa.service';
import { GaugeMaster } from '../../../../entities/gauge-master.entity';
import { CalibrationLog } from '../../../../entities/calibration-log.entity';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('MsaService', () => {
  let target: MsaService;
  let mockGaugeRepo: DeepMocked<Repository<GaugeMaster>>;
  let mockCalRepo: DeepMocked<Repository<CalibrationLog>>;

  beforeEach(async () => {
    mockGaugeRepo = createMock<Repository<GaugeMaster>>();
    mockCalRepo = createMock<Repository<CalibrationLog>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MsaService,
        { provide: getRepositoryToken(GaugeMaster), useValue: mockGaugeRepo },
        { provide: getRepositoryToken(CalibrationLog), useValue: mockCalRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<MsaService>(MsaService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findGaugeById', () => {
    it('should return gauge', async () => {
      mockGaugeRepo.findOne.mockResolvedValue({ gaugeCode: 'G-001' } as any);
      expect((await target.findGaugeById('G-001')).gaugeCode).toBe('G-001');
    });
    it('should throw NotFoundException', async () => {
      mockGaugeRepo.findOne.mockResolvedValue(null);
      await expect(target.findGaugeById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createGauge', () => {
    it('should create gauge', async () => {
      mockGaugeRepo.findOne.mockResolvedValue(null);
      const saved = { gaugeCode: 'G-001' } as any;
      mockGaugeRepo.create.mockReturnValue(saved);
      mockGaugeRepo.save.mockResolvedValue(saved);
      const r = await target.createGauge({ gaugeCode: 'G-001' } as any, 'CO', 'P01', 'user');
      expect(r.gaugeCode).toBe('G-001');
    });
    it('should throw when duplicate', async () => {
      mockGaugeRepo.findOne.mockResolvedValue({ gaugeCode: 'G-001' } as any);
      await expect(target.createGauge({ gaugeCode: 'G-001' } as any, 'CO', 'P01', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteGauge', () => {
    it('should throw when calibrations exist', async () => {
      mockGaugeRepo.findOne.mockResolvedValue({ gaugeCode: 'G-001' } as any);
      mockCalRepo.count.mockResolvedValue(3);
      await expect(target.deleteGauge('G-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteCalibration', () => {
    it('should throw when not found', async () => {
      mockCalRepo.findOne.mockResolvedValue(null);
      await expect(target.deleteCalibration('CAL-999')).rejects.toThrow(NotFoundException);
    });
  });
});
