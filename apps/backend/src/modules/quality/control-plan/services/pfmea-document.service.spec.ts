import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import { PfmeaDocumentService } from './pfmea-document.service';

const dto = {
  processFlowRowId: 10, processFunction: '압착', requirement: '규격 만족', potentialFailureMode: '압착높이 불량',
  potentialFailureEffect: '접촉 불량', severity: 8, potentialCause: '금형 마모', occurrence: 3,
  detection: 4, rpn: 1, actionSeverity: 7, actionOccurrence: 2, actionDetection: 3, actionRpn: 999,
};

describe('PfmeaDocumentService', () => {
  let tx: DeepMocked<TransactionService>;
  let query: jest.Mock;
  let service: PfmeaDocumentService;
  beforeEach(() => {
    tx = createMock<TransactionService>(); query = jest.fn();
    tx.run.mockImplementation(async (callback) => callback({ query } as unknown as QueryRunner));
    service = new PfmeaDocumentService(tx);
  });

  it('고정 PFD Revision에 없는 행 참조를 거부한다', async () => {
    query.mockResolvedValueOnce([{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'PFMEA', REF_PFD_REVISION_ID: 5, PACKAGE_ID: 1 }]).mockResolvedValueOnce([]);
    await expect(service.createRow(2, dto, '40', '1000', 'tester')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('등급이 1~10 범위를 벗어나면 거부한다', async () => {
    query.mockResolvedValueOnce([{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'PFMEA', REF_PFD_REVISION_ID: 5, PACKAGE_ID: 1 }]);
    await expect(service.createRow(2, { ...dto, severity: 11 }, '40', '1000', 'tester')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('서버가 조치 전후 RPN을 재계산한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('REF_PFD_REVISION_ID')) return [{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'PFMEA', REF_PFD_REVISION_ID: 5, PACKAGE_ID: 1 }];
      if (sql.includes('QUALITY_PROCESS_FLOW_ROWS')) return [{ ROW_ID: 10 }];
      if (sql.includes('MAX(ROW_SEQ)')) return [{ NEXT_ROW_SEQ: 1 }];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 20 }];
      return [];
    });
    const result = await service.createRow(2, dto, '40', '1000', 'tester');
    expect(result.rpn).toBe(96);
    expect(result.actionRpn).toBe(42);
    const insertParams = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO QUALITY_PFMEA_ROWS'))?.[1];
    expect(insertParams).toContain(96);
    expect(insertParams).toContain(42);
  });

  it('등록되지 않은 특별특성 코드를 거부한다', async () => {
    query
      .mockResolvedValueOnce([{ STATUS: 'DRAFT', DOCUMENT_TYPE: 'PFMEA', REF_PFD_REVISION_ID: 5, PACKAGE_ID: 1 }])
      .mockResolvedValueOnce([{ ROW_ID: 10 }])
      .mockResolvedValueOnce([]);
    await expect(service.createRow(2, { ...dto, specialCharacteristicCode: 'BAD' }, '40', '1000', 'tester'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('DRAFT 행 수정 시 RPN을 다시 계산한다', async () => {
    query.mockResolvedValueOnce([{ ROW_ID: 20, REVISION_ID: 2, SEVERITY: 8, OCCURRENCE: 3, DETECTION: 4 }]).mockResolvedValueOnce([]);
    await expect(service.updateRow(20, { severity: 9 }, '40', '1000', 'tester')).resolves.toMatchObject({ rowId: 20, rpn: 108 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE QUALITY_PFMEA_ROWS'))).toBe(true);
  });

  it('조치 목표일과 완료일 및 조치 후 등급을 함께 수정한다', async () => {
    query.mockResolvedValueOnce([{ ROW_ID: 20, REVISION_ID: 2, SEVERITY: 8, OCCURRENCE: 3, DETECTION: 4 }]).mockResolvedValueOnce([]);
    await service.updateRow(20, { targetDate: '2026-10-01', completionDate: '2026-10-02', actionSeverity: 7, actionOccurrence: 2, actionDetection: 3 }, '40', '1000', 'tester');
    const update = query.mock.calls.find(([sql]) => String(sql).includes('TARGET_DATE=COALESCE'));
    expect(update?.[0]).toContain("COMPLETION_DATE=COALESCE(TO_DATE(:18,'YYYY-MM-DD')");
    expect(update?.[1]).toEqual(expect.arrayContaining(['2026-10-01', '2026-10-02', 7, 2, 3, 42]));
  });

  it('DRAFT PFMEA 행을 현재 참조 PFD Revision의 다른 공정에 다시 연결한다', async () => {
    query
      .mockResolvedValueOnce([{ ROW_ID: 20, REVISION_ID: 2, REF_PFD_REVISION_ID: 5, PROCESS_FLOW_ROW_ID: 10, SEVERITY: 8, OCCURRENCE: 3, DETECTION: 4 }])
      .mockResolvedValueOnce([{ ROW_ID: 11 }])
      .mockResolvedValue([]);
    await service.updateRow(20, { processFlowRowId: 11 }, '40', '1000', 'tester');
    expect(query.mock.calls).toEqual(expect.arrayContaining([
      expect.arrayContaining([expect.stringContaining('SET PROCESS_FLOW_ROW_ID=:1'), [11, 'tester', 20, '40', '1000']]),
    ]));
  });

  it('Control Plan에서 참조 중인 PFMEA 행 삭제를 거부한다', async () => {
    query.mockResolvedValueOnce([{ ROW_ID: 20, REVISION_ID: 2 }]).mockResolvedValueOnce([{ CNT: 1 }]);
    await expect(service.deleteRow(20, '40', '1000')).rejects.toBeInstanceOf(BadRequestException);
  });
});
