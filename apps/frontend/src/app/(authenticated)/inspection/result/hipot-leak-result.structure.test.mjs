import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * 내전압(절연저항 포함)·리크 검사 스테이션 — 통전검사 워크플로우를 inspectType 만 바꿔 재사용하고,
 * 회로라벨 대신 측정값을 받아 서버가 품목 스펙(INSPECT_ITEM_SPECS)과 대조해 판정한다.
 */
const here = import.meta.dirname;
const repo = resolve(here, "../../../../../../..");
const read = (p) => readFileSync(resolve(repo, p), "utf8");

const panel = read("apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPanel.tsx");
const types = read("apps/frontend/src/app/(authenticated)/inspection/result/types.ts");
const menu = read("apps/frontend/src/config/menuConfig.ts");
const registry = read("apps/frontend/src/components/layout/pageRegistry.generated.ts");
const validator = read("apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts");
const seed = JSON.parse(read("apps/backend/src/seeds/menu-config.json"));
const dto = read("apps/backend/src/modules/quality/continuity-inspect/dto/continuity-inspect.dto.ts");
const service = read("apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts");
const controller = read("apps/backend/src/modules/quality/continuity-inspect/controllers/continuity-inspect.controller.ts");
const judge = read("packages/shared/src/utils/inspect-measurement-spec.ts");

test("내전압·리크 페이지는 통전 워크플로우를 재사용한다", () => {
  for (const [slug, typ, key] of [["hipot-result", "HIPOT", "hipotResult"], ["leak-result", "LEAK", "leakResult"]]) {
    const p = `apps/frontend/src/app/(authenticated)/inspection/${slug}/page.tsx`;
    assert.ok(existsSync(resolve(repo, p)), `${p} 가 있어야 한다`);
    const page = read(p);
    assert.match(page, /InspectionResultWorkflow/);
    assert.match(page, new RegExp(`inspectType="${typ}"`));
    assert.match(page, new RegExp(`inspection\\.${key}\\.title`));
    assert.match(registry, new RegExp(`/inspection/${slug}`), "페이지 레지스트리에 경로가 있어야 한다");
  }
});

test("메뉴 4소스(menuConfig·validator·seed·registry)에 두 메뉴가 같이 있다", () => {
  for (const code of ["INSP_HIPOT_RESULT", "INSP_LEAK_RESULT"]) {
    assert.match(menu, new RegExp(code));
    assert.match(validator, new RegExp(`'${code}'`));
    assert.ok(seed.childMenuCodes.INSPECTION.includes(code), `seed INSPECTION 에 ${code}`);
  }
  assert.match(menu, /menu\.inspection\.hipotResult[\s\S]{0,80}\/inspection\/hipot-result/);
  assert.match(menu, /menu\.inspection\.leakResult[\s\S]{0,80}\/inspection\/leak-result/);
});

test("측정형 검사는 회로라벨 대신 측정값을 입력받고 필수값이 차야 합격 버튼이 열린다", () => {
  assert.match(types, /MEASURE_FIELDS: Record<"HIPOT" \| "LEAK" \| "TORQUE"/);
  assert.match(types, /HIPOT: \[[\s\S]*?insulationMohm[\s\S]*?\]/, "절연저항은 내전압 측정 항목에 같이 있다");
  assert.match(panel, /const isMeasured = isMeasuredInspectType\(inspectType\)/);
  assert.match(panel, /data-testid="inspect-measure-inputs"/);
  assert.match(panel, /if \(requiresCircuitLabel\) payload\.circuitLabel = circuitLabel;/);
  assert.match(panel, /if \(isMeasured\) Object\.assign\(payload, measurePayload\(\)\);/);
  assert.match(panel, /isMeasured \? !measureReady : requiresCircuitLabel && !circuitLabel\.trim\(\)/);
  // 대기 라벨은 검사유형별로 가져온다
  assert.match(panel, /pending\/\$\{order\.orderNo\}`, \{ params: \{ inspectType \} \}/);
  // 이력에 측정값 요약 컬럼
  assert.match(panel, /formatMeasuredSummary\(row\.original\.inspectType, row\.original\.inspectData\)/);
});

test("서버는 HIPOT/LEAK 를 받아 스펙으로 판정하고 회로라벨을 요구하지 않는다", () => {
  assert.match(dto, /@IsIn\(\['CONTINUITY', 'TERMINAL', 'HIPOT', 'LEAK', 'TORQUE', 'VISION', 'RELAY_FUNCTION'\]\)/);
  for (const f of ["voltageKv", "currentMa", "testSeconds", "insulationMohm", "chargeBar", "holdBar", "holdSeconds"]) {
    assert.match(dto, new RegExp(`\\b${f}\\?: number;`), `ContinuityInspectDto.${f}`);
  }
  assert.match(service, /MEASURED_TYPES = new Set\(\['HIPOT', 'LEAK', 'TORQUE'\]\)/);
  assert.match(service, /const verdict = await this\.applyMeasurementJudgement\(queryRunner, dto, company, plant\);/);
  assert.match(service, /const circuitLabel = requiresCircuitLabel \? \(dto\.circuitLabel\?\.trim\(\) \|\| null\) : null;/);
  assert.match(service, /if \(dto\.passYn === 'Y' && requiresCircuitLabel\) \{/);
  assert.match(service, /inspectData: verdict\.inspectData,/);
  // 대기 라벨: 그 유형의 결과가 없는 ISSUED 라벨
  assert.match(service, /async getPendingLabels\(orderNo: string, company\?: string, plant\?: string, inspectType\?: string\)/);
  assert.match(service, /NOT EXISTS \(SELECT 1 FROM INSPECT_RESULTS ir/);
  assert.match(controller, /@Query\('inspectType'\) inspectType\?: string,[\s\S]{0,120}getPendingLabels\(orderNo, company, plant, inspectType \|\| undefined\)/);
  // 절연저항 판정은 공용 judge 의 HIPOT 분기에 있다
  assert.match(judge, /minInsulationMohm/);
  assert.match(judge, /절연저항 \$\{ins\} MΩ < 하한 \$\{minIns\} MΩ/);
});

test("i18n 4개 언어에 화면·메뉴·측정·공통코드 키가 있다", () => {
  for (const lang of ["ko", "en", "zh", "vi"]) {
    const j = JSON.parse(read(`apps/frontend/src/locales/${lang}.json`));
    assert.equal(typeof j.menu["inspection.hipotResult"], "string", `${lang} menu hipot`);
    assert.equal(typeof j.menu["inspection.leakResult"], "string", `${lang} menu leak`);
    for (const key of ["hipotResult", "leakResult"]) {
      for (const f of ["title", "description", "searchPlaceholder", "selectOrder"]) {
        assert.equal(typeof j.inspection[key][f], "string", `${lang} inspection.${key}.${f}`);
      }
    }
    for (const f of ["voltageKv", "currentMa", "testSeconds", "insulationMohm", "chargeBar", "holdBar", "holdSeconds"]) {
      assert.equal(typeof j.inspection.result.measure[f], "string", `${lang} measure.${f}`);
    }
    assert.equal(typeof j.inspection.result.measurementRequired, "string", `${lang} measurementRequired`);
    assert.equal(typeof j.master.inspectItemSpec.minInsulationMohm, "string", `${lang} spec minInsulationMohm`);
    for (const c of ["HIPOT", "LEAK", "TERMINAL", "STRUCTURE", "TORQUE"]) {
      assert.equal(typeof j.comCode.INSPECT_TYPE[c], "string", `${lang} comCode.INSPECT_TYPE.${c}`);
    }
  }
});
