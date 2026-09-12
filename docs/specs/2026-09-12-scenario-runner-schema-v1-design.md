# 설계: 시나리오 규격 schemaVersion 1

작성일: 2026-09-12
상태: 규격 확정 (구현 대기)
상위 계획: `docs/plans/2026-09-11-activity-log-scenario-runner.md` — 본 문서는 그 계획의 **일 2**다.

## 1. 이 문서의 범위와 위치

시나리오 실행기(일 3)와 시나리오 작성 스킬(일 4)이 **같은 어휘를 참조**해야 하므로 규격을 먼저 못 박는다. 구현물이 아니라 문서 산출물이다.

세 소비자가 이 규격을 공유한다.

| 소비자 | 관계 |
|---|---|
| 실행기 `scenario-runner.spec.ts` (일 3) | 이 규격을 **파싱·실행**한다 |
| 작성 스킬 (일 4) | 이 규격대로 **생성**한다 |
| 기존 `ui-test-crud-red` 시나리오 | 이 규격으로 **이관**한다 (2절) |

### 1.1 설계 원칙 — 시나리오는 선언, 로직은 러너

시나리오 JSON은 **선언적**이어야 한다. 루프·조건·필터 같은 제어구조를 JSON에 넣으면 그건 규격이 아니라 **미니 언어**이고, 작성 스킬(AI)이 생성한 결과를 읽어서 검증할 수 없게 된다.

따라서 반복이 필요한 동작은 JSON에 루프 문법을 주는 대신 **러너의 내장 액션**으로 캡슐화한다. 이 원칙이 6.3(`cleanupPrefix`)과 7절(`inspection`)의 근거다.

판정 기준: **액션 하나가 Playwright 호출 또는 HTTP 호출 하나에 1:1로 대응되지 않으면, 그건 내장 액션이어야 한다.**

## 2. 확정된 전제 — 기존 규격 통합

**결정: 기존 `ui-test-crud-red`의 고정 슬롯형 시나리오를 신규 `steps` 배열형으로 이관하고, 규격을 하나로 통일한다.** 리포터가 둘 공존하는 상태를 남기지 않는다.

기존 러너(`~/.codex/skills/ui-test-crud-red/scripts/ui-test-crud-red-runner.mjs`, 389줄)가 실제로 수행하는 기능을 전수 조사해, 신규 규격이 전부 표현 가능한지 대조했다.

| # | 기존 기능 | 위치 | 신규 규격 대응 |
|---|---|---|---|
| M1 | `label:has-text()` → `..` → `input` 폼 입력 | runner:177 | `target.label` — **셀렉터 우선순위에 편입** (5.2) |
| M2 | `input[placeholder*=...]` 검색 입력 | runner:192-194 | `fill` + `target.placeholder` (5.1) — 전용 `search` 액션 불필요 (4.3) |
| M3 | `tr:has-text(...)` → `button` nth 클릭 | runner:204-206 | `target.row` + `target.nthButton` (5.3) |
| M4 | API cleanup — prefix 검색 후 DELETE 반복 | runner:117-133 | `cleanupPrefix` 내장 액션 (6.3) |
| M5 | API 존재 검증 (`apiVerify`) | runner:210-217 | `api` 액션 + `expectApi` (6.4) |
| M6 | 스크린샷 3스코프 (content / viewport / dialog) | runner:162-173 | `screenshot` 액션 + `scope` (4.2) |
| M7 | `{{stamp}}` · `{{reportDate}}` 내장변수, vars 자체 치환 | runner:79-93 | 3.2 내장 변수 |

RED(강제 오류) 검증은 별도 기능으로 두지 않는다. 기존은 `expectedStatus: 409` + `expectedModalText`를 DOM으로 확인했는데, 신규는 이벤트 술어 `expect: { type: 'API_ERROR', status: 409 }` 하나로 대체된다 — 상위 계획 D9의 결과다.

## 3. 최상위 구조

```jsonc
{
  "schemaVersion": 1,
  "id": "subprocess-kitting-basic",        // 파일명과 동일 (e2e/scenarios/<id>.json)
  "title": "서브공정 키팅 기본",
  "startRoute": "/production/subprocess-kitting",
  "dataPolicy": "consumes",                // readonly | consumes | creates
  "reportSlug": "hanes-subprocess-kitting-basic",   // 리포트 파일명 (생략 시 id)
  "vars": {
    "orderNo": "WO2609090279",
    "prefix": "FECRUD",
    "itemCode": "{{prefix}}-{{stamp}}"     // vars끼리 치환 가능 (선언 순서대로 1패스)
  },
  "preconditions": ["당일 설비 점검은 시나리오 스텝에 포함됨"],
  "onFailure": "pause",                    // pause | abort | continue
  "defaultTimeoutMs": 10000,
  "settleMs": 500,                         // expect 없는 스텝의 에러 관찰 시간 (6.2)
  "ignoreErrors": [                        // 이 시나리오와 무관한 배경 에러 (6.2)
    { "pathIncludes": "/monitoring/" }
  ],
  "setup":    [ /* 스텝 배열 — 본 실행 전 (M4 cleanup) */ ],
  "steps":    [ /* 스텝 배열 — 본 실행 */ ],
  "teardown": [ /* 스텝 배열 — 성공·실패 무관 항상 실행 */ ]
}
```

### 3.1 `dataPolicy`

| 값 | 의미 | 러너 동작 |
|---|---|---|
| `readonly` | 조회만 | 쓰기 액션(`api` POST/PUT/DELETE, `cleanupPrefix`) 발견 시 **파싱 단계에서 거부** |
| `consumes` | 기존 유효 데이터를 소모 (SG 라벨 등) | 실행 전 경고 1회. `vars` 갱신 필요 안내 |
| `creates` | 테스트 데이터를 만들고 정리 | `vars.prefix` 필수, `teardown` 필수 |

`creates`는 기존 `ui-test-crud-red`(FECRUD 접두어 생성 후 삭제)의 성격이다. 이관 시 이 값을 쓴다.

### 3.2 내장 변수 (M7)

| 변수 | 값 | 용도 |
|---|---|---|
| `{{stamp}}` | `YYMMDDHHmmss` (실행 시각) | 유니크 키 생성 |
| `{{reportDate}}` | `YYYY-MM-DD` (KST) | 리포트 파일명 |
| `{{runId}}` | `<id>-<stamp>` | 리포트 디렉터리 |

`{{변수}}` 치환은 `value` / `target.*` / `expect.*` / `api.path` 전부에 적용된다. `capture` 액션이 런타임에 넣은 변수도 같은 문법으로 참조한다.

## 4. 액션

### 4.1 액션 목록

| action | 필수 필드 | 동작 |
|---|---|---|
| `goto` | `value`(경로) | 이동. **이동 전 이벤트 버퍼 drain** (계획 2.4) |
| `click` | `target` | 클릭 |
| `fill` | `target`, `value` | 입력 (기존 값 지움) |
| `scan` | `target`, `value` | `fill` + `Enter` — `BarcodeScanInput` 동작과 일치 |
| `press` | `target`, `value`(키명) | 키 입력 |
| `waitForText` | `value` | 텍스트 출현 대기 |
| `capture` | `target`, `as` | 화면 텍스트를 읽어 변수에 저장 (발행 바코드 등) |
| `screenshot` | `as`(파일명), `label` | 증거 캡처 (M6) |
| `api` | `method`, `path` | HTTP 직접 호출 (M5) |
| `cleanupPrefix` | `path`, `prefixField` | 접두어 테스트 데이터 일괄 삭제 — 내장 (M4, 6.3) |
| `inspection` | `value`(`DAILY`\|`WORKER`) | 점검 인터록 전용 내장 (7절) |
| `waitMs` | `value`(ms) | 고정 대기 — **최후 수단**, `note`에 이유 필수 |
| `pause` | — | 관람자 개입 대기 |

모든 액션 공통 옵션: `note`(사람용 설명, 리포트 스텝 문구), `expect`, `alreadyDone`, `timeoutMs`, `optional`, `ignoreErrors`(스텝 한정 추가).

`optional: true`인 스텝은 실패해도 시나리오를 중단하지 않고 `SKIPPED`로 기록한다. `setup`의 cleanup처럼 "없으면 없는 대로 진행"이 정상인 스텝에 쓴다.

### 4.2 `screenshot` (M6)

```jsonc
{ "action": "screenshot", "as": "03-created.png", "label": "03. 등록 후 검색 결과", "scope": "content" }
```

| `scope` | 대상 | 기존 대응 |
|---|---|---|
| `content` (기본) | `main > div.flex-1` 작업영역 | runner:159 |
| `viewport` | 보이는 화면 전체 | 에러 모달 캡처 |
| `dialog` | `role=dialog` 첫 요소 | 확인 모달 캡처 |

스크린샷은 **증거**이지 판정 근거가 아니다. 판정은 이벤트 술어만 쓴다 (계획 D9).

### 4.3 전용 `search` 액션을 두지 않는 이유

기존 러너 `runner:192-194`는 `input[placeholder*="검색"]`에 `.fill()`만 하고, 그 뒤로 Enter를 누르거나 버튼을 클릭하지 않는다. 바로 `waitForText`로 넘어간다. 즉 **HANES 검색은 타이핑 디바운스 방식이고 submit 방식이 아니다.**

따라서 `fill` + `expect`로 충분하며, `search`는 액션을 하나 늘리는 대신 아무것도 얻지 못한다.

```jsonc
{ "action": "fill", "target": { "placeholder": "검색" }, "value": "{{itemCode}}",
  "expect": { "type": "API_CALL", "method": "GET", "pathIncludes": "/master/parts", "status": 200 } }
```

## 5. 셀렉터 (`target`)

### 5.1 해석 우선순위

`target` 객체에 여러 키가 있으면 아래 순서로 처음 해석되는 것을 쓴다. 로케일은 ko-KR 고정.

```
1. testId       → getByTestId
2. role + name  → getByRole(role, { name, exact: true })
3. label        → label:has-text(...) 의 형제 input/textarea   ← M1, 신규 편입
4. ariaLabel    → getByLabel
5. placeholder  → input[placeholder*=...]  (부분 일치)
6. text         → getByText(..., { exact: false })
```

### 5.2 `label`을 3순위로 편입한 근거

기존 러너가 `label`을 쓰는 이유는 HANES 폼 컴포넌트가 **`aria-label`이 아니라 가시 `<label>` 텍스트**로 필드를 식별하기 때문이다 (`runner:177`이 `label:has-text()` → `..` → `input`으로 올라간다). 이관 대상 시나리오의 모든 `create.fields` / `update.fields`가 이 방식이다.

`ariaLabel`보다 앞에 두는 이유: `label`은 화면에 보이는 문구라 작성 스킬이 소스에서 확실하게 추출할 수 있고, `aria-label`은 일부 컴포넌트에만 있다. 반대로 `testId`·`role`을 `label`보다 앞에 두는 이유는 i18n 문구 변경에 깨지지 않기 때문이다.

**작성 규칙**: 가능하면 `testId` → `role`+`name`을 쓰고, 폼 필드에서만 `label`을 쓴다.

### 5.3 행 스코프 (M3)

```jsonc
{ "action": "click",
  "target": { "row": "{{itemCode}}", "nthButton": 1 },
  "note": "행 삭제 버튼" }
```

- `row`: `tr` 중 해당 텍스트를 포함하는 첫 행 (`locator('tr', { hasText })`)
- 행 안에서 다시 `testId` / `role`+`name` / `nthButton` 중 하나로 대상을 고른다
- `nthButton`은 **0-based 버튼 인덱스**다. 순서 의존이라 취약하므로 `testId`나 `role`+`name`이 가능하면 그쪽을 쓴다. 기존 `rowActionIndex`가 이 값으로 이관된다

## 6. 판정

### 6.1 `expect` / `alreadyDone` 술어

DOM이 아니라 **인페이지 이벤트 링버퍼**(`window.__HANES_ACTIVITY__`)에 대한 술어다. 필드가 여러 개면 AND다.

| 필드 | 의미 |
|---|---|
| `type` | `TOAST_SUCCESS` \| `TOAST_ERROR` \| `API_CALL` \| `API_ERROR` \| `JS_ERROR` \| `SCAN` \| `PAGE_ACCESS` |
| `messageIncludes` | 메시지 부분 일치 |
| `status` | HTTP 상태 정확 일치 |
| `method` | `GET` \| `POST` \| `PUT` \| `PATCH` \| `DELETE` |
| `pathIncludes` | API 경로 부분 일치 |
| `errorCode` | 백엔드 `HttpExceptionFilter`의 `errorCode` 정확 일치 |

### 6.2 에러 귀속 규칙 — 규격의 핵심

**문제**: 스텝 실행 중 도착한 `API_ERROR`가 그 스텝 때문인지 알 수 없다. HANES에는 배경 폴링(모니터링 보드), `suppressErrorModal`로 컴포넌트가 인라인 처리하고 복구하는 호출이 있다. "에러 이벤트가 오면 즉시 실패"로 두면 **무관한 배경 에러 하나에 정상 스텝이 실패**하고, 첫 실기 시나리오가 고장난 것처럼 보인다.

**규칙**: 에러를 즉시 실패로 쓰지 않고 **후보로 모은 뒤, `expect` 충족이 이기게** 한다.

```
스텝 실행 후:
  candidateErrors = []
  loop (100ms 간격, timeoutMs 까지):
      버퍼 drain → 이벤트 누적
      ignoreErrors 에 매칭되는 에러는 폐기 (판정·후보 모두 제외, events 에는 남김)
      alreadyDone 일치        -> ALREADY_DONE 확정, 종료
      expect 일치             -> PASS 확정, 종료   ← 에러가 이미 와 있어도 expect 가 이긴다
      남은 에러 이벤트         -> candidateErrors 에 적재 (계속 대기, 조기 실패 안 함)

  타임아웃 시:
      candidateErrors 있음    -> FAIL (첫 에러를 원인으로 기록)
      expect 있음             -> FAIL (타임아웃)
      expect 없음             -> PASS
```

**`expect`가 없는 스텝**(순수 조작)은 즉시 PASS로 확정하지 않고 `settleMs`(기본 500ms)만큼 에러를 관찰한 뒤 확정한다. 이 창에서 에러가 오면 FAIL이다. 이게 없으면 클릭 직후 터지는 에러를 놓친다.

**러너 기본 무시 목록** (시나리오가 적지 않아도 항상 제외):
- `POST /system/activity-logs` — 수집기 자신 (계획 2.3)

**감수하는 대가**: 진짜 실패도 `timeoutMs`(기본 10s)를 기다린다. 조기 실패의 속도를 버리고 오판을 없앤 것이다. 실패 스텝이 드물므로 총 실행시간 영향은 작다.

**`expect`가 이기게 한 이유**: 성공 토스트와 무관한 배경 에러가 같은 창에 들어오는 일은 흔하지만, 그 반대(스텝이 실제로 실패했는데 `expect`가 일치)는 술어를 그 스텝의 성공 신호로 써야만 가능하다. 따라서 `expect`는 구체적으로 쓴다 — `{type:'TOAST_SUCCESS'}`만 쓰지 말고 `messageIncludes`나 `pathIncludes`를 함께 준다.

### 6.3 `cleanupPrefix` 내장 액션 (M4)

접두어 테스트 데이터 정리는 "목록 조회 → 접두어 필터 → 건별 DELETE"라 본질적으로 루프다. 1.1 원칙에 따라 JSON에 루프 문법을 주지 않고 **러너 내장 액션 하나**로 캡슐화한다.

```jsonc
{ "action": "cleanupPrefix",
  "path": "/master/parts",        // 목록 GET · 건별 DELETE 의 기준 경로
  "listPath": "data",             // 응답에서 목록을 꺼낼 키 (기본 "data")
  "prefixField": "itemCode",      // 이 필드가 vars.prefix 로 시작하는 행만 삭제
  "optional": true,
  "note": "이전 실행의 잔여 테스트 데이터 정리" }
```

러너 동작: `GET {path}?search={{prefix}}&limit=100` → `listPath` 목록에서 `prefixField`가 `{{prefix}}`로 시작하는 행만 → `DELETE {path}/{그 행의 prefixField 값}`. 개별 삭제 실패는 무시하고 계속하며, 삭제 건수를 리포트에 남긴다.

`vars.prefix`가 없으면 파싱 단계에서 거부한다 — 접두어 없는 일괄 삭제는 사고다.

### 6.4 `api` 액션과 `expectApi` (M5)

`api`는 화면을 거치지 않는 직접 호출이라 인페이지 이벤트를 만들지 않는다. 따라서 **자기 응답으로 판정**하며 전용 술어 `expectApi`를 쓴다. 6.2의 에러 귀속 규칙은 적용되지 않는다.

```jsonc
{ "action": "api", "method": "GET", "path": "/master/parts?search={{itemCode}}&limit=20",
  "expectApi": { "status": 200, "listPath": "data",
                 "notContains": { "itemCode": "{{itemCode}}" } },
  "note": "삭제 검증: API 목록에 없어야 한다" }
```

| `expectApi` 필드 | 의미 |
|---|---|
| `status` | HTTP 상태 |
| `listPath` | 응답 본문에서 목록을 꺼낼 경로 (`data`) |
| `contains` / `notContains` | 목록에 해당 필드=값 항목이 있어야 / 없어야 함 |

**`api` 액션은 `dataPolicy: readonly`에서 GET만 허용한다.** 쓰기 메서드가 있으면 파싱 단계에서 거부한다 (3.1).

## 7. `inspection` 내장 액션 (점검 인터록)

설비 일상점검·작업자 설비점검은 모든 생산 시나리오의 공통 선행 조건이고, "이미 완료"가 정상 결과다(계획 D11). 스텝 10여 개로 풀어쓰면 모든 시나리오가 같은 블록을 복사하므로 내장 액션으로 감싼다 (1.1 원칙).

```jsonc
{ "action": "inspection", "value": "DAILY", "note": "설비 일상점검" }
```

러너 동작:

1. 해당 점검 배지가 **`완료(합격)`** 이면 → `ALREADY_DONE` 기록하고 다음 스텝
2. 아니면 입력 버튼을 눌러 모달을 열고, **선택형 항목을 전부 합격으로** 지정한 뒤 저장
3. 저장 후 배지가 `완료(불합격)`이면 → `FAIL`

### 7.1 3번이 실제로 발생하는 유일한 경로

2번에서 선택형 항목을 전부 합격으로 넣으면 `anyFail`은 false이고 종합판정은 `PASS`로 저장된다. 그럼 3번은 죽은 분기처럼 보이는데, **한 경우에만 발생한다**: 측정형(MEASURE) 항목이다.

`DailyInspectModal.tsx:60-66`이 측정값을 LSL/USL과 비교해 **자동 판정**한다. 러너는 측정값을 "선택"으로 합격시킬 수 없고, 설비 실측값이 규격을 벗어나 있으면 자동으로 FAIL이 된다.

이때 시나리오가 자동으로 뚫는 것은 **금지**다. 종합판정 불합격은 설비를 조치하고 사람이 재점검해야 하는 상태이고(2026-09-12 인터록 수정 `947a8938`), 러너가 측정값을 조작해 통과시키면 인터록 자체가 무의미해진다. 따라서 `FAIL`로 세우고 `onFailure`에 맡긴다.

배지 문구가 `완료` 여부가 아니라 `완료(합격)` / `완료(불합격)`인 것도 같은 수정의 결과다 — 러너도 완료 여부가 아니라 판정을 읽어야 한다.

## 8. 리포트

```
docs/reports/<reportSlug>-<reportDate>/          # 스크린샷
docs/reports/<reportSlug>-<reportDate>.html      # 단일 HTML 리포트
docs/reports/<reportSlug>-<reportDate>.json      # 기계 판독용 결과
```

```jsonc
{
  "id": "...", "runId": "...", "startedAt": "...", "finishedAt": "...",
  "verdict": "PASS" | "FAIL",
  "vars": { /* 치환 후 최종 값 — 다음 실행 시 재조회 대상 판별용 */ },
  "steps": [
    { "index": 0, "action": "scan", "note": "...",
      "verdict": "PASS" | "ALREADY_DONE" | "FAIL" | "SKIPPED",
      "events": [ /* 그 스텝에서 drain된 이벤트 원본 (무시된 에러 포함, 무시 표시) */ ],
      "candidateErrors": [ /* 판정에 쓰인 에러 후보 */ ],
      "screenshots": ["03-created.png"],
      "error": null }
  ],
  "serverLogs": [ /* 실행 후 GET /system/activity-logs 조회 결과 — 대조용 */ ]
}
```

스텝별 `events`를 그대로 싣는 게 이 리포트의 핵심이다. 실패 원인이 "빨간 토스트가 떴다"가 아니라 `{type:'API_ERROR', status:409, path:'/production/...', errorCode:'HTTP_409'}`로 남는다. 무시된 에러도 표시해 남기는데, `ignoreErrors`가 과하게 넓어 진짜 실패를 삼키고 있는지 사람이 검토할 수 있어야 하기 때문이다.

`verdict: PASS`의 의미는 **"이 시나리오에 적힌 스텝이 통과했다"**이지 화면 전체 커버리지가 아니다 (기존 `ui-test-crud-red` 규칙 승계).

## 9. 이관 대조표 — `master-part` 시나리오

| 기존 키 | 신규 위치 |
|---|---|
| `id`, `title`, `route` | `id`, `title`, `startRoute` |
| `reportSlug` | `reportSlug` |
| `testData.prefix` / `.values` | `vars` (`{{stamp}}` 내장변수 사용) |
| `testData.primaryKey` | 삭제 — 각 스텝이 값을 명시 참조 |
| `cleanup.*` (5개 키) | `setup`의 `cleanupPrefix` 1개 (6.3) |
| `search.placeholderIncludes` / `.value` | `fill` + `target.placeholder` (4.3) |
| `create.openButton` / `.submitButton` / `.cancelButton` | `click` 액션들 |
| `create.fields[]` | `fill` 액션들 (`target.label`) |
| `create.waitForText` | `waitForText` 또는 `expect` |
| `create.stepText` | `note` |
| `red.kind: duplicate-create` | 동일 값 재입력 스텝들 (특수 처리 없음) |
| `red.expectedStatus: 409` | `expect: { type: 'API_ERROR', status: 409 }` |
| `red.expectedModalText` | 삭제 — 이벤트로 판정하므로 불필요 |
| `red.closeButton` | `click` (모달 닫기 = 조작) |
| `update.rowActionIndex` | `target.row` + `target.nthButton` |
| `delete.confirmButton` | `click` |
| `apiVerify.*` | `api` + `expectApi` (6.4) |
| `captures.*` | 각 `screenshot`의 `label` |

`dataPolicy`는 `creates`로 둔다.

**주의**: RED 스텝(중복 등록)은 `expect`가 `API_ERROR`다. 6.2 규칙에서 에러는 후보로 모이지만, 여기서는 `expect`가 그 에러와 일치하므로 **PASS로 확정된다**. 즉 "의도한 에러"는 `expect`에 적으면 성공이 되고, 적지 않은 에러만 실패 후보가 된다 — 규칙이 자연스럽게 두 경우를 구분한다.

## 10. 검증 규칙 (러너 파싱 단계)

시나리오 JSON을 읽는 즉시 검사하고, 위반이면 실행 전 거부한다. 작성 스킬(일 4)의 자동 검증이 이 규칙을 재사용한다.

1. `schemaVersion === 1`
2. `id`가 파일명과 일치
3. 모든 `target`에 해석 가능한 키가 최소 1개
4. `dataPolicy: readonly`인데 쓰기 `api` 또는 `cleanupPrefix`가 있으면 거부
5. `dataPolicy: creates`인데 `vars.prefix` 또는 `teardown`이 없으면 거부
6. `cleanupPrefix`가 있는데 `vars.prefix`가 없으면 거부 (6.3)
7. `{{변수}}`가 `vars` / 내장변수 / 앞선 `capture`의 `as` 중 하나로 해석되는지 — 미해석 변수는 거부
8. `waitMs`에 `note`가 없으면 거부 (고정 대기 남용 방지)
9. `expect`가 `{ type }` 단독이면 경고 — 6.2에 따라 술어가 느슨하면 오판 위험이 커진다

## 11. 열린 항목

| # | 항목 | 해소 시점 |
|---|---|---|
| O1 | ~~`page.pause()` 중 사용자가 페이지를 직접 조작할 수 있는지~~ — **해소(2026-09-12)**: headed 스파이크로 확인. 일시정지 중 브라우저 화면에서 **클릭·입력이 정상 동작**한다. `onFailure: pause`와 `pause` 액션을 설계 그대로 확정한다 | 완료 |
| O2 | 인증 방식 — 기존 러너는 `localStorage`에 토큰·user 직접 주입, 신규는 `auth.setup.ts` 세션 재사용. 두 경로가 같은 권한을 주는지 대조 | 일 3 |
| O3 | ~~`search` 액션의 검색 실행 방법~~ — **해소(2026-09-12)**: 기존 러너가 `fill` 후 아무 submit도 하지 않으므로 디바운스 방식으로 확정, `search` 액션 폐기 (4.3) | 완료 |
| O4 | `ignoreErrors` 기본값에 넣어야 할 배경 폴링 경로 목록 — 첫 실기 실행에서 실제로 잡히는 것을 보고 채운다 | 일 3 첫 실행 후 |
