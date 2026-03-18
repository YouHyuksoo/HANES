/**
 * @file spc.service.spec.ts
 * @description SpcService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { SpcService } from './spc.service';
import { SpcChart } from '../../../../entities/spc-chart.entity';
import { SpcData } from '../../../../entities/spc-data.entity';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('SpcService', () => {
  let target: SpcService;
  let mockChartRepo: DeepMocked<Repository<SpcChart>>;
  let mockDataRepo: DeepMocked<Repository<SpcData>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockChartRepo = createMock<Repository<SpcChart>>();
    mockDataRepo = createMock<Repository<SpcData>>();
    mockDataSource = createMock<DataSource>();
    mockDataSource.query = jest.fn().mockResolvedValue([{ nextSeq: 1 }]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpcService,
        { provide: getRepositoryToken(SpcChart), useValue: mockChartRepo },
        { provide: getRepositoryToken(SpcData), useValue: mockDataRepo },
        { provide: DataSource, useValue: mockDataSource },
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
      mockChartRepo.findOne.mockResolvedValue({ id: 1, subgroupSize: 5 } as any);
      await expect(target.createData({ chartId: 1, values: [1, 2], sampleDate: '2026-01-01' } as any, 'CO', 'P01', 'user'))
        .rejects.toThrow(BadRequestException);
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
});
