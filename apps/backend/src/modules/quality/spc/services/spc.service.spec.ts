/**
 * @file spc.service.spec.ts
 * @description SpcService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { SpcService } from './spc.service';
import { SpcChart } from '../../../../entities/spc-chart.entity';
import { SpcData } from '../../../../entities/spc-data.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { NumberingService } from '../../../../shared/numbering.service';

describe('SpcService', () => {
  let target: SpcService;
  let mockChartRepo: DeepMocked<Repository<SpcChart>>;
  let mockDataRepo: DeepMocked<Repository<SpcData>>;
  let mockItemRepo: DeepMocked<Repository<ItemMaster>>;
  let mockProcessRepo: DeepMocked<Repository<ProcessMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockChartRepo = createMock<Repository<SpcChart>>();
    mockDataRepo = createMock<Repository<SpcData>>();
    mockItemRepo = createMock<Repository<ItemMaster>>();
    mockProcessRepo = createMock<Repository<ProcessMaster>>();
    mockDataSource = createMock<DataSource>();
    mockDataSource.query = jest.fn().mockResolvedValue([{ nextSeq: 1 }]);
    mockNumbering = createMock<NumberingService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpcService,
        { provide: getRepositoryToken(SpcChart), useValue: mockChartRepo },
        { provide: getRepositoryToken(SpcData), useValue: mockDataRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemRepo },
        { provide: getRepositoryToken(ProcessMaster), useValue: mockProcessRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<SpcService>(SpcService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findChartById', () => {
    it('should return chart', async () => {
      mockChartRepo.findOne.mockResolvedValue({ chartNo: 'SPC-001' } as any);
      expect((await target.findChartById('SPC-001')).chartNo).toBe('SPC-001');
    });
    it('should throw NotFoundException', async () => {
      mockChartRepo.findOne.mockResolvedValue(null);
      await expect(target.findChartById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createData', () => {
    it('should throw when subgroup size mismatch', async () => {
      mockChartRepo.findOne.mockResolvedValue({ chartNo: 'SPC-001', subgroupSize: 5 } as any);
      await expect(target.createData({ chartId: 'SPC-001', values: [1, 2], sampleDate: '2026-01-01' } as any, 'CO', 'P01', 'user'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('updateChart', () => {
    it('should update only DTO fields and keep tenant/chart key columns from the matched chart', async () => {
      const chart = { chartNo: 'SPC-001', characteristicName: 'Old', company: 'CO', plant: 'P01' } as unknown as SpcChart;
      mockChartRepo.findOne.mockResolvedValue(chart);
      mockChartRepo.save.mockImplementation(async (value) => value as SpcChart);

      const result = await target.updateChart('SPC-001', {
        chartNo: 'SPC-999',
        characteristicName: 'New',
        chartName: 'Ignored',
        company: 'OTHER',
        plant: 'P99',
      } as any, 'user', 'CO', 'P01');

      expect(result).toEqual(expect.objectContaining({
        chartNo: 'SPC-001',
        characteristicName: 'New',
        company: 'CO',
        plant: 'P01',
        updatedBy: 'user',
      }));
      expect(result).not.toHaveProperty('chartName');
    });
  });

  describe('calculateControlLimits', () => {
    it('should throw when less than 2 subgroups', async () => {
      mockChartRepo.findOne.mockResolvedValue({ chartNo: 'SPC-001', id: 1 } as any);
      mockDataRepo.find.mockResolvedValue([]);
      await expect(target.calculateControlLimits('SPC-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('calculateCpk', () => {
    it('should throw when USL/LSL missing', async () => {
      mockChartRepo.findOne.mockResolvedValue({ chartNo: 'SPC-001', usl: null, lsl: null } as any);
      await expect(target.calculateCpk('SPC-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── 관리도 엑셀 업로드 ───
  const bufferFromRows = (rows: Record<string, unknown>[], sheetName = 'Sheet1') => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  };

  describe('previewChartUpload', () => {
    it('필수값 누락 행은 error, 마스터에 없는 품목/공정은 error로 분류한다', async () => {
      mockItemRepo.find.mockResolvedValue([{ itemCode: 'ITEM1' } as any]);
      mockProcessRepo.find.mockResolvedValue([]);
      const buffer = bufferFromRows([
        { 품목코드: '', 공정코드: 'GCRMP', 특성명: '크림프 높이' },
        { 품목코드: 'ITEM1', 공정코드: 'GCRMP', 특성명: '크림프 높이' },
      ]);

      const result = await target.previewChartUpload(buffer, '40', '1000');

      expect(result.errorCount).toBe(2);
      expect(result.rows[0].message).toContain('필수');
      expect(result.rows[1].message).toContain('공정마스터');
    });

    it('품목/공정이 유효하면 신규로, 이미 활성 관리도가 있으면 duplicate_db로 분류한다', async () => {
      mockItemRepo.find.mockResolvedValue([{ itemCode: 'ITEM1' } as any]);
      mockProcessRepo.find.mockResolvedValue([{ processCode: 'GCRMP' } as any]);
      mockChartRepo.find.mockResolvedValue([
        { itemCode: 'ITEM1', processCode: 'GCRMP', characteristicName: '크림프 높이' } as any,
      ]);
      const buffer = bufferFromRows([
        { 품목코드: 'ITEM1', 공정코드: 'GCRMP', 특성명: '크림프 높이', 서브그룹크기: 5, LSL: 1.9, TARGET: 1.95, USL: 2.0 },
      ]);

      const result = await target.previewChartUpload(buffer, '40', '1000');

      expect(result.rows[0].status).toBe('duplicate_db');
      expect(result.newCount).toBe(0);
    });
  });

  describe('uploadChartsFromExcel', () => {
    it('신규 행만 createChart를 호출해 등록하고, 중복/오류는 건너뛴다', async () => {
      mockItemRepo.find.mockResolvedValue([{ itemCode: 'ITEM1' } as any]);
      mockProcessRepo.find.mockResolvedValue([{ processCode: 'GCRMP' } as any]);
      mockChartRepo.find.mockResolvedValue([]);
      mockNumbering.next.mockResolvedValue('SPC-20260904-001');
      mockChartRepo.create.mockImplementation((v) => v as any);
      mockChartRepo.save.mockImplementation(async (v) => v as any);
      const buffer = bufferFromRows([
        { 품목코드: 'ITEM1', 공정코드: 'GCRMP', 특성명: '크림프 높이' },
        { 품목코드: '', 공정코드: 'GCRMP', 특성명: '누락' },
      ]);

      const result = await target.uploadChartsFromExcel(buffer, '40', '1000', 'user');

      expect(result.inserted).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(mockChartRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 측정데이터 엑셀 업로드 ───
  describe('previewDataUpload', () => {
    it('존재하지 않는 관리도번호는 error로 분류한다', async () => {
      mockChartRepo.find.mockResolvedValue([]);
      const buffer = bufferFromRows([
        { 관리도번호: 'SPC-NOPE', 측정일시: '2026-09-01 08:30', 서브그룹번호: 1, '측정값(쉼표구분)': '1,2,3,4,5' },
      ]);

      const result = await target.previewDataUpload(buffer, '40', '1000');

      expect(result.rows[0].status).toBe('error');
      expect(result.rows[0].message).toContain('찾을 수 없습니다');
    });

    it('서브그룹 크기가 관리도와 다르면 error로 분류한다', async () => {
      mockChartRepo.find.mockResolvedValue([{ chartNo: 'SPC-001', subgroupSize: 5 } as any]);
      const buffer = bufferFromRows([
        { 관리도번호: 'SPC-001', 측정일시: '2026-09-01 08:30', 서브그룹번호: 1, '측정값(쉼표구분)': '1,2,3' },
      ]);

      const result = await target.previewDataUpload(buffer, '40', '1000');

      expect(result.rows[0].status).toBe('error');
      expect(result.rows[0].message).toContain('서브그룹 크기');
    });

    it('유효한 행은 new 로 분류하고 측정값/설비코드를 파싱한다', async () => {
      mockChartRepo.find.mockResolvedValue([{ chartNo: 'SPC-001', subgroupSize: 3 } as any]);
      const buffer = bufferFromRows([
        { 관리도번호: 'SPC-001', 측정일시: '2026-09-01 08:30', 서브그룹번호: 1, '측정값(쉼표구분)': '1.1,1.2,1.3', 설비코드: 'EQ-1' },
      ]);

      const result = await target.previewDataUpload(buffer, '40', '1000');

      expect(result.rows[0]).toMatchObject({ status: 'new', chartId: 'SPC-001', values: [1.1, 1.2, 1.3], equipCode: 'EQ-1' });
    });
  });

  describe('uploadDataFromExcel', () => {
    it('신규 행만 createData를 호출해 등록한다', async () => {
      mockChartRepo.findOne.mockResolvedValue({ chartNo: 'SPC-001', subgroupSize: 3, ucl: null, lcl: null } as any);
      mockChartRepo.find.mockResolvedValue([{ chartNo: 'SPC-001', subgroupSize: 3 } as any]);
      mockDataRepo.create.mockImplementation((v) => v as any);
      mockDataRepo.save.mockImplementation(async (v) => v as any);
      const buffer = bufferFromRows([
        { 관리도번호: 'SPC-001', 측정일시: '2026-09-01 08:30', 서브그룹번호: 1, '측정값(쉼표구분)': '1.1,1.2,1.3', 설비코드: 'EQ-1' },
      ]);

      const result = await target.uploadDataFromExcel(buffer, '40', '1000', 'user');

      expect(result.inserted).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockDataRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
