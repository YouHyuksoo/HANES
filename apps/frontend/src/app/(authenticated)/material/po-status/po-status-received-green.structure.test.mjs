import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("PO status screen renders RECEIVED status as green even when com code color differs", () => {
  assert.match(
    source,
    /const\s+RECEIVED_STATUS_CLASS\s*=\s*"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"/,
    "RECEIVED 상태 전용 초록 배지 클래스가 필요합니다.",
  );
  assert.match(
    source,
    /const\s+isReceived\s*=\s*s\s*===\s*"RECEIVED"\s*\|\|\s*row\.original\.receiveRate\s*>=\s*100/,
    "좌측 PO현황 상태 배지는 상태코드 RECEIVED뿐 아니라 입고율 100%도 입고완료로 판단해야 합니다.",
  );
  assert.match(
    source,
    /isReceived\s*\?\s*RECEIVED_STATUS_CLASS\s*:\s*poStatusMap\[s\]\?\.attr1/,
    "입고완료 판단 행은 공통코드 attr1 대신 초록 클래스를 우선 적용해야 합니다.",
  );
  assert.match(
    source,
    /isReceived\s*\?\s*poStatusMap\.RECEIVED\?\.codeName\s*\|\|\s*"입고완료"\s*:\s*poStatusMap\[s\]\?\.codeName\s*\|\|\s*s/,
    "입고율 100% 행은 좌측 상태 배지 문구도 입고완료로 표시해야 합니다.",
  );
  assert.match(
    source,
    /rate\s*>=\s*100\s*\?\s*"bg-green-500"\s*:\s*rate\s*>\s*0\s*\?\s*"bg-yellow-500"\s*:\s*"bg-gray-400"/,
    "좌측 입고율 진행바도 100%는 초록, 부분입고는 노랑, 미입고는 회색이어야 합니다.",
  );
  assert.doesNotMatch(
    source,
    /RECEIVED_STATUS_CLASS\s*=\s*"[^"]*(pink|rose|fuchsia)[^"]*"/,
    "RECEIVED 상태 전용 색상은 분홍/장미 계열이면 안 됩니다.",
  );
});
