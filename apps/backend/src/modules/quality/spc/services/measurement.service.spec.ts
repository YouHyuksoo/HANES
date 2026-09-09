/**
 * @file measurement.service.spec.ts
 * @description MeasurementService 단위 테스트 — 설정 N 403, 관리도 없음 404, 정상 적재, rawData 파싱
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MeasurementService, MEASURE_RECEIVE_ENABLED_KEY } from './measurement.service';
import { SpcService } from './spc.service';
import { SpcChart } from '../../../../entities/spc-chart.entity';
import { SpcData } from '../../../../entities/spc-data.entity';
import { EquipProtocol } from '../../../../entities/equip-protocol.entity';
import { SysConfigService } from '../../../system/services/sys-config.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('MeasurementService', () => {
  let target: MeasurementService;
  let mockChartRepo: DeepMocked<Repository<SpcChart>>;
  let mockDataRepo: DeepMocked<Repository<SpcData>>;
  let mockProtocolRepo: DeepMocked<Repository<EquipProtocol>>;
  let mockSpcService: DeepMocked<SpcService>;
  let mockSysConfig: DeepMocked<SysConfigService>;

  const chart = { chartNo: 'SPC-001', subgroupSize: 1, status: 'ACTIVE' } as unknown as SpcChart;
  const baseDto = { itemCode: 'ITEM-1', processCode: 'CRIMP', characteristicName: '압착고' };

  beforeEach(async () => {
    mockChartRepo = createMock<Repository<SpcChart>>();
    mockDataRepo = createMock<Repository<SpcData>>();
    mockProtocolRepo = createMock<Repository<EquipProtocol>>();
    mockSpcService = createMock<SpcService>();
    mockSysConfig = createMock<SysConfigService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeasurementService,
        { provide: getRepositoryToken(SpcChart), useValue: mockChartRepo },
        { provide: getRepositoryToken(SpcData), useValue: mockDataRepo },
        { provide: getRepositoryToken(EquipProtocol), useValue: mockProtocolRepo },
        { provide: SpcService, useValue: mockSpcService },
        { provide: SysConfigService, useValue: mockSysConfig },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<MeasurementService>(MeasurementService);
  });
  afterEach(() => jest.clearAllMocks());

  it('MEASURE_RECEIVE_ENABLED 가 N/없음이면 403 이고 관리도를 조회하지 않는다', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(false);
    await expect(target.receive({ ...baseDto, values: [1.2] }, 'CO', 'P01', 'user'))
      .rejects.toThrow(ForbiddenException);
    expect(mockSysConfig.isEnabled).toHaveBeenCalledWith(MEASURE_RECEIVE_ENABLED_KEY, 'CO', 'P01');
    expect(mockChartRepo.findOne).not.toHaveBeenCalled();
    expect(mockSpcService.createData).not.toHaveBeenCalled();
  });

  it('활성 관리도가 없으면 404', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockChartRepo.findOne.mockResolvedValue(null);
    await expect(target.receive({ ...baseDto, values: [1.2] }, 'CO', 'P01', 'user'))
      .rejects.toThrow(NotFoundException);
    expect(mockChartRepo.findOne).toHaveBeenCalledWith({
      where: {
        itemCode: 'ITEM-1',
        processCode: 'CRIMP',
        characteristicName: '압착고',
        status: 'ACTIVE',
        company: 'CO',
        plant: 'P01',
      },
    });
    expect(mockSpcService.createData).not.toHaveBeenCalled();
  });

  it('정상 수신 시 마지막 subgroupNo+1 로 createData 를 호출하고 REMARK 에 DEVICE 스탬프를 남긴다', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockChartRepo.findOne.mockResolvedValue(chart);
    mockDataRepo.findOne.mockResolvedValue({ subgroupNo: 7 } as SpcData);
    const saved = { chartId: 'SPC-001', subgroupNo: 8 } as SpcData;
    mockSpcService.createData.mockResolvedValue(saved);

    const result = await target.receive(
      { ...baseDto, values: [2.35], equipCode: 'GAUGE-01', orderNo: 'W2609090001', sampleDate: '2026-09-09T01:00:00.000Z' },
      'CO', 'P01', 'user',
    );

    expect(mockSpcService.createData).toHaveBeenCalledWith(
      {
        chartId: 'SPC-001',
        sampleDate: '2026-09-09T01:00:00.000Z',
        subgroupNo: 8,
        values: [2.35],
        equipCode: 'GAUGE-01',
        remark: 'source=DEVICE protocol=- equip=GAUGE-01 order=W2609090001',
      },
      'CO', 'P01', 'user',
    );
    expect(result).toEqual({ chartNo: 'SPC-001', subgroupNo: 8, values: [2.35], valueUnit: null, data: saved });
  });

  it('데이터가 없는 관리도는 subgroupNo 1 부터 시작하고 sampleDate 는 서버 시각으로 채운다', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockChartRepo.findOne.mockResolvedValue(chart);
    mockDataRepo.findOne.mockResolvedValue(null);
    mockSpcService.createData.mockResolvedValue({} as SpcData);

    await target.receive({ ...baseDto, values: [1.1] }, 'CO', 'P01', 'user');

    const dto = mockSpcService.createData.mock.calls[0][0];
    expect(dto.subgroupNo).toBe(1);
    expect(dto.equipCode).toBeUndefined();
    expect(dto.remark).toBe('source=DEVICE protocol=- equip=-');
    expect(Number.isNaN(new Date(dto.sampleDate).getTime())).toBe(false);
  });

  it('rawData+protocolId 면 프로토콜 valueIndex 로 수치를 파싱해 values 로 적재한다', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockProtocolRepo.findOne.mockResolvedValue({
      protocolId: 'CRIMP-GAUGE',
      equipCode: 'GAUGE-02',
      delimiter: ',',
      resultIndex: 1,
      passValue: 'OK',
      errorIndex: null,
      dataStartChar: null,
      dataEndChar: null,
      valueIndex: 2,
      valueUnit: 'kgf',
    } as EquipProtocol);
    mockChartRepo.findOne.mockResolvedValue(chart);
    mockDataRepo.findOne.mockResolvedValue(null);
    mockSpcService.createData.mockResolvedValue({} as SpcData);

    const result = await target.receive(
      { ...baseDto, protocolId: 'CRIMP-GAUGE', rawData: 'W001,OK,12.34' },
      'CO', 'P01', 'user',
    );

    expect(mockProtocolRepo.findOne).toHaveBeenCalledWith({
      where: { protocolId: 'CRIMP-GAUGE', useYn: 'Y', company: 'CO', plant: 'P01' },
    });
    const dto = mockSpcService.createData.mock.calls[0][0];
    expect(dto.values).toEqual([12.34]);
    expect(dto.equipCode).toBe('GAUGE-02');
    expect(dto.remark).toBe('source=DEVICE protocol=CRIMP-GAUGE equip=GAUGE-02');
    expect(result.valueUnit).toBe('kgf');
  });

  it('rawData 의 수치 토큰이 숫자가 아니면 400', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockProtocolRepo.findOne.mockResolvedValue({
      protocolId: 'P1', delimiter: ',', resultIndex: 1, passValue: 'OK', errorIndex: null,
      dataStartChar: null, dataEndChar: null, valueIndex: 2, valueUnit: null, equipCode: null,
    } as EquipProtocol);
    await expect(target.receive({ ...baseDto, protocolId: 'P1', rawData: 'W001,OK,abc' }, 'CO', 'P01', 'user'))
      .rejects.toThrow(BadRequestException);
    expect(mockSpcService.createData).not.toHaveBeenCalled();
  });

  it('프로토콜에 valueIndex 가 없으면 400', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockProtocolRepo.findOne.mockResolvedValue({ protocolId: 'P1', valueIndex: null } as EquipProtocol);
    await expect(target.receive({ ...baseDto, protocolId: 'P1', rawData: 'W001,OK,1' }, 'CO', 'P01', 'user'))
      .rejects.toThrow(BadRequestException);
  });

  it('프로토콜을 찾지 못하면 404', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockProtocolRepo.findOne.mockResolvedValue(null);
    await expect(target.receive({ ...baseDto, protocolId: 'NOPE', rawData: 'W001,OK,1' }, 'CO', 'P01', 'user'))
      .rejects.toThrow(NotFoundException);
  });

  it('values 도 없고 rawData 도 없으면 400', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    await expect(target.receive({ ...baseDto }, 'CO', 'P01', 'user')).rejects.toThrow(BadRequestException);
    await expect(target.receive({ ...baseDto, rawData: 'x' }, 'CO', 'P01', 'user')).rejects.toThrow(BadRequestException);
  });
});
