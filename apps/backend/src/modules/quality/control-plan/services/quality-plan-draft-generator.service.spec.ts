import { BadRequestException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import { QualityPlanDraftGeneratorService } from './quality-plan-draft-generator.service';

describe('QualityPlanDraftGeneratorService', () => {
  let tx: DeepMocked<TransactionService>; let query: jest.Mock; let service: QualityPlanDraftGeneratorService;
  beforeEach(() => {
    tx = createMock<TransactionService>(); query = jest.fn();
    tx.run.mockImplementation(async (callback) => callback({ query } as unknown as QueryRunner));
    service = new QualityPlanDraftGeneratorService(tx);
  });

  it('품목 라우팅 순서로 PFD 행을 생성하고 검사조건을 PFMEA/Control Plan 후보로 매핑한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM QUALITY_PLAN_PACKAGES P')) return [{ PACKAGE_ID: 1, ITEM_CODE: 'ITEM-1', PFD_REVISION_ID: 11, PFMEA_REVISION_ID: 12, CP_REVISION_ID: 13 }];
      if (sql.includes('PROCESS_QUALITY_CONDITIONS')) return [{ SEQ: 2, CONDITION_CODE: 'CRIMP_HEIGHT', MIN_VALUE: 1.1, MAX_VALUE: 1.3, UNIT: 'mm' }];
      if (sql.includes('FROM ROUTING_GROUPS')) return [
        { SEQ: 1, PROCESS_CODE: 'CUT', PROCESS_NAME: '절단', EXECUTION_TYPE: 'IN_HOUSE', EQUIP_TYPE: 'CUTTER' },
        { SEQ: 2, PROCESS_CODE: 'CRIMP', PROCESS_NAME: '압착', EXECUTION_TYPE: 'IN_HOUSE', EQUIP_TYPE: 'PRESS' },
      ];
      if (sql.includes('INSPECT_ITEM_SPECS')) return [{ INSPECT_TYPE: 'HIPOT', TEST_VOLTAGE_KV: 3, MAX_CURRENT_MA: 2 }];
      if (sql.includes('TERMINAL_CRIMP_SPECS')) return [{ CRIMP_HEIGHT_LSL: 1.1, CRIMP_HEIGHT_USL: 1.3, WIRE_SIZE: '0.5' }];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 100 }];
      return [];
    });
    const result = await service.generate(1, '40', '1000', 'tester');
    expect(result.pfdRows).toBe(2);
    expect(result.pfmeaCandidates).toBeGreaterThanOrEqual(1);
    expect(result.controlPlanCandidates).toBeGreaterThanOrEqual(1);
    const pfdParams = query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO QUALITY_PROCESS_FLOW_ROWS')).map((call) => call[1]);
    expect(pfdParams[0]).toContain('CUT'); expect(pfdParams[1]).toContain('CRIMP');
  });

  it('토크·누설 검사 스펙도 500자 안의 읽을 수 있는 규격 문구로 만든다(옛 코드는 행 전체를 JSON 으로 넣어 500)', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM QUALITY_PLAN_PACKAGES P')) return [{ PACKAGE_ID: 1, ITEM_CODE: 'ITEM-1', PFD_REVISION_ID: 11, PFMEA_REVISION_ID: 12, CP_REVISION_ID: 13 }];
      if (sql.includes('FROM ROUTING_GROUPS') && !sql.includes('PROCESS_QUALITY_CONDITIONS')) return [{ SEQ: 1, PROCESS_CODE: 'CUT', PROCESS_NAME: '절단', EXECUTION_TYPE: 'IN_HOUSE', EQUIP_TYPE: 'CUTTER' }];
      if (sql.includes('INSPECT_ITEM_SPECS')) return [
        { INSPECT_TYPE: 'TORQUE', TORQUE_LSL: 1.5, TORQUE_USL: 2.5, TORQUE_UNIT: 'N.m', REMARK: 'x'.repeat(900) },
        { INSPECT_TYPE: 'LEAK', CHARGE_BAR: 2, CHARGE_TOL_BAR: 0.1, HOLD_SECONDS: 10, MIN_HOLD_BAR: 1.9 },
      ];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 100 }];
      return [];
    });
    await service.generate(1, '40', '1000', 'tester');
    const requirements = query.mock.calls
      .filter(([sql]) => String(sql).includes('INSERT INTO QUALITY_PFMEA_ROWS')).map((call) => String(call[1][7]));
    expect(requirements).toEqual(['1.5~2.5N.m', '충전 2±0.1bar / 유지 10s / 하한 1.9bar']);
  });

  it('기준정보가 없어도 오류 없이 빈 문서 묶음을 유지한다', async () => {
    query.mockImplementation(async (sql: string) => sql.includes('FROM QUALITY_PLAN_PACKAGES P')
      ? [{ PACKAGE_ID: 1, ITEM_CODE: 'ITEM-1', PFD_REVISION_ID: 11, PFMEA_REVISION_ID: 12, CP_REVISION_ID: 13 }] : []);
    await expect(service.generate(1, '40', '1000', 'tester')).resolves.toMatchObject({ pfdRows: 0, pfmeaCandidates: 0, controlPlanCandidates: 0 });
  });

  it('기존 행이 있으면 자동 초안을 중복 생성하지 않는다', async () => {
    query.mockResolvedValueOnce([{ PACKAGE_ID: 1, ITEM_CODE: 'ITEM-1', PFD_REVISION_ID: 11, PFMEA_REVISION_ID: 12, CP_REVISION_ID: 13 }])
      .mockResolvedValueOnce([{ CNT: 1 }]);
    await expect(service.generate(1, '40', '1000', 'tester')).rejects.toBeInstanceOf(BadRequestException);
  });
});
