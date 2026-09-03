/**
 * @file src/modules/master/validation/master-validation.service.ts
 * @description 기준정보 검증 실행 서비스 — 규칙 카탈로그를 순회하며 raw SQL로 검증
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ALL_RULES, ValidationRule, RuleCategory } from './rules';

/** 규칙 1건의 실행 결과 */
export interface RuleRunResult {
  rule: Omit<ValidationRule, 'sql'>;
  status: 'OK' | 'VIOLATION' | 'ERROR';
  totalCount: number;
  rows: Record<string, unknown>[];
  errorMessage?: string;
}

/** 규칙당 반환 최대 행 수 */
const ROW_LIMIT = 200;

@Injectable()
export class MasterValidationService {
  private readonly logger = new Logger(MasterValidationService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** 전체(또는 선택 카테고리) 규칙을 실행하고 결과를 집계한다 */
  async run(categories: RuleCategory[] | undefined, company: string, plantCd: string) {
    const startedAt = Date.now();
    const rules = categories?.length
      ? ALL_RULES.filter((r) => categories.includes(r.category))
      : ALL_RULES;

    const results: RuleRunResult[] = [];
    for (const rule of rules) {
      results.push(await this.runRule(rule, company, plantCd));
    }

    return {
      runAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary: {
        totalRules: rules.length,
        failedRules: results.filter((r) => r.status === 'ERROR').length,
        errorCount: results
          .filter((r) => r.status === 'VIOLATION' && r.rule.severity === 'ERROR')
          .reduce((a, r) => a + r.totalCount, 0),
        warnCount: results
          .filter((r) => r.status === 'VIOLATION' && r.rule.severity === 'WARN')
          .reduce((a, r) => a + r.totalCount, 0),
      },
      results,
    };
  }

  /** 규칙 1건 실행 — 실패는 해당 규칙만 ERROR로 격리한다 */
  private async runRule(rule: ValidationRule, company: string, plantCd: string): Promise<RuleRunResult> {
    const meta = {
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      title: rule.title,
      description: rule.description,
      targetPath: rule.targetPath,
    };
    // oracledb는 named placeholder도 배열이면 등장 순서대로 바인드한다 (모든 규칙 SQL은 :company → :plantCd 순)
    const params = rule.tenantScoped === false ? undefined : [company, plantCd];
    try {
      const countRows: Record<string, unknown>[] = await this.dataSource.query(
        `SELECT COUNT(*) AS CNT FROM (${rule.sql})`, params,
      );
      const totalCount = Number(countRows[0]?.CNT ?? countRows[0]?.cnt ?? 0);
      if (totalCount === 0) return { rule: meta, status: 'OK', totalCount: 0, rows: [] };

      const rows: Record<string, unknown>[] = await this.dataSource.query(
        `SELECT * FROM (${rule.sql}) WHERE ROWNUM <= ${ROW_LIMIT}`, params,
      );
      return { rule: meta, status: 'VIOLATION', totalCount, rows };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`검증 규칙 ${rule.id} 실행 실패: ${msg}`);
      return { rule: meta, status: 'ERROR', totalCount: 0, rows: [], errorMessage: msg };
    }
  }
}
