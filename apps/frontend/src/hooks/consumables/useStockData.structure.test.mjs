import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "useStockData.ts"), "utf8");

assert.match(
  source,
  /api\.get\('\/consumables\/stocks',\s*\{\s*params:\s*\{\s*limit:\s*'5000'\s*\}\s*\}\)/,
  "소모품 재고현황은 배포 서버에서도 충분한 건수를 조회하도록 limit=5000을 전달해야 합니다.",
);

assert.match(
  source,
  /const raw = res\.data\?\.data \?\? res\.data \?\? \[\]/,
  "표준 응답 래퍼의 첫 번째 data 필드를 먼저 풀어야 합니다.",
);

assert.match(
  source,
  /const items = Array\.isArray\(raw\) \? raw : \(raw\?\.data \?\? \[\]\)/,
  "컨트롤러가 반환한 { data: rows }가 전역 인터셉터로 한 번 더 감싸진 응답도 풀어야 합니다.",
);

assert.match(
  source,
  /setRawData\(Array\.isArray\(items\) \? items : \[\]\)/,
  "최종 rows가 배열일 때만 테이블 원본 데이터로 반영해야 합니다.",
);

console.log("consumable stock response parsing structure ok");
