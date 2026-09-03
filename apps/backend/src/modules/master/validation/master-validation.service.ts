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

  /**
   * 정기 실행 진입점 — SCHEDULER_JOBS(EXEC_TYPE=SERVICE, TENANT_AWARE) 'MasterValidationService.scheduledRun'.
   * ERROR 심각도 위반이나 규칙 실행 실패가 있으면 success=false로 반환해 잡 로그가 FAILED로 남고 관리자 알림을 탄다.
   * message에는 위반 규칙 id와 건수를 남겨 SCHEDULER_LOGS.RESULT_MSG만으로 무엇이 깨졌는지 알 수 있게 한다.
   */
  async scheduledRun(company: string, plantCd: string): Promise<{ success: boolean; affectedRows: number; message: string }> {
    const result = await this.run(undefined, company, plantCd);
    const { totalRules, errorCount, warnCount, failedRules } = result.summary;
    const detail = result.results
      .filter((r) => r.status !== 'OK')
      .map((r) => (r.status === 'ERROR' ? `${r.rule.id}=실행실패` : `${r.rule.id}=${r.totalCount}건`))
      .join(', ');
    const summaryLine =
      `검증 규칙 ${totalRules}건 실행(${company}/${plantCd}): ERROR 위반 ${errorCount}건, WARN 위반 ${warnCount}건, 실행실패 ${failedRules}건, ${result.durationMs}ms`;
    const message = (detail ? `${summaryLine} — ${detail}` : summaryLine).slice(0, 1900);
    const success = errorCount === 0 && failedRules === 0;
    if (success) this.logger.log(message); else this.logger.warn(message);
    return { success, affectedRows: errorCount + warnCount, message };
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
