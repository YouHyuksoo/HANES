import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");

assert.match(page, /interface TemplateInfo[\s\S]*templateKey: string/, "템플릿 선택을 위해 templateKey를 보관해야 합니다.");
assert.match(page, /const \[templates, setTemplates\]/, "라벨디자인마스터 템플릿 목록을 상태로 보관해야 합니다.");
assert.match(page, /const \[selectedTemplateKey, setSelectedTemplateKey\]/, "사용자가 선택한 템플릿 key를 상태로 보관해야 합니다.");
assert.match(page, /templateOptions/, "템플릿 선택 Select 옵션을 구성해야 합니다.");
assert.match(page, /handleTemplateChange/, "템플릿 선택 변경 시 designData를 labelDesign에 적용해야 합니다.");
assert.match(page, /<Select[\s\S]*value=\{selectedTemplateKey\}[\s\S]*onChange=\{handleTemplateChange\}/, "UID 발행 화면에서 라벨 템플릿을 선택할 수 있어야 합니다.");
assert.match(page, /setLabelDesign\(ensureObjectLabelDesign\(rawDesign, "jig"\)\)/, "선택된 템플릿의 designData를 공통 출력 렌더러에 전달해야 합니다.");
assert.match(page, /<LabelPrintRenderer ref=\{printRef\} items=\{activePrintItems\} design=\{labelDesign\}/, "UID 발행/재발행 인쇄는 선택된 labelDesign으로 출력해야 합니다.");
