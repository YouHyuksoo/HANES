import { BadRequestException, ConflictException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import { QualityDocumentRevisionService } from './quality-document-revision.service';
import { QualityPlanValidationService } from './quality-plan-validation.service';

describe('QualityDocumentRevisionService', () => {
  let tx: DeepMocked<TransactionService>;
  let query: jest.Mock;
  let service: QualityDocumentRevisionService;
  let validation: DeepMocked<QualityPlanValidationService>;

  beforeEach(() => {
    tx = createMock<TransactionService>();
    query = jest.fn();
    validation = createMock<QualityPlanValidationService>();
    validation.validateInTx.mockResolvedValue({ valid: true, validationId: 1, errorCount: 0, warningCount: 0, issues: [] });
    tx.run.mockImplementation(async (callback) => callback({ query } as unknown as QueryRunner));
    service = new QualityDocumentRevisionService(tx, validation);
  });

  it.each(['PUBLISHED', 'SUPERSEDED'])('%s 발행본 update를 거부한다', async (status) => {
    query.mockResolvedValueOnce([{ REVISION_ID: 10, STATUS: status }]);
    await expect(service.updateMetadata(10, {}, '40', '1000', 'tester')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('DRAFT 또는 다른 패키지의 상위 Revision 참조 변경을 거부한다', async () => {
    query
      .mockResolvedValueOnce([{ REVISION_ID: 10, DOCUMENT_ID: 20, DOCUMENT_TYPE: 'PFMEA', REVISION_CODE: '01', STATUS: 'DRAFT', PACKAGE_ID: 30 }])
      .mockResolvedValueOnce([{ REVISION_ID: 7, DOCUMENT_TYPE: 'PFD', STATUS: 'DRAFT', PACKAGE_ID: 30 }]);
    await expect(service.updateMetadata(10, { refPfdRevisionId: 7 }, '40', '1000', 'tester')).rejects.toBeInstanceOf(BadRequestException);

    query.mockReset();
    query
      .mockResolvedValueOnce([{ REVISION_ID: 10, DOCUMENT_ID: 20, DOCUMENT_TYPE: 'PFMEA', REVISION_CODE: '01', STATUS: 'DRAFT', PACKAGE_ID: 30 }])
      .mockResolvedValueOnce([{ REVISION_ID: 8, DOCUMENT_TYPE: 'PFD', STATUS: 'PUBLISHED', PACKAGE_ID: 31 }]);
    await expect(service.updateMetadata(10, { refPfdRevisionId: 8 }, '40', '1000', 'tester')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('같은 패키지의 발행 PFD Revision으로 참조를 변경한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FOR UPDATE')) return [{ REVISION_ID: 10, DOCUMENT_ID: 20, DOCUMENT_TYPE: 'PFMEA', REVISION_CODE: '01', STATUS: 'DRAFT', PACKAGE_ID: 30, REF_PFD_REVISION_ID: 6 }];
      if (sql.includes('R.REVISION_ID,R.STATUS')) return [{ REVISION_ID: 7, DOCUMENT_TYPE: 'PFD', STATUS: 'PUBLISHED', PACKAGE_ID: 30 }];
      if (sql.includes('NEXTVAL')) return [{ NEXT_SEQ: 201 }];
      return [];
    });
    await service.updateMetadata(10, { refPfdRevisionId: 7 }, '40', '1000', 'tester');
    expect(query.mock.calls).toEqual(expect.arrayContaining([
      expect.arrayContaining([expect.stringContaining('REF_PFD_REVISION_ID=:1'), expect.arrayContaining([7])]),
    ]));
  });

  it('발행본 delete를 거부한다', async () => {
    query.mockResolvedValueOnce([{ REVISION_ID: 10, STATUS: 'PUBLISHED' }]);
    await expect(service.deleteDraft(10, '40', '1000')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('이미 DRAFT가 있으면 새 Revision을 만들지 않는다', async () => {
    query
      .mockResolvedValueOnce([{ REVISION_ID: 10, DOCUMENT_ID: 20, DOCUMENT_TYPE: 'PFD', REVISION_CODE: '00', STATUS: 'PUBLISHED', PACKAGE_ID: 30 }])
      .mockResolvedValueOnce([{ REVISION_ID: 11 }]);
    await expect(service.createRevision(10, { changeReason: '변경', changeDescription: '내용' }, '40', '1000', 'tester'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('발행본 머리정보와 유형별 하위행을 REV.01 DRAFT로 복제한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN QUALITY_PLAN_DOCUMENTS')) return [{ REVISION_ID: 10, DOCUMENT_ID: 20, DOCUMENT_TYPE: 'PFD', REVISION_CODE: '00', STATUS: 'PUBLISHED', PACKAGE_ID: 30 }];
      if (sql.includes("STATUS = 'DRAFT'")) return [];
      if (sql.includes('SEQ_QUALITY_PLAN_REVISION.NEXTVAL')) return [{ NEXT_SEQ: 101 }];
      if (sql.includes('SEQ_QUALITY_PLAN_EVENT.NEXTVAL')) return [{ NEXT_SEQ: 201 }];
      return [];
    });

    const result = await service.createRevision(10, { changeReason: '공정변경', changeDescription: '설비 변경' }, '40', '1000', 'tester');

    expect(result).toMatchObject({ revisionId: 101, revisionCode: '01', status: 'DRAFT' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO QUALITY_PROCESS_FLOW_ROWS') && String(sql).includes('SELECT SEQ_QUALITY_PROCESS_FLOW_ROW.NEXTVAL'))).toBe(true);
  });

  it('새 Revision 발행 뒤 직전 발행본을 SUPERSEDED로 전환한다', async () => {
    query.mockResolvedValueOnce([{ REVISION_ID: 11, DOCUMENT_ID: 20, STATUS: 'DRAFT', PACKAGE_ID: 30 }]);
    query.mockResolvedValue([]);

    await service.publish(11, '40', '1000', 'publisher');

    const updates = query.mock.calls.map(([sql]) => String(sql)).filter((sql) => sql.includes('UPDATE QUALITY_PLAN_REVISIONS'));
    expect(updates[0]).toContain("STATUS = 'PUBLISHED'");
    expect(updates[1]).toContain("STATUS = 'SUPERSEDED'");
    expect(tx.run).toHaveBeenCalledTimes(1);
  });

  it('트랜잭션 오류를 숨기지 않는다', async () => {
    tx.run.mockRejectedValueOnce(new Error('rollback'));
    await expect(service.publish(11, '40', '1000', 'publisher')).rejects.toThrow('rollback');
  });

  it('발행 검증 ERROR가 있으면 상태를 변경하지 않는다', async () => {
    query.mockResolvedValueOnce([{ REVISION_ID: 11, DOCUMENT_ID: 20, STATUS: 'DRAFT', PACKAGE_ID: 30 }]);
    validation.validateInTx.mockResolvedValueOnce({ valid: false, validationId: 2, errorCount: 1, warningCount: 0, issues: [{ severity: 'ERROR', code: 'BLOCK', documentType: 'CONTROL_PLAN', revisionId: 11, rowId: null, field: null, message: '차단' }] });
    await expect(service.publish(11, '40', '1000', 'publisher')).rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE QUALITY_PLAN_REVISIONS'))).toBe(false);
  });

  it('같은 문서의 두 Revision에서 추가 삭제 변경 행을 비교한다', async () => {
    query
      .mockResolvedValueOnce([
        { REVISION_ID: 10, DOCUMENT_ID: 20, DOCUMENT_TYPE: 'CONTROL_PLAN', REVISION_CODE: '00', STATUS: 'SUPERSEDED', CHANGE_REASON: '최초' },
        { REVISION_ID: 11, DOCUMENT_ID: 20, DOCUMENT_TYPE: 'CONTROL_PLAN', REVISION_CODE: '01', STATUS: 'PUBLISHED', CHANGE_REASON: '검사 변경' },
      ])
      .mockResolvedValueOnce([
        { ROW_ID: 100, REVISION_ID: 10, ROW_SEQ: 1, SPECIFICATION: '1.0', CREATED_AT: new Date('2026-01-01') },
        { ROW_ID: 101, REVISION_ID: 10, ROW_SEQ: 2, SPECIFICATION: '2.0' },
      ])
      .mockResolvedValueOnce([
        { ROW_ID: 200, REVISION_ID: 11, ROW_SEQ: 1, SPECIFICATION: '1.1', CREATED_AT: new Date('2026-02-01') },
        { ROW_ID: 202, REVISION_ID: 11, ROW_SEQ: 3, SPECIFICATION: '3.0' },
      ]);

    const result = await service.compare(10, 11, '40', '1000');

    expect(result.metadataChanges).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'REVISION_CODE', before: '00', after: '01' })]));
    expect(result.changed).toEqual([expect.objectContaining({ rowSeq: 1, fields: ['SPECIFICATION'] })]);
    expect(result.removed).toEqual([expect.objectContaining({ ROW_SEQ: 2 })]);
    expect(result.added).toEqual([expect.objectContaining({ ROW_SEQ: 3 })]);
  });
});
