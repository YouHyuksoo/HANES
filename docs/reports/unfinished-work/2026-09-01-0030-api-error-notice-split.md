# 미완료 작업 기록: API 오류/안내 창 분리

- 작성시각: 2026-09-01 00:30 KST
- 작성자: claude
- 작업 범위: 프론트엔드 전역 API 응답 피드백 UI (업무 안내 창 / 시스템 오류 창 분리)
- 현재 상태: 검증대기 (i18n 포함 구현 완료, 안내 창 화면 확인만 남음)

## 완료한 것

- 심각도 분류 단일 출처 신설: `classifyApiError(status, errorCode)` → `notice` | `system`
  - notice: 400 / 403 / 404 / 409 / 422 (사용자가 입력·조건을 고치면 해결되는 응답)
  - system: 500 / 502 / 503 / 504 / status 0, 그리고 errorCode가 `INTERNAL_SERVER_ERROR` `UNKNOWN_ERROR` `DB_CONNECTION_ERROR`
  - errorCode 판정이 상태코드 판정보다 우선
- `errorStore`에 `severity`, `errorCode` 필드 추가
- axios 응답 인터셉터가 severity를 채워 저장 (네트워크 실패는 항상 system)
- 표시 창 분리
  - `ApiNoticeModal`: 업무 안내 전용. 복사 버튼·URL·상태코드·응답 전문 없음, 메시지 + 확인 버튼. 상세는 접이식. `whitespace-pre-line`으로 class-validator 다중 메시지 개행 유지. 파스텔 배경 미사용(테두리/텍스트 색 구분)
  - `ErrorDetailModal`: 시스템 오류 전용으로 축소. store 직접 구독 제거 → props(`error`, `onClose`) 기반
  - `ApiFeedbackModal`: errorStore의 유일한 구독자. severity로 배타 분기. `providers.tsx`에 단일 마운트
- 백엔드는 변경하지 않음 (throw 사이트 1,278곳 유지, FE 전용 분류)
- **다국어 전환 완료** (2026-09-01 추가 지시)
  - `getNoticeTitle`/`getNoticeHint` → `getNoticeTitleKey`/`getNoticeHintKey`로 교체, 소스에서 표시 문구 제거
  - `ApiNoticeModal`이 `useTranslation`의 `t()`로 렌더
  - `locales/{ko,en,zh,vi}.json`에 `apiNotice` 섹션 추가 (제목 5 + 힌트 5 + 버튼 4 = 각 파일 20줄 추가, 삭제 0, BOM 없음)

## 미완료 / 남은 것

- **notice 창 실제 화면 검증** — 409(중복 저장), 400(필수값 누락), 404(대상 없음)에서 새 안내 창이 뜨는지 눈으로 확인
- 로그인 후 화면 검증 전반

## 변경 파일

- `apps/frontend/src/services/api-error-severity.ts`: 신규. 심각도 분류 + 안내 문구 매핑
- `apps/frontend/src/services/api-error-severity.structure.test.mjs`: 신규. 분류 규칙·배선 회귀 테스트 8건
- `apps/frontend/src/components/shared/ApiNoticeModal.tsx`: 신규. 업무 안내 창
- `apps/frontend/src/components/shared/ApiFeedbackModal.tsx`: 신규. severity 분기 진입점
- `apps/frontend/src/components/shared/ErrorDetailModal.tsx`: props 기반으로 전환, 시스템 오류 전용
- `apps/frontend/src/stores/errorStore.ts`: `severity`/`errorCode` 필드 추가
- `apps/frontend/src/services/api.ts`: `classifyApiError` 배선, `ApiErrorResponse.errorCode` 타입 추가
- `apps/frontend/src/app/providers.tsx`: `ErrorDetailModal` → `ApiFeedbackModal` 마운트 교체

## 검증 상태

- 실행함: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` → 오류 0
- 실행함: `node --test apps/frontend/src/services/api-error-severity.structure.test.mjs` → **15/15 pass**
  - 배선/형태 검증 + 분류 함수 실제 실행 검증(Node type-stripping으로 `.ts` 직접 import)
  - 4개 로케일 `apiNotice` 키 존재/BOM 부재 검증 포함
- 실행함: 브라우저(claude-in-chrome) — system 분기 실전 확인
  - 네트워크 실패(status 0)가 시스템 오류 창(빨강 상세+복사)으로 표시
  - `/api/health` **503 + DB_CONNECTION_ERROR**도 system으로 분류되어 같은 창으로 표시
- 실행 못함: notice 창 화면 검증
  - DB는 2026-09-01 복구됨(`/api/health` → `status: ok`, `database: connected`, latency 146ms)
  - 남은 차단 사유는 **로그인**이다. 에이전트는 비밀번호 입력/인증 대행을 하지 않는다
  - 로그인 전 화면에서 400을 유발하려 비밀번호를 비우고 제출해봤으나 브라우저 `required` 검증에 막혀 서버까지 가지 않음

## 중단 사유

- 환경 장애: DB 서버 `10.1.10.35`가 **ping·TCP 모두 불통** (1527, 1528 포트 전부 실패).
  - 백엔드 `/api/health`는 200이지만 본문이 `status: "degraded"`, `database.error = NJS-510 connection timed out`
  - health 응답이 9.5초 걸려 프론트 `timeout: 10000`과 충돌 → 간헐적으로 status 0(ECONNREFUSED) 모달이 뜬다
  - 같은 날 앞서 발생한 ORA-28001(비밀번호 만기)은 해결 완료된 별개 건이며, 지금 증상의 원인이 아니다

## 다음 작업자가 바로 할 일

1. `Test-NetConnection 10.1.10.35 -Port 1527`로 DB 도달 여부 재확인. 불통이면 네트워크/VPN·DB 서버 상태부터 확인
2. DB 복구 후 백엔드 재시작 (`pnpm dev:restart`) — 현재 백엔드 프로세스는 DB 불통 상태에서 떠 있다
3. 로그인 후 409 재현: 설비마스터에서 기존 설비코드로 저장 → 안내 창(노란 테두리, "지금은 처리할 수 없습니다")이 뜨는지 확인
4. 400 재현: 필수값 비우고 저장 → 다중 줄 검증 메시지가 개행 유지되는지 확인
5. 500 재현은 불필요. 구조 테스트로 대체됨

## 주의사항

- Oracle `test` 계정 비밀번호 만기는 이미 해제됨(동일 비번 재설정 + `ALTER PROFILE DEFAULT LIMIT PASSWORD_LIFE_TIME/GRACE_TIME UNLIMITED`). 되돌리지 말 것
- 백엔드 포트는 **3003**이다(3001 아님). `/health`는 백엔드 루트 기준이며 프론트에서는 `/api/health`로 프록시된다
- `suppressErrorModal` 플래그 사용처 17곳은 손대지 않았다. 기존 동작 그대로 모달을 띄우지 않는다
- 커밋하지 않았다. 변경은 작업 트리에만 있다
- 안내 창 문구는 i18n 4파일로 전환 완료. 문구 수정은 `locales/*.json`의 `apiNotice`에서만 한다(소스에 되돌려 넣으면 테스트가 실패한다)
- 기존 `ErrorDetailModal`(시스템 오류 창)은 여전히 한국어 하드코딩이다. 이번 범위 밖이라 그대로 뒀다
- `ApiNoticeModal`의 `autoFocus`(확인 버튼)는 기존 오류 창에 없던 신규 동작이다. 스캔 화면에서 안내 창을 닫은 뒤 바코드 입력 포커스가 돌아오는지 확인 필요(kiosk·PDA 주요 경로는 대부분 `suppressErrorModal: true`라 노출은 적음)
