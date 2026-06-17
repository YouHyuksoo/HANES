import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");
const panel = readFileSync(join(here, "components", "ConLabelDetailPanel.tsx"), "utf8");
const renderer = readFileSync(join(here, "..", "..", "master", "label", "components", "LabelDesignRenderer.tsx"), "utf8");

assert.match(panel, /onReprint: \(instance: InstanceItem\) => void/, "우측 패널은 기존 UID 재발행 콜백을 받아야 합니다.");
assert.match(panel, /onPreview: \(instance: InstanceItem\) => void/, "우측 패널은 기존 UID 미리보기 콜백을 받아야 합니다.");
assert.match(panel, /Printer/, "우측 패널 재발행 버튼은 프린터 아이콘을 사용해야 합니다.");
assert.match(panel, /onClick=\{\(\) => onReprint\(inst\)\}/, "각 기발행 UID 행에서 해당 UID만 재발행해야 합니다.");
assert.match(panel, /onClick=\{\(\) => onPreview\(inst\)\}/, "각 기발행 UID 행에서 해당 UID를 미리볼 수 있어야 합니다.");
assert.match(panel, />\s*미리보기\s*</, "기발행 UID 목록에는 미리보기 버튼이 보여야 합니다.");
assert.match(panel, />\s*재발행\s*</, "기발행 UID 목록에는 재발행 버튼이 보여야 합니다.");
assert.doesNotMatch(panel, /<table[\s\S]*재발행[\s\S]*<\/table>/, "420px 우측 패널에서는 재발행 버튼이 잘릴 수 있는 넓은 테이블 구조를 쓰면 안 됩니다.");
assert.match(panel, /aria-label=\{`\$\{inst\.conUid\} 라벨 재발행`\}/, "재발행 버튼은 UID별 접근 가능한 이름을 가져야 합니다.");
assert.match(panel, /aria-label=\{`\$\{inst\.conUid\} 라벨 미리보기`\}/, "미리보기 버튼은 UID별 접근 가능한 이름을 가져야 합니다.");

assert.match(page, /const \[activePrintItems, setActivePrintItems\]/, "신규 발행과 재발행이 공통 출력 렌더링 상태를 사용해야 합니다.");
assert.match(page, /previewPrintItem/, "재발행 전 미리보기 대상 상태가 있어야 합니다.");
assert.match(page, /handlePreviewLabel/, "기존 UID 미리보기 핸들러가 있어야 합니다.");
assert.match(page, /handleReprintLabel/, "기존 UID 재발행 핸들러가 있어야 합니다.");
assert.match(page, /printAgentPng/, "재발행은 브라우저 인쇄가 아니라 로컬 print-agent로 PNG를 전송해야 합니다.");
assert.match(page, /renderLabelNodeToPngBase64/, "재발행은 렌더링된 라벨 DOM을 PNG base64로 변환해야 합니다.");
assert.match(page, /waitForLabelRenderReady/, "agent 출력 캡처 전에 바코드와 이미지 렌더 완료를 기다려야 합니다.");
assert.match(page, /setActivePrintItems\(\[\{[\s\S]*conUid: instance\.conUid/, "재발행은 새 UID를 만들지 않고 기존 conUid를 출력 데이터로 사용해야 합니다.");
assert.match(page, /await logBrowserPrint\(\[instance\.conUid\]\)/, "재발행도 기존 print log API에 같은 UID로 이력을 남겨야 합니다.");
assert.doesNotMatch(page, /handleReprintLabel[\s\S]{0,600}createConUids\(\)/, "재발행 중에는 신규 UID 채번 API를 호출하면 안 됩니다.");
assert.doesNotMatch(page, /handleReprintLabel[\s\S]*?window\.open[\s\S]*?\}, \[detailMaster/, "재발행은 팝업 기반 웹 인쇄를 열면 안 됩니다.");
assert.doesNotMatch(page, /handleReprintLabel[\s\S]*?window\.print[\s\S]*?\}, \[detailMaster/, "재발행은 브라우저 print dialog를 호출하면 안 됩니다.");
assert.match(page, /<ConLabelDetailPanel[\s\S]*onReprint=\{handleReprintLabel\}/, "상세 패널에 재발행 핸들러를 전달해야 합니다.");
assert.match(page, /<ConLabelDetailPanel[\s\S]*onPreview=\{handlePreviewLabel\}/, "상세 패널에 미리보기 핸들러를 전달해야 합니다.");
assert.match(page, /<Modal[\s\S]*라벨 미리보기[\s\S]*<LabelDesignRenderer/, "미리보기 모달은 실제 라벨 렌더러를 사용해야 합니다.");
assert.match(page, /<LabelPrintRenderer ref=\{printRef\} items=\{activePrintItems\} design=\{labelDesign\}/, "공통 출력 렌더러는 activePrintItems를 사용해야 합니다.");
assert.match(renderer, /data-label-barcode-pending/, "바코드 placeholder는 pending marker를 제공해야 합니다.");
assert.match(renderer, /data-label-barcode-ready/, "완성된 바코드 이미지는 ready marker를 제공해야 합니다.");
assert.match(renderer, /position:\s*"relative"/, "SVG foreignObject PNG 변환 시 라벨 루트 위치 기준은 inline style이어야 합니다.");
assert.match(renderer, /position:\s*"absolute"/, "SVG foreignObject PNG 변환 시 라벨 객체 배치는 inline style이어야 합니다.");
assert.match(renderer, /boxSizing:\s*"border-box"/, "SVG foreignObject PNG 변환 시 라벨 객체 box model은 inline style이어야 합니다.");
assert.match(renderer, /objectFit:\s*"contain"/, "SVG foreignObject PNG 변환 시 바코드 이미지는 inline object-fit으로 잘림 없이 맞춰야 합니다.");

console.log("consumable label reprint structure ok");
