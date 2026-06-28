import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const page = readFileSync(join(here, "page.tsx"), "utf8");
// 점검항목 목록 컬럼 셀은 equipInspectItemColumns.tsx 팩토리로 분리되었다
const columns = readFileSync(join(here, "equipInspectItemColumns.tsx"), "utf8");
const inspectItemImage = readFileSync(join(root, "apps/frontend/src/components/shared/InspectItemImage.tsx"), "utf8");
const helper = readFileSync(join(root, "apps/frontend/src/utils/file-url.ts"), "utf8");
const deployWorkflow = readFileSync(join(root, ".github/workflows/deploy.yml"), "utf8");

assert.match(helper, /resolveBackendFileUrl/, "업로드 파일 URL 정규화 helper가 필요합니다.");
assert.match(helper, /startsWith\("\/uploads"\)/, "`/uploads/...` 상대경로를 감지해야 합니다.");
assert.match(helper, /NEXT_PUBLIC_API_URL/, "배포 API base URL 기준으로 정적 파일 URL을 만들어야 합니다.");

assert.match(page, /import \{ resolveBackendFileUrl \} from "@\/utils\/file-url"/, "점검항목 마스터 페이지는 업로드 URL helper를 사용해야 합니다.");
assert.match(columns, /resolveBackendFileUrl\(getValue\(\) as string \| null\)/, "점검항목 목록 이미지는 backend file URL로 정규화해야 합니다.");
assert.match(page, /resolveBackendFileUrl\(previewUrl\)/, "점검항목 편집 패널 미리보기도 backend file URL로 정규화해야 합니다.");

assert.match(inspectItemImage, /import \{ resolveBackendFileUrl \} from '@\/utils\/file-url'/, "공용 점검항목 이미지 컴포넌트도 helper를 사용해야 합니다.");
assert.match(inspectItemImage, /const src = resolveBackendFileUrl\(imageUrl\)/, "공용 점검항목 이미지는 정규화한 src를 사용해야 합니다.");
assert.match(inspectItemImage, /src=\{src\}/, "썸네일과 확대 이미지가 정규화된 src를 사용해야 합니다.");

assert.match(deployWorkflow, /generate-equip-inspect-item-seed-images\.mjs/, "배포 서버에서도 gitignore된 점검항목 시드 이미지를 재생성해야 합니다.");
