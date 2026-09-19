import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * 키오스크 헤더 Row1은 고정폭 요소(설비/점검2/전체화면)가 많아 좁은 화면에서 작업지시 칸을 잡아먹는다.
 * 좁아지면 아이콘만 남기고 2xl+ 에서만 라벨/카드를 펼치는 규칙을 회귀 방지로 고정한다.
 */
const repoRoot = resolve(import.meta.dirname, "../../../../../../..");
const headerPath = resolve(
  repoRoot,
  "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx",
);
const checkItemPath = resolve(
  repoRoot,
  "apps/frontend/src/components/inspect/HeaderCheckItem.tsx",
);

const workerSlotPath = resolve(
  repoRoot,
  "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerSlot.tsx",
);

const actionsPath = resolve(
  repoRoot,
  "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipActionButtons.tsx",
);

const header = readFileSync(headerPath, "utf8");
// 설비정지/관리자호출은 헤더에서 우측 하단 컴포넌트로 옮겨졌다(2026-09-19)
const actions = readFileSync(actionsPath, "utf8");
const checkItem = readFileSync(checkItemPath, "utf8");
// 작업자 칸은 3화면 공용 WorkerSlot 으로 빠졌다 — 헤더는 그 컴포넌트를 쓰기만 한다.
const workerSlot = readFileSync(workerSlotPath, "utf8");

test("HeaderCheckItem은 responsiveCompact로 아이콘 모드를 제공한다", () => {
  assert.match(checkItem, /responsiveCompact\?:\s*boolean/);
  assert.match(checkItem, /if \(!responsiveCompact\) return fullCard;/);
  // 좁은 화면 전용 아이콘 버튼과, 2xl+ 에서만 펼치는 원래 카드가 같이 있어야 한다.
  assert.match(checkItem, /2xl:hidden/, "아이콘 버튼은 2xl 미만에서만 보여야 한다");
  assert.match(checkItem, /hidden 2xl:contents/, "원래 카드는 2xl+ 에서만 펼쳐야 한다");
});

test("HeaderCheckItem 아이콘 모드는 상태와 이름을 잃지 않는다", () => {
  // 아이콘만 남아도 완료/미완료는 배지로, 이름과 사유는 title/aria-label로 전달돼야 한다.
  assert.match(checkItem, /const compactTitle = \[label, statusText/);
  assert.match(checkItem, /aria-label=\{compactTitle\}/);
  assert.match(checkItem, /title=\{compactTitle\}/);
});

test("설비일일점검·작업자설비점검 카드는 축약 모드를 켠다", () => {
  const daily = header.slice(header.indexOf('testId="kiosk-daily-inspect-open"'));
  assert.match(daily.slice(0, 200), /responsiveCompact/);
  assert.match(daily.slice(0, 200), /icon=\{ShieldCheck\}/);

  const worker = header.slice(header.indexOf('testId="kiosk-worker-inspect-open"'));
  assert.match(worker.slice(0, 200), /responsiveCompact/);
  assert.match(worker.slice(0, 200), /icon=\{UserCheck\}/);
});

test("설비정지·관리자호출은 헤더가 아니라 우측 하단 EquipActionButtons 에 있고 라벨을 항상 보여 준다", () => {
  // 2026-09-19: 두 버튼을 헤더 Row1에서 우측 컬럼 맨 아래로 옮겼다. 폭을 아낄 필요가 없어 라벨을 접지 않는다.
  assert.doesNotMatch(header, /kiosk-equip-stop-open|kiosk-manager-call-open/, "헤더에는 두 버튼이 남아 있으면 안 된다");
  assert.match(actions, /data-testid="kiosk-equip-actions"/);
  assert.match(actions, /data-testid="kiosk-equip-stop-open"/);
  assert.match(actions, /data-testid="kiosk-manager-call-open"/);
  // 진행중: 빨강/앰버 보더로 상태를 알린다(파스텔 배경 없음)
  assert.match(actions, /\? 'border-red-600 text-red-600/, '설비정지 진행중 보더');
  assert.match(actions, /\? 'border-amber-600 text-amber-600/, '관리자호출 진행중 보더');
  assert.doesNotMatch(actions, /bg-(red|amber)-(50|100)/, '파스텔 배경 금지');
  // 이름은 aria-label 과 항상 보이는 라벨 span 둘 다로 전달된다
  assert.match(actions, /aria-label=\{t\('kiosk\.equipStop\.title', '설비정지'\)\}/);
  assert.match(actions, /aria-label=\{t\('kiosk\.managerCall\.title', '관리자호출'\)\}/);
  assert.match(actions, /<span className="whitespace-nowrap text-sm font-bold">\s*\{isStopped \? t\('kiosk\.equipStop\.stopping'/);
  assert.match(actions, /<span className="whitespace-nowrap text-sm font-bold">\s*\{isCalling \? t\('kiosk\.managerCall\.calling'/);
  assert.doesNotMatch(actions, /hidden 2xl:inline/, '라벨을 접는 축약 모드는 쓰지 않는다');
  // 설비 없으면 두 버튼 모두 잠긴다
  assert.equal((actions.match(/disabled=\{!hasEquip\}/g) ?? []).length, 2);
});

test("작업지시 선택·변경 버튼은 좁은 화면에서 아이콘만 남는다", () => {
  const idx = header.indexOf('data-testid="kiosk-joborder-open"');
  assert.ok(idx > 0, "작업지시 버튼이 있어야 한다");
  const block = header.slice(idx, idx + 2200);
  // 선택됨 → 연필, 미선택 → 돋보기. 둘 다 2xl 미만에서만 아이콘, 2xl+ 에서 라벨 복귀
  assert.match(block, /<Pencil className="h-3\.5 w-3\.5 shrink-0 2xl:hidden" \/>/);
  assert.match(block, /<Search className="h-3\.5 w-3\.5 shrink-0 2xl:hidden" \/>/);
  assert.match(block, /<span className="hidden 2xl:inline">\{t\('common\.change'\)\}<\/span>/);
  assert.match(block, /<span className="hidden 2xl:inline">\{t\('kiosk\.header\.selectJobOrder'\)\}<\/span>/);
  // 유휴 정사각 → 2xl+ 폭 자동
  assert.match(block, /h-7 w-7 shrink-0[\s\S]{0,200}2xl:h-auto 2xl:w-auto 2xl:px-2\.5 2xl:py-1/);
  // 아이콘만 남아도 이름은 aria-label 로 남는다
  assert.match(block, /aria-label=\{t\('common\.change'\)\}/);
  assert.match(block, /aria-label=\{t\('kiosk\.header\.selectJobOrder'\)\}/);
  // 생산유형 배지는 좁은 화면에서 접어 품목명에 폭을 넘긴다
  assert.match(header, /hidden shrink-0 rounded bg-primary\/10[^"]*2xl:inline/);
});
test("작업자추가 버튼은 좁은 화면에서 아이콘만 남는다", () => {
  assert.match(header, /<WorkerSlot workers=\{selectedWorkers\}/, "헤더는 공용 WorkerSlot 을 써야 한다");
  const idx = workerSlot.indexOf('data-testid="kiosk-worker-open"');
  assert.ok(idx > 0, "작업자추가 버튼이 있어야 한다");
  const block = workerSlot.slice(idx, idx + 900);
  // 유휴 상태: h-7 w-7 정사각 → 2xl+ 에서 폭 자동 + 라벨 복귀
  assert.match(block, /h-7 w-7 shrink-0/);
  assert.match(block, /2xl:h-auto 2xl:w-auto 2xl:px-2\.5/);
  assert.match(block, /<span className="hidden 2xl:inline">\{t\('kiosk\.header\.addWorker'\)\}<\/span>/);
  // 아이콘만 남아도 이름은 aria-label/title 로 전달된다
  assert.match(block, /aria-label=\{t\('kiosk\.header\.addWorker'\)\}/);
});

test("작업자 배정 상태는 접혀도 읽힌다", () => {
  // 미배정 경고: 문구만 접고 경고 아이콘은 유지, 문구는 title 로 남긴다
  const warnIdx = workerSlot.indexOf("<AlertTriangle className=\"h-3.5 w-3.5 shrink-0\" />");
  assert.ok(warnIdx > 0, "작업자 미배정 경고가 있어야 한다");
  const warnBlock = workerSlot.slice(warnIdx - 300, warnIdx + 400);
  assert.match(warnBlock, /title=\{t\('kiosk\.header\.workerRequired'\)\}/);
  assert.match(warnBlock, /<span className="hidden 2xl:inline">\{t\('kiosk\.header\.workerRequired'\)\}<\/span>/);
  // 배정된 작업자 이름은 좁은 화면에서 잘리고 title 로 전체 이름을 보장한다
  assert.match(workerSlot, /max-w-\[64px\] truncate 2xl:max-w-none" title=\{w\.workerName\}/);
});

test("진행중 경과시간은 아이콘 옆에 계속 보인다", () => {
  // 현장에서 경과시간이 제일 중요하다 — 정지/호출 중이면 버튼 안에 tabular-nums 타이머를 붙이고 title 에도 싣는다.
  assert.match(actions, /\{isStopped && \([\s\S]{0,120}data-testid="kiosk-header-stop-elapsed"[\s\S]{0,160}tabular-nums[\s\S]{0,80}formatElapsed\(stopElapsed\)/);
  assert.match(actions, /\{isCalling && \([\s\S]{0,160}tabular-nums[\s\S]{0,80}formatElapsed\(callElapsed\)/);
  assert.match(actions, /isStopped \? ` · \$\{formatElapsed\(stopElapsed\)\}` : ''/);
  assert.match(actions, /isCalling \? ` · \$\{formatElapsed\(callElapsed\)\}` : ''/);
});