# i18n 하드코딩 → t() 전환 작업 인계 가이드

> 대상: 다른 AI 세션(codex 등)이 남은 하드코딩 한글의 `t()` 전환을 이어받기 위한 절차서.
> 작성: claude, 2026-06-21. 진행 상황은 `.ai-coordination/HANDOFF/claude.md` 참조.

## 0. 현황 (2026-06-21 기준)

- **번역 키 누락은 100% 해결됨.** 전체 `apps/frontend/src/app/(authenticated)` 화면의 모든 `t()` 정적 키가 ko/en/zh/vi 4개 locale에 존재한다. (ko 미존재 0건, 4언어 불일치 0건, 키 수 동일)
- **하드코딩 `t()` 전환은 80개 코드 파일 완료, 잔여 있음.** 14개 병렬 에이전트 중 6개가 세션 한도로 중단되어 담당 모듈 끝부분이 미전환.
- **미완료(코드에 한글 하드코딩이 남은) 모듈**: `master`(labelSources.ts/types.ts 등 상수), `production`(나머지 일부), `quality/aql`·`quality/spc` 잔여, `shipping`, `equipment` 일부. 측정값은 아래 1단계로 직접 확인할 것.

## 1. 핵심 규칙 (반드시 준수)

locale 파일: `apps/frontend/src/locales/{ko,en,zh,vi}.json`

1. **4개 언어(ko/en/zh/vi) 동시 수정.** 한 키를 추가하면 4파일 모두에 추가한다.
2. **EOL은 CRLF.** locale 파일은 CRLF다. 삽입 시 LF가 섞이면 안 된다. 아래 삽입 스크립트는 `replace(/\n/g, "\r\n")`로 CRLF를 보장한다.
3. **BOM 절대 금지.** (Turbopack 빌드 실패) 삽입 후 `charCodeAt(0) !== 0xFEFF` 확인.
4. **재직렬화 안전성**: `JSON.stringify(obj, null, 2) + "\n"`을 CRLF로 변환하면 기존 파일과 **바이트 단위로 동일**하다(검증됨). 따라서 키 추가는 파싱→set→재직렬화 방식이 안전하며 diff가 추가분만 생긴다.
5. 코드 전환은 `t("키", "한글원문")` 형태. **폴백(2번째 인자)에 기존 한글을 반드시** 넣는다. (키가 없어도 한글이 표시되어 회귀가 없다)
6. **키 네임스페이스**: 화면 단위 `<모듈>.<화면camelCase>.<key>`. 기존 키가 있으면 재사용(해당 모듈의 ko.json 블록을 먼저 읽는다). 기존 코드가 쓰던 네임스페이스(`kiosk.*`, `selfInspect.*`, `improvement.*` 등 최상위)가 있으면 그것을 따른다.
7. **`common.*`에 새 키를 만들지 않는다.** 공통 의미라도 모듈 네임스페이스에 만들거나 기존 common 키만 재사용.
8. **`${...}` 템플릿 리터럴 보간**이 폴백에 필요하면 i18next `{{...}}` 보간으로 바꾸고 `t()` 옵션 객체에 변수를 전달한다. (locale에 `${}` 그대로 넣으면 i18next가 보간 못 해 깨진다)
9. 제외 대상: 주석, `console.*`, React 컴포넌트 밖 상수/dead 코드, 변수명, 타입 정의, API 값 비교/파싱 키. **화면에 보이는 텍스트만** 전환.
10. **번역값 톤**: MES UI 번역체(간결한 명사형 라벨). `기본정보`=Basic Info/基本信息/Thông tin cơ bản 처럼 기존 스타일 참고.

## 2. 절차

### 2-1. 측정 (어디에 하드코딩이 남았나)
```bash
node -e '
const fs=require("fs"),path=require("path");
const root="apps/frontend/src/app/(authenticated)";
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const fp=path.join(d,e.name);if(e.isDirectory())w(fp);else if(/\.(tsx?|jsx?)$/.test(e.name))files.push(fp);}})(root);
const hangul=/[가-힣]/; const byMod={}; let total=0;
for(const f of files){const mod=path.relative(root,f).split(path.sep)[0];
  for(const ln of fs.readFileSync(f,"utf8").split("\n")){
    if(!hangul.test(ln))continue;const tr=ln.trim();
    if(tr.startsWith("//")||tr.startsWith("*")||tr.startsWith("/*"))continue;
    if(/\bt\(/.test(ln)||/defaultValue\s*:/.test(ln))continue;
    byMod[mod]=(byMod[mod]||0)+1;total++;}}
console.log("하드코딩 잔여:",total);
Object.entries(byMod).sort((a,b)=>b[1]-a[1]).forEach(([m,c])=>console.log(String(c).padStart(4),m));'
```
> 주의: 이 측정은 과대추정한다(멀티라인 t()의 한글 인자 줄, types.ts 상수, dead 코드 포함). 실제 전환 대상은 파일을 열어 판단한다.

### 2-2. 코드 전환 (병렬 에이전트 권장)
모듈/하위폴더 단위로 에이전트에 분담. 각 에이전트는 **코드(.tsx/.ts)만 수정하고 locale JSON은 건드리지 않으며**, 추가한 키→4언어 번역 매핑을 JSON으로 반환한다. (locale 동시 수정 시 충돌하므로 오케스트레이터가 단독 삽입)

에이전트 프롬프트 템플릿은 위 "1. 핵심 규칙"을 그대로 포함하고, 담당 폴더와 반환 형식을 지정:
```json
{ "keys": {"모듈.화면.key":{"ko":"","en":"","zh":"","vi":""}}, "filesModified":[], "notes":"" }
```

### 2-3. locale 삽입 (오케스트레이터가 단독 수행)
에이전트들이 반환한 keys를 하나의 객체 `ALL`로 병합한 뒤:
```bash
node -e '
const fs=require("fs");
const ALL=JSON.parse(fs.readFileSync("MERGED_KEYS.json","utf8")); // {key:{ko,en,zh,vi}}
for(const k of Object.keys(ALL)) if(/\$\{/.test(ALL[k].ko||"")) delete ALL[k]; // ${} 폴백 제외(코드 {{}} 수정 후 별도)
function setIfAbsent(o,p,v){const s=p.split(".");let c=o;for(let i=0;i<s.length-1;i++){if(!(s[i] in c)||typeof c[s[i]]!=="object"||c[s[i]]===null)c[s[i]]={};c=c[s[i]];}const l=s[s.length-1];if(!(l in c)){c[l]=v;return 1}return 0;}
for(const lang of ["ko","en","zh","vi"]){
  const fp="apps/frontend/src/locales/"+lang+".json";
  const o=JSON.parse(fs.readFileSync(fp,"utf8"));
  let n=0;for(const[p,tr]of Object.entries(ALL))n+=setIfAbsent(o,p,tr[lang]);
  const out=(JSON.stringify(o,null,2)+"\n").replace(/\n/g,"\r\n");
  if(out.charCodeAt(0)===0xFEFF){console.error("BOM!");process.exit(1);}
  fs.writeFileSync(fp,out,"utf8");console.log(lang,"+"+n);}'
```
> 키 경로는 `.`로 split된다. `PRC-CUT`처럼 하이픈 포함 세그먼트는 그대로 한 세그먼트로 처리된다.

### 2-4. 중단/유실된 키 복구 (에이전트가 키를 못 돌려준 경우)
코드에는 `t("key","폴백")`이 적용됐지만 locale에 키가 없는 경우, 코드의 폴백을 추출해 ko값으로 삼는다:
```bash
node -e '
const fs=require("fs"),path=require("path");
const flat=(o,p="",out={})=>{for(const k in o){const v=o[k];const np=p?p+"."+k:k;if(v&&typeof v==="object"&&!Array.isArray(v))flat(v,np,out);else out[np]=v;}return out;};
const ko=flat(JSON.parse(fs.readFileSync("apps/frontend/src/locales/ko.json","utf8")));
const root="apps/frontend/src/app/(authenticated)";
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const fp=path.join(d,e.name);if(e.isDirectory())w(fp);else if(/\.(tsx?|jsx?)$/.test(e.name))files.push(fp);}})(root);
const reA=/\bt\(\s*(["`])([a-zA-Z][a-zA-Z0-9_.-]*?)\1\s*,\s*(["`])((?:[^"`\\]|\\.)*)\3/g;
const fb={};for(const f of files){const t=fs.readFileSync(f,"utf8");let m;while((m=reA.exec(t)))if(!(m[2] in fb))fb[m[2]]=m[4];}
const re=/\bt\(\s*(["`])([a-zA-Z][a-zA-Z0-9_.-]*?)\1/g;const miss=new Set();
for(const f of files){const t=fs.readFileSync(f,"utf8");let m;while((m=re.exec(t))){const k=m[2];if(k.indexOf(".")>=0&&!(k in ko))miss.add(k);}}
const out={};[...miss].sort().forEach(k=>{if(fb[k]&&/[가-힣]/.test(fb[k]))out[k]=fb[k];});
fs.writeFileSync("recovered_fallbacks.json",JSON.stringify(out,null,1),"utf8");
console.log("폴백 추출:",Object.keys(out).length,"/ 전체 미존재:",miss.size);'
```
추출된 `recovered_fallbacks.json`(키→ko폴백)을 en/zh/vi로 번역해 4언어 매핑으로 만든 뒤 2-3 스크립트로 삽입한다.

## 3. 검증 (완료 기준)
```bash
# (a) 전체 t() 정적키 중 ko 미존재 = 0, 4언어 불일치 = 0
node -e '
const fs=require("fs"),path=require("path");
const load=f=>JSON.parse(fs.readFileSync("apps/frontend/src/locales/"+f+".json","utf8"));
const flat=(o,p="",out={})=>{for(const k in o){const v=o[k];const np=p?p+"."+k:k;if(v&&typeof v==="object"&&!Array.isArray(v))flat(v,np,out);else out[np]=v;}return out;};
const ko=flat(load("ko")),en=flat(load("en")),zh=flat(load("zh")),vi=flat(load("vi"));
const root="apps/frontend/src/app/(authenticated)";
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const fp=path.join(d,e.name);if(e.isDirectory())w(fp);else if(/\.(tsx?|jsx?)$/.test(e.name))files.push(fp);}})(root);
const re=/\bt\(\s*(["`])([a-zA-Z][a-zA-Z0-9_.-]*?)\1/g;const miss=new Set();
for(const f of files){const t=fs.readFileSync(f,"utf8");let m;while((m=re.exec(t))){const k=m[2];if(k.indexOf(".")>=0&&!(k in ko))miss.add(k);}}
console.log("ko 미존재:",miss.size,[...miss].slice(0,20));
console.log("4언어 불일치:",Object.keys(ko).filter(k=>!(k in en)||!(k in zh)||!(k in vi)).length);
for(const f of ["ko","en","zh","vi"]){const t=fs.readFileSync("apps/frontend/src/locales/"+f+".json","utf8");console.log(f,"LF단독:",(t.match(/(?<!\r)\n/g)||[]).length,"BOM:",t.charCodeAt(0)===0xFEFF);}'

# (b) 타입체크 (dev 서버 실행 중이면 pnpm build 금지 — tsc만)
pnpm --filter @harness/frontend exec tsc --noEmit
```
완료 기준: ko 미존재 0, 4언어 불일치 0, LF단독 0(전부 CRLF), BOM false, tsc exit 0.

## 4. 주의/함정
- locale 파일이 다른 AI 세션에 의해 점유(active)될 수 있다. 편집 전 `.ai-coordination/LOCKS.md` 확인.
- `pnpm build`는 dev 서버(포트 3002) 실행 중이면 `.next` 캐시를 손상시킨다. 타입 검증은 `tsc --noEmit`만.
- 측정 스크립트의 잔여 수치는 과대추정이다. types.ts 옵션 라벨 상수는 "렌더 컴포넌트에서 t() 적용"이 원칙이나 구조 변경이 과하면 보류하고 notes에 남긴다.
- `common.件`, `common.cases` 같이 카운트 접미사는 en에서 빈 문자열/숫자만이 자연스러울 수 있다.
