import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { NumberingService } from '../../../../shared/numbering.service';
import { TransactionService } from '../../../../shared/transaction.service';
import { PlanPackageService } from './plan-package.service';

describe('PlanPackageService', () => {
  let tx: DeepMocked<TransactionService>;
  let numbering: DeepMocked<NumberingService>;
  let query: jest.Mock;
  let service: PlanPackageService;

  beforeEach(() => {
    tx = createMock<TransactionService>();
    numbering = createMock<NumberingService>();
    query = jest.fn();
    tx.run.mockImplementation(async (callback) => callback({ query } as unknown as QueryRunner));
    service = new PlanPackageService(tx, numbering);
  });

  it('다른 tenant에 없는 품목으로 패키지를 생성하지 않는다', async () => {
    query.mockResolvedValueOnce([]);

    await expect(service.create({ itemCode: 'X', phase: 'PRODUCTION' }, '40', '1000', 'tester'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(numbering.nextQualityDocumentNo).not.toHaveBeenCalled();
  });

  it('신규 패키지에 세 문서를 REV.00 DRAFT로 생성한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM ITEM_MASTERS')) return [{ ITEM_NAME: '테스트품목' }];
      if (sql.includes('.NEXTVAL')) return [{ NEXT_SEQ: 100 }];
      return [];
    });
    numbering.nextQualityDocumentNo
      .mockResolvedValueOnce('PFD-20260915-001')
      .mockResolvedValueOnce('PFMEA-20260915-001')
      .mockResolvedValueOnce('CP-20260915-001');

    const result = await service.create({ itemCode: 'ITEM-1', phase: 'PRODUCTION' }, '40', '1000', 'tester');

    expect(result.documents).toHaveLength(3);
    expect(result.documents.every((document) => document.revisionCode === '00' && document.status === 'DRAFT')).toBe(true);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO QUALITY_PLAN_REVISIONS'))).toHaveLength(3);
  });

  it('출력과 다운로드 이벤트를 서버 사용자로 감사 기록한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM QUALITY_PLAN_PACKAGES')) return [{ PACKAGE_ID: 30 }];
      if (sql.includes('FROM QUALITY_PLAN_DOCUMENTS D JOIN QUALITY_PLAN_REVISIONS R')) return [{ DOCUMENT_ID: 40, REVISION_ID: 50 }];
      if (sql.includes('SEQ_QUALITY_PLAN_EVENT.NEXTVAL')) return [{ NEXT_SEQ: 201 }];
      return [];
    });

    await service.recordOutputEvent(30, '40', '1000', 'tester', 'PDF_DOWNLOADED', 'CONTROL_PLAN');

    const insert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO QUALITY_PLAN_EVENTS'));
    expect(insert?.[1]).toEqual([201, 30, 40, 50, '40', '1000', 'PDF_DOWNLOADED', 'tester', JSON.stringify({ documentType: 'CONTROL_PLAN' })]);
  });

  it('통합 Excel 출력도 현재 발행 Control Plan Revision에 연결한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM QUALITY_PLAN_PACKAGES')) return [{ PACKAGE_ID: 30 }];
      if (sql.includes('FROM QUALITY_PLAN_DOCUMENTS D JOIN QUALITY_PLAN_REVISIONS R')) return [{ DOCUMENT_ID: 40, REVISION_ID: 50 }];
      if (sql.includes('SEQ_QUALITY_PLAN_EVENT.NEXTVAL')) return [{ NEXT_SEQ: 202 }];
      return [];
    });
    await service.recordOutputEvent(30, '40', '1000', 'tester', 'EXCEL_DOWNLOADED', 'WORKBOOK');
    expect(query.mock.calls).toEqual(expect.arrayContaining([
      expect.arrayContaining([expect.stringContaining("D.DOCUMENT_TYPE=:4 AND R.STATUS='PUBLISHED'"), [30, '40', '1000', 'CONTROL_PLAN']]),
    ]));
  });

  it('패키지의 생성·개정·발행·출력 감사 이력을 tenant 범위로 조회한다', async () => {
    query.mockResolvedValueOnce([{ EVENT_ID: 1, EVENT_TYPE: 'PUBLISHED', ACTOR_ID: 'tester' }]);
    await expect(service.listEvents(30, '40', '1000')).resolves.toHaveLength(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('E.PACKAGE_ID=:1 AND E.COMPANY=:2 AND E.PLANT_CD=:3'), [30, '40', '1000']);
  });

  it('발행 전 패키지 기본정보를 수정하고 감사 기록한다', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('PUBLISHED_COUNT')) return [{ PACKAGE_ID: 30, ITEM_CODE: 'ITEM-1', PUBLISHED_COUNT: 0 }];
      if (sql.includes('SEQ_QUALITY_PLAN_EVENT.NEXTVAL')) return [{ NEXT_SEQ: 201 }];
      return [];
    });
    await service.update(30, { projectName: '신규 프로젝트', phase: 'PRE_LAUNCH' }, '40', '1000', 'tester');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE QUALITY_PLAN_PACKAGES'))).toBe(true);
    expect(query.mock.calls.some(([sql,params]) => String(sql).includes('INSERT INTO QUALITY_PLAN_EVENTS') && params.includes('UPDATED'))).toBe(true);
  });

  it('발행본이 있으면 패키지 공통 기본정보 수정을 거부한다', async () => {
    query.mockResolvedValueOnce([{ PACKAGE_ID: 30, ITEM_CODE: 'ITEM-1', PUBLISHED_COUNT: 1 }]);
    await expect(service.update(30, { projectName: '변경' }, '40', '1000', 'tester')).rejects.toBeInstanceOf(BadRequestException);
  });
});
