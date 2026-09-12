# 계획: 활동 이벤트 수집기 + 시나리오 실행기

작성일: 2026-09-11 (2026-09-12 전면 개정 — 판정 채널 구조 교정)
상태: 구현 대기

## 1. 배경

서브공정 키팅 화면 테스트용 바코드 데이터 제공에서 출발했다. "시나리오를 미리 정의해 두면 실행기가 화면을 자동 조작하며 진행하고, 사용자는 관람하다가 문제 시 개입한다"는 요구를 grill-me 방식으로 구체화했고, 그 과정에서 실행기의 판정 근거가 되는 **수집기를 시스템 기본 기능으로 먼저 만든다**는 결론에 도달했다.

개정 사유: 초판은 실행기가 토스트/모달을 DOM으로 감시해 판정하는 구조였다. 이는 잘못이다 — 아래 2절이 교정된 구조다.

## 2. 핵심 아키텍처 (이 문서에서 가장 중요한 절)

### 2.1 원칙: DOM은 조작, 이벤트는 판정

| 역할 | 수단 | 이유 |
|---|---|---|
| 클릭·입력·스캔·이동 | DOM (Playwright locator) | 조작은 DOM 외 수단이 없다 |
| 성공 / 이미 진행됨 / 실패 판정 | **구조화된 이벤트** | 토스트는 4초 뒤 사라지고, 스크린샷은 기계 판정이 불가능하다 |

토스트를 캡처로 확인하는 방식은 금지한다. 판정은 `type: 'API_ERROR', status: 409` 같은 구조화된 객체로만 한다.

### 2.2 이중 채널 — 판정은 서버 로그로 하지 않는다

수집기는 한 이벤트를 **두 곳에** 흘린다.

```
수집 지점 (토스트 래퍼 / axios 인터셉터 / window.onerror / BarcodeScanInput)
      |
      +--> [채널 A] POST /system/activity-logs   -- 서버 저장. 조회화면·감사·사후 리포트첨부용.
      |                                             SYS_CONFIGS 설정으로 on/off. fire-and-forget.
      |
      +--> [채널 B] window.__HANES_ACTIVITY__    -- 인페이지 링버퍼. 항상 전량. 설정 무관.
                                                    실행기 전용 판정 채널.
```

**채널 B가 판정 채널이다.** 서버 로그(채널 A)로 스텝을 판정하면 세 가지가 깨진다.

1. 전송이 fire-and-forget이라 조용히 유실될 수 있다 — 판정 근거로 부적격
2. DB 커밋까지 대기해야 하는 레이스가 생긴다
3. 판정이 `ENABLE_ACTIVITY_LOG` / `ACTIVITY_LOG_COLLECT_ALL` 설정에 종속된다

채널 B는 이 셋을 동시에 해소한다. 부수 효과로 `RUN_ID` / `STEP_SEQ` 같은 상관관계 컬럼이 **불필요**해진다 — 실행기가 스텝마다 버퍼를 비우므로 이벤트가 스텝 경계로 자연 분리된다.

### 2.3 링버퍼 규격

```ts
// apps/frontend/src/services/activity-collector.ts (신규)
export interface ActivityEvent {
  ts: number;                    // Date.now()
  type: ActivityEventType;       // TOAST_ERROR | TOAST_SUCCESS | API_ERROR | API_CALL
                                 //  | JS_ERROR | SCAN | PAGE_ACCESS
  message?: string;              // 토스트 본문 / 에러 메시지
  method?: string;               // GET | POST | ...
  path?: string;                 // /production/subprocess-kitting/issue
  status?: number;               // HTTP 상태
  errorCode?: string;            // 백엔드 HttpExceptionFilter의 errorCode
  pagePath?: string;
  value?: string;                // SCAN 값
}

declare global {
  interface Window { __HANES_ACTIVITY__?: ActivityEvent[] }
}
```

- 상한 500건, 초과 시 앞에서 버린다 (메모리 누수 방지)
- 모듈 로드 시 `window.__HANES_ACTIVITY__ ??= []`
- **설정과 무관하게 항상 push**한다. 설정은 채널 A(전송)만 제어한다
- 로그 전송 API(`POST /system/activity-logs`) 자신은 양쪽 채널 모두에서 제외 (무한 루프 방지)

### 2.4 실행기의 스텝 판정 루프

```
for each step:
  1. DOM 조작 실행 (click / fill / scan / goto ...)
  2. 이벤트 대기: 100ms 간격으로 버퍼를 폴링하며
       - expect 술어 일치      -> 성공, 즉시 종료
       - alreadyDone 술어 일치 -> "이미 진행됨", 즉시 종료
       - 에러 이벤트 도착      -> 실패, 즉시 종료 (조기 실패)
       - 타임아웃(기본 10s)    -> expect가 있으면 실패 / 없으면 성공
  3. 버퍼 drain -> 스텝 결과에 첨부
```

- API 응답은 비동기로 도착하므로 **단순 drain이 아니라 폴링 대기**여야 한다. 조작 직후 한 번 읽으면 아직 비어 있다
- `expect`가 없는 순수 조작 스텝은 에러 이벤트만 없으면 성공
- **`goto` / 리로드는 `window`를 날린다. 반드시 이동 *전에* drain한다.** 이걸 놓치면 첫 화면전환 시나리오에서 증거가 조용히 사라진다

### 2.5 서버 로그(채널 A)가 계속 하는 일

판정에서 빠질 뿐 역할이 줄지 않는다: 조회 화면(4.5), 감사 추적, 실행 종료 후 리포트 첨부(운영자가 나중에 조회), 사람이 쓰는 평상시 에러 추적.

## 3. 결정 사항

| # | 결정 | 내용 |
|---|---|---|
| D1 | 작업 분리 | 일1 수집기 / 일2 규격확정 / 일3 실행기 / 일4 작성스킬 — 4단계 |
| D2 | 전송 범위 | 에러 3종은 **필수**. 성공 토스트·스캔·API 호출은 **설정 on/off**. 클릭·키입력은 수집 안 함 |
| D3 | 버퍼 범위 | 링버퍼는 **설정 무관 항상 전량**. (초판의 "시나리오 모드 플래그"는 폐기 — 불필요해짐) |
| D4 | 저장 | 기존 `ACTIVITY_LOGS` 재사용 + `MESSAGE` 컬럼 추가. 새 테이블 없음 |
| D5 | 조회 | 시스템관리 카테고리에 조회 화면 신설 (`/system/activity-logs`) |
| D6 | 보관 | 7일. 기존 `SCHEDULER_JOBS` 방식으로 정리 잡 추가 |
| D7 | 실행기 | Playwright 기반. JSON 시나리오 파싱 후 절차대로 실행. 인앱 러너 아님 |
| D8 | 실행 모드 | 관람형 / 리포트형 — 실행 시 선택 |
| D9 | **판정 근거** | **인페이지 이벤트 링버퍼(2.2 채널 B). DOM 토스트 감시·스크린샷 판정 금지** |
| D10 | 시나리오 데이터 | AI가 작성 시점에 DB를 조회해 실제 유효 데이터를 채운 완성형 JSON 생성. 실행기는 DB 미접속 |
| D11 | 스텝 판정 | 성공 / 이미 진행됨 / 실패 3종. "이미 진행됨"은 **추론하지 않고 `alreadyDone` 전용 술어로 명시** |
| D12 | 중단 잔여 데이터 | 발행만 되고 확정 안 된 라벨(ISSUED)은 "확정 대기" 정상 상태이므로 teardown하지 않음 |
| D13 | ACTOR_KIND | 서버 로그의 HUMAN/SCENARIO **구분 표시용**. 수집 게이팅에는 사용하지 않음 (D3으로 불필요해짐) |
| D14 | 스킬 경계 | 신규 스킬은 **작성 전용**. 실행/QA는 기존 `hanes-page-scenario-qa` 담당 (7절) |

## 4. 일 1: 활동 이벤트 수집기

### 4.1 수집 지점

| 이벤트 | type | 수집 지점 | 채널A 전송 |
|---|---|---|---|
| 실패 토스트 | `TOAST_ERROR` | react-hot-toast 래퍼 (신규) | 필수 |
| API 실패 응답 | `API_ERROR` | `services/api.ts` 응답 인터셉터 (에러 분기) | 필수 |
| 프론트 JS 에러 | `JS_ERROR` | `window.onerror` + `unhandledrejection` | 필수 |
| 성공 토스트 | `TOAST_SUCCESS` | 동일 래퍼 | 옵션 |
| 스캔 값 | `SCAN` | `BarcodeScanInput` (모든 스캔의 중앙 병목) | 옵션 |
| API 호출(성공 포함) | `API_CALL` | 동일 인터셉터 (성공 분기) | 옵션 |
| 페이지 접속 | `PAGE_ACCESS` | 기존 `useActivityLogger` | 기존 유지 |

**채널 B(링버퍼)는 위 전부를 예외 없이 받는다.** "필수/옵션"은 채널 A에만 적용된다.

`services/api.ts`의 응답 인터셉터는 이미 성공 토스트 자동 발화(`skipSuccessToast`)와 에러 상세 모달(`suppressErrorModal`), `errorCode` 추출을 중앙에서 처리한다 — 수집 훅을 여기 한 곳에 붙이면 API 계열 3종이 모두 커버된다.

### 4.2 설정 키 (SYS_CONFIGS)

| 키 | 값 | 기본 | 적용 대상 |
|---|---|---|---|
| `ENABLE_ACTIVITY_LOG` | Y/N | 기존 | 채널 A 마스터. 단 **에러 3종은 N이어도 항상 전송** |
| `ACTIVITY_LOG_COLLECT_ALL` | Y/N | N | Y면 성공 토스트·스캔·API 호출까지 채널 A 전송 |

> **[초판 누락 — 반드시 반영]** 프론트가 이미 게이팅한다. `apps/frontend/src/hooks/useActivityLogger.ts:41`에서 `sysConfigStore.isEnabled('ENABLE_ACTIVITY_LOG')`로 **전송 자체를 막는다.** 따라서 "에러 3종은 설정 무관 저장"을 백엔드에만 구현하면 무의미하다. 프론트 수집기도 에러 3종에 한해 이 게이트를 우회해야 한다.

### 4.3 DB 변경 (마이그레이션 SQL)

1. `ACTIVITY_LOGS` 컬럼 추가
   - `MESSAGE VARCHAR2(2000 CHAR) NULL` — 토스트/에러 메시지 본문.
     **`CHAR` 세만틱 명시 필수** (BYTE면 한글 실질 666자)
   - `ACTOR_KIND VARCHAR2(20) DEFAULT 'HUMAN'` — HUMAN / SCENARIO (D13)
2. **SEQ 버그 수정 (기존 결함, 코드 대조로 확인됨)**
   - 현상: PK가 `(ACTIVITY_DATE, SEQ)`인데 `activity-log.service.ts`의 `create()`가 **두 컬럼 다 세팅하지 않는다**. `seq`는 엔티티 `default: 1`이라 같은 날 2번째 insert가 ORA-00001로 실패하고, `catch`가 `logger.warn`으로 삼킨다(`:73`). 그래서 테이블이 사실상 비어 있다
   - 조치: `SEQ_ACTIVITY_LOG` 시퀀스 생성 후 insert 시 `NEXTVAL` 사용. **`MAX+1` 금지** (AGENTS.md)
   - **[초판 누락]** `ACTIVITY_DATE`도 서비스가 채우지 않는다. 실DB에 컬럼 DEFAULT(`SYSDATE`)가 실제로 걸려 있는지 **먼저 확인**하고, 없으면 서비스에서 명시 세팅한다 (없으면 ORA-01400)
3. 7일 정리 잡: `SCHEDULER_JOBS`에 신규 행.
   `JOB_CODE='CLEANUP_ACTIVITY_LOGS'`, `EXEC_TYPE='SQL'`,
   `EXEC_TARGET=DELETE FROM ACTIVITY_LOGS WHERE CREATED_AT < SYSDATE - 7`, `CRON_EXPR='0 0 2 * * *'`.
   참고: 기존 `DB_CLEANUP_LOGS`는 `INTER_LOGS` 30일 전용이고 `IS_ACTIVE='N'`이다
4. 테넌트: COMPANY / PLANT_CD 스코프 유지

### 4.4 백엔드 변경

- `activity-log.entity.ts` — 신규 컬럼 반영
- `activity-log.service.ts`
  - `activityDate` / `seq` 명시 세팅 (시퀀스 채번)
  - 에러 3종은 `ENABLE_ACTIVITY_LOG` 무관 저장
  - **[초판 누락] `findAll` 페이징 tie-break 추가.** 현재 `createdAt DESC` 단일 정렬 + `skip/take`인데, 전수 수집이 켜지면 같은 밀리초에 수십 건이 쌓여 **페이지 경계에서 행 중복/누락**이 발생한다. 2차 정렬키(`seq DESC`)를 넣는다
- `CreateActivityLogDto` — 현재 `@IsIn(['LOGIN','PAGE_ACCESS'])`를 신규 type 전체로 확장, `message` / `actorKind` 추가
- 조회 API는 기존 `GET /system/activity-logs` 재사용 (activityType 필터는 이미 있음)

### 4.5 조회 화면

- 경로 `/system/activity-logs`, 메뉴코드 `SYS_ACTIVITY_LOG`, 시스템관리 카테고리 말단
- 필터: 기간(기본 당일) / 사용자 / 유형
- 컬럼: 시각 / 사용자 / 유형 / 페이지 / 메시지 / 구분(HUMAN·SCENARIO)
- AGENTS.md 규칙: `menuConfig.ts` + backend menu-code validator + seed SQL + **JSHANES의 `MENU_CATEGORY_ITEMS`·`ROLE_MENU_PERMISSIONS` 적용 확인까지**

### 4.6 일 1 완료 조건

- `python tools/generate_db_schema_doc.py`로 `docs/database/schema-erd.md` 갱신 (마이그레이션과 동일 커밋)
- backend / frontend typecheck 통과
- 검증: 에러 토스트 발생 → 조회 화면 기록 확인 / 설정 off 시 성공 토스트 미기록 / **같은 날 2건 이상 저장(SEQ 수정 검증)** / 브라우저 콘솔에서 `window.__HANES_ACTIVITY__`가 설정과 무관하게 채워지는지 확인

> 링버퍼 sink는 **실행기가 아니라 수집기 소유다.** 일 1에서 빠뜨리면 일 3에서 "훅이 없다"를 발견하게 된다.

## 5. 일 2: 시나리오 규격 확정 (schemaVersion 1)

구현물이 아니라 **문서 산출물**이다. 일 3(실행기)과 일 4(작성 스킬)가 같은 규격을 참조해야 하므로 먼저 못 박는다.

### 5.1 시나리오 JSON

```jsonc
{
  "schemaVersion": 1,
  "id": "subprocess-kitting-basic",          // 파일명과 동일
  "title": "서브공정 키팅 기본",
  "startRoute": "/production/subprocess-kitting",
  "dataPolicy": "consumes",                  // readonly | consumes
  "vars": { "orderNo": "WO2609090279" },
  "preconditions": ["당일 설비 점검은 시나리오 스텝에 포함됨"],
  "onFailure": "pause",                      // pause | abort | continue
  "steps": [
    { "action": "goto",  "value": "/production/subprocess-kitting" },

    { "action": "click", "target": { "text": "설비 선택" } },

    { "action": "scan",
      "target": { "ariaLabel": "작업지시번호 스캔 또는 입력 후 Enter" },
      "value": "{{orderNo}}",
      "expect": { "type": "API_CALL", "method": "GET", "pathIncludes": "/job-orders", "status": 200 } },

    { "action": "click", "target": { "testId": "sub-kit-issue" },
      "expect":      { "type": "TOAST_SUCCESS", "messageIncludes": "발행" },
      "alreadyDone": { "type": "API_ERROR", "status": 409 } },

    { "action": "capture", "target": { "testId": "issued-sg-barcode" }, "as": "issuedSg" }
  ]
}
```

### 5.2 이벤트 술어 어휘 (판정의 핵심)

`expect` / `alreadyDone`는 **DOM이 아니라 링버퍼 이벤트에 대한 술어**다.

| 필드 | 의미 |
|---|---|
| `type` | 이벤트 종류 (2.3의 `ActivityEventType`) |
| `messageIncludes` | 메시지 부분 일치 |
| `status` | HTTP 상태 |
| `method` / `pathIncludes` | API 식별 |
| `errorCode` | 백엔드 errorCode 정확 일치 |

판정 규칙:

- `expect` 일치 → **성공**
- `alreadyDone` 일치 → **이미 진행됨** (D11. 추론 금지, 명시된 술어만 인정)
- 에러 이벤트(`TOAST_ERROR` / `API_ERROR` / `JS_ERROR`) 도착 → **실패** (조기 종료)
- `expect` 없는 순수 조작 스텝: 에러 없으면 성공
- 타임아웃(기본 10s): `expect`가 있으면 실패

초판의 `assertToast`는 **폐기한다.** 토스트 소멸(4초)과 경합하던 문제 자체가 사라진다.

### 5.3 액션과 셀렉터

- `action`: `goto / click / fill / scan / press / waitForText / capture / waitMs / pause / inspection`
- `scan` = fill + Enter (`BarcodeScanInput` 동작과 일치)
- `capture` + `{{변수}}` 치환 — 발행된 바코드를 읽어 다음 스텝에 사용
- `target` 우선순위: `testId` → `role`+`name` → `ariaLabel` → `placeholder` → `text` (ko 로케일 기준)
- `inspection`: 점검 인터록(일상점검/작업자점검) 전용 액션. 모달을 열어 이미 완료면 "이미 진행됨", 아니면 전 항목 PASS 후 저장

> **[결정 필요]** 기존 `ui-test-crud-red` 시나리오는 `label` / `placeholderIncludes` / 버튼 텍스트 기반이라 셀렉터 규약이 다르다. 신규 규격으로 이관할지, 두 규격을 병존시킬지 일 2에서 결정한다.

## 6. 일 3: 시나리오 실행기

### 6.1 위치와 실행

- 시나리오: `apps/frontend/e2e/scenarios/<id>.json` (git 관리)
- 러너: `apps/frontend/e2e/scenario-runner.spec.ts` (범용 1개)
- 실행: `SCENARIO=<id> pnpm test:e2e e2e/scenario-runner.spec.ts --headed`
- 기존 e2e 규칙("읽기 전용")과 분리: `scenarios/`는 consumes 허용, 수동 실행 전용, **CI 제외**
- 기존 인프라 재사용: `auth.setup.ts` 세션, 포트 3002 dev 서버, ko-KR 로케일 고정

### 6.2 실행 모드

| 모드 | 동작 |
|---|---|
| 관람형 | `--headed` + `E2E_SLOWMO=600` |
| 리포트형 | headless 실행 후 결과 파일 확인. 스텝별 이벤트 로그 첨부 |

### 6.3 이벤트 접근 헬퍼

```ts
const drain = (page: Page) => page.evaluate(() => {
  const buf = window.__HANES_ACTIVITY__ ?? [];
  window.__HANES_ACTIVITY__ = [];
  return buf;
});
```

- 2.4의 폴링 대기 루프로 감싼다 (`waitForEvent(page, expect, alreadyDone, timeout)`)
- **`goto` 직전 반드시 drain** (2.4 주의)

### 6.4 실패 처리

- 에러 이벤트 감지 즉시 해당 스텝 실패 처리 — **DOM 감시 불필요**
- `ApiFeedbackModal`은 **판정 대상이 아니라 조작 대상**이다. 모달을 띄운 API 에러는 이미 이벤트로 잡혔고, 러너는 다음 스텝을 위해 모달을 **닫기만** 하면 된다
- `onFailure: pause`면 브라우저를 멈추고 개입 대기 → 수동 조작 후 재개
  - **구현 전 스파이크 필요**: `page.pause()` 중 사용자가 페이지를 직접 조작 가능한지 5분 확인. 불가하면 개입 방식 재설계
- 실행 종료 후 `GET /system/activity-logs`를 조회해 서버 기록도 리포트에 첨부 (판정용 아님, 대조용)

### 6.5 코드 사전 작업

- 발행 바코드 표시 영역에 `data-testid` 추가: `SubKitActionBar.tsx`(issuedSg), `AssemblyActionBar.tsx`(issuedFg)

## 7. 일 4: 시나리오 작성 스킬

### 7.1 기존 스킬과의 관계 (초판 전면 누락 — 중복 구현 방지)

| 기존 스킬 | 겹치는 부분 | 처리 |
|---|---|---|
| `ui-test-crud-red` | 시나리오 JSON + Playwright 러너 + `{{변수}}` 치환 + 에러모달 검증 + HTML 리포트 | **승계 관계.** 기존은 `create/red/update/delete` **고정 슬롯형**이라 서브공정 키팅 같은 자유 업무 플로우를 표현할 수 없다. 본 규격의 `steps` 배열형이 상위호환 |
| `aitester-source-indexer` | "화면 소스 분석해 route/필드라벨/버튼/i18n 해석" 전체 | **재사용.** `.aitester/knowledge/*.json`을 스킬 입력으로 쓴다. 1단계를 새로 짜지 않는다 |
| `hanes-page-scenario-qa` | "HANES 화면 시나리오 테스트" 트리거 선점 | **경계 분리.** 신규 스킬 description은 **작성/생성만** 잡고 실행/QA는 명시적으로 배제한다 (D14) |

### 7.2 스킬 범위

1. 대상 화면 소스 분석 — `aitester-source-indexer` 산출물 우선 활용, 부족분만 직접 읽기
2. JSHANES DB 조회로 유효 테스트 데이터 확보 (설비/작업지시/SG 라벨/자재 — 잔량·상태·BOM 검증 포함)
3. schemaVersion 1 규격대로 JSON 생성, `apps/frontend/e2e/scenarios/`에 저장
4. **생성 직후 러너로 1회 실행해 통과 확인까지가 스킬 범위다.** 이 검증 루프가 없으면 AI가 존재하지 않는 셀렉터를 그럴듯하게 써넣고 끝낸다 — 이 스킬의 유일하고 결정적인 실패 모드다
5. 데이터 소모로 실패 시 `vars`만 재조회해 갱신하는 운용 안내

### 7.3 설치 위치

repo 내 `.claude/skills/`에 둔다. 규격 JSON·러너와 같은 커밋으로 버전 관리돼야 하기 때문이다. (현재 프로젝트에는 `.claude/skills/`가 없다 — 신설)

> 참고: `ui-test-crud-red`는 SKILL.md가 `~/.claude/skills/`인데 스크립트는 `~/.codex/skills/`를 가리키는 혼용 상태다(AI-GLOBAL.md의 tool boundaries 위반). 같은 실수를 반복하지 않는다.

### 7.4 검증된 데이터 (첫 시나리오 2개 재료)

- 서브공정 키팅: 설비 `EQ-SHDCT-HV-01`, 지시 `WO2609090279`(N91H00-X9800-C2), 입력 SG `SG260909-00822` (BOM 반제품 자식 검증 완료, 원자재 없음)
- 완제품 조립: 설비 `MAG_EQ_MASSY_D`(원자재 6종 장착됨), 지시 `WO2609110353`(MAG_EAD65942601), 반제품 SFG 6종 1장씩

## 8. 구현 순서

| 순서 | 작업 | 선행 이유 |
|---|---|---|
| 1 | **일 1** 수집기 (DB → 백엔드 → 프론트 수집 + 링버퍼 → 조회화면 → JSHANES 적용) | 링버퍼가 없으면 실행기가 판정할 수 없다 |
| 2 | **일 2** 규격 확정 (문서) | 일 3과 일 4가 같은 어휘를 참조해야 한다 |
| 3 | **일 3** 실행기 (스파이크 → 러너 → 시나리오 2개 → 실기 검증) | 일 4의 검증 루프(7.2-4)가 러너를 요구한다 |
| 4 | **일 4** 작성 스킬 | |

> 초판은 스킬이 실행기보다 먼저였는데, 스킬의 완료 조건이 "러너로 실행해 통과 확인"이므로 성립하지 않는다. 위 순서로 교정했다.

## 9. 공통 주의사항 (AGENTS.md)

- SEQ/ID 채번은 `SEQUENCE.NEXTVAL`만
- `alert/confirm/prompt` 금지, 공통코드는 ComCode 계열 사용
- DB 변경은 SQL 작성 후 `oracle-db` 커넥터로 JSHANES에 적용 + pre/post 확인
- 스키마 변경 시 migration + `schema-erd.md` 갱신 동일 커밋
- 프론트 검증 포트 3002, dev 서버 실행 중 `pnpm build` 금지
- typecheck: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` / backend 동일
- 이벤트 전송 부하: 전수 수집이 켜지면 업무 요청 1건당 로그 HTTP 1건이 추가된다(모니터링 보드 폴링 화면에서 특히). 채널 A는 버퍼 + 주기 flush 또는 `sendBeacon` 적용을 검토한다 — 채널 B는 인메모리라 무관
