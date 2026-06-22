/**
 * @file src/modules/ai/sql-validator.service.ts
 * @description text-to-SQL 보안 검증 (Oracle)
 *
 * - 허용: SELECT / INSERT / UPDATE / WITH (단일 쿼리)
 * - 차단: DELETE/DROP/TRUNCATE/ALTER/GRANT/REVOKE/EXEC/MERGE/CREATE/시스템객체/다중쿼리
 * - INSERT/UPDATE는 kind='write' → 승인 후 실행
 * - SELECT는 kind='select' → 즉시 실행(읽기전용)
 */
import { Injectable } from '@nestjs/common';

export type SqlKind = 'select' | 'write';

export interface SqlValidation {
  valid: boolean;
  error?: string;
  kind?: SqlKind;
}

const DANGEROUS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bDELETE\b/, name: 'DELETE' },
  { pattern: /\bDROP\b/, name: 'DROP' },
  { pattern: /\bTRUNCATE\b/, name: 'TRUNCATE' },
  { pattern: /\bALTER\b/, name: 'ALTER' },
  { pattern: /\bGRANT\b/, name: 'GRANT' },
  { pattern: /\bREVOKE\b/, name: 'REVOKE' },
  { pattern: /\bEXEC(UTE)?\b/, name: 'EXEC' },
  { pattern: /\bMERGE\b/, name: 'MERGE' },
  { pattern: /\bCREATE\b/, name: 'CREATE' },
  { pattern: /\bSYS\./, name: 'SYS.' },
  { pattern: /\bDBMS_/, name: 'DBMS_' },
  { pattern: /\bUTL_/, name: 'UTL_' },
];

@Injectable()
export class SqlValidatorService {
  /** LLM 응답의 마크다운 코드펜스 제거 */
  stripFences(sql: string): string {
    let s = (sql ?? '').trim();
    if (s.startsWith('```sql')) s = s.slice(6);
    else if (s.startsWith('```')) s = s.slice(3);
    if (s.endsWith('```')) s = s.slice(0, -3);
    return s.trim();
  }

  validate(rawSql: string): SqlValidation {
    const sql = this.stripFences(rawSql);
    if (!sql) return { valid: false, error: '빈 쿼리입니다.' };
    const upper = sql.toUpperCase();

    // 다중 쿼리 차단 (끝 세미콜론 1개만 허용)
    const inner = sql.replace(/;\s*$/, '');
    if (inner.includes(';')) {
      return { valid: false, error: '다중 쿼리는 허용되지 않습니다.' };
    }

    // 허용 시작 구문
    const startsAllowed = ['SELECT', 'INSERT', 'UPDATE', 'WITH'].some((s) => upper.startsWith(s));
    if (!startsAllowed) {
      return { valid: false, error: 'SELECT / INSERT / UPDATE 문만 허용됩니다.' };
    }

    // 위험 키워드 차단
    for (const { pattern, name } of DANGEROUS) {
      if (pattern.test(upper)) {
        return { valid: false, error: `금지된 키워드가 포함되어 있습니다: ${name}` };
      }
    }

    const isWrite = /\bINSERT\b/.test(upper) || /\bUPDATE\b/.test(upper);

    // UPDATE 안전장치: WHERE 필수
    if (/\bUPDATE\b/.test(upper) && !/\bWHERE\b/.test(upper)) {
      return { valid: false, error: 'UPDATE 문에는 반드시 WHERE 절이 필요합니다.' };
    }

    return { valid: true, kind: isWrite ? 'write' : 'select' };
  }
}
