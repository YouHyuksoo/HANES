import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import { QualityPlanValidationService } from './quality-plan-validation.service';

describe('QualityPlanValidationService', () => {
  let tx: DeepMocked<TransactionService>; let query: jest.Mock; let service: QualityPlanValidationService;
  beforeEach(() => {
    tx = createMock<TransactionService>(); query = jest.fn();
    tx.run.mockImplementation(async (callback) => callback({ query } as unknown as QueryRunner));
    service = new QualityPlanValidationService(tx);
  });

  it('PFD 중복, PFMEA 참조/RPN, 특별특성 연결, Control Plan 필수값을 오류로 반환하고 snapshot을 저장한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT D.PACKAGE_ID')) return [{ PACKAGE_ID: 1, DOCUMENT_TYPE: 'CONTROL_PLAN', REVISION_CODE: '00', REF_PFD_REVISION_ID: 7, REF_PFMEA_REVISION_ID: 8, REF_PFD_STATUS: 'PUBLISHED', REF_PFD_PACKAGE_ID: 1, REF_PFD_TYPE: 'PFD', REF_PFMEA_STATUS: 'PUBLISHED', REF_PFMEA_PACKAGE_ID: 1, REF_PFMEA_TYPE: 'PFMEA' }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [{ ROW_ID: 1, PROCESS_NO: '10' }, { ROW_ID: 2, PROCESS_NO: '10' }];
      if (sql.includes('QUALITY_PFMEA_ROWS')) return [{ ROW_ID: 3, PROCESS_FLOW_ROW_ID: 999, SEVERITY: 9, OCCURRENCE: 4, DETECTION: 3, RPN: 1, SPECIAL_CHAR_CODE: 'SAFETY', RECOMMENDED_ACTION: null }];
      if (sql.includes('QUALITY_CONTROL_PLAN_ROWS')) return [{ ROW_ID: 4, PROCESS_FLOW_ROW_ID: 1, PFMEA_ROW_ID: 999, SPECIFICATION: null, EVALUATION_METHOD: null, SAMPLE_SIZE: '5EA', CONTROL_METHOD: null, REACTION_PLAN: null }];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 50 }];
      return [];
    });
    const result = await service.validateRevision(10, '40', '1000', 'tester');
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['PFD_PROCESS_DUPLICATE','PFMEA_PROCESS_NOT_IN_PFD','PFMEA_RPN_MISMATCH','SPECIAL_CHARACTERISTIC_NOT_CONTROLLED','CONTROL_PLAN_PFMEA_REFERENCE_MISMATCH','CP_REQUIRED_FIELD_MISSING','PFMEA_HIGH_RPN_NO_ACTION']));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO QUALITY_PLAN_VALIDATIONS'))).toBe(true);
  });

  it('오류가 없으면 valid true를 반환한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT D.PACKAGE_ID')) return [{ PACKAGE_ID: 1, DOCUMENT_TYPE: 'CONTROL_PLAN', REVISION_CODE: '00', REF_PFD_REVISION_ID: 7, REF_PFMEA_REVISION_ID: 8, REF_PFD_STATUS: 'PUBLISHED', REF_PFD_PACKAGE_ID: 1, REF_PFD_TYPE: 'PFD', REF_PFMEA_STATUS: 'PUBLISHED', REF_PFMEA_PACKAGE_ID: 1, REF_PFMEA_TYPE: 'PFMEA' }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [{ ROW_ID: 1, PROCESS_NO: '10' }];
      if (sql.includes('QUALITY_PFMEA_ROWS')) return [];
      if (sql.includes('QUALITY_CONTROL_PLAN_ROWS')) return [{ ROW_ID: 4, PROCESS_FLOW_ROW_ID: 1, SPECIFICATION: '1±0.1', EVALUATION_METHOD: '측정', SAMPLE_SIZE: '5EA', CONTROL_METHOD: '검사', REACTION_PLAN: '격리' }];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 50 }];
      return [];
    });
    await expect(service.validateRevision(10, '40', '1000', 'tester')).resolves.toMatchObject({ valid: true });
  });

  it('더 최신 발행 참조본이 있으면 경고한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT D.PACKAGE_ID')) return [{ PACKAGE_ID: 1, DOCUMENT_TYPE: 'CONTROL_PLAN', REVISION_CODE: '00', REF_PFD_REVISION_ID: 7, REF_PFMEA_REVISION_ID: 8, REF_PFD_STATUS: 'PUBLISHED', REF_PFD_PACKAGE_ID: 1, REF_PFD_TYPE: 'PFD', REF_PFMEA_STATUS: 'PUBLISHED', REF_PFMEA_PACKAGE_ID: 1, REF_PFMEA_TYPE: 'PFMEA' }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [{ ROW_ID: 1, PROCESS_NO: '10' }];
      if (sql.includes('QUALITY_PFMEA_ROWS')) return [];
      if (sql.includes('QUALITY_CONTROL_PLAN_ROWS')) return [{ ROW_ID: 4, PROCESS_FLOW_ROW_ID: 1, SPECIFICATION: 'x', EVALUATION_METHOD: 'x', SAMPLE_SIZE: '5', CONTROL_METHOD: 'x', REACTION_PLAN: 'x' }];
      if (sql.includes('NEWER.STATUS')) return [{ CNT: 1 }];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 50 }];
      return [];
    });
    const result = await service.validateRevision(10, '40', '1000', 'tester');
    expect(result.issues.map((issue) => issue.code)).toContain('OLD_REFERENCE_REVISION');
  });

  it('행이 없는 문서는 발행 차단 오류로 반환한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT D.PACKAGE_ID')) return [{ PACKAGE_ID: 1, DOCUMENT_TYPE: 'PFD' }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [];
      if (sql.includes('SEQ_QUALITY_PLAN_VALIDATION.NEXTVAL')) return [{ NEXT_SEQ: 9 }];
      return [];
    });
    const result = await service.validateRevision(7, '40', '1000', 'tester');
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DOCUMENT_EMPTY', documentType: 'PFD' })]));
  });

  it('PFMEA와 Control Plan은 같은 패키지의 불변 상위 Revision만 참조해 발행할 수 있다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT D.PACKAGE_ID')) return [{ PACKAGE_ID: 1, DOCUMENT_TYPE: 'CONTROL_PLAN', REVISION_CODE: '00', REF_PFD_REVISION_ID: 7, REF_PFMEA_REVISION_ID: 8, REF_PFD_STATUS: 'DRAFT', REF_PFD_PACKAGE_ID: 1, REF_PFD_TYPE: 'PFD', REF_PFMEA_STATUS: 'PUBLISHED', REF_PFMEA_PACKAGE_ID: 2, REF_PFMEA_TYPE: 'PFMEA' }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [{ ROW_ID: 1, PROCESS_NO: '10' }];
      if (sql.includes('QUALITY_PFMEA_ROWS')) return [];
      if (sql.includes('QUALITY_CONTROL_PLAN_ROWS')) return [{ ROW_ID: 4, PROCESS_FLOW_ROW_ID: 1, SPECIFICATION: 'x', EVALUATION_METHOD: 'x', SAMPLE_SIZE: '5', CONTROL_METHOD: 'x', REACTION_PLAN: 'x' }];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 50 }];
      return [];
    });
    const result = await service.validateRevision(10, '40', '1000', 'tester');
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REFERENCE_REVISION_MUTABLE', field: 'refPfdRevisionId' }),
      expect.objectContaining({ code: 'REFERENCE_PACKAGE_MISMATCH', field: 'refPfmeaRevisionId' }),
    ]));
  });

  it('REV.01 이상은 개정사유와 변경내용이 없으면 발행할 수 없다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT D.PACKAGE_ID')) return [{ PACKAGE_ID: 1, DOCUMENT_TYPE: 'PFD', REVISION_CODE: '01', CHANGE_REASON: ' ', CHANGE_DESCRIPTION: null }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [{ ROW_ID: 1, PROCESS_NO: '10' }];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 50 }];
      return [];
    });
    const result = await service.validateRevision(10, '40', '1000', 'tester');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REVISION_REASON_REQUIRED' }),
      expect.objectContaining({ code: 'REVISION_DESCRIPTION_REQUIRED' }),
    ]));
  });
});
