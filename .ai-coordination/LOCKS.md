# LOCKS

## Active Locks

## T-QUALITY-DEFECT-FILTER-ONE-LINE 불량관리 필터 한 줄 배치
status: active
owner: hermes
role: implementer
scope:
- `/quality/defect` 필터 영역 레이아웃 조정
files:
- apps/frontend/src/app/(authenticated)/quality/defect/page.tsx
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/hermes.md
started: 2026-06-20


## 운영 규칙

- `LOCKS.md`에는 현재 수정 중이거나 인계 판단이 필요한 `active`/`stale` 잠금만 둔다.
- 작업 완료 시 `JOURNAL.md`와 `ARCHIVE.md` 또는 `HANDOFF/<agent-name>.md`에 결과를 남긴 뒤, 해당 lock 항목은 이 파일에서 제거한다.
- 완료 이력을 `status: released`로 이 파일에 누적하지 않는다.
