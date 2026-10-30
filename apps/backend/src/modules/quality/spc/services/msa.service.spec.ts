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
import { MockLoggerService } from '@test/mock-logger.service';
import { NumberingService } from '../../../../shared/numbering.service';

describe('MsaService', () => {
  let target: MsaService;
  let mockGaugeRepo: DeepMocked<Repository<GaugeMaster>>;
  let mockCalRepo: DeepMocked<Repository<CalibrationLog>>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockGaugeRepo = createMock<Repository<GaugeMaster>>();
    mockCalRepo = createMock<Repository<CalibrationLog>>();
    mockNumbering = createMock<NumberingService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MsaService,
        { provide: getRepositoryToken(GaugeMaster), useValue: mockGaugeRepo },
        { provide: getRepositoryToken(CalibrationLog), useValue: mockCalRepo },
        { provide: NumberingService, useValue: mockNumbering },
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

  describe('updateGauge', () => {
    it('should keep tenant and gauge key columns from the matched gauge when update payload contains them', async () => {
      const gauge = { gaugeCode: 'G-001', gaugeName: 'Old', company: 'CO', plant: 'P01' } as GaugeMaster;
      mockGaugeRepo.findOne.mockResolvedValue(gauge);
      mockGaugeRepo.save.mockImplementation(async (value) => value as GaugeMaster);

      const result = await target.updateGauge('G-001', {
        gaugeCode: 'G-999',
        gaugeName: 'New',
        company: 'OTHER',
        plant: 'P99',
      } as any, 'user', 'CO', 'P01');

      expect(result).toEqual(expect.objectContaining({
        gaugeCode: 'G-001',
        gaugeName: 'New',
        company: 'CO',
        plant: 'P01',
        updatedBy: 'user',
      }));
    });
  });

  describe('deleteCalibration', () => {
    it('should throw when not found', async () => {
      mockCalRepo.findOne.mockResolvedValue(null);
      await expect(target.deleteCalibration('CAL-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllCalibrations', () => {
    const createQb = (rows: any[], total: number) => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(total),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      return qb;
    };

    it('조회기간(fromDate/toDate)을 날짜 경계 조건으로 적용한다', async () => {
      const qb = createQb([], 0);
      mockCalRepo.createQueryBuilder.mockReturnValue(qb);

      await target.findAllCalibrations(
        { page: 1, limit: 50, fromDate: '2026-09-01', toDate: '2026-09-04' } as any,
        'C1',
        'P1',
      );

      expect(qb.andWhere).toHaveBeenCalledWith('c.calibrationDate >= :dateFrom', expect.objectContaining({ dateFrom: expect.any(Date) }));
      expect(qb.andWhere).toHaveBeenCalledWith('c.calibrationDate <= :dateTo', expect.objectContaining({ dateTo: expect.any(Date) }));
    });

    it('날짜 없이 호출하면 날짜 조건 없이 전체(테넌트 범위 내) 조회한다', async () => {
      const qb = createQb([], 0);
      mockCalRepo.createQueryBuilder.mockReturnValue(qb);

      await target.findAllCalibrations({ page: 1, limit: 50 } as any, 'C1', 'P1');

      const dateCalls = qb.andWhere.mock.calls.filter((c: any[]) => String(c[0]).includes('calibrationDate'));
      expect(dateCalls.length).toBe(0);
    });

    it('search 파라미터로 교정번호/계측기코드/계측기명을 LIKE 검색한다', async () => {
      const qb = createQb([], 0);
      mockCalRepo.createQueryBuilder.mockReturnValue(qb);

      await target.findAllCalibrations({ page: 1, limit: 50, search: 'cal-01' } as any, 'C1', 'P1');

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('c.calibrationNo'),
        { search: '%CAL-01%' },
      );
    });

    it('page/limit 로 서버 페이징하고 total/page/limit 을 반환한다', async () => {
      const rows = [{ calibrationNo: 'CAL-1' }];
      const qb = createQb(rows, 7);
      mockCalRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await target.findAllCalibrations({ page: 2, limit: 3 } as any, 'C1', 'P1');

      expect(qb.skip).toHaveBeenCalledWith(3);
      expect(qb.take).toHaveBeenCalledWith(3);
      expect(result).toEqual({ data: rows, total: 7, page: 2, limit: 3 });
    });
  });

  describe('교정 이력 입력 확인', () => {
    const dto = { gaugeId: 'G-001', calibrationDate: '2026-11-05', calibrationType: 'INTERNAL', result: 'PASS' } as any;

    it('폐기된 계측기에는 교정을 등록할 수 없다', async () => {
      mockGaugeRepo.findOne.mockResolvedValue({ gaugeCode: 'G-001', status: 'SCRAPPED' } as any);
      await expect(target.createCalibration(dto, 'CO', 'P01', 'user')).rejects.toThrow('폐기된 계측기에는 교정을 등록할 수 없습니다');
      expect(mockCalRepo.save).not.toHaveBeenCalled();
    });

    it('다음 교정일이 교정일보다 앞서면 400, 과거 소급 입력은 계측기 교정일을 덮어쓰지 않는다', async () => {
      mockGaugeRepo.findOne.mockResolvedValue({ gaugeCode: 'G-001', status: 'ACTIVE', lastCalibrationDate: new Date(2026, 9, 1) } as any);
      await expect(target.createCalibration({ ...dto, nextDueDate: '2026-01-01' }, 'CO', 'P01', 'user')).rejects.toThrow('다음 교정일이 교정일보다 앞설 수 없습니다');
      mockNumbering.next.mockResolvedValue('CAL-1');
      mockCalRepo.create.mockImplementation((v) => v as any);
      mockCalRepo.save.mockImplementation(async (v) => v as any);
      await target.createCalibration({ ...dto, calibrationDate: '2026-01-01' }, 'CO', 'P01', 'user');
      expect(mockCalRepo.save).toHaveBeenCalledTimes(1);
      expect(mockGaugeRepo.save).not.toHaveBeenCalled();
    });

    it('만료 예정 조회의 일수는 정수여야 한다', async () => {
      await expect(target.getExpiringSoon(NaN, 'CO', 'P01')).rejects.toThrow('조회 일수는 정수여야 합니다');
    });
  });
});
