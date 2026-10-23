/**
 * @file scripts/gen-page-registry.mjs
 * @description (authenticated) 영역의 모든 page.tsx를 스캔해 경로→lazy 동적 import 레지스트리를 생성한다.
 *
 * 생성기 본체는 공용 UI 패키지(@jisung/ui/scripts/gen-page-registry.mjs)로 옮겨졌다.
 * 이 파일은 HANES 경로를 넘기는 래퍼다. 생성 결과는 옮기기 전과 바이트 단위로 같다.
 *
 * 사용: `node scripts/gen-page-registry.mjs` (페이지 추가/삭제 후 재실행)
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(FRONTEND_ROOT, "package.json"));
const generator = require.resolve("@jisung/ui/scripts/gen-page-registry");

const result = spawnSync(
  process.execPath,
  [
    generator,
    "--root", FRONTEND_ROOT,
    "--pages", "src/app/(authenticated)",
    "--out", "src/components/layout/pageRegistry.generated.ts",
    "--command", "node scripts/gen-page-registry.mjs",
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
