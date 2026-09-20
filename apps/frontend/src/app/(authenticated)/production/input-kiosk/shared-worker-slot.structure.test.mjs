import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * 실적입력 3화면(가공·서브조립·조립)의 작업자 선택은 하나의 UI(WorkerSlot)와 하나의 상태 훅(useEquipWorkers)을 쓴다.
 * - 칩 나열 + 제거 + 미배정 경고가 세 화면에서 같아야 한다.
 * - 추가/제거는 설비 현재 작업자(CURRENT_WORKER_CODES)에 저장되고 설비 복원 시 다시 불러와야 한다.
 */
const base = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(resolve(base, p), "utf8");

// 상태 로직은 hooks/useInputKioskController.ts 로 옮겨졌다(2026-09-20, B 배치와 공유). 페이지+훅을 함께 검사한다.
const kioskPage = read("input-kiosk/page.tsx") + read("input-kiosk/hooks/useInputKioskController.ts");
const header = read("input-kiosk/components/EquipHeader.tsx");
const resultRow = read("input-kiosk/components/AssemblyResultRow.tsx");
const subkitPage = read("subprocess-kitting/page.tsx");
const assemblyPage = read("input-assembly/page.tsx");
const hook = read("input-kiosk/hooks/useEquipWorkers.ts");

test("작업자 칸 UI는 WorkerSlot 하나뿐이다", () => {
  assert.match(header, /import WorkerSlot from '\.\/WorkerSlot'/);
  assert.match(resultRow, /import WorkerSlot from "\.\/WorkerSlot"/);
  // 서브조립·조립은 AssemblyResultRow 를 통해 같은 슬롯을 그린다
  assert.match(subkitPage, /<AssemblyResultRow[\s\S]{0,200}workers=\{selectedWorkers\}/);
  assert.match(assemblyPage, /<AssemblyResultRow[\s\S]{0,200}workers=\{selectedWorkers\}/);
  // 예전 "홍길동 외 2" 요약 버튼은 남기지 않는다
  assert.doesNotMatch(resultRow, /외 \$\{/);
  assert.doesNotMatch(resultRow, /workerNames/);
});

test("세 화면 모두 useEquipWorkers 로 추가·제거·복원한다", () => {
  for (const [name, src] of [["가공", kioskPage], ["서브조립", subkitPage], ["조립", assemblyPage]]) {
    assert.match(src, /useEquipWorkers\(/, `${name}: 훅을 써야 한다`);
    assert.match(src, /restoreWorkers\(/, `${name}: 설비 복원 시 작업자를 다시 불러와야 한다`);
    assert.doesNotMatch(src, /setSelectedWorkers/, `${name}: 스토어 작업자를 직접 쓰지 않는다`);
    assert.doesNotMatch(src, /\/workers`/, `${name}: 저장 API 호출은 훅에만 있다`);
  }
  assert.match(hook, /\/equipment\/equips\/\$\{encodeURIComponent\(equipCode\)\}\/workers/);
  assert.match(hook, /\/master\/workers\/\$\{encodeURIComponent\(code\)\}/);
  // 저장 실패 시 되돌리고 알린다
  assert.match(hook, /setSelectedWorkers\(previous\);[\s\S]{0,80}kiosk\.header\.workerAssignError/);
});
