/**
 * @file hv-spc.service.spec.ts
 * @description HvSpcService 소스 전환(SPC_HV_SOURCE)·목록/상세 응답 계약·404 테스트 + 컨트롤러 래핑
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SpcChart } from '../../../../entities/spc-chart.entity';
import { SpcData } from '../../../../entities/spc-data.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import { SysConfigService } from '../../../system/services/sys-config.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { HvSpcService, SPC_HV_SOURCE_CONFIG_KEY } from './hv-spc.service';
import { HvSpcController } from './hv-spc.controller';

describe('HvSpcService', () => {
  let service: HvSpcService;
  let controller: HvSpcController;
  let chartRepo: DeepMocked<Repository<SpcChart>>;
  let dataRepo: DeepMocked<Repository<SpcData>>;
  let processRepo: DeepMocked<Repository<ProcessMaster>>;
  let itemRepo: DeepMocked<Repository<ItemMaster>>;
  let sysConfig: DeepMocked<SysConfigService>;

  beforeEach(async () => {
    chartRepo = createMock<Repository<SpcChart>>();
    dataRepo = createMock<Repository<SpcData>>();
    processRepo = createMock<Repository<ProcessMaster>>();
    itemRepo = createMock<Repository<ItemMaster>>();
    sysConfig = createMock<SysConfigService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HvSpcController],
      providers: [
        HvSpcService,
        { provide: getRepositoryToken(SpcChart), useValue: chartRepo },
        { provide: getRepositoryToken(SpcData), useValue: dataRepo },
        { provide: getRepositoryToken(ProcessMaster), useValue: processRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemRepo },
        { provide: SysConfigService, useValue: sysConfig },
      ],
    }).setLogger(new MockLoggerService()).compile();
    service = module.get(HvSpcService);
    controller = module.get(HvSpcController);
  });
  afterEach(() => jest.clearAllMocks());

  describe('resolveSourceSetting', () => {
    it('키 없음 → MOCK (기본)', async () => {
      sysConfig.getValue.mockResolvedValue(null);
      expect(await service.resolveSourceSetting()).toBe('MOCK');
      expect(sysConfig.getValue).toHaveBeenCalledWith(SPC_HV_SOURCE_CONFIG_KEY);
    });
    it('MOCK / db(대소문자 무시) 인식', async () => {
      sysConfig.getValue.mockResolvedValue('MOCK');
      expect(await service.resolveSourceSetting()).toBe('MOCK');
      sysConfig.getValue.mockResolvedValue(' db ');
      expect(await service.resolveSourceSetting()).toBe('DB');
    });
    it('허용 밖 값은 조용히 폴백하지 않고 오류', async () => {
      sysConfig.getValue.mockResolvedValue('ORACLE');
      await expect(service.resolveSourceSetting()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('MOCK 소스', () => {
    beforeEach(() => sysConfig.getValue.mockResolvedValue('MOCK'));

    it('getTargets: 원본 응답 형태 { sourceKind, dateFrom, dateTo, targets[12] }, DB 접근 없음', async () => {
      const res = await service.getTargets('40', '1000', { days: 30, kLimit: 0 });
      expect(Object.keys(res)).toEqual(['sourceKind', 'dateFrom', 'dateTo', 'targets']);
      expect(res.sourceKind).toBe('MOCK');
      expect(res.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.targets).toHaveLength(12);
      expect(Object.keys(res.targets[0])).toEqual([
        'id', 'processCode', 'processName', 'itemCode', 'characteristic', 'characteristicEn', 'unit',
        'subgroupSize', 'spec', 'decimals', 'equipCodes', 'cpk', 'health', 'oocCount', 'warnCount',
        'subgroupCount', 'lastSampleAt',
      ]);
      expect(chartRepo.find).not.toHaveBeenCalled();
      expect(dataRepo.find).not.toHaveBeenCalled();
    });

    it('getTarget: 상세 응답 + kLimit 적용, 없는 id 는 404', async () => {
      const res = await service.getTarget('40', '1000', 'GCRMP-CRIMP-H', { days: 30, kLimit: 10 });
      expect(res.sourceKind).toBe('MOCK');
      expect(res.target.id).toBe('GCRMP-CRIMP-H');
      expect(res.subgroups).toHaveLength(10);
      expect(res.stats).not.toBeNull();
      expect(res.capability).not.toBeNull();
      await expect(service.getTarget('40', '1000', 'NOPE', { days: 30, kLimit: 0 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('DB 소스', () => {
    beforeEach(() => {
      sysConfig.getValue.mockResolvedValue('DB');
      chartRepo.find.mockResolvedValue([
        { chartNo: 'SPC-1', itemCode: 'I1', processCode: 'P1', characteristicName: '높이', chartType: 'XBAR_R', subgroupSize: 5, usl: 2, lsl: 1, target: 1.5 },
      ] as unknown as SpcChart[]);
      processRepo.find.mockResolvedValue([{ processCode: 'P1', processName: '압착' }] as ProcessMaster[]);
      itemRepo.find.mockResolvedValue([{ itemCode: 'I1', itemName: '하네스' }] as ItemMaster[]);
    });

    it('getTargets: sourceKind ORACLE, SPC_CHARTS 기반, 데이터 없으면 빈 서브그룹 그대로', async () => {
      dataRepo.find.mockResolvedValue([]);
      const res = await service.getTargets('40', '1000', { days: 30, kLimit: 0 });
      expect(res.sourceKind).toBe('ORACLE');
      expect(res.targets).toHaveLength(1);
      expect(res.targets[0]).toMatchObject({ id: 'SPC-1', processName: '압착', itemName: '하네스', subgroupCount: 0, health: 'STABLE', cpk: null });
      expect(dataRepo.find).toHaveBeenCalledTimes(1);
    });

    it('getTargets: 관리도 자체가 없으면 targets [] (목업 대체 없음)', async () => {
      chartRepo.find.mockResolvedValue([]);
      const res = await service.getTargets('40', '1000', { days: 7, kLimit: 0 });
      expect(res).toMatchObject({ sourceKind: 'ORACLE', targets: [] });
      expect(dataRepo.find).not.toHaveBeenCalled();
    });

    it('getTarget: SPC_DATA 서브그룹으로 관리한계 계산, 없는 CHART_NO 는 404', async () => {
      dataRepo.find.mockResolvedValue([
        { chartId: 'SPC-1', subgroupNo: 1, seq: 1, sampleDate: new Date(), values: '[1.5,1.6,1.4,1.5,1.5]', remark: 'LOT1' },
        { chartId: 'SPC-1', subgroupNo: 2, seq: 2, sampleDate: new Date(), values: '[1.5,1.5,1.4,1.6,1.5]', remark: 'LOT2' },
      ] as unknown as SpcData[]);
      const res = await service.getTarget('40', '1000', 'SPC-1', { days: 30, kLimit: 0 });
      expect(res.sourceKind).toBe('ORACLE');
      expect(res.subgroups).toHaveLength(2);
      expect(res.subgroups[0].lotNo).toBe('LOT1');
      expect(res.stats?.xbarBar).toBeCloseTo(1.5, 3);
      expect(res.capability?.cpk).not.toBeNull();
      await expect(service.getTarget('40', '1000', 'SPC-404', { days: 30, kLimit: 0 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('HvSpcController', () => {
    it('ResponseUtil.success 래핑, days/k 기본값 30/0', async () => {
      sysConfig.getValue.mockResolvedValue(null);
      const spy = jest.spyOn(service, 'getTargets');
      const res = await controller.getTargets({}, '40', '1000');
      expect(spy).toHaveBeenCalledWith('40', '1000', { days: 30, kLimit: 0 });
      expect(res.success).toBe(true);
      expect(res.data.sourceKind).toBe('MOCK');
      expect(res.data.targets).toHaveLength(12);
    });
    it('상세: days/k 전달', async () => {
      sysConfig.getValue.mockResolvedValue(null);
      const spy = jest.spyOn(service, 'getTarget');
      const res = await controller.getTarget('ATCUT-CUT-LEN', { days: 7, k: 5 }, '40', '1000');
      expect(spy).toHaveBeenCalledWith('40', '1000', 'ATCUT-CUT-LEN', { days: 7, kLimit: 5 });
      expect(res.data.target.id).toBe('ATCUT-CUT-LEN');
      expect(res.data.subgroups.length).toBeLessThanOrEqual(5);
    });
  });
});
