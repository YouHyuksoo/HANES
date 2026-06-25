import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const controller = readFileSync(join(here, "label-template.controller.ts"), "utf8");

assert.match(controller, /@Post\('upload-image'\)/, "라벨 템플릿 이미지 업로드 엔드포인트가 필요합니다.");
assert.match(controller, /FileInterceptor\('image'/, "라벨 이미지 업로드 multipart field 이름은 image여야 합니다.");
assert.match(controller, /const uploadPath = '\.\/uploads\/label-templates'/, "라벨 이미지 파일은 label-templates 업로드 폴더에 저장해야 합니다.");
assert.match(controller, /label-image-\$\{uniqueSuffix\}\$\{extname\(file\.originalname\)\}/, "업로드 파일명은 label-image prefix와 원본 확장자를 보존해야 합니다.");
assert.match(controller, /const okByExt = \/\\\.\(jpe\?g\|png\|gif\|webp\|svg\)\$\/i\.test\(file\.originalname\)/, "라벨 이미지는 확장자로도 검증해야 합니다.");
assert.match(controller, /const okByMime = \/\^image\\\/\(jpeg\|png\|gif\|webp\|svg\\\+xml\)\$\/i\.test\(file\.mimetype\)/, "SVG 업로드를 위해 image/svg+xml MIME을 허용해야 합니다.");
assert.match(controller, /if \(!okByExt && !okByMime\)/, "확장자와 MIME 중 하나라도 이미지이면 허용해야 합니다.");
assert.match(controller, /limits:\s*\{\s*fileSize:\s*5 \* 1024 \* 1024\s*\}/, "라벨 이미지 업로드는 5MB로 제한해야 합니다.");
assert.match(controller, /const imageUrl = `\/uploads\/label-templates\/\$\{file\.filename\}`/, "응답 URL은 정적 제공 가능한 /uploads 경로여야 합니다.");
assert.match(controller, /url:\s*imageUrl/, "업로드 응답은 frontend가 사용할 url을 반환해야 합니다.");

console.log("label template upload structure ok");
