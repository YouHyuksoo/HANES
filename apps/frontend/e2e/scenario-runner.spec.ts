import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { createContext, buildVars, runSteps, summarize } from './scenario-runner/engine';
import { validateScenario } from './scenario-runner/validate';
import { writeReport } from './scenario-runner/report';
import type { Scenario, StepResult } from './scenario-runner/types';

/**
 * 범용 시나리오 실행기.
 *
 * 규격: docs/specs/2026-09-12-scenario-runner-schema-v1-design.md
 * 계획: docs/plans/2026-09-11-activity-log-scenario-runner.md
 *
 * 실행:
 *   # 관람형 (눈으로 따라가기)
 *   SCENARIO=subprocess-kitting-basic E2E_SLOWMO=600 npx playwright test e2e/scenario-runner.spec.ts --project=chromium --headed --no-deps
 *   # 리포트형
 *   SCENARIO=subprocess-kitting-basic npx playwright test e2e/scenario-runner.spec.ts --project=chromium --no-deps
 *
 * 기존 e2e 규칙("읽기 전용")과 분리된다. scenarios/ 는 consumes/creates 를 허용하고
 * 수동 실행 전용이며 CI 에서 돌리지 않는다.
 */

const SCENARIO_DIR = path.join(__dirname, 'scenarios');
const REPORT_ROOT = path.resolve(__dirname, '../../../docs/reports/scenario-runs');
const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:3003/api/v1';

const scenarioId = process.env.SCENARIO;

test.describe('시나리오 실행기', () => {
  test.skip(!scenarioId, 'SCENARIO=<id> 환경변수로 실행할 시나리오를 지정하라');
  // 시나리오는 화면을 여러 단계 조작하므로 기본 타임아웃으로는 모자란다
  test.setTimeout(10 * 60 * 1000);

  test(`시나리오 실행: ${scenarioId ?? '(미지정)'}`, async ({ page }) => {
    const file = path.join(SCENARIO_DIR, `${scenarioId}.json`);
    if (!fs.existsSync(file)) throw new Error(`시나리오 파일이 없다: ${file}`);

    const scenario = JSON.parse(fs.readFileSync(file, 'utf8')) as Scenario;
    const errors = validateScenario(scenario, path.basename(file, '.json'));
    if (errors.length > 0) {
      throw new Error(`시나리오 규격 위반 ${errors.length}건:\n  - ${errors.join('\n  - ')}`);
    }

    const vars = buildVars(scenario);
    const startedAt = new Date().toISOString();
    const outDir = path.join(REPORT_ROOT, vars.runId);
    const shotDirName = 'shots';
    const ctx = createContext(page, scenario, vars, path.join(outDir, shotDirName), API_BASE);

    console.log(`[runner] ${scenario.title} (${scenario.id})`);
    console.log(`[runner] dataPolicy=${scenario.dataPolicy} onFailure=${scenario.onFailure ?? 'abort'}`);
    if (scenario.dataPolicy === 'consumes') {
      console.log('[runner] 주의: 이 시나리오는 실제 데이터를 소모한다. 실패하면 vars 를 재조회해 갱신해야 한다.');
    }
    for (const p of scenario.preconditions ?? []) console.log(`[runner] 전제: ${p}`);

    const results: StepResult[] = [];
    // 스텝 루프 밖에서 터진 예외(진입 실패·세션 만료 등)를 담는다.
    // 이게 없으면 스텝을 하나도 못 돌고 죽었는데 "FAIL 스텝이 없으니 PASS"로 집계된다.
    let fatalError: Error | null = null;
    try {
      await page.goto(scenario.startRoute);
      if (page.url().includes('/login')) {
        throw new Error('세션이 만료됐다. E2E_EMAIL/E2E_PASSWORD 로 setup 프로젝트를 먼저 실행하라(--no-deps 를 빼면 된다).');
      }

      if (scenario.setup?.length) {
        console.log('[runner] --- setup ---');
        await runSteps(ctx, scenario.setup, 'setup', results);
      }
      console.log('[runner] --- steps ---');
      await runSteps(ctx, scenario.steps, 'steps', results);
    } catch (e: unknown) {
      fatalError = e instanceof Error ? e : new Error(String(e));
      console.log(`[runner] 치명적 오류: ${fatalError.message}`);
    } finally {
      if (scenario.teardown?.length) {
        console.log('[runner] --- teardown (실패해도 항상 실행) ---');
        await runSteps(ctx, scenario.teardown, 'teardown', results).catch(() => {});
      }

      const result = summarize(scenario, ctx.vars, results, startedAt, fatalError?.message ?? null);
      const written = writeReport(result, outDir, shotDirName);
      console.log(`[runner] 판정: ${result.verdict}`);
      console.log(`[runner] 리포트: ${written.html}`);
      console.log(`[runner] JSON  : ${written.json}`);

      // 리포트를 남긴 뒤에 던진다 — 진입 실패도 증거가 남아야 한다
      if (fatalError) throw fatalError;

      const failed = results.filter((s) => s.verdict === 'FAIL');
      if (failed.length > 0) {
        throw new Error(
          `시나리오 실패 ${failed.length}건:\n  - `
          + failed.map((s) => `[${s.phase}/${s.index}] ${s.action}: ${s.error}`).join('\n  - '),
        );
      }
    }
  });
});
