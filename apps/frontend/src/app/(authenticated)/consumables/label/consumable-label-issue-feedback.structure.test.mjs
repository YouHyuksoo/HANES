import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");

assert.match(page, /import toast from "react-hot-toast"/, "UID 발행 흐름은 toast로 발행중/완료/실패 피드백을 표시해야 합니다.");
assert.match(page, /const \[issueStatus, setIssueStatus\]/, "UID 발행 상태는 별도 배너가 아니라 한 줄 상태로 관리해야 합니다.");
assert.match(page, /const \[categoryFilter, setCategoryFilter\]/, "카테고리 고정 필터 값을 상태로 관리해야 합니다.");
assert.match(page, /categoryFilterOptions/, "그리드 상단 카테고리 드롭다운 옵션을 구성해야 합니다.");
assert.match(page, /handleCategoryFilterChange/, "카테고리 필터 변경 시 숨은 선택값이 남지 않도록 처리해야 합니다.");
assert.match(page, /m\.category === categoryFilter/, "카테고리 필터는 그리드 데이터 자체를 고정 필터링해야 합니다.");
assert.match(page, /aria-label="카테고리 필터"[\s\S]*value=\{categoryFilter\}[\s\S]*onChange=\{handleCategoryFilterChange\}/, "카테고리 필터 드롭다운은 그리드 상단 toolbar에 고정 표시되어야 합니다.");
assert.match(page, /role="status"[\s\S]*aria-live="polite"/, "UID 발행 상태는 헤더 액션 영역의 한 줄 라이브 상태로 표시해야 합니다.");
assert.match(page, /toast\.loading\(/, "UID 생성/출력 시작 시 발행중 메시지를 표시해야 합니다.");
assert.match(page, /toast\.success\(/, "UID 발행 완료 시 완료 메시지를 표시해야 합니다.");
assert.match(page, /toast\.error\(/, "UID 0건, 팝업 차단, 예외 상황은 실패 메시지를 표시해야 합니다.");
assert.match(page, /const printWin = window\.open\("", "_blank"\);[\s\S]*created = await createConUids\(\)/, "UID API 대기 전에 사용자 클릭 동기 구간에서 출력창을 먼저 열어야 합니다.");
assert.match(page, /printWin\.document\.write/, "선점한 출력창에 UID 발행 후 라벨 HTML을 주입해야 합니다.");
assert.match(page, /printWin\.close\(\)/, "UID 발행 실패나 출력 준비 실패 시 선점한 출력창을 닫아야 합니다.");
assert.doesNotMatch(page, /document\.createElement\("iframe"\)/, "숨김 iframe 인쇄는 배포 브라우저에서 print 호출이 무시될 수 있어 사용하지 않습니다.");
assert.doesNotMatch(page, /document\.body\.appendChild\(printFrame\)/, "출력용 숨김 iframe을 DOM에 붙이면 안 됩니다.");
assert.doesNotMatch(page, /window\.onload=\(\)=>\{window\.print\(\);window\.close\(\);\}/, "인쇄창을 load 즉시 print+close 하면 실제 출력 다이얼로그가 안 보일 수 있습니다.");
assert.match(page, /const message = err instanceof Error/, "UID 발행 예외는 서버 메시지를 화면 피드백에 사용해야 합니다.");
assert.doesNotMatch(page, /console\.error\("Failed to issue consumable labels:",\s*err\)/, "UID 발행 실패를 AxiosError 객체 그대로 console.error로 출력하면 Next dev overlay가 뜹니다.");
assert.doesNotMatch(page, /setIssueNotice/, "공간을 밀어내는 별도 상태 배너 상태는 사용하지 않아야 합니다.");
assert.doesNotMatch(page, /발행\/출력 상태 배너/, "UID 발행 상태를 별도 배너 영역으로 렌더링하지 않아야 합니다.");
assert.doesNotMatch(page, /생성된 conUid 결과 배너/, "UID 발행 결과를 별도 결과 배너로 렌더링하지 않아야 합니다.");
assert.doesNotMatch(page, /createdUids\.length > 0 && \(/, "발행 UID 목록이 화면 공간을 늘리는 별도 블록으로 표시되면 안 됩니다.");
assert.match(page, /clearCreatedUids\(\);[\s\S]{0,180}fetchData\(\)/, "인쇄 호출 후 생성 UID 목록은 화면에 남기지 않고 내부 상태를 정리해야 합니다.");

console.log("consumable label issue feedback structure ok");
