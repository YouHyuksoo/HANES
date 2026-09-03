/**
 * @file src/modules/master/validation/master-validation.service.spec.ts
 * @description 기준정보 검증 실행 서비스 단위 테스트
 */
import { MasterValidationService } from './master-validation.service';
import { ALL_RULES } from './rules';

describe('MasterValidationService', () => {
  const makeService = (queryImpl: jest.Mock) =>
    new MasterValidationService({ query: queryImpl } as any);

  it('규칙 SQL 실패 시 해당 규칙만 ERROR로 격리되고 나머지는 계속 실행된다', async () => {
    const query = jest.fn()
      .mockRejectedValueOnce(new Error('ORA-00942')) // 첫 규칙 count 실패
      .mockResolvedValue([{ CNT: 0 }]); // 나머지 전부 0건
    const svc = makeService(query);
    const result = await svc.run(undefined, '40', '1000');
    expect(result.summary.failedRules).toBe(1);
    expect(result.results.filter((r) => r.status === 'ERROR')).toHaveLength(1);
    expect(result.results.filter((r) => r.status === 'OK').length)
      .toBe(result.summary.totalRules - 1);
  });

  it('위반 건수가 있는 규칙은 VIOLATION이고 rows는 200건으로 제한된다', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ REF_KEY: `K${i}` }));
    const query = jest.fn()
      .mockResolvedValueOnce([{ CNT: 500 }]) // count
      .mockResolvedValueOnce(rows) // rows
      .mockResolvedValue([{ CNT: 0 }]); // 나머지
    const svc = makeService(query);
    const result = await svc.run(['REF_INTEGRITY'], '40', '1000');
    const v = result.results.find((r) => r.status === 'VIOLATION');
    expect(v?.totalCount).toBe(500);
    expect(v?.rows).toHaveLength(200);
  });

  it('categories 필터가 적용된다', async () => {
    const query = jest.fn().mockResolvedValue([{ CNT: 0 }]);
    const svc = makeService(query);
    const result = await svc.run(['DATA_QUALITY'], '40', '1000');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every((r) => r.rule.category === 'DATA_QUALITY')).toBe(true);
    expect(result.summary.totalRules).toBe(
      ALL_RULES.filter((r) => r.category === 'DATA_QUALITY').length,
    );
  });

  it('summary는 ERROR/WARN 위반 건수를 집계한다', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ CNT: 3 }])
      .mockResolvedValueOnce([{ REF_KEY: 'A' }, { REF_KEY: 'B' }, { REF_KEY: 'C' }])
      .mockResolvedValue([{ CNT: 0 }]);
    const svc = makeService(query);
    const result = await svc.run(undefined, '40', '1000');
    const first = result.results[0];
    const expectedKey = first.rule.severity === 'ERROR' ? 'errorCount' : 'warnCount';
    expect(result.summary[expectedKey]).toBe(3);
  });

  it('scheduledRun은 ERROR 위반이 있으면 success=false와 위반 규칙 id를 message에 담는다', async () => {
    const firstError = ALL_RULES.find((r) => r.severity === 'ERROR');
    if (!firstError) throw new Error('ERROR 규칙이 없다');
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes(firstError.sql) && sql.startsWith('SELECT COUNT')) return Promise.resolve([{ CNT: 2 }]);
      if (sql.includes(firstError.sql)) return Promise.resolve([{ REF_KEY: 'A' }, { REF_KEY: 'B' }]);
      return Promise.resolve([{ CNT: 0 }]);
    });
    const svc = makeService(query);
    const out = await svc.scheduledRun('40', '1000');
    expect(out.success).toBe(false);
    expect(out.affectedRows).toBe(2);
    expect(out.message).toContain(`${firstError.id}=2건`);
  });

  it('scheduledRun은 위반이 없으면 success=true다', async () => {
    const svc = makeService(jest.fn().mockResolvedValue([{ CNT: 0 }]));
    const out = await svc.scheduledRun('40', '1000');
    expect(out.success).toBe(true);
    expect(out.affectedRows).toBe(0);
  });

  it('규칙 SQL의 :company/:plantCd 바인드는 각 1회만 등장한다(배열 위치 바인드 계약)', () => {
    for (const r of ALL_RULES.filter((x) => x.tenantScoped !== false)) {
      expect((r.sql.match(/:company\b/g) ?? []).length).toBe(1);
      expect((r.sql.match(/:plantCd\b/g) ?? []).length).toBe(1);
    }
  });
});
