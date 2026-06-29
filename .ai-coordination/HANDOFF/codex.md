# codex Handoff

## 마지막 갱신

2026-06-29 12:58 KST

## 현재 상태

- Coordination은 enabled 상태다. 새 작업 전 `AGENTS.md`와 `.ai-coordination/{README,STATE,TASKS,DECISIONS,LOCKS}.md`를 확인한다.
- `T-ARCH-PAGE-RULE-REFORM`은 구현 완료로 `REVIEW_QUEUE.md`에 이동했고 active lock은 해제했다.
- HANES 전체 `apps/frontend/src/app/(authenticated)`의 `page.tsx` 기준 인라인 `ColumnDef` 검색 결과는 0건이다.
- 마지막 잔여 5개 화면까지 컬럼 분리를 완료했다:
  - `/customs/stock`
  - `/sales/customer-po-status`
  - `/outsourcing/receive`
  - `/quality/defect`
  - `/shipping/return`
- 각 화면은 `page.tsx` 인라인 `ColumnDef`를 제거하고 화면별 `*Columns.tsx` 팩토리와 필요 시 `types.ts`로 분리했다. 구조 테스트 `*-columns.structure.test.mjs`를 추가했다.

## 검증

- PASS `rg -n "ColumnDef<|const .*columns\\s*=\\s*useMemo<ColumnDef|const .*Columns\\s*=\\s*useMemo<ColumnDef" 'apps/frontend/src/app/(authenticated)' -g page.tsx` 결과 없음
- PASS 신규 5개 화면 구조 테스트 10/10
- PASS `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS `git diff --check`

## 현재 dirty worktree 주의

- 이번 codex 작업 파일 외에 `vendor-barcode`, `work-instruction`, `packages/shared/src/utils/*rules.ts` 변경이 같이 존재한다.
- 해당 파일들은 이번 컬럼 분리 커밋 범위가 아니므로 stage하지 않는다.
- `.ai-coordination/AGENTS_STATUS*.tmp` 임시 파일이 생기면 경로 확인 후 제거해도 된다.

## 다음 작업 후보

- 리뷰 승인 후 `T-ARCH-PAGE-RULE-REFORM`을 `ARCHIVE.md`로 이동한다.
- 업무 규칙 중앙화 추가 작업은 화면별로 새 task/lock을 잡고 진행한다.
