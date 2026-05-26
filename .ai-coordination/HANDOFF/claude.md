# Claude Handoff

## Last Update

2026-05-26 T-008 closed (Claude Opus 4.7 1M context)

## Completed (T-008)

- 2차 코드 리뷰 15건 중 13건 처리 + #11 iqc-template 까지 함께 처리 (T-007 잠금 해제 후).
- 보안/데이터 무결성:
  - SQL Executor: 문자열 리터럴 / q-quote 짝-구분자 / 위치+이름 혼용으로 인한 DELETE 가드 우회 + 바인드 silent miswire 차단.
  - Equipment ConsumableService SCRAP: tenant 미전달 호출에서 다른 테넌트 마스터까지 useYn='N' 으로 flip 되던 cross-tenant 결함 차단.
  - physical-inv startSession race: tx + partial unique index 로 단일 IN_PROGRESS 불변식 DB 보장.
- 회귀:
  - retryCount = `NVL(RETRY_COUNT, 0) + 1` 로 legacy NULL 무한 retry 차단.
  - retryLog affected=0 시 InternalServerErrorException — pk 정밀도 mismatch silent fail 차단.
  - createLog post-commit worker 조회 실패 → 200 응답 유지로 사용자 재시도 인한 중복 SCRAP 방지.
- 운영:
  - main.ts 에서 Node TZ 를 Asia/Seoul 로 강제 → setHours(0,0,0,0) 자정 의미를 컨테이너 TZ 와 분리.
  - migrations/README.md 추가 — 시퀀스 마이그 미적용 환경, cutover race 안전 절차 가이드.
  - create_log_sequences.sql IQC_TEMPLATES 블록 USER_TABLES 가드 추가.

## Files Touched

- apps/backend/src/main.ts
- apps/backend/src/migrations/2026-05-26_create_log_sequences.sql
- apps/backend/src/migrations/2026-05-26_physical_inv_session_uniq.sql (new)
- apps/backend/src/migrations/README.md (new)
- apps/backend/src/modules/equipment/services/consumable.service{.ts,.spec.ts}
- apps/backend/src/modules/interface/services/interface.service{.ts,.spec.ts}
- apps/backend/src/modules/master/services/iqc-template.service.ts
- apps/backend/src/modules/material/services/physical-inv.service{.ts,.spec.ts}
- apps/backend/src/modules/scheduler/executors/sql.executor{.ts,.spec.ts}
- apps/backend/src/modules/system/services/training.service.ts

## Verification

- `pnpm exec tsc --noEmit` → 0 error
- `pnpm exec jest --no-coverage` → 168 suites / 1671 tests PASS
- 신규/수정 마이그 SQL 은 사용자가 별도로 JSHANES 에 적용해야 함 (`apps/backend/src/migrations/README.md` 참고).

## Deferred / Operational Notes

- **#6 마이그 cutover race**: 코드 수정으로 막을 수 없는 운영 절차 항목. README 와 SQL 헤더 코멘트에 안전 절차 문서화. 실제 배포 시 사용자가 구 코드 인스턴스를 중지/quiesce 한 뒤 마이그를 실행할 것.
- **#8 마이그 미적용 위험**: README 의 smoke-test 체크리스트로 가이드. startup-time sequence existence probe 는 별도 task 로 분리 가능.
- **#11 iqc-template per-tenant 채번**: 현재는 글로벌 시퀀스 + 자릿수 9999 cap. per-tenant dense numbering 으로 전환 시 sequence 제거 + 별도 채번 테이블 필요. 비즈니스 결정 대기.
- 전배된 worker tenant fallback(#12) 은 PII 노출 측면에서 의도된 동작인지 비즈니스 확인 필요 (현재 결정: 워커는 글로벌 식별자라 가정하고 fallback 허용).

## Next AI Should

1. `AGENTS.md` 와 `.ai-coordination/*` 우선 읽기.
2. broad edit / DB change / review handoff 시 `PROTOCOL.md` 확인.
3. 편집 전 `LOCKS.md` 에 task ID 기록.
4. 신규 마이그 적용 여부는 사용자에게 명시적으로 확인.
5. 종료 전 본 핸드오프 갱신.
