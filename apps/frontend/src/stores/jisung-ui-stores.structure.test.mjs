import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("탭·테마 스토어는 @jisung/ui 것 하나만 쓴다 (HANES 에서 새로 만들지 않는다)", () => {
  for (const name of ["tabStore.ts", "themeStore.ts"]) {
    assert.doesNotMatch(read(name), /\bcreate[<(]/, `${name} 가 zustand 스토어를 따로 만들면 탭/테마 상태가 두 벌이 된다`);
    assert.match(read(name), /from "@jisung\/ui"/);
  }
});

test("HANES 테마 저장 키와 대시보드 고정 탭을 패키지에 넘긴다", () => {
  assert.match(read("themeStore.ts"), /configureThemeStore\(\{ storageKey: "harness-theme" \}\)/);
  assert.match(read("tabStore.ts"), /configureTabStore\(\{/);
  assert.match(read("tabStore.ts"), /path: "\/dashboard"/);
});
