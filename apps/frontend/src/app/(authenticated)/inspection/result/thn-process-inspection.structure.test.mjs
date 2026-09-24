import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repo = resolve(import.meta.dirname, "../../../../../../..");
const read = (path) => readFileSync(resolve(repo, path), "utf8");

const menu = read("apps/frontend/src/config/menuConfig.ts");
const validator = read("apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts");
const seed = JSON.parse(read("apps/backend/src/seeds/menu-config.json"));
const dto = read("apps/backend/src/modules/quality/continuity-inspect/dto/continuity-inspect.dto.ts");
const service = read("apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts");
const types = read("apps/frontend/src/app/(authenticated)/inspection/result/types.ts");

const stations = [
  ["torque-result", "TORQUE", "INSP_TORQUE_RESULT", "torqueResult"],
  ["vision-result", "VISION", "INSP_VISION_RESULT", "visionResult"],
  ["relay-result", "RELAY_FUNCTION", "INSP_RELAY_RESULT", "relayResult"],
];

test("THN 공정표의 미지원 독립 검사 3종은 메뉴에서 접근 가능한 검사 스테이션이다", () => {
  for (const [slug, inspectType, code, key] of stations) {
    const path = `apps/frontend/src/app/(authenticated)/inspection/${slug}/page.tsx`;
    assert.ok(existsSync(resolve(repo, path)), `${path}가 있어야 한다`);
    const page = read(path);
    assert.match(page, /InspectionResultWorkflow/);
    assert.match(page, new RegExp(`inspectType="${inspectType}"`));
    assert.match(page, new RegExp(`inspection\\.${key}\\.title`));
    assert.match(menu, new RegExp(`${code}[\\s\\S]{0,120}/inspection/${slug}`));
    assert.match(validator, new RegExp(`'${code}'`));
    assert.ok(seed.childMenuCodes.INSPECTION.includes(code), `${code} seed 등록`);
  }
});

test("검사 저장 계약은 TORQUE, VISION, RELAY_FUNCTION을 허용한다", () => {
  for (const inspectType of ["TORQUE", "VISION", "RELAY_FUNCTION"]) {
    assert.match(dto, new RegExp(`['\"]${inspectType}['\"]`));
  }
  assert.match(dto, /torque\?: number;/);
  assert.match(service, /MEASURED_TYPES = new Set\(\['HIPOT', 'LEAK', 'TORQUE'\]\)/);
  assert.match(service, /CIRCUIT_LABEL_TYPES = new Set\(\['CONTINUITY', 'TERMINAL'\]\)/);
});

test("토크는 측정형이고 비전·릴레이 기능검사는 수동 판정형이다", () => {
  assert.match(types, /Record<"HIPOT" \| "LEAK" \| "TORQUE"/);
  assert.match(types, /TORQUE:[\s\S]*?torque/);
  assert.match(types, /isCircuitLabelInspectType/);
  assert.match(types, /CONTINUITY[\s\S]*TERMINAL/);
});

test("4개 언어에 신규 메뉴·화면·공통코드 번역이 있다", () => {
  for (const lang of ["ko", "en", "zh", "vi"]) {
    const locale = JSON.parse(read(`apps/frontend/src/locales/${lang}.json`));
    for (const [, inspectType, , key] of stations) {
      assert.equal(typeof locale.menu[`inspection.${key}`], "string", `${lang} menu ${key}`);
      assert.equal(typeof locale.inspection[key]?.title, "string", `${lang} inspection.${key}.title`);
      assert.equal(typeof locale.comCode.INSPECT_TYPE[inspectType], "string", `${lang} comCode ${inspectType}`);
    }
    assert.equal(typeof locale.inspection.result.measure.torque, "string", `${lang} torque label`);
  }
});
