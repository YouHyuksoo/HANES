# codex Handoff

## 마지막 갱신

2026-06-29 07:55 KST

## 현재 상태

- Coordination은 enabled 상태다. 수정 전 `AGENTS.md`와 `.ai-coordination/{README,STATE,TASKS,DECISIONS,LOCKS}.md`를 읽는다.
- 현재 codex 소유 coordination 범위는 `T-ARCH-PAGE-RULE-REFORM`이며 `.ai-coordination/JOURNAL.md`, `.ai-coordination/HANDOFF/codex.md`를 포함한다.
- `T-ARCH-PAGE-RULE-REFORM` slice로 active lock 없는 18개 화면 컬럼 분리를 완료했다.
- 완료 화면:
  - `/system/department`
  - `/production/pack-result`
  - `/equipment/mold`
  - `/production/progress`
  - `/quality/rework-inspect`
  - `/material/scrap`
  - `/production/result-summary`
  - `/equipment/calibration-history`
  - `/equipment/pm-result`
  - `/equipment/pm-plan`
  - `/equipment/inspect-history`
  - `/equipment/mold-mgmt`
  - `/inspection/history`
  - `/inspection/structure`
  - `/interface/log`
  - `/outsourcing/vendor`
  - `/outsourcing/order`
  - `/sales/customer-po`
- 각 화면은 `page.tsx` 인라인 `ColumnDef`를 제거하고 화면별 `*Columns.tsx` 팩토리와 필요 시 `types.ts`로 분리했다. 구조 테스트 `*-columns.structure.test.mjs`를 추가했다.
- 검증:
  - PASS `node --test` 대상 컬럼 구조 테스트 18개 파일
  - PASS `git diff --cached --check` 대상 커밋 파일
- 참고: 마지막 전체 frontend `tsc`는 다른 세션/범위 파일인 `quality/aql/page.tsx`, `quality/oqc-history/page.tsx`의 미완성 컬럼 분리 오류로 실패했다. 해당 파일은 codex T-ARCH 범위가 아니어서 수정하지 않았다.
- 현재 dirty worktree 전체를 codex 작업으로 가정하지 않는다. master DTO/page/column-rule 관련 변경이 이미 많이 있으므로 보존한다.

## 최근 codex 완료

- 커밋 `2f783199 Add route code map generator`.
- AI 없이 실행 가능한 route code-map generator를 추가했다:
  - `tools/code-map/src/generate.mjs`
  - `tools/code-map/tests/pilot-code-map.test.mjs`
  - `.code-map/index.json`
  - `docs/reports/code-map.md`
  - `package.json` scripts: `code-map:generate`, `code-map:test`
- 현재 code-map 범위: `/master/bom`, `/master/routing`, `/production/order`.
- code-map 출력은 menu route -> page/import graph -> API -> Controller -> Service method -> method-level tables -> Entity columns 흐름을 추적한다.
- 커밋 전 검증:
  - PASS `pnpm.cmd code-map:test`
  - PASS `pnpm.cmd code-map:generate`
  - PASS `git diff --cached --check`

## 현재 dirty worktree 주의

- active coordination 작업 때문에 coordination 문서가 dirty 상태다.
- master DTO/page refactor 파일과 generated column 파일 등 무관한 application 파일이 많이 dirty 상태다.
- 미추적 항목에는 `db_dumps/`, 여러 `scripts/*.py`, generated master column structure test가 포함된다.
- 사용자가 명시하지 않으면 이 항목들을 정리, stage, revert하지 않는다.

## 다음 작업 후보

- code-map을 계속하면 pilot route에서 선택한 실제 메뉴로 확장하고, 애매한 controller/API match에 confidence marker를 추가한다.
- architecture refactor를 계속하면 `docs/reports/architecture-improvement-candidates.md`를 기준으로 삼고 `.ai-coordination/LOCKS.md`의 active lock을 존중한다. 다음 컬럼 분리는 `master/*`, 출하 서비스, quality/defect, trace, inventory/consumables/customs/system batch lock 등을 피해서 고른다.
- 다음 커밋 시 요청 범위만 stage한다. worktree는 의도적으로 dirty 상태다.

## 정리 기록

- 이전 handoff가 너무 길어져 2026-06-29에 압축했다.
- 오래된 상세 handoff 내용은 반복하지 않는다. 과거 세부 정보가 필요하면 git history를 사용한다.
