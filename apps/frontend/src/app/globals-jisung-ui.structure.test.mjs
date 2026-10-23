import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

test("디자인 토큰은 @jisung/ui 에서 가져오고 직접 정의하지 않는다", () => {
  assert.match(css, /@import "@jisung\/ui\/styles\/tokens\.css";/);
  assert.doesNotMatch(css, /^:root \{/m);
  assert.doesNotMatch(css, /^@theme inline \{/m);
});

test("Tailwind 가 공용 패키지 소스의 클래스를 생성하도록 @source 로 포함한다", () => {
  assert.match(css, /@source "\.\.\/\.\.\/node_modules\/@jisung\/ui\/src";/);
});
