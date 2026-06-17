import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "useConLabelIssue.ts"), "utf8");

assert.match(source, /api\.post\("\/material\/label-print\/log",\s*\{/);
assert.match(source, /category:\s*"con_uid"/);
assert.match(source, /uidList:\s*conUids/);
assert.doesNotMatch(source, /matUids:\s*conUids/);
assert.match(source, /function getApiErrorMessage/, "API 오류 응답 메시지를 사용자 메시지로 정리해야 합니다.");
assert.match(source, /throw new Error\(getApiErrorMessage\(err\)\)/, "UID 발행 실패는 page.tsx가 피드백 처리하도록 Error로 전달해야 합니다.");
assert.doesNotMatch(source, /console\.error\("Failed to create conUids:",\s*err\)/, "AxiosError 객체를 그대로 console.error로 출력하면 Next dev overlay가 뜹니다.");

console.log("consumable label print log payload structure ok");
