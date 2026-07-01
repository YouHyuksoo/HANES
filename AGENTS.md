# AGENTS.md - HANES MES 프로젝트 지침

이 문서는 HANES repo에서 작업하는 모든 AI agent가 먼저 따라야 하는 프로젝트 기준이다.

## 1. 적용 범위와 우선순위

- 이 파일은 `C:\Project\HANES` 프로젝트 전용 지침이다.
- 현재 확인된 `AGENTS.md`는 프로젝트 파일 하나뿐이다. 전역/유저 `AGENTS.md`가 없으면 임의로 새로 만들지 않는다.
- `CLAUDE.md`는 Claude Code용 보조 지침이다. 공통 규칙은 이 파일을 우선하고, Claude 전용 실행 방식만 `CLAUDE.md`에서 보충한다.
- 사용자 직접 지시가 최우선이다. 그다음 이 `AGENTS.md`, 더 하위 디렉터리의 지침, 도구/스킬 지침 순서로 따른다.
- 불확실하면 구현하지 말고 `.ai-coordination/TASKS.md`에 `BLOCKED`로 남기거나 사용자에게 확인한다.

## 2. 작업 시작 절차

여러 AI 세션이 동시에 작업할 수 있으므로 작업 전 먼저 coordination 상태를 확인한다.

- `python C:/Users/hsyou/.codex/skills/ai-coordination/scripts/coordination_state.py status --repo .`
- `COORDINATION_STATUS.json`의 `enabled`가 `false`이면 `.ai-coordination/`은 과거 기록/점검 자료로만 취급한다. 사용자가 명시적으로 coordination 정리를 요청한 경우를 제외하고 새 `TASKS`, `LOCKS`, `JOURNAL`, `HANDOFF` 항목을 만들지 않는다.
- `enabled`가 `true`이거나 사용자가 coordination 정리를 명시하면 아래 파일을 순서대로 읽는다.

1. `AGENTS.md`
2. `.ai-coordination/README.md`
3. `.ai-coordination/STATE.md`
4. `.ai-coordination/TASKS.md`
5. `.ai-coordination/DECISIONS.md`
6. `.ai-coordination/LOCKS.md`

다음 상황에서는 `.ai-coordination/PROTOCOL.md`도 읽는다.

- 충돌 또는 stale lock 처리
- DB 변경, 마이그레이션, 배포, 운영 데이터 정리
- 공유 모듈, 대량 수정, 리뷰 핸드오프
- coordination 문서 자체 정리

## 3. Coordination 필수 규칙

- 코드나 문서를 수정하기 전에 `TASKS.md`에서 작업 ID를 확인하거나 새 작업 ID를 만든다.
- 수정 예정 파일은 `LOCKS.md`에 agent 이름, 작업 ID, 파일 목록, 만료 시간을 기록한다.
- 다른 AI가 lock한 파일은 사용자 허가 없이 수정하지 않는다.
- 작업 중 중요한 판단은 `DECISIONS.md`에 남긴다.
- 작업 종료 전 결과와 검증은 `JOURNAL.md`에 남기고 `.ai-coordination/HANDOFF/<agent-name>.md`를 갱신한다.
- 구현 완료 후 검토 대기 작업은 `TASKS.md`에서 제거하고 `.ai-coordination/REVIEW_QUEUE.md`로 옮긴다.
- 완료 작업은 `TASKS.md` 또는 `REVIEW_QUEUE.md`에서 제거하고 `ARCHIVE.md`에 한 줄만 남긴다.
- `LOCKS.md`에는 현재 `active` 또는 `stale` 잠금만 둔다. 완료 이력을 `status: released`로 누적하지 않는다.
- `.ai-coordination/` 문서는 한글로 기록한다. 기술 식별자, 경로, 테이블명, API 경로는 원문을 유지한다.

## 4. 프로젝트 기본 정보

- 이름: HANES MES
- 스택: NestJS + TypeORM + Oracle Database + Turborepo
- 패키지 매니저: `pnpm`
- DB 사이트: `JSHANES` (`10.1.10.35:1527/JSHNSMES`)
- 마이그레이션 위치: `apps/backend/src/migrations/`
- 프론트 개발 서버 기본 포트: `3002`

## 5. DB와 마이그레이션 규칙

- TypeORM CLI는 ES Module 이슈로 직접 사용하지 않는다. Raw SQL과 `oracle-db` connector 경로를 우선한다.
- DDL/DML 실행 시 사이트를 명시한다. 기본 사이트는 `JSHANES`다.
- INSERT, seed, DDL 작성 전 실제 테이블 스키마를 먼저 확인한다.
- DB 변경, 메뉴 seed, 운영 데이터 DML이 작업 범위에 포함되면 SQL 파일만 추가하고 멈추지 않는다. 사용자가 보류를 명시하지 않은 한 `oracle-db` connector로 `JSHANES`에 적용하고 pre-check/post-check 결과를 남긴다.
- `oracle-db --execute-file`로 실행할 SQL 파일은 다중 DML/PLSQL 블록마다 `/` 구분자를 넣어 작성한다. ORA-00933 같은 실행 형식 오류가 나면 파일 형식을 고친 뒤 같은 connector로 재적용하고 DB 상태를 재확인한다.
- 메뉴 추가는 `menuConfig.ts`, backend menu-code validator, seed/migration 파일뿐 아니라 `JSHANES`의 `MENU_CATEGORY_ITEMS`와 `ROLE_MENU_PERMISSIONS` 적용 확인까지 완료한다.
- `SEQ` 또는 ID 채번은 Oracle `SEQUENCE.NEXTVAL`만 사용한다.
- `MAX(SEQ)+1`, `NVL(MAX(...))+1`, 날짜별 1부터 재시작 채번은 금지한다.
- `COMPANY`, `PLANT_CD`가 있는 업무 SQL은 명시적 공유 범위가 문서화되지 않는 한 tenant scope를 포함한다.
- 테이블/컬럼/PK/FK/CHECK/코드 도메인 등 DB 스키마 변경 시 `python tools/generate_db_schema_doc.py`를 실행해 `docs/reports/db-schema-erd.md`를 함께 갱신한다.
- 스키마 변경 PR/커밋 범위에는 migration SQL과 ERD 갱신을 같이 포함한다.

## 6. 코드와 UI 규칙

- 화면 개발 시 검사수준, AQL, 검사구분, 단위, 상태, 라인, 설비, 공정, 품목, 거래처처럼 코드성/기준정보성 값은 자유입력보다 공통코드 또는 기준정보 선택 방식을 우선한다.
- 공통코드/기준정보가 없으면 임시 자유입력으로 우회하지 말고 기준을 먼저 추가한다.
- `alert()`, `confirm()`, `prompt()`는 사용하지 않는다. 모달 컴포넌트를 사용한다.
- 상태 텍스트와 색상을 화면에서 하드코딩하지 말고 `ComCodeBadge`, `ComCodeSelect`, `useComCode` 계열을 우선한다.
- 공통 필터와 공통 입력 컴포넌트는 `components/shared/`를 우선 확인한다.
- 새 화면이나 컴포넌트에서 바코드/QR/스캔 입력을 받을 때는 일반 `Input`에 `onKeyDown Enter`, `useScanInputFocus`, `useSerialStore`를 직접 조합하지 말고 `components/shared/BarcodeScanInput`을 사용한다.
- PC 업무 화면의 바코드 입력은 `BarcodeScanInput`의 `maintainFocus`, `blinkIndicator`, `serialFocusedOnly`, `refocusAfterScan` 옵션으로 처리한다. PDA 전용 스캔 UI나 검색/선택용 일반 입력은 이 규칙의 예외다.
- 기존 화면을 수정하다가 바코드 스캔용 일반 `Input`을 발견하면 새 UI를 추가하기 전에 `BarcodeScanInput`으로 통일할 수 있는지 먼저 확인한다.
- flex 스크롤 영역에는 `min-h-0`를 명시한다.
- 정보카드가 운영 흐름에 필요 없다고 사용자가 말하면 restyle하지 말고 제거한다.

## 7. 검증 규칙

- 수정 범위에 맞는 focused test와 typecheck를 우선한다.
- 기본 frontend typecheck: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- 기본 backend typecheck: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
- 개발 서버가 이미 떠 있으면 `pnpm build`를 실행하지 않는다. dev 서버 중 production build는 `.next` 캐시를 손상시킬 수 있다.
- `pnpm build`는 사용자가 요청했거나, dev 서버가 없고 전체 빌드 검증이 필요한 경우에만 실행한다.
- HANES 프론트 검증은 기본 포트 `3002`를 사용한다. 예상 포트/서버/라우트가 unavailable이면 임의 대체 포트를 띄우지 말고 실패를 보고한다.
- Playwright는 실제 사용자 UI 흐름이나 브라우저 렌더 검증이 필요한 경우에 사용한다. 단순 확인에는 남발하지 않는다.

## 8. 리뷰와 판단 규칙

- 코드 리뷰나 현재 코드 판단 전 `git log --oneline -3`으로 HEAD를 확인한다.
- 이전 세션에서 읽은 파일 내용을 현재 상태로 가정하지 않는다. 필요한 파일은 현재 HEAD에서 다시 읽는다.
- 변수명만 보고 데이터 타입/값을 추정하지 않는다. 실제 API 응답을 만드는 controller/service/query/entity 흐름을 확인한다.
- "A 화면이 X API를 쓴다"고 말하려면 해당 화면 소스에서 직접 확인한다.
- CRUD 저장 API는 Controller -> Service -> Entity까지 호출 체인을 읽고, 프론트 제출값이 서버에서 어떻게 검증/재정의되는지 추적한다.
- 리뷰에는 코드로 증명되거나 재현 가능한 사실만 쓴다. "일 것이다", "가능성이 있다"는 표현으로 경고를 올리지 않는다.
- 우선순위는 실제 운영 데이터에서 지금 터지는 문제를 먼저 보고, 그다음 방어 필요성을 논한다.

## 9. 작업 중단과 미완료 기록

- 작업이 중간에 멈추거나 검증, 배포, 데이터 정리가 완료되지 않았으면 `docs/standards/unfinished-work-record.md` 기준으로 기록한다.
- 기록 위치는 `docs/reports/unfinished-work/YYYY-MM-DD-HHMM-<short-slug>.md`다.
- 다음 작업 시작 시 관련 미완료 기록을 먼저 확인하고, 기록 내용을 현재 코드/DB 상태로 재검증한다.
- `.ai-coordination`이 비활성화되어 있어도 미완료 기록은 생략하지 않는다.

## 10. Windows와 도구 경로 주의

- PowerShell 명령은 cmdlet별 실제 파라미터를 확인하고 사용한다.
- Windows PowerShell 5.1의 `New-Item`은 `-LiteralPath`를 지원하지 않으므로 디렉터리 생성에는 `New-Item -ItemType Directory -Force -Path ...` 또는 `[System.IO.Directory]::CreateDirectory(...)`를 사용한다.
- `-LiteralPath` 권장 규칙을 모든 cmdlet에 기계적으로 적용하지 않는다.
- 도구가 여러 설치 경로를 가질 수 있으면 `Get-Command <tool> -All`, `where.exe <tool>`, 실제 `--version`을 확인한다.

## 11. AI 도구와 스킬 경로 구분

| 도구 | 사용자 환경 예시 | 비고 |
| --- | --- | --- |
| Claude Code CLI | `~/.claude/skills/`, 프로젝트 `.claude/` | 사용자 Claude 환경 |
| Kimi Code CLI | `~/.agents/skills/` | Kimi 환경 |
| Codex | `~/.codex/skills/`, 세션 skill roots, `~/.codex/config.toml` | 현재 Codex 환경 |

- 도구별 설정과 스킬 경로는 서로 분리되어 있다.
- 사용자가 특정 도구를 명시하면 그 도구 기준으로 설명한다.
- 내 환경과 사용자의 CLI 환경을 섞어 말하지 않는다.

## 12. 과거 실수 방지 기록

### 2026-06-21 - IQC AQL 프로세스 리뷰

#### 근거 없는 가정 금지

- `IqcModal`의 `supplierName`이 업체명일 것이라 추정했지만 실제 백엔드는 `PARTNER_CODE`를 내려주고 있었다.
- `iqc-part-spec` 페이지의 preview API가 이미 `resolve-iqc-items`로 전환된 사실을 화면 소스 확인 없이 놓쳤다.
- 서버가 `aqlPolicy.result`로 프론트 verdict를 재정의하는 구조를 끝까지 추적하지 못했다.
- `POST /material/iqc-history/arrival` 실제 service 흐름을 끝까지 읽지 않고 결론을 냈다.

교훈:

- 변수명보다 실제 백엔드 응답 생성 코드를 확인한다.
- 화면/API 연결 주장은 화면 소스와 API 호출부로 증명한다.
- 저장 API는 Controller -> Service -> Entity 전체 체인을 확인한다.
- 이론적 위험보다 운영 데이터에서 실제로 터지는 문제를 먼저 본다.

#### Stale 코드 판단 금지

- 이전에 읽은 파일을 현재 코드로 가정해 이미 해결된 문제를 현재 문제라고 주장했다.
- 특정 라인 번호를 지목할 때 현재 HEAD에서 다시 읽은 라인 번호를 사용하지 않았다.

교훈:

- 리뷰와 판단 전 `git log --oneline -3`으로 HEAD를 확인한다.
- 현재 파일 내용을 다시 읽고 판단한다.
- 이미 해결된 문제를 현재 문제라고 주장하지 않는다.

### 2026-06-17 - jsPDF + autotable 한글 폰트

- `html2canvas`는 Tailwind CSS `lab()` 색상 함수 파싱 실패로 사용하지 않는다.
- jsPDF + autotable 한글 출력은 TTF를 VFS에 넣고 `Identity-H` CID 인코딩으로 등록한다.
- autotable의 `styles.font`, `headStyles.font`, `bodyStyles.font`, `alternateRowStyles.font`, `didParseCell`에 같은 폰트를 지정한다.
- Regular 폰트만 등록했다면 `headStyles.fontStyle = "normal"`을 명시한다. 기본 bold fallback 때문에 헤더만 깨질 수 있다.
- 관련 파일: `apps/frontend/src/hooks/useExport.ts`, `public/fonts/NotoSansKR-*.ttf`

### 2026-02-24 - 도구 식별과 스킬 경로

- Claude Code CLI, Kimi Code CLI, Codex의 스킬/설정 경로는 서로 다르다.
- 사용자가 쓰는 도구와 내가 현재 실행 중인 도구를 혼동하지 않는다.
- 경로를 말할 때는 해당 도구 기준인지 명확히 밝힌다.
