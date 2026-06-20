# HANES AI Coordination

이 디렉토리는 여러 AI 세션이 같은 HANES repo에서 충돌 없이 일하기 위한 공용 작업장이다.

## 시작 절차

모든 AI는 작업을 시작하기 전에 아래 순서로 읽는다.

1. `AGENTS.md`
2. `.ai-coordination/STATE.md`
3. `.ai-coordination/TASKS.md`
4. `.ai-coordination/DECISIONS.md`
5. `.ai-coordination/LOCKS.md`
6. `.ai-coordination/PROTOCOL.md`는 충돌, stale lock, 리뷰, DB 변경, 큰 수정 때 읽는다.

## 작업 절차

1. `TASKS.md`에서 작업 ID를 확인한다.
2. 수정할 파일이나 모듈을 `LOCKS.md`에 기록한다.
3. 구현 또는 검증을 진행한다.
4. 중요한 결정은 `DECISIONS.md`에 기록한다.
5. 작업 결과, 검증 명령, 남은 위험을 `JOURNAL.md`에 append한다.
6. 완료된 작업은 `TASKS.md`에서 제거하고 `ARCHIVE.md`에 한 줄 요약만 남긴다.
7. 다음 AI가 이어받을 수 있게 `HANDOFF/<agent-name>.md`를 갱신한다.
8. 작업이 끝난 lock은 `LOCKS.md`에서 제거한다. 완료 이력을 `status: released`로 Active Locks에 남기지 않는다.

## 역할 분리

위험한 작업은 가능하면 역할을 나눈다.

- implementer: 코드 수정과 focused test 담당
- reviewer: diff, 위험, 누락 테스트 검토 담당
- operator: DB, 마이그레이션, 환경, 배포 검증 담당

작은 작업은 한 AI가 여러 역할을 맡을 수 있지만, DB 변경·공유 모듈·대량 수정은 최소 리뷰 역할을 분리한다.

## 언어 규칙

- `.ai-coordination/`의 모든 문서(TASKS, DECISIONS, JOURNAL, STATE, PROTOCOL, LOCKS, ARCHIVE, HANDOFF)는 **한글로 기록**한다.
- 영어로 적힌 기존 항목은 수정할 때 한글로 갱신한다.
- 코드, 파일 경로, DB 테이블명, API 엔드포인트 등 기술 식별자는 원문을 유지한다.

## 컨텍스트 절약 규칙

- `TASKS.md`에는 `TODO`, `IN_PROGRESS`, `BLOCKED` 작업만 둔다.
- `DONE` 작업은 `ARCHIVE.md`로 옮기고 `TASKS.md`에서 제거한다.
- `LOCKS.md`에는 현재 `active`/`stale` 잠금만 둔다. 완료된 잠금 이력은 `JOURNAL.md`와 `ARCHIVE.md`에만 남긴다.
- `ARCHIVE.md`에는 작업 ID, 제목, 완료일, owner, 결과 한 줄만 남긴다.
- 완료 작업의 상세 변경 파일, 검증 로그, 판단 근거는 `JOURNAL.md`에만 남긴다.
- 새 AI 세션은 기본적으로 `ARCHIVE.md`를 읽지 않는다. 과거 작업 확인이 필요할 때만 특정 작업 ID로 검색한다.
- `HANDOFF/<agent-name>.md`에는 다음 작업자가 당장 알아야 할 미해결 사항만 남기고 완료 상세는 반복하지 않는다.
- `STATE.md`는 80줄 이하, active task는 25줄 이하, handoff는 80줄 이하로 유지한다.

## 충돌 방지 규칙

- 다른 AI가 `LOCKS.md`에 잡아둔 파일은 수정하지 않는다.
- 같은 파일을 반드시 수정해야 하면 먼저 `TASKS.md`에 BLOCKED로 남기고 사용자 확인을 받는다.
- lock이 만료됐으면 바로 덮어쓰지 말고 `PROTOCOL.md`의 stale lock 절차를 따른다.
- 사용자 변경으로 보이는 diff는 되돌리지 않는다.
- 커밋은 사용자 요청이 있을 때만 한다.

## 다른 AI에게 줄 시작 프롬프트

아래 내용을 그대로 다른 AI 세션 첫 메시지에 붙여 넣는다.

```text
너는 HANES MES repo(C:\Project\HANES)에서 작업한다.

작업 전 반드시 다음 파일을 읽어라:
- AGENTS.md
- .ai-coordination/README.md
- .ai-coordination/STATE.md
- .ai-coordination/TASKS.md
- .ai-coordination/DECISIONS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/PROTOCOL.md는 충돌, stale lock, 리뷰, DB 변경, 큰 수정 때 읽어라.

규칙:
- 다른 AI가 LOCKS.md에 기록한 파일은 수정하지 마라.
- 작업 시작 전 LOCKS.md에 너의 agent 이름, 작업 ID, 수정 예정 파일을 기록해라.
- 작업 종료 전 JOURNAL.md와 .ai-coordination/HANDOFF/<agent-name>.md를 갱신해라.
- DONE 작업은 TASKS.md에서 제거하고 ARCHIVE.md에 한 줄만 남겨 컨텍스트를 아껴라.
- ARCHIVE.md는 기본적으로 읽지 말고, 과거 작업 확인이 필요한 경우에만 작업 ID로 검색해라.
- 충돌, stale lock, broad refactor, DB 변경, review handoff는 PROTOCOL.md를 따라라.
- 중요한 기술 결정은 DECISIONS.md에 남겨라.
- 사용자 변경을 되돌리지 마라.
- Oracle 채번은 무조건 SEQUENCE.NEXTVAL만 사용한다. MAX+1, NVL(MAX(...))+1, 날짜별 1부터 채번은 금지다.
- TypeORM CLI는 쓰지 말고 Oracle 작업은 oracle-db connector 또는 raw SQL 파일로 처리해라.

작업 결과를 말할 때는 변경 파일, 검증 명령, 남은 위험을 짧게 보고해라.
```
