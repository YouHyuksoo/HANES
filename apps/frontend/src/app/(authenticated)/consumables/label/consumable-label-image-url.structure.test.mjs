import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const columns = readFileSync(join(here, "components/ConLabelColumns.tsx"), "utf8");
const renderer = readFileSync(join(root, "apps/frontend/src/app/(authenticated)/master/label/components/LabelDesignRenderer.tsx"), "utf8");
const helper = readFileSync(join(root, "apps/frontend/src/utils/file-url.ts"), "utf8");
const deployWorkflow = readFileSync(join(root, ".github/workflows/deploy.yml"), "utf8");

assert.match(helper, /resolveBackendFileUrl/, "업로드 파일 URL 정규화 helper가 필요합니다.");
assert.match(helper, /startsWith\("\/uploads"\)/, "`/uploads/...` 상대경로를 감지해야 합니다.");
assert.match(helper, /NEXT_PUBLIC_API_URL/, "배포 API base URL 기준으로 정적 파일 URL을 만들어야 합니다.");
assert.match(helper, /\/api\(\?:\\\/v1\)\?/, "`/api` 또는 `/api/v1` 접미사는 정적 파일 base에서 제거해야 합니다.");

assert.match(columns, /resolveBackendFileUrl\(row\.original\.imageUrl\)/, "소모품 라벨 그리드 이미지는 backend file URL로 정규화해야 합니다.");
assert.match(renderer, /resolveBackendFileUrl\(resolveLabelValue/, "라벨 인쇄 렌더러 이미지도 backend file URL로 정규화해야 합니다.");
assert.match(deployWorkflow, /generate-consumable-master-seed-images\.mjs/, "배포 서버에서도 gitignore된 소모품 시드 이미지를 재생성해야 합니다.");
