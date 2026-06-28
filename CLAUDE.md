# CLAUDE.md - HANES Claude Code 보조 지침

이 문서는 Claude Code CLI에서 HANES repo를 다룰 때의 보조 지침이다. 공통 프로젝트 규칙은 `AGENTS.md`를 우선한다.

## 1. 시작 순서

작업 전 먼저 coordination 상태를 확인한다.

```powershell
python C:/Users/hsyou/.codex/skills/ai-coordination/scripts/coordination_state.py status --repo .
```

`COORDINATION_STATUS.json`의 `enabled`가 `false`이면 `.ai-coordination/`은 과거 기록/점검 자료로만 취급한다. 사용자가 명시적으로 coordination 정리를 요청한 경우를 제외하고 새 `TASKS`, `LOCKS`, `JOURNAL`, `HANDOFF` 항목을 만들지 않는다.

`enabled`가 `true`이거나 사용자가 coordination 정리를 명시하면 아래 순서로 읽는다.

1. `AGENTS.md`
2. `.ai-coordination/README.md`
3. `.ai-coordination/STATE.md`
4. `.ai-coordination/TASKS.md`
5. `.ai-coordination/DECISIONS.md`
6. `.ai-coordination/LOCKS.md`

충돌, stale lock, DB 변경, 마이그레이션, 공유 모듈 수정, 큰 리팩토링, 리뷰 핸드오프가 있으면 `.ai-coordination/PROTOCOL.md`도 읽는다.
`REVIEW_QUEUE.md`는 기본 시작 절차에서 읽지 않고 리뷰 처리나 완료 정리 시 필요한 작업 ID로만 확인한다.

## 2. Claude 전용 협업 규칙

- coordination이 켜져 있을 때만 편집 전 `LOCKS.md`에 `owner: claude` 또는 실제 세션 이름으로 작업 ID와 수정 예정 파일을 기록한다.
- coordination이 켜져 있을 때만 세션 종료 전 `.ai-coordination/HANDOFF/claude.md`를 갱신한다.
- 구현 완료 후 검토 대기 작업은 `TASKS.md`에서 제거하고 `.ai-coordination/REVIEW_QUEUE.md`로 옮긴다.
- 완료 작업은 `TASKS.md` 또는 `REVIEW_QUEUE.md`에서 제거하고 `ARCHIVE.md`에 한 줄만 남긴다.
- 다른 AI가 lock한 파일은 사용자 승인 없이 수정하지 않는다.
- 협업 문서 변경과 기능 변경은 가능하면 별도 커밋으로 분리한다.
- `AGENTS.md`와 이 문서가 충돌하면 `AGENTS.md`를 우선한다.

## 3. 실행과 검증

- 패키지 매니저는 `pnpm`을 사용한다. `npm`은 사용하지 않는다.
- 프론트 개발 서버 기본 포트는 `3002`다.
- 이미 dev 서버가 떠 있으면 `pnpm build`를 실행하지 않는다. typecheck가 필요하면 아래 명령을 우선한다.

```powershell
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
```

- focused test와 typecheck를 먼저 수행한다.
- `pnpm build`는 사용자가 요청했거나 dev 서버가 없고 전체 빌드 확인이 필요한 경우에만 실행한다.
- 서버나 포트가 예상과 다르면 임의 대체 포트를 띄우지 말고 실패를 보고한다.

## 4. DB 작업

- Oracle 작업은 `oracle-db` connector 또는 검증된 raw SQL 파일 경로를 우선한다.
- 기본 사이트는 `JSHANES`다.
- DDL/DML 실행 전 실제 스키마를 확인한다.
- DB 스키마 변경 시 `AGENTS.md`의 ERD 갱신 규칙을 따른다.

## 5. UI와 코드 품질

- `alert()`, `confirm()`, `prompt()` 대신 모달 컴포넌트를 사용한다.
- 코드성 값은 직접 입력보다 공통코드/기준정보 선택 컴포넌트를 우선한다.
- 공통 코드 표시는 `ComCodeBadge`, `ComCodeSelect`, `useComCode` 계열을 우선한다.
- 공통 필터와 입력 컴포넌트는 `components/shared/`를 먼저 확인한다.
- `catch (error: unknown)` 형태를 유지하고, `as any` 사용을 피한다.
- 멀티테넌시 기능에는 `COMPANY`, `PLANT_CD` 스코프를 포함한다.

## 6. 미완료 작업

- 작업이 중간에 멈추거나 검증/배포/데이터 정리가 끝나지 않았으면 `docs/standards/unfinished-work-record.md` 기준으로 `docs/reports/unfinished-work/`에 기록한다.
- 다음 세션은 관련 미완료 기록을 현재 코드와 DB 상태로 재검증한 뒤 이어간다.
