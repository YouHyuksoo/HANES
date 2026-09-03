/**
 * @file src/modules/master/validation/master-validation.rules.spec.ts
 * @description 기준정보 검증 규칙 카탈로그 무결성 테스트
 */
import * as fs from 'fs';
import * as path from 'path';
import { ALL_RULES, RULE_CATEGORIES, RULE_SEVERITIES } from './rules';

describe('master-validation 규칙 카탈로그 무결성', () => {
  it('규칙이 1건 이상 존재한다', () => {
    expect(ALL_RULES.length).toBeGreaterThan(0);
  });

  it('규칙 id는 전역 유일하다', () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('category/severity는 정의된 enum 값이다', () => {
    for (const r of ALL_RULES) {
      expect(RULE_CATEGORIES).toContain(r.category);
      expect(RULE_SEVERITIES).toContain(r.severity);
    }
  });

  it('필수 필드(title, description, targetPath, sql)가 비어있지 않다', () => {
    for (const r of ALL_RULES) {
      expect(r.title.trim()).not.toBe('');
      expect(r.description.trim()).not.toBe('');
      expect(r.targetPath.startsWith('/')).toBe(true);
      expect(r.sql.trim()).not.toBe('');
    }
  });

  it('tenantScoped(기본 true) 규칙은 :company/:plantCd 바인드를 포함한다', () => {
    for (const r of ALL_RULES.filter((x) => x.tenantScoped !== false)) {
      expect(r.sql).toContain(':company');
      expect(r.sql).toContain(':plantCd');
    }
  });

  it('SELECT 첫 컬럼 alias는 REF_KEY다', () => {
    for (const r of ALL_RULES) {
      expect(r.sql).toMatch(/SELECT\s+(DISTINCT\s+)?[\w.]+[^,]*\s+AS\s+REF_KEY/i);
    }
  });

  it('targetPath는 프론트 menuConfig에 존재하는 경로다', () => {
    const menuConfigPath = path.join(
      __dirname, '../../../../../frontend/src/config/menuConfig.ts',
    );
    const menuConfigSrc = fs.readFileSync(menuConfigPath, 'utf8');
    for (const r of ALL_RULES) {
      expect(menuConfigSrc).toContain(`path: "${r.targetPath}"`);
    }
  });
});
