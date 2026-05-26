# Claude Handoff

## Last Update

2026-05-26 (Claude Opus 4.7 1M context, HANES MES repo)

## Completed

- Backend 잠재 버그 5건 처리(commit `c79b4c6` 및 `59e29a1`에 분산 반영):
  - `sql.executor.ts` 정규식 false positive/negative 차단(문자열 리터럴·코멘트 strip, 선행 0 바인드 검출).
  - `db-backup.service.ts` TypeORM 객체 바인드 캐스트 제거, 위치 바인드 배열로 복귀.
  - `interface.service.ts` 시퀀스 도입 후 무용한 `LOCK TABLE` 제거, `retryLog` retryCount 원자적 증가.
  - `equipment/consumable.service.ts createLog` 를 `tx.run` 으로 감싸 SCRAP partial commit 차단.
  - `bom.service.spec.ts findHierarchy` 회귀 방지 spec 3건 추가.
- 시퀀스 전환 검증: 6개 호출처에서 `SEQ_*.NEXTVAL` 정상 적용 확인, 마이그레이션 SQL 존재 확인.
- 사이드 spec 정리: JwtAuthGuard APP_GUARD 전환 영향으로 깨진 5개 spec(`jwt-auth.guard`, `equip-bom.service`, `menu-categories.guard`, `production-controller.guard-tenant`, `mold.controller`, `product-hold.controller`, `product-physical-inv.controller`) 패턴에 맞춰 재작성.
- AI 협업 보드 통합:
  - `~/.claude/skills/ai-coordination/` 스킬 생성. Codex와 동일 스크립트 동봉.
  - HANES `CLAUDE.md` 최상단에 협업 보드 포인터 섹션 추가(commit `fa6c786`).

## Verification

- `pnpm exec tsc --noEmit` → 0 error
- `pnpm exec jest` → 168 suites / 1663 tests PASS
- `check_coordination.py --repo /c/Project/HANES` → OK

## Open Notes

- 추가 잠재 버그 보류분(이번 작업 범위 밖, 다음 세션에서 검토 가치 있음):
  - `erp-material.service.ts importPurchaseOrder`: `getNextSeq` 호출이 `tx.run` 바깥. 시퀀스 도입으로 PK 충돌 위험은 사라졌으나 트랜잭션 롤백 시 SEQ 갭만 남음(허용 가능). 필요 시 `tx.run` 안으로 이동 검토.
  - `bom.service.ts findHierarchy`: bind() 헬퍼는 SQL 등장 순서에 강하게 묶여 있어 절 추가/이동 시 묵시적으로 깨질 수 있음. 회귀 spec 3건으로 1차 방어 완료. 장기적으로는 named bind + 객체 전달 방식으로 전환 가치 있음(TypeORM 객체 바인드 호환성 사전 확인 필요).
  - `interface.service.ts bulkRetry`: `Promise.all` 로 동시 호출 시 동일 로그 키가 두 번 들어오면 race. 현재는 호출자가 distinct 키를 보장하지만 방어 코드 없음.
- 협업 보드 자체에 대한 변경은 가능한 한 협업 인프라 커밋으로만 분리할 것. backend 기능 변경과 섞지 말 것.

## Next AI Should

1. `AGENTS.md` 와 `.ai-coordination/README.md` / `STATE.md` / `TASKS.md` / `DECISIONS.md` / `LOCKS.md` 를 먼저 읽는다.
2. broad edits / DB 변경 / 리뷰 핸드오프가 있으면 `PROTOCOL.md` 도 읽는다.
3. 편집 전 `LOCKS.md` 에 agent 이름·task ID·예정 파일 기록.
4. `TASKS.md` 는 active-only 유지. 완료 작업은 `ARCHIVE.md` 한 줄 + `JOURNAL.md` 상세.
5. 종료 전 본 핸드오프 파일을 갱신할 것.
