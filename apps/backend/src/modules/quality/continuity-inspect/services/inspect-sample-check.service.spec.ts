import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { InspectSampleCheckService } from './inspect-sample-check.service';
import { InspectAid } from '../../../../entities/inspect-aid.entity';
import { InspectSampleCheck } from '../../../../entities/inspect-sample-check.entity';
import { InspectSampleCheckItem } from '../../../../entities/inspect-sample-check-item.entity';
import { ShiftPattern } from '../../../../entities/shift-pattern.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { EquipInspectService } from '../../../equipment/services/equip-inspect.service';

const TENANT = { company: 'C1', plant: 'P1' };
const ACTOR = { userId: 'U1', workerId: 'W-100' };

function aid(over: Partial<InspectAid>): InspectAid {
  return {
    company: 'C1', plant: 'P1', aidCode: 'OK-1', aidType: 'LIMIT_OK', aidName: '양품견본',
    itemCode: 'ITEM-1', processCode: null, defectCode: null, imageUrl: null, location: null,
    validFrom: null, validTo: null, approvedBy: null, approvedAt: null, status: 'ACTIVE',
    inspectType: 'CONTINUITY', requiredYn: 'Y', sortOrder: 1,
    remark: null, useYn: 'Y',
    createdBy: null, updatedBy: null, createdAt: new Date(), updatedAt: new Date(),
    ...over,
  } as InspectAid;
}

describe('InspectSampleCheckService', () => {
  let service: InspectSampleCheckService;
  const aidRepo = { find: jest.fn() };
  const checkRepo = { findOne: jest.fn(), find: jest.fn() };
  const itemRepo = { find: jest.fn() };
  const shiftRepo = { find: jest.fn() };
  const seq = { getNo: jest.fn() };
  const equipInspectService = { getInspectionStatus: jest.fn() };
  const savedChecks: InspectSampleCheck[] = [];
  const savedItems: InspectSampleCheckItem[][] = [];
  const manager = {
    save: jest.fn(async (_entity: unknown, value: unknown) => {
      if (Array.isArray(value)) savedItems.push(value as InspectSampleCheckItem[]);
      else savedChecks.push(value as InspectSampleCheck);
      return value;
    }),
  };
  const queryRunner = {
    connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(), release: jest.fn(), manager,
  };
  const dataSource = { createQueryRunner: () => queryRunner };

  beforeEach(async () => {
    jest.clearAllMocks();
    savedChecks.length = 0;
    savedItems.length = 0;
    seq.getNo.mockResolvedValue('SMC-20260915-0001');
    shiftRepo.find.mockResolvedValue([
      { shiftCode: 'DAY', startTime: '00:00', endTime: '23:59', useYn: 'Y', sortOrder: 1 },
    ]);
    equipInspectService.getInspectionStatus.mockResolvedValue({ workDate: '2026-09-15' });
    checkRepo.findOne.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        InspectSampleCheckService,
        { provide: getRepositoryToken(InspectAid), useValue: aidRepo },
        { provide: getRepositoryToken(InspectSampleCheck), useValue: checkRepo },
        { provide: getRepositoryToken(InspectSampleCheckItem), useValue: itemRepo },
        { provide: getRepositoryToken(ShiftPattern), useValue: shiftRepo },
        { provide: SeqGeneratorService, useValue: seq },
        { provide: EquipInspectService, useValue: equipInspectService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = moduleRef.get(InspectSampleCheckService);
  });

  const baseDto = {
    orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1',
  };
  const statusArgs = { orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1' };

  it('양품견본은 PASS, 불량견본은 FAIL일 때 종합 PASS로 저장한다', async () => {
    aidRepo.find.mockResolvedValue([aid({}), aid({ aidCode: 'NG-1', aidType: 'LIMIT_NG', sortOrder: 2 })]);
    const res = await service.create(
      { ...baseDto, items: [{ aidCode: 'OK-1', actualResult: 'PASS' }, { aidCode: 'NG-1', actualResult: 'FAIL' }] },
      ACTOR,
      TENANT,
    );
    expect(res.overallResult).toBe('PASS');
    expect(savedChecks[0].checkerId).toBe('W-100');
    expect(savedChecks[0].createdBy).toBe('U1');
    expect(savedChecks[0].shiftCode).toBe('DAY');
    expect(savedItems[0].map((i) => i.result)).toEqual(['OK', 'OK']);
  });

  it('불량견본이 PASS로 나오면 NG로 판정한다', async () => {
    aidRepo.find.mockResolvedValue([aid({ aidCode: 'NG-1', aidType: 'LIMIT_NG' })]);
    const res = await service.create(
      { ...baseDto, items: [{ aidCode: 'NG-1', actualResult: 'PASS' }] },
      ACTOR,
      TENANT,
    );
    expect(res.overallResult).toBe('NG');
    expect(savedItems[0][0].result).toBe('NG');
  });

  it('양품견본이 FAIL로 나오면 NG로 판정한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    const res = await service.create(
      { ...baseDto, items: [{ aidCode: 'OK-1', actualResult: 'FAIL' }] },
      ACTOR,
      TENANT,
    );
    expect(res.overallResult).toBe('NG');
  });

  it('필수 견본이 빠지면 저장을 거부한다', async () => {
    aidRepo.find.mockResolvedValue([aid({}), aid({ aidCode: 'NG-1', aidType: 'LIMIT_NG' })]);
    await expect(service.create(
      { ...baseDto, items: [{ aidCode: 'OK-1', actualResult: 'PASS' }] },
      ACTOR, TENANT,
    )).rejects.toThrow(/필수 한도견본/);
  });

  it('후보에 없는 코드를 스캔하면 거부한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    await expect(service.create(
      { ...baseDto, items: [{ aidCode: 'UNKNOWN', actualResult: 'PASS' }] },
      ACTOR, TENANT,
    )).rejects.toThrow(/등록되지 않은 한도견본/);
  });

  it('유효기간이 지난 필수 견본이 있으면 거부한다', async () => {
    aidRepo.find.mockResolvedValue([aid({ validTo: new Date('2020-01-01') })]);
    await expect(service.create(
      { ...baseDto, items: [{ aidCode: 'OK-1', actualResult: 'PASS' }] },
      ACTOR, TENANT,
    )).rejects.toThrow(/유효기간/);
  });

  it('필수 견본이 0건이면 대조 없이 통과 상태를 돌려준다', async () => {
    aidRepo.find.mockResolvedValue([]);
    const status = await service.getStatus(statusArgs, TENANT);
    expect(status.required).toBe(false);
    expect(status.done).toBe(true);
    await expect(service.assertReady(statusArgs, TENANT)).resolves.toBeUndefined();
  });

  it('대조 기록이 없으면 검사를 차단한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    checkRepo.findOne.mockResolvedValue(null);
    await expect(service.assertReady(statusArgs, TENANT)).rejects.toThrow(BadRequestException);
  });

  it('최신 대조가 NG면 검사를 차단한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    checkRepo.findOne.mockResolvedValue({ checkNo: 'SMC-1', overallResult: 'NG', checkedAt: new Date() });
    await expect(service.assertReady(statusArgs, TENANT)).rejects.toThrow(/대조 결과가 불합격/);
  });

  it('최신 대조가 PASS면 통과한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    checkRepo.findOne.mockResolvedValue({ checkNo: 'SMC-1', overallResult: 'PASS', checkedAt: new Date() });
    await expect(service.assertReady(statusArgs, TENANT)).resolves.toBeUndefined();
  });

  it('필수 견본이 만료면 대조 자체를 막고 사유를 돌려준다', async () => {
    aidRepo.find.mockResolvedValue([aid({ validTo: new Date('2020-01-01') })]);
    const status = await service.getStatus(statusArgs, TENANT);
    expect(status.done).toBe(false);
    expect(status.blockReason).toMatch(/유효기간/);
    await expect(service.assertReady(statusArgs, TENANT)).rejects.toThrow(/유효기간/);
  });

  it('후보 조회는 기대결과와 만료여부를 함께 내린다', async () => {
    aidRepo.find.mockResolvedValue([
      aid({}),
      aid({ aidCode: 'NG-1', aidType: 'LIMIT_NG', validTo: new Date('2020-01-01'), sortOrder: 2 }),
    ]);
    const list = await service.getCandidates('ITEM-1', 'CONTINUITY', TENANT);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ aidCode: 'OK-1', expectedResult: 'PASS', expired: false });
    expect(list[1]).toMatchObject({ aidCode: 'NG-1', expectedResult: 'FAIL', expired: true });
  });

  it('스캔 코드는 공백·대소문자를 정규화해 매칭한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    const res = await service.create(
      { ...baseDto, items: [{ aidCode: ' ok-1 ', actualResult: 'PASS' }] },
      ACTOR, TENANT,
    );
    expect(res.overallResult).toBe('PASS');
    expect(savedItems[0][0].aidCode).toBe('OK-1');
  });
});
