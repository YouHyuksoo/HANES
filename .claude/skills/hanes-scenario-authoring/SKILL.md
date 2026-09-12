---
name: hanes-scenario-authoring
description: Use when the user asks to CREATE or UPDATE a HANES MES 시나리오 JSON for the Playwright scenario runner — "OO 화면 시나리오 만들어", "키팅 시나리오 작성", "시나리오 갱신/데이터 재조회", "시나리오 규격대로 써줘". This skill AUTHORS scenarios (schemaVersion 1) and verifies them by running the runner once. It does NOT do general screen QA or ad-hoc UI testing — that is `hanes-page-scenario-qa`.
---

# HANES 시나리오 작성

Playwright 시나리오 실행기가 먹는 JSON을 만든다. **작성 전용**이다.

## 경계 (중요)

| 요청 | 담당 |
|---|---|
| "시나리오 만들어 / 갱신해" | **이 스킬** |
| "이 화면 테스트해봐 / 확인해줘" | `hanes-page-scenario-qa` |
| "기준정보 CRUD QA 리포트 뽑아" | `hanes-page-scenario-qa` |

애매하면 사용자에게 "시나리오 파일을 만드는 것인지, 지금 한 번 테스트해보는 것인지" 한 줄로 묻는다.

## 규격 단일 출처

**작성 전에 반드시 읽는다**: `docs/specs/2026-09-12-scenario-runner-schema-v1-design.md`

이 스킬은 규격을 요약하지 않는다. 규격이 바뀌면 그 문서만 바뀌고 이 스킬은 그대로다.
관련 계획: `docs/plans/2026-09-11-activity-log-scenario-runner.md`

## 산출물 위치

- 시나리오: `apps/frontend/e2e/scenarios/<id>.json` (`id`는 파일명과 동일해야 한다)
- 실행 결과: `docs/reports/scenario-runs/<runId>/` (HTML + JSON + 스크린샷)

## 절차

### 1. 대상 화면의 실제 셀렉터 확보 — 소스 추측 금지

살아 있는 화면에서 뽑는다. 소스를 읽어 셀렉터를 추측하면 존재하지 않는 셀렉터를 그럴듯하게 쓰게 된다.

```powershell
cd C:\Project\HANES\apps\frontend
$env:PROBE_ROUTE='/production/subprocess-kitting'
npx playwright test e2e/probe-selectors.spec.ts --project=chromium --no-deps --reporter=list
```

버튼 텍스트 / placeholder / aria-label / data-testid 목록이 나온다.

`data-testid`가 비어 있고 그 요소를 꼭 집어야 하면, **먼저 소스에 `data-testid`를 추가**하고 사용자에게 그 변경을 보고한다. 규격 5.1 우선순위상 `testId`가 가장 안정적이다.

보조로 `aitester-source-indexer` 산출물(`.aitester/knowledge/*.json`)이 있으면 route/필드라벨/버튼을 거기서 먼저 본다. 없으면 만들지 말고 프로브만 쓴다.

### 2. 유효한 테스트 데이터 확보 — DB 실측

`oracle-db` 스킬로 **직접 조회한다**. 사용자에게 SQL 실행을 지시하지 않는다.

```powershell
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "<SQL>"
```

확인할 것 (화면에 따라 다름):
- 작업지시: 상태가 진행 가능(`WAITING`/`RUNNING`)이고 잔량이 있는가
- SG/FG 라벨: `status`가 소모 가능한 상태인가
- 설비: `USE_YN='Y'`이고 해당 공정에 매핑돼 있는가
- BOM: 투입하려는 자재/반제품이 실제 자식인가

찾은 값은 `vars`에 넣는다. 화면 문구는 하드코딩하지 말고 `vars`로 뺀다.

### 3. 규격대로 JSON 작성

규격서 3~7절을 따른다. 자주 틀리는 것:

- `expect`를 `{ "type": "TOAST_SUCCESS" }` 단독으로 쓰지 마라. `messageIncludes` 또는 `pathIncludes`를 같이 준다 (규격서 6.2 — 느슨하면 남의 이벤트에 오판한다)
- 의도한 에러(중복 등록 등)는 `expect`에 적는다. 적으면 성공이 되고, 안 적은 에러만 실패 후보가 된다
- "이미 완료"가 정상인 스텝은 `alreadyDone` 술어를 **명시**한다. 추론하지 않는다
- 점검 인터록은 스텝으로 풀어쓰지 말고 `{"action":"inspection","value":"DAILY"}`를 쓴다
- 접두어 데이터 정리는 `cleanupPrefix` 한 줄이다. 루프를 JSON에 쓰지 마라
- `waitMs`는 최후 수단이고 `note`에 이유가 없으면 검증기가 거부한다

`dataPolicy` 선택:
- `readonly` — 조회/모달 열고닫기만. 쓰기 `api`·`cleanupPrefix` 금지
- `consumes` — 기존 라벨·지시를 소모. 재실행하려면 `vars` 재조회 필요
- `creates` — 테스트 데이터 생성 후 정리. `vars.prefix`와 `teardown` 필수

### 4. 검증 — 이게 스킬 범위의 일부다

**JSON을 만들고 끝내지 않는다.** 러너로 1회 실행해 통과를 확인해야 작성이 끝난다.
이 루프가 없으면 존재하지 않는 셀렉터를 그럴듯하게 써넣고 끝나며, 그게 이 스킬의 유일하고 결정적인 실패 모드다.

```powershell
cd C:\Project\HANES\apps\frontend
$env:SCENARIO='<id>'
npx playwright test e2e/scenario-runner.spec.ts --project=chromium --no-deps --reporter=list
```

- 파싱 검증(규격서 10절)은 러너가 실행 전에 자동으로 돈다. 위반이면 실행 자체를 거부한다
- 실패하면 리포트 JSON의 `steps[].events`를 읽어 원인을 잡는다. "빨간 토스트가 떴다"가 아니라 `{type:'API_ERROR', status:409, path:...}`로 남아 있다
- 관람형으로 눈으로 보려면: `$env:E2E_SLOWMO='600'` + `--headed`

전제: dev 서버 3002 / 백엔드 3003 기동, e2e 세션 유효. 세션이 만료됐으면 `--no-deps`를 빼고 `E2E_EMAIL`/`E2E_PASSWORD`로 로그인 setup을 먼저 돌린다.

### 5. 쓰기 시나리오는 승인받고 돌린다

`dataPolicy`가 `consumes`/`creates`인 시나리오는 **JSHANES 운영 DB를 실제로 변경**한다(라벨 발행, 실적 등록, 마스터 생성).
검증 실행 전에 사용자에게 무엇이 생성·소모되는지 한 줄로 알리고 승인을 받는다. `readonly`는 그냥 돌려도 된다.

### 6. 운용 안내 — 데이터 소모

`consumes` 시나리오는 한 번 돌면 그 라벨/지시가 소모돼 재실행이 실패한다. 이때는
**시나리오 구조를 고치지 말고 `vars`만 2번 절차로 재조회해 갱신**한다.
실패 리포트의 `vars`에 마지막 사용 값이 남아 있으니 무엇이 소모됐는지 거기서 본다.

## 보고 형식

작성을 마치면 이렇게 보고한다.

- 만든 파일 경로와 `dataPolicy`
- DB에서 실측한 `vars`와 그 근거(어떤 조건으로 골랐는지)
- 러너 실행 결과: 판정 + 리포트 경로
- 실패했다면 어느 스텝에서 어떤 이벤트 때문인지

## 안 하는 것

- 규격에 없는 액션·필드를 임의로 만들지 않는다. 필요하면 규격서를 먼저 고치자고 제안한다
- 점검 종합판정이 불합격일 때 측정값을 조작해 뚫지 않는다 (규격서 7.1)
- `docs/reports/scenario-runs/` 산출물을 커밋하지 않는다 (실행 산출물이다)
