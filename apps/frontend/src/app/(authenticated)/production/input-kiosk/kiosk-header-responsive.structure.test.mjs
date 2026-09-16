import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * 키오스크 헤더 Row1은 고정폭 요소(설비/점검2/정지/호출/전체화면)가 많아 좁은 화면에서 작업지시 칸을 잡아먹는다.
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

const header = readFileSync(headerPath, "utf8");
const checkItem = readFileSync(checkItemPath, "utf8");

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

test("설비정지·관리자호출은 평소 아이콘 크기를 유지한다", () => {
  // 헤더 우측 두 버튼은 작업지시/작업자 칸을 밀어내지 않도록 평소 w-11 정사각(전체화면 버튼과 동일 크기)이다.
  // 진행 중일 때만 px 를 열어 경과시간을 함께 보여준다.
  // 진행중: px 를 열어 경과시간을 붙인다 / 유휴: w-11 정사각
  assert.match(header, /\? 'border-red-600 px-2\.5/, '설비정지 진행중은 폭을 연다');
  assert.match(header, /: 'w-11 2xl:w-auto 2xl:px-3 border-border[^']*hover:border-red-500/, '설비정지 유휴는 w-11 정사각');
  assert.match(header, /\? 'border-amber-600 px-2\.5/, '관리자호출 진행중은 폭을 연다');
  assert.match(header, /: 'w-11 2xl:w-auto 2xl:px-3 border-border[^']*hover:border-amber-500/, '관리자호출 유휴는 w-11 정사각');
  // 아이콘만 남으므로 이름은 title/aria-label 로 전달되어야 한다
  assert.match(header, /aria-label=\{t\('kiosk\.equipStop\.title', '설비정지'\)\}/);
  assert.match(header, /aria-label=\{t\('kiosk\.managerCall\.title', '관리자호출'\)\}/);
  assert.match(header, /<span className="hidden whitespace-nowrap text-sm font-bold 2xl:inline">\{t\('kiosk\.equipStop\.title'/);
  assert.match(header, /<span className="hidden whitespace-nowrap text-sm font-bold 2xl:inline">\{t\('kiosk\.managerCall\.title'/);
  assert.match(header, /hidden text-\[11px\] 2xl:block/);
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
  const idx = header.indexOf('data-testid="kiosk-worker-open"');
  assert.ok(idx > 0, "작업자추가 버튼이 있어야 한다");
  const block = header.slice(idx, idx + 900);
  // 유휴 상태: h-7 w-7 정사각 → 2xl+ 에서 폭 자동 + 라벨 복귀
  assert.match(block, /h-7 w-7 shrink-0/);
  assert.match(block, /2xl:h-auto 2xl:w-auto 2xl:px-2\.5/);
  assert.match(block, /<span className="hidden 2xl:inline">\{t\('kiosk\.header\.addWorker'\)\}<\/span>/);
  // 아이콘만 남아도 이름은 aria-label/title 로 전달된다
  assert.match(block, /aria-label=\{t\('kiosk\.header\.addWorker'\)\}/);
});

test("작업자 배정 상태는 접혀도 읽힌다", () => {
  // 미배정 경고: 문구만 접고 경고 아이콘은 유지, 문구는 title 로 남긴다
  const warnIdx = header.indexOf("<AlertTriangle className=\"h-3.5 w-3.5 shrink-0\" />");
  assert.ok(warnIdx > 0, "작업자 미배정 경고가 있어야 한다");
  const warnBlock = header.slice(warnIdx - 300, warnIdx + 400);
  assert.match(warnBlock, /title=\{t\('kiosk\.header\.workerRequired'\)\}/);
  assert.match(warnBlock, /<span className="hidden 2xl:inline">\{t\('kiosk\.header\.workerRequired'\)\}<\/span>/);
  // 배정된 작업자 이름은 좁은 화면에서 잘리고 title 로 전체 이름을 보장한다
  assert.match(header, /max-w-\[64px\] truncate 2xl:max-w-none" title=\{w\.workerName\}/);
});

test("진행중 경과시간은 아이콘 옆에 계속 보인다", () => {
  // 현장에서 경과시간이 제일 중요하다 — 라벨은 접어도 타이머는 접지 않는다.
  assert.match(header, /data-testid="kiosk-header-stop-elapsed"[\s\S]{0,160}tabular-nums/);
  assert.match(header, /isCalling \? \([\s\S]{0,400}tabular-nums/);
});