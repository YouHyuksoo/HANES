import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import { ControlPlanDocumentService } from './control-plan-document.service';

const dto = {
  processFlowRowId: 10, pfmeaRowId: 20, processNo: 'HACK', processName: '변조', specification: '1.0±0.1',
  evaluationMethod: '마이크로미터', sampleSize: '5EA', sampleFrequency: '매 LOT', controlMethod: '초중종 검사',
  reactionPlan: '정지 후 격리',
};

describe('ControlPlanDocumentService', () => {
  let tx: DeepMocked<TransactionService>; let query: jest.Mock; let service: ControlPlanDocumentService;
  beforeEach(() => {
    tx = createMock<TransactionService>(); query = jest.fn();
    tx.run.mockImplementation(async (callback) => callback({ query } as unknown as QueryRunner));
    service = new ControlPlanDocumentService(tx);
  });

  it('고정 PFD/PFMEA Revision에 없는 참조를 거부한다', async () => {
    query.mockResolvedValueOnce([{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'CONTROL_PLAN', REF_PFD_REVISION_ID: 5, REF_PFMEA_REVISION_ID: 6 }]).mockResolvedValueOnce([]);
    await expect(service.createRow(3, dto, '40', '1000', 'tester')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('공정번호와 공정명은 요청값 대신 참조 PFD 값을 저장한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('REF_PFD_REVISION_ID')) return [{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'CONTROL_PLAN', REF_PFD_REVISION_ID: 5, REF_PFMEA_REVISION_ID: 6 }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [{ ROW_ID: 10, PROCESS_NO: '10', PROCESS_NAME: '압착', PROCESS_CODE: 'CRIMP' }];
      if (sql.includes('QUALITY_PFMEA_ROWS')) return [{ ROW_ID: 20, PROCESS_FLOW_ROW_ID: 10 }];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 30 }];
      if (sql.includes('MAX(ROW_SEQ)')) return [{ NEXT_ROW_SEQ: 1 }];
      return [];
    });
    const result = await service.createRow(3, dto, '40', '1000', 'tester');
    expect(result.processNo).toBe('10');
    expect(result.processName).toBe('압착');
    const params = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO QUALITY_CONTROL_PLAN_ROWS'))?.[1];
    expect(params).toContain('10'); expect(params).toContain('압착'); expect(params).not.toContain('HACK');
  });

  it('100% 시료에 검사주기가 있으면 거부한다', async () => {
    query
      .mockResolvedValueOnce([{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'CONTROL_PLAN', REF_PFD_REVISION_ID: 5, REF_PFMEA_REVISION_ID: 6 }])
      .mockResolvedValueOnce([{ ROW_ID: 10, PROCESS_NO: '10', PROCESS_NAME: '압착' }])
      .mockResolvedValueOnce([{ ROW_ID: 20, PROCESS_FLOW_ROW_ID: 10 }]);
    await expect(service.createRow(3, { ...dto, sampleSize: '100%', sampleFrequency: '매 LOT' }, '40', '1000', 'tester'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('발행본 행은 수정할 수 없다', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.updateRow(30, { controlMethod: '변경' }, '40', '1000', 'tester')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('DRAFT Control Plan 행의 PFD/PFMEA 연결과 공정 snapshot을 함께 갱신한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("R.STATUS='DRAFT'")) return [{ ROW_ID: 30, REVISION_ID: 3, REF_PFD_REVISION_ID: 5, REF_PFMEA_REVISION_ID: 6, PROCESS_FLOW_ROW_ID: 10, PFMEA_ROW_ID: 20, PROCESS_NO: '10', SAMPLE_SIZE: '5EA' }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [{ ROW_ID: 11, PROCESS_NO: '20', PROCESS_NAME: '검사', PROCESS_CODE: 'INSP' }];
      if (sql.includes('QUALITY_PFMEA_ROWS')) return [{ ROW_ID: 21, PROCESS_FLOW_ROW_ID: 11 }];
      return [];
    });
    await service.updateRow(30, { processFlowRowId: 11, pfmeaRowId: 21 }, '40', '1000', 'tester');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('SELECT ROW_ID,PROCESS_FLOW_ROW_ID FROM QUALITY_PFMEA_ROWS'))).toBe(true);
    expect(query.mock.calls).toEqual(expect.arrayContaining([
      expect.arrayContaining([expect.stringContaining('SET PROCESS_FLOW_ROW_ID=:1'), [11, 21, '20', '검사', null, null, 'tester', 30, '40', '1000']]),
    ]));
  });

  it('PFMEA 연결을 null로 보내면 기존 연결을 해제한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("R.STATUS='DRAFT'")) return [{ ROW_ID: 30, REVISION_ID: 3, REF_PFD_REVISION_ID: 5, REF_PFMEA_REVISION_ID: 6, PROCESS_FLOW_ROW_ID: 10, PFMEA_ROW_ID: 20, PROCESS_NO: '10', PROCESS_NAME: '압착', SAMPLE_SIZE: '5EA' }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [{ ROW_ID: 10, PROCESS_NO: '10', PROCESS_NAME: '압착' }];
      return [];
    });
    await service.updateRow(30, { pfmeaRowId: null }, '40', '1000', 'tester');
    expect(query.mock.calls).toEqual(expect.arrayContaining([
      expect.arrayContaining([expect.stringContaining('SET PROCESS_FLOW_ROW_ID=:1'), [10, null, '10', '압착', null, null, 'tester', 30, '40', '1000']]),
    ]));
  });

  it('DRAFT 행은 삭제한다', async () => {
    query.mockResolvedValueOnce([{ ROW_ID: 30, REVISION_ID: 3 }]).mockResolvedValueOnce([]);
    await expect(service.deleteRow(30, '40', '1000')).resolves.toEqual({ rowId: 30 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM QUALITY_CONTROL_PLAN_ROWS'))).toBe(true);
  });
});
