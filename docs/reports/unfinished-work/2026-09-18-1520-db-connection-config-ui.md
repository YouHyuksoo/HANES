# 미완료 작업 기록: DB 접속 설정 화면(.env 편집 + 백엔드 재시작)

- 작성시각: 2026-09-18 15:20 KST
- 작성자: claude
- 작업 범위: system/config 화면의 "DB 접속" 탭, `/api/v1/system/db-connection` API
- 현재 상태: 검증대기 (브라우저 실화면 미확인)

## 완료한 것

- 백엔드 `DbConnectionService` 구현 — TDD로 작성, 단위 테스트 15건 통과
  - 비밀번호 마스킹(`getCurrent`), 재시작 필요 판정(`getStatus`), 접속 테스트(`testConnection`),
    연결 테스트 통과 시에만 저장(`save`), PM2 재시작(`restart`)
  - `.env` 저장은 ORACLE_* 라인만 교체하고 다른 키·주석 보존, 쓰기 전 `.env.bak-<타임스탬프>` 백업
  - SID 저장 시 SERVICE_NAME 을 빈 값으로 만들어 두 값이 충돌하지 않게 함
- 컨트롤러 `/system/db-connection` (GET, GET /status, POST /test, PUT, POST /restart), 전 엔드포인트 `@Roles('ADMIN')`
- 프론트 `DbConnectionPanel` + config 페이지 `DB 접속` 탭, i18n 4개 언어(ko/en/zh/vi) 23키 추가
- 라우트 등록 확인: `curl /api/v1/system/db-connection/status` → 401(인증 가드 도달, 404 아님)

## 미완료 / 남은 것

- 브라우저 실화면 검증 전체 (탭 노출, 폼 로딩, 연결 테스트 버튼, 저장, 재시작 확인 모달)
- `restart()` 실제 PM2 동작 확인 — 로컬은 pnpm dev 구동이라 `pm2 restart hanes-backend` 가 실패한다.
  배포 서버(PM2 구동)에서만 정상 동작하며, 실서버에서 눌러본 적 없음
- 저장 후 재시작 → 실제로 다른 DB 로 붙는 왕복 시나리오 미확인

## 변경 파일

- `apps/backend/src/modules/system/services/db-connection.service.ts`: 신규 서비스
- `apps/backend/src/modules/system/services/db-connection.service.spec.ts`: 신규 테스트 15건
- `apps/backend/src/modules/system/controllers/db-connection.controller.ts`: 신규 컨트롤러(ADMIN 전용)
- `apps/backend/src/modules/system/dto/db-connection.dto.ts`: 신규 DTO
- `apps/backend/src/modules/system/system.module.ts`: 컨트롤러·서비스 등록
- `apps/frontend/src/components/system/DbConnectionPanel.tsx`: 신규 패널
- `apps/frontend/src/app/(authenticated)/system/config/page.tsx`: DB_CONNECTION 탭 추가
- `apps/frontend/src/locales/{ko,en,zh,vi}.json`: `system.dbConnection.*` 23키 + `system.config.group.DB_CONNECTION`

## 검증 상태

- 실행함: `pnpm typecheck:backend` 통과, `pnpm typecheck:frontend` 통과
- 실행함: `npx jest src/modules/system src/architecture/module-boundary.spec.ts` → 13 스위트 185건 통과
- 실행함: `curl /api/v1/system/db-connection/status` → 401(라우트 등록 확인)
- 실행함: locale 4개 파일 BOM 없음·키 수 동일 확인
- 실행 못함: 브라우저 UI 검증 — claude-in-chrome 확장이 연결되지 않음
  ("Browser extension is not connected")
- 실행 못함: `POST /restart` 실동작 — 로컬이 PM2 구동이 아니고, 누르면 세션이 끊김

## 중단 사유

- 브라우저 확장 미연결(환경 오류). 재시도 2회 이내 규칙에 따라 중단하고 기록으로 남김.

## 다음 작업자가 바로 할 일

1. 브라우저 확장을 연결한 뒤 `http://localhost:3002/system/config` → `DB 접속` 탭에서
   폼 로딩(호스트 10.1.10.35 / 포트 1527 / 계정 test / 서비스명 JSHNSMES)과 비밀번호 칸이 빈 채 뜨는지 확인
2. `연결 테스트` 버튼으로 성공 토스트, 비밀번호를 틀리게 넣어 ORA-01017 힌트가 뜨는지 확인
3. 저장 후 `apps/backend/.env` 와 `.env.bak-*` 백업 파일이 생겼는지 확인하고 원복
4. 배포 서버에서 `재시작` 버튼 동작 확인(작업자가 없는 시간대에)

## 주의사항

- 저장/재시작은 운영 영향이 크다. 로컬에서 `재시작` 버튼을 누르면 pm2 미구동으로 실패 토스트만 뜬다(무해).
- `.env` 는 gitignore 대상이다. 테스트로 값을 바꿨으면 반드시 원복하고 백업 파일을 정리한다.
- 접속 설정 단일 출처 규칙은 `apps/backend/src/database/oracle-env.ts` + `tools/hanes_db.py` 다.
  이 화면은 그 파일을 편집할 뿐 새 읽기 경로를 만들지 않는다.
- 커밋하지 않은 상태로 워킹 트리에 남아 있다.
