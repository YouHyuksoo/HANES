import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const renderer = readFileSync(join(here, "components/LabelDesignRenderer.tsx"), "utf8");

assert.match(renderer, /function ShapeStrokeLayer/, "박스/원/선 stroke는 별도 내부 레이어로 렌더링해야 합니다.");
assert.match(renderer, /data-label-shape-stroke/, "출력 PNG 캡처 검증을 위해 stroke 레이어 marker가 필요합니다.");
assert.match(renderer, /boxShadow:\s*`inset 0 0 0 \$\{borderWidth\} \$\{strokeColor\}`/, "박스 stroke는 CSS border 단독이 아니라 inset shadow로 내부에 고정해야 합니다.");
assert.doesNotMatch(renderer, /border:\s*element\.type === "box" \|\| element\.type === "circle"/, "박스/원 outer element의 CSS border는 제거해 foreignObject 캡처 시 edge clipping을 피해야 합니다.");
assert.doesNotMatch(renderer, /borderTop:\s*element\.type === "line"/, "선 객체도 CSS borderTop 대신 stroke 레이어를 사용해야 합니다.");
assert.match(renderer, /<ShapeStrokeLayer[\s\S]*element=\{element\}[\s\S]*unit=\{unit\}[\s\S]*scale=\{scale\}/, "shape 객체는 공통 stroke 레이어를 사용해야 합니다.");
assert.match(renderer, /pointerEvents:\s*"none"/, "stroke 레이어는 드래그/리사이즈 포인터 이벤트를 가로채면 안 됩니다.");
assert.match(renderer, /overflow:\s*element\.type === "box" \|\| element\.type === "circle" \|\| element\.type === "line" \? "visible" : "hidden"/, "shape 객체는 stroke가 가장자리에서 잘리지 않도록 overflow visible이어야 합니다.");

console.log("master label box stroke structure ok");
