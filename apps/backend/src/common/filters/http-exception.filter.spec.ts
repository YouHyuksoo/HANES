/**
 * @file src/common/filters/http-exception.filter.spec.ts
 * @description Oracle 참조 무결성 오류(ORA-02291/02292)의 HTTP 상태·코드 매핑 검증
 */
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

interface CapturedResponse {
  status: number | null;
  body: Record<string, unknown> | null;
}

function buildHost(captured: CapturedResponse): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };
  const request = { url: '/master/part/X', method: 'DELETE' };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter - Oracle 참조 무결성 매핑', () => {
  let filter: HttpExceptionFilter;
  let captured: CapturedResponse;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    captured = { status: null, body: null };
  });

  it('ORA-02291(부모 키 없음)은 400 REF_NOT_FOUND 로 변환한다', () => {
    const err = new Error('ORA-02291: integrity constraint (HANES.FK_PRC_EQP_EQUIP) violated - parent key not found');
    filter.catch(err, buildHost(captured));
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body?.errorCode).toBe('REF_NOT_FOUND');
    expect(String(captured.body?.message)).not.toContain('ORA-');
  });

  it('ORA-02292(자식 레코드 존재)는 409 REF_IN_USE 로 변환한다', () => {
    const err = new Error('ORA-02292: integrity constraint (HANES.FK_RTG_PRC_PROCESS) violated - child record found');
    filter.catch(err, buildHost(captured));
    expect(captured.status).toBe(HttpStatus.CONFLICT);
    expect(captured.body?.errorCode).toBe('REF_IN_USE');
    expect(String(captured.body?.message)).not.toContain('ORA-');
  });

  it('ORA-00001 중복키는 기존대로 409 DUPLICATE_KEY 를 유지한다', () => {
    const err = new Error('ORA-00001: unique constraint (HANES.PK_ITEM_MASTERS) violated');
    filter.catch(err, buildHost(captured));
    expect(captured.status).toBe(HttpStatus.CONFLICT);
    expect(captured.body?.errorCode).toBe('DUPLICATE_KEY');
  });

  it('그 외 ORA 오류는 500 DB_QUERY_ERROR 로 원문을 숨긴다', () => {
    const err = new Error('ORA-00904: "FOO": invalid identifier');
    filter.catch(err, buildHost(captured));
    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body?.errorCode).toBe('DB_QUERY_ERROR');
  });
});
