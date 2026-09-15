# 미완료 작업 기록: 통전·단자검사 준비 인터락과 양불마스터 대조

- 작성시각: 2026-09-15 19:30 KST
- 작성자: claude (Opus 5)
- 작업 범위: `/inspection/result`(통전), `/inspection/terminal-result`(단자), `/master/inspect-aid`, 설비점검 게이트 공용화
- 현재 상태: 검증대기 (브라우저 실사용 검증만 남음)

## 완료한 것

- 설계·계획 문서: `docs/specs/2026-09-15-inspection-prep-interlock-sample-check-design.md`, `docs/plans/2026-09-15-inspection-prep-interlock-sample-check.md`
- DB (JSHANES 적용 완료, pre 0건 → post 확인):
  - `INSPECT_AIDS` + `INSPECT_TYPE` / `REQUIRED_YN` / `SORT_ORDER`
  - `INSPECT_SAMPLE_CHECKS`, `INSPECT_SAMPLE_CHECK_ITEMS` 신설, 인덱스 `IX_ISC_KEY`
  - `SEQ_SMP_CHK` + `SEQ_RULES('SMP_CHK')` (채번 확인: `SMC-20260915-0001`)
  - `COM_CODES INSPECT_TYPE.TERMINAL` 추가, INVALID 객체 0건, ERD 재생성
  - 검증용 한도견본 시드 2건(`LS-OK-0001`, `LS-NG-0001`, 품목 `N91H00-X9800-S-AB`, CONTINUITY, 필수)
- Backend:
  - `EquipInspectGateService` 신설(설비점검 인터락 단일 출처). `ProdResultService.assertEquipInspectGate`는 위임만.
  - `InspectSampleCheckService`(후보/상태/저장/이력) + 엔티티 2종 + DTO
  - `ContinuityInspectService.assertInspectPrepGate` / `getPrepStatus`, 검사 등록(`inspect`) 직전 게이트 호출
  - 작업자 검증: `EQUIP_MASTERS.CURRENT_WORKER_CODES` 미배정·불일치 시 400
  - API: `GET prep-status`, `GET sample-check/candidates`, `POST sample-check`, `GET sample-check/history`
  - 검사보조구 마스터 DTO/서비스에 3필드 반영(HOLDER는 `REQUIRED_YN='N'` 강제)
- Frontend:
  - 점검 모달 공용화: `apps/frontend/src/components/inspect/{DailyInspectModal,WorkerInspectModal}.tsx`(kioskStore 의존 제거), 키오스크는 얇은 래퍼
  - `InspectStationBar`(검사기+작업자 선택, 공용 `WorkerSelectModal`, 현재작업자 배정 API)
  - `useInspectPrepStatus`(prep 단일 객체), `InspectPrepCheckBar`(4단계), `SampleCheckModal`(견본 바코드 스캔), `SampleCheckHistoryModal`
  - `InspectPanel`은 `prep` 단일 prop, 준비 미완료 시 합격·불합격 버튼 비활성, 검사 등록에 대표 작업자 전달
  - i18n `ko/en/zh/vi` 4개 파일 키 추가(BOM 없음, JSON 파싱 확인)
- 도움말: `QC_INSPECT_AID`(user/operator) "검사화면 연동은 후속 범위" 문장 제거 후 실제 동작으로 교체, `INSP_RESULT`(user/operator)에 준비 4단계·작업자 선택·대조 절차 추가. `node tools/help-frontmatter-audit.mjs` 누락 0건.

## 미완료 / 남은 것

- 포트 3002/3003 브라우저 실사용 검증 (계획 Task 10 Step 2~3). 아래 10단계가 미수행:
  1. 검사기 선택 전 작업자 추가 버튼 비활성
  2. 작업자 미선택 시 합격·불합격 버튼 비활성 + 사유 툴팁
  3. 작업자 추가 후 새로고침 복원
  4. 설비일상점검·작업자설비점검 모달이 키오스크와 동일 동작(공용화 회귀)
  5. `[양/불체크 시작]` → 미등록 코드 스캔 거부 → 정상 스캔 후에만 판정 버튼 활성
  6. 불량 견본에 합격 입력 → NG, 검사 버튼 계속 비활성
  7. 재대조 정상 입력 → 준비 완료, 판정 버튼 활성
  8. 대조 이력에 NG·PASS 모두 표시
  9. `/inspection/terminal-result` 동일 동작
  10. `POST /quality/continuity-inspect/inspect` 직접 호출이 400으로 막히는지
- 위 검증 후 `INSPECT_SAMPLE_CHECKS` / `INSPECT_SAMPLE_CHECK_ITEMS` / `INSPECT_RESULTS.INSPECTOR_ID` 실제 적재 확인 (계획 Task 10 Step 3 쿼리)
- i18n locale 4개 파일(`apps/frontend/src/locales/{ko,en,zh,vi}.json`)은 **편집만 하고 커밋하지 않았다.** 같은 파일에 다른 세션(hanes-1b, material-issue FIFO 작업)의 미커밋 변경이 섞여 있어 파일 단위 커밋이 그 작업을 쓸어갈 수 있다. 사용자 확인 후 커밋 필요.

## 변경 파일

- `tools/sql/2026-09-15-inspect-sample-check.sql`, `tools/sql/2026-09-15-inspect-aid-seed.sql`: DDL·시드 (JSHANES 적용 완료)
- `docs/database/schema-erd.md`: ERD 재생성
- `apps/backend/src/modules/equipment/services/equip-inspect-gate.service.ts(+spec)`, `equipment.module.ts`: 게이트 단일 출처
- `apps/backend/src/modules/production/services/prod-result.service.ts(+spec)`: 게이트 위임
- `apps/backend/src/entities/{inspect-sample-check,inspect-sample-check-item,inspect-aid}.entity.ts`
- `apps/backend/src/modules/quality/continuity-inspect/**`: 서비스·DTO·컨트롤러·테스트
- `apps/backend/src/modules/master/{dto,services}/inspect-aid.*(+spec)`
- `apps/frontend/src/components/inspect/**`: 공용 점검 모달·타입·구조 테스트
- `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/{DailyInspectModal,WorkerInspectModal}.tsx`: 래퍼로 축소
- `apps/frontend/src/app/(authenticated)/inspection/result/**`: 훅·체크바·스테이션바·대조/이력 모달·패널·구조 테스트
- `apps/frontend/src/app/(authenticated)/master/inspect-aid/**`: 3필드 노출
- `apps/frontend/src/locales/{ko,en,zh,vi}.json`: i18n 키 추가 **(미커밋)**
- `apps/frontend/public/help/{user,operator}/ko/{QC_INSPECT_AID,INSP_RESULT}.md`

## 검증 상태

- 실행함: `pnpm --dir apps/backend run test:unit` (exit 0), 신규 spec 3종 통과 — 게이트 9건, 대조 서비스 13건, 게이트 통합 7건, 검사보조구 DTO 5건
- 실행함: `pnpm.cmd run typecheck:backend`, `typecheck:frontend` 오류 0
- 실행함: 프론트 구조 테스트 — `inspect-prep-gate`(5), `sample-check-modal`(4), `components/inspect/*`(11), `inspect-aid.structure`(7), 키오스크 `daily-inspect-row-key` 통과
- 실행함: JSHANES pre/post 쿼리, 채번 호출, INVALID 객체 0건 확인
- 실행함: `node tools/help-frontmatter-audit.mjs` 누락 0건
- 실행 못함: 포트 3002/3003 브라우저 시나리오. 두 포트를 `.worktrees/quality-control-plan-doc-system` 빌드가 점유 중(3002 PID 41424 Next.js, 3003 PID 34256 backend dist). 그 dist 빌드에는 이번 신규 API가 없어 그대로 검증해도 의미가 없다. 임의 대체 포트로 우회하지 않았다.

## 중단 사유

- 포트 점유 해제와 main worktree dev 서버 기동은 다른 세션(hanes-1b)의 작업에 영향을 주므로 사용자 결정이 필요하다.

## 다음 작업자가 바로 할 일

1. 3002/3003 점유 프로세스 정리 여부를 사용자와 확인한 뒤, main worktree에서 `pnpm dev`(또는 `pnpm dev:restart`) 기동.
2. 위 "미완료 / 남은 것"의 10단계를 `/inspection/result`에서 순서대로 수행. 시드 견본(`LS-OK-0001`, `LS-NG-0001`)이 붙은 품목 `N91H00-X9800-S-AB` 작업지시를 쓴다.
3. `INSPECT_SAMPLE_CHECKS`, `INSPECT_SAMPLE_CHECK_ITEMS`, `INSPECT_RESULTS.INSPECTOR_ID` 적재 확인.
4. locale 4개 파일 커밋 여부를 사용자와 정리(다른 세션 변경 혼입 주의).

## 주의사항

- 작업트리에 다른 세션의 미커밋 변경(material receiving/issue, menuConfig, pageRegistry, locales)이 있다. `git add -A`/디렉토리 add 금지, 파일 단위로만 스테이징할 것.
- 시드 한도견본은 **품목 `N91H00-X9800-S-AB` + CONTINUITY 한정**으로 넣었다. 이 품목의 통전검사는 이제 대조 없이는 등록되지 않는다. 테스트 후 불필요하면 `INSPECT_AIDS`에서 두 건을 지우거나 `REQUIRED_YN='N'`으로 낮춘다.
- `EQUIP_INSPECT_INTERLOCK='N'` 또는 `INSPECT_DAILY_INSPECT_REQUIRED='N'` / `INSPECT_WORKER_INSPECT_REQUIRED='N'` sys-config로 인터락을 끌 수 있다(기본 켜짐).
- DDL은 이미 JSHANES에 적용됐다. 되돌리려면 테이블 2개·컬럼 3개·시퀀스·SEQ_RULES·COM_CODES 항목을 함께 정리해야 한다.
