/**
 * @file equip-inspect.service.spec.ts
 * @description EquipInspectService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EquipInspectService } from './equip-inspect.service';
import { EquipInspectLog } from '../../../entities/equip-inspect-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import { WorkCalendar } from '../../../entities/work-calendar.entity';
import { WorkCalendarDay } from '../../../entities/work-calendar-day.entity';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('EquipInspectService', () => {
  let target: EquipInspectService;
  let mockLogRepo: DeepMocked<Repository<EquipInspectLog>>;
  let mockEquipRepo: DeepMocked<Repository<EquipMaster>>;
  let mockItemRepo: DeepMocked<Repository<EquipInspectItemPool>>;
  let mockCalendarRepo: DeepMocked<Repository<WorkCalendar>>;
  let mockCalendarDayRepo: DeepMocked<Repository<WorkCalendarDay>>;
  let mockShiftRepo: DeepMocked<Repository<ShiftPattern>>;

  beforeEach(async () => {
    mockLogRepo = createMock<Repository<EquipInspectLog>>();
    mockEquipRepo = createMock<Repository<EquipMaster>>();
    mockItemRepo = createMock<Repository<EquipInspectItemPool>>();
    mockCalendarRepo = createMock<Repository<WorkCalendar>>();
    mockCalendarDayRepo = createMock<Repository<WorkCalendarDay>>();
    mockShiftRepo = createMock<Repository<ShiftPattern>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipInspectService,
        { provide: getRepositoryToken(EquipInspectLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: mockEquipRepo },
        { provide: getRepositoryToken(EquipInspectItemPool), useValue: mockItemRepo },
        { provide: getRepositoryToken(WorkCalendar), useValue: mockCalendarRepo },
        { provide: getRepositoryToken(WorkCalendarDay), useValue: mockCalendarDayRepo },
        { provide: getRepositoryToken(ShiftPattern), useValue: mockShiftRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<EquipInspectService>(EquipInspectService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('maps raw inspection rows to the grid response shape', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            log_EQUIP_CODE: 'EQ-ATCUT-01',
            log_INSPECT_TYPE: 'DAILY',
            log_INSPECT_DATE: new Date('2026-06-16T01:00:00.000Z'),
            log_ORDER_NO: null,
            log_WORK_DATE: new Date('2026-06-16T00:00:00.000Z'),
            log_INSPECT_AT: new Date('2026-06-16T01:00:00.000Z'),
            log_INSPECTOR_NAME: '홍길동',
            log_OVERALL_RESULT: 'PASS',
            log_DETAILS: '{"items":[]}',
            log_REMARK: '정상',
            log_COMPANY: '40',
            log_PLANT_CD: '1000',
            log_CREATED_BY: 'codex',
            log_UPDATED_BY: 'codex',
            log_CREATED_AT: new Date('2026-06-16T01:00:00.000Z'),
            log_UPDATED_AT: new Date('2026-06-16T01:00:00.000Z'),
            EQUIP_CODE: 'EQ-ATCUT-01',
            EQUIP_NAME: '자동절단 설비 #1',
            EQUIP_LINECODE: 'LINE-01',
          },
        ]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await target.findAll({ page: 1, limit: 20 } as any, '40', '1000');

      expect(result.total).toBe(1);
      expect(result.data[0]).toEqual(expect.objectContaining({
        equipCode: 'EQ-ATCUT-01',
        inspectType: 'DAILY',
        inspectorName: '홍길동',
        overallResult: 'PASS',
        remark: '정상',
        equipName: '자동절단 설비 #1',
        lineCode: 'LINE-01',
        equip: expect.objectContaining({
          equipCode: 'EQ-ATCUT-01',
          equipName: '자동절단 설비 #1',
          lineCode: 'LINE-01',
        }),
      }));
      expect(qb.andWhere).toHaveBeenCalledWith('log.company = :company', { company: '40' });
      expect(qb.andWhere).toHaveBeenCalledWith('log.plant = :plant', { plant: '1000' });
    });
  });

  describe('create', () => {
    it('should create inspect log', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);
      const saved = { equipCode: 'EQ-001', overallResult: 'PASS' } as any;
      mockLogRepo.create.mockReturnValue(saved);
      mockLogRepo.save.mockResolvedValue(saved);
      const r = await target.create({ equipCode: 'EQ-001', inspectType: 'DAILY', inspectDate: '2026-03-18', overallResult: 'PASS' } as any);
      expect(r.overallResult).toBe('PASS');
    });
    it('should throw when equip not found', async () => {
      mockEquipRepo.findOne.mockResolvedValue(null);
      await expect(target.create({ equipCode: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
    it('should throw when context tenant differs from equipment tenant', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);

      await expect(
        target.create(
          { equipCode: 'EQ-001', inspectType: 'DAILY', inspectDate: '2026-03-18', overallResult: 'PASS' } as any,
          { company: 'OTHER', plant: 'P01' },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockLogRepo.create).not.toHaveBeenCalled();
    });
    it('should throw when request tenant is present but equipment tenant is missing', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: null, plant: 'P01' } as any);

      await expect(
        target.create(
          { equipCode: 'EQ-001', inspectType: 'DAILY', inspectDate: '2026-03-18', overallResult: 'PASS' } as any,
          { company: 'CO', plant: 'P01' },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockLogRepo.create).not.toHaveBeenCalled();
    });
    it('should resolve equipment and interlock update within request tenant', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);
      mockLogRepo.create.mockReturnValue({ overallResult: 'FAIL' } as any);
      mockLogRepo.save.mockResolvedValue({ equipCode: 'EQ-001', overallResult: 'FAIL' } as any);
      mockEquipRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.create(
        { equipCode: 'EQ-001', inspectType: 'DAILY', inspectDate: '2026-03-18', overallResult: 'FAIL' } as any,
        { company: 'CO', plant: 'P01' },
      );

      expect(mockEquipRepo.findOne).toHaveBeenCalledWith({
        where: { equipCode: 'EQ-001', company: 'CO', plant: 'P01' },
      });
      expect(mockEquipRepo.update).toHaveBeenCalledWith(
        { equipCode: 'EQ-001', company: 'CO', plant: 'P01' },
        { status: 'INTERLOCK' },
      );
    });
    it('should set INTERLOCK on FAIL', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);
      mockLogRepo.create.mockReturnValue({ overallResult: 'FAIL' } as any);
      mockLogRepo.save.mockResolvedValue({ equipCode: 'EQ-001', overallResult: 'FAIL' } as any);
      mockEquipRepo.update.mockResolvedValue({ affected: 1 } as any);
      await target.create({ equipCode: 'EQ-001', inspectType: 'DAILY', inspectDate: '2026-03-18', overallResult: 'FAIL' } as any);
      expect(mockEquipRepo.update).toHaveBeenCalledWith({ equipCode: 'EQ-001' }, { status: 'INTERLOCK' });
    });
    it('stores WORKER inspectDate with inspection time to avoid date-level primary key collisions', async () => {
      mockEquipRepo.findOne.mockResolvedValue({
        equipCode: 'EQ-ATCNS-01',
        company: '40',
        plant: '1000',
        processCode: 'ATCNS',
      } as any);
      mockCalendarRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any);
      mockLogRepo.query.mockResolvedValue({ affected: 1 } as any);

      const result = await target.create({
        equipCode: 'EQ-ATCNS-01',
        inspectType: 'WORKER',
        orderNo: 'WO2606190110',
        inspectAt: '2026-06-19T17:23:26',
        inspectorName: '오지훈, 강태영',
        overallResult: 'PASS',
        details: { items: [] },
      } as any, { company: '40', plant: '1000' });

      expect(mockLogRepo.query).toHaveBeenCalledWith(
        expect.stringContaining("TO_DATE(:3, 'YYYY-MM-DD HH24:MI:SS')"),
        expect.arrayContaining([
          'EQ-ATCNS-01',
          'WORKER',
          '2026-06-19 17:23:26',
          'WO2606190110',
        ]),
      );
      expect(mockLogRepo.create).not.toHaveBeenCalled();
      expect(mockLogRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        equipCode: 'EQ-ATCNS-01',
        inspectType: 'WORKER',
        orderNo: 'WO2606190110',
        overallResult: 'PASS',
      }));
    });
  });

  describe('getInspectionStatus', () => {
    it('resolves daily inspection by operational work date starting at 08:00', async () => {
      mockEquipRepo.findOne.mockResolvedValue({
        equipCode: 'EQ-CUT-01',
        processCode: 'CUT',
        company: '40',
        plant: '1000',
      } as any);
      mockCalendarRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ calendarId: 'WC-CUT-2026', defaultShifts: 'DAY' }),
      } as any);
      mockCalendarDayRepo.findOne.mockResolvedValue({ workDate: '2026-06-15', shifts: 'DAY' } as any);
      mockShiftRepo.findOne.mockResolvedValue({ shiftCode: 'DAY', startTime: '08:00', endTime: '17:00' } as any);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          inspectAt: new Date(2026, 5, 15, 8, 30, 0),
          inspectorName: '홍길동',
        }),
      };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await target.getInspectionStatus({
        equipCode: 'EQ-CUT-01',
        inspectType: 'DAILY',
        at: new Date(2026, 5, 16, 7, 59, 0),
      }, { company: '40', plant: '1000' });

      expect(result).toEqual(expect.objectContaining({
        alreadyInspected: true,
        inspectedAt: '2026-06-15 08:30:00',
        inspectorName: '홍길동',
        workDate: '2026-06-15',
        windowStart: '2026-06-15 08:00:00',
        windowEnd: '2026-06-16 08:00:00',
      }));
      expect(qb.andWhere).toHaveBeenCalledWith('log.workDate = TO_DATE(:workDate, \'YYYY-MM-DD\')', {
        workDate: '2026-06-15',
      });
    });

    it('checks worker inspection by job order number', async () => {
      mockEquipRepo.findOne.mockResolvedValue({
        equipCode: 'EQ-CUT-01',
        processCode: 'CUT',
        company: '40',
        plant: '1000',
      } as any);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          inspectAt: new Date(2026, 5, 16, 9, 15, 0),
          inspectorName: '김작업',
        }),
      };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await target.getInspectionStatus({
        equipCode: 'EQ-CUT-01',
        inspectType: 'WORKER',
        orderNo: 'WO2606150066',
      }, { company: '40', plant: '1000' });

      expect(result.alreadyInspected).toBe(true);
      expect(result.inspectedAt).toBe('2026-06-16 09:15:00');
      expect(qb.andWhere).toHaveBeenCalledWith('log.orderNo = :orderNo', { orderNo: 'WO2606150066' });
    });
  });

  describe('findByKey', () => {
    it('finds daily inspection details by operational work date', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          equipCode: 'EQ-CUT-01',
          inspectType: 'DAILY',
          workDate: new Date(2026, 5, 15),
        }),
      };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb as any);
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-CUT-01' } as any);

      await target.findByKey('EQ-CUT-01', 'DAILY', '2026-06-15', '40', '1000');

      expect(qb.andWhere).toHaveBeenCalledWith(
        "(log.workDate = TO_DATE(:inspectDate, 'YYYY-MM-DD') OR (log.workDate IS NULL AND log.inspectDate >= TO_DATE(:inspectDate, 'YYYY-MM-DD') AND log.inspectDate < TO_DATE(:inspectDate, 'YYYY-MM-DD') + 1))",
        { inspectDate: '2026-06-15' },
      );
    });
  });
});
