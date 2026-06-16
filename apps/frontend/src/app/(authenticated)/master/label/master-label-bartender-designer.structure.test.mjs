import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const page = readFileSync(join(here, "page.tsx"), "utf8");
const types = readFileSync(join(here, "types.ts"), "utf8");
const objectDesigner = readFileSync(join(here, "components/LabelObjectDesigner.tsx"), "utf8");
const renderer = readFileSync(join(here, "components/LabelDesignRenderer.tsx"), "utf8");
const designerRuntime = `${objectDesigner}\n${renderer}`;
const sources = readFileSync(join(here, "labelSources.ts"), "utf8");
const conLabelPage = readFileSync(join(root, "apps/frontend/src/app/(authenticated)/consumables/label/page.tsx"), "utf8");

for (const kind of ["text", "barcode", "box", "line", "circle", "image"]) {
  assert.match(types, new RegExp(`"${kind}"`), `LabelElementKind에 ${kind} 객체가 필요합니다.`);
  assert.match(objectDesigner, new RegExp(`type:\\s*"${kind}"|kind:\\s*"${kind}"|${kind}`), `${kind} 객체 추가 UI가 필요합니다.`);
}

assert.match(types, /sourceTable\??:/, "라벨 디자인에는 소스테이블이 저장되어야 합니다.");
assert.match(types, /sourceFields\??:/, "라벨 디자인에는 사용자가 구성한 소스 필드 목록이 저장되어야 합니다.");
assert.match(types, /sourceField\??:/, "객체에는 소스 필드 매핑이 저장되어야 합니다.");
assert.match(sources, /consumable/, "소모품 소스테이블 정의가 필요합니다.");
assert.match(sources, /conUid/, "소모품 출력용 conUid 필드 정의가 필요합니다.");

assert.match(designerRuntime, /onPointerDown/, "캔버스 객체는 마우스 포인터로 드래그/리사이즈되어야 합니다.");
assert.match(designerRuntime, /resize-handle|data-resize-handle/, "객체별 리사이즈 앵커가 렌더링되어야 합니다.");
assert.match(objectDesigner, /sourceField/, "텍스트/바코드 객체에 소스 필드 매핑 UI가 필요합니다.");
assert.match(objectDesigner, /필드 추가/, "좌측 필드 목록은 사용자가 추가할 수 있어야 합니다.");
assert.match(objectDesigner, /updateSourceField/, "좌측 필드 목록은 사용자가 수정할 수 있어야 합니다.");
assert.match(objectDesigner, /deleteSourceField/, "좌측 필드 목록은 사용자가 삭제할 수 있어야 합니다.");
assert.match(objectDesigner, /sourceFields:/, "사용자 정의 필드 목록은 design.sourceFields에 저장되어야 합니다.");

assert.match(renderer, /BarcodeImage/, "렌더러는 인쇄 가능한 바코드 이미지를 생성해야 합니다.");
assert.match(renderer, /resolveLabelValue/, "렌더러는 저장된 소스 필드 매핑으로 데이터를 치환해야 합니다.");

assert.match(page, /LabelObjectDesigner/, "/master/label 페이지는 객체 기반 디자이너를 사용해야 합니다.");
assert.doesNotMatch(page, /LabelDesigner/, "이전 좌표 입력형 LabelDesigner는 페이지에서 제거되어야 합니다.");
assert.doesNotMatch(page, /categories\.map/, "상단 카테고리 탭은 제거되어야 합니다.");
assert.doesNotMatch(page, /handleCategoryChange/, "상단 탭 기반 카테고리 변경 로직은 제거되어야 합니다.");

assert.match(conLabelPage, /label-templates/, "소모품 라벨 발행은 저장된 라벨 템플릿을 조회해야 합니다.");
assert.match(conLabelPage, /LabelPrintRenderer/, "소모품 라벨 발행은 공통 디자인 렌더러로 출력해야 합니다.");
assert.doesNotMatch(conLabelPage, /className="label-card"[\s\S]*className="uid"/, "소모품 라벨 고정 HTML 출력은 제거되어야 합니다.");
