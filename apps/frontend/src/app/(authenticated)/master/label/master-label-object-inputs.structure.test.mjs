import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const designer = readFileSync(join(here, "components/LabelObjectDesigner.tsx"), "utf8");
const renderer = readFileSync(join(here, "components/LabelDesignRenderer.tsx"), "utf8");

assert.match(designer, /const sourceField = fieldKey \?\? \(type === "barcode" \? field : undefined\)/, "툴바로 추가한 글자/이미지 객체는 기본 소스 필드에 묶이면 안 됩니다.");
assert.match(designer, /sourceField,/, "계산된 sourceField를 라벨 객체에 저장해야 합니다.");
assert.match(designer, /<option value="">\{t\("master\.label\.noSourceField", "고정값 사용"\)\}<\/option>/, "글자/이미지 객체는 소스 필드를 비우고 고정값을 사용할 수 있어야 합니다.");
assert.match(designer, /event\.target\.value \|\| undefined/, "소스 필드 빈 선택은 undefined로 저장해야 합니다.");
assert.match(designer, /TextareaInput[\s\S]*fixedText/, "고정 문구는 짧은 input이 아니라 여러 줄 입력 가능한 컨트롤로 수정해야 합니다.");
assert.match(renderer, /resolveLabelValue\(data, element\.sourceField, element\.text \?\? element\.sourceField \?\? ""\)/, "소스 필드가 비어 있으면 renderer는 element.text를 그대로 사용해야 합니다.");

assert.match(designer, /useRef<HTMLInputElement>\(null\)/, "이미지 업로드용 file input ref가 필요합니다.");
assert.match(designer, /api\.post\("\/master\/label-templates\/upload-image"/, "이미지는 라벨 템플릿 전용 업로드 API로 전송해야 합니다.");
assert.match(designer, /formData\.append\("image", file\)/, "업로드 multipart field 이름은 backend와 같은 image여야 합니다.");
assert.match(designer, /updateElement\(selected\.id, \{ imageUrl: url, sourceField: undefined \}\)/, "업로드 성공 시 imageUrl을 반영하고 소스 필드는 비워야 합니다.");
assert.match(designer, /accept="image\/\*"/, "이미지 업로드 input은 image 파일만 선택해야 합니다.");
assert.match(designer, /resolveBackendFileUrl\(selected\.imageUrl\)/, "업로드된 상대 URL은 백엔드 파일 URL로 미리보기해야 합니다.");

console.log("master label object inputs structure ok");
