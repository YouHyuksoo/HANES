import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");

assert.match(page, /const infoCards = useMemo/, "상단 정보카드는 배열 데이터로 구성해 반복 렌더링해야 합니다.");
assert.match(page, /grid-cols-2 sm:grid-cols-5 gap-2/, "정보카드는 반응형 5열 컴팩트 카드 그리드여야 합니다(상태 4종 + 분류 통계).");
assert.match(page, /rounded-lg border px-4 py-3 flex items-center justify-between/, "정보카드는 배지가 아니라 테두리 있는 카드 블록이어야 합니다.");
assert.match(page, /text-2xl font-bold/, "정보카드의 핵심 수치는 크게 보여야 합니다.");
assert.match(page, /data-testid=\{`consumable-life-card-\$\{card\.key\}`\}/, "정보카드는 상태별 테스트 가능한 식별자를 가져야 합니다.");
assert.match(page, /card\.icon/, "정보카드는 상태별 아이콘 영역을 포함해야 합니다.");
assert.match(page, /card\.tone/, "정보카드는 상태별 시각 톤을 분리해야 합니다.");
assert.doesNotMatch(page, /flex gap-2 text-xs flex-shrink-0/, "기존 작은 배지형 정보카드 행은 제거해야 합니다.");
assert.doesNotMatch(page, /inline-flex items-center gap-1 px-2 py-1/, "정보카드는 작은 pill 배지로 렌더링하면 안 됩니다.");

console.log("consumable life large info cards structure ok");
