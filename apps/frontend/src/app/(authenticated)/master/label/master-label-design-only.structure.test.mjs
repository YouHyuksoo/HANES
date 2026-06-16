import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");
const types = readFileSync(join(here, "types.ts"), "utf8");
const ko = JSON.parse(readFileSync(join(process.cwd(), "apps/frontend/src/locales/ko.json"), "utf8"));

assert.match(page, /sourceCategoryMap:[\s\S]*equipment[\s\S]*consumable[\s\S]*worker[\s\S]*mat_lot/, "소스테이블 기준으로 템플릿 카테고리가 자동 매핑되어야 합니다.");
assert.doesNotMatch(page, /key:\s*"part"/, "품목 탭은 제거되어야 합니다.");
assert.doesNotMatch(types, /"part"/, "LabelCategory 타입에서 품목 카테고리를 제거해야 합니다.");

assert.doesNotMatch(page, /api\.get\(/, "디자인 제공 전용 화면은 대상 조회 API를 호출하지 않아야 합니다.");
assert.doesNotMatch(page, /<LabelGrid\b/, "디자인 제공 전용 화면에는 대상 선택 그리드를 렌더링하지 않아야 합니다.");
assert.doesNotMatch(page, /<LabelPreview\b/, "디자인 제공 전용 화면에는 선택 항목 인쇄 컴포넌트를 렌더링하지 않아야 합니다.");

assert.equal(ko.master.label.catJig, "소모품", "지그/금형 탭명은 소모품이어야 합니다.");
assert.equal(typeof ko.master.label.designOnly, "string", "공통 디자인 제공 전용 문구가 필요합니다.");
assert.equal(typeof ko.master.label.designOnlyHint, "string", "공통 디자인 제공 안내 문구가 필요합니다.");
