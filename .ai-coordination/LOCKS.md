# LOCKS

Before editing, add a lock entry. Mark it released when done.

## Active Locks

```md
- task: T-DOCS-KNOWLEDGE-WIKI
  owner: claude
  files:
    - wiki/** (신규 디렉토리 — docs/는 읽기 전용으로만 사용)
    - .ai-coordination/LOCKS.md
  started: 2026-06-12 01:32 KST
  last_seen: 2026-06-12 01:32 KST
  expires: 2026-06-12 03:30 KST
  status: stale

```

## History

- T-KIOSK-AUTOISSUE-BOM-MISMATCH-GUARD (codex, 2026-06-12): 키오스크 스캔 LOT가 BOM 품목과 불일치하면 실적처리/자동차감 전 중단하도록 방어 추가 후 lock 해제. 파일: `apps/backend/src/modules/production/services/auto-issue.service.ts`, `apps/backend/src/modules/production/services/auto-issue.service.spec.ts`.

- T-CUSTOMER-INTRO-PPTX-EXPORT (codex, 2026-06-12): 고객 소개 HTML 23장 기준 편집 가능한 PPTX 재생성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.pptx`.

- T-QUALITY-INSPECT-USEMEMO (codex, 2026-06-12): `/quality/inspect` 화면 `useMemo is not defined` 런타임 오류 수정 완료 후 lock 해제. 파일: `apps/frontend/src/app/(authenticated)/quality/inspect/page.tsx`.

- T-INV-TRANSACTION-CARDS (codex, 2026-06-12): `/inventory/transaction` 상단 정보카드 3개 제거 완료 후 lock 해제. 파일: `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx`.

- T-CUSTOMER-INTRO-HTML-DESIGN (codex, 2026-06-12): 고객 소개 HTML의 카드형 AI 느낌을 줄이고 산업형 색상/공정 보드 레이아웃으로 재정리 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`.

- T-CUSTOMER-INTRO-HTML-V2 (codex, 2026-06-12): 작업지시서 기준 고객 소개 HTML을 22장 가로형 슬라이드로 재구성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`.

- T-EQUIP-INSPECT-POOL-TYPE (claude, 2026-06-11): 점검항목 풀에 EQUIP_TYPE 추가, equip-inspect-item 마스터 페이지를 설비유형 기준 POOL 편집기로 전환, equip-inspect 추가 모달이 설비유형으로 풀 조회하도록 수정 완료 후 lock 해제. JSHANES 컬럼 적용·typecheck·구조테스트 통과. 파일: `apps/backend/src/migrations/2026-06-11_equip_inspect_pool_equip_type.sql`, `apps/backend/src/entities/equip-inspect-item-pool.entity.ts`, `apps/backend/src/modules/master/dto/equip-inspect-item-pool.dto.ts`, `apps/backend/src/modules/master/services/equip-inspect-item-pool.service.ts`, `apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx`, `apps/frontend/src/app/(authenticated)/master/equip-inspect/{types.ts,components/AddInspectItemModal.tsx,components/EquipAssignTab.tsx,components/ItemMasterTab.tsx}`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`.

- T-ROUTING-TREE-OVERFLOW (claude, 2026-06-11): 라우팅 BOM 트리가 우측 패널 침범하는 레이아웃 버그 수정(grid 자식 min-w-0 + 트리 overflow-auto) 완료 후 lock 해제. 파일: `apps/frontend/src/app/(authenticated)/master/routing/{page.tsx,components/RoutingGroupManager.tsx}`.

- T-DATA-CLEAN-HNS02 (codex, 2026-06-11): JSHANES HNS02 BOM 기준 데이터 클린징 실행 완료 후 lock 해제. HNS02 기준 `ITEM_MASTERS`/`BOM_MASTERS` 47건만 유지, 요청 업무 데이터 및 비-HNS02 `ITEM_CODE` 잔여 0건 확인. 범위: JSHANES DB 데이터, `.ai-coordination/*`.
- T-IQC-SAMPLE-REMOVE (codex, 2026-06-11): IQC 검사구분에서 SAMPLE 제거, 기존 마스터 SAMPLE은 FULL로 정규화 완료 후 lock 해제. `IQC_LOGS.INSPECT_CLASS`는 별개/legacy 이력 컬럼으로 보고 기존 값은 변경하지 않음. 파일: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`, `apps/backend/src/modules/master/{dto/iqc-group.dto.ts,services/iqc-group.service.ts,services/iqc-group.service.spec.ts}`, `apps/backend/src/modules/material/{dto/iqc-history.dto.ts,services/iqc-history.service.ts}`, `apps/backend/src/entities/{iqc-log.entity.ts,iqc-group.entity.ts,part-master.entity.ts}`, `apps/frontend/src/components/material/{IqcModal.tsx,IqcTable.tsx}`, `apps/frontend/src/hooks/material/useIqcData.ts`, `apps/frontend/src/app/(authenticated)/master/{part,iqc-item}/**`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`, `packages/shared/src/constants/com-code-values.ts`.
- T-PDA-RECEIVE-WORKER-GUARD (claude, 2026-06-11): PDA 자재입고 사전 게이트 검증·사용자 메시지 모달 + 작업자 스캔 등록·workerId 저장 완료 후 lock 해제. 파일: `apps/frontend/src/hooks/pda/useMatReceivingScan.ts`, `apps/frontend/src/app/pda/material/receiving/{page.tsx,components.tsx}`.

- T-IQC-MODAL-POOL-ITEMS (claude, 2026-06-11): IQC 검사결과 모달이 풀 검사항목 전체+검사기준 표시하도록 수정 완료 후 lock 해제. 파일: `apps/backend/src/modules/master/{controllers/iqc-part-link.controller.ts,services/iqc-part-link.service.ts}`, `apps/backend/src/migrations/2026-06-11_iqc_group_chain_repair_seed.sql`, `apps/frontend/src/components/material/IqcModal.tsx`.
- T-REINSPECT-MOVE-LEDGER (claude, 2026-06-11): 유수명 재검 불합격 수불 양품출고/불용입고 2건 분리 완료 후 lock 해제. 파일: `apps/backend/src/modules/material/services/shelf-life-reinspect.service.{ts,spec.ts}`, `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx`.
- T-IQC-METHOD-LABELS (codex, 2026-06-11): IQC 검사구분 라벨을 검사/무검사로 통일 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`, `apps/frontend/src/components/material/IqcModal.tsx`, `apps/frontend/src/components/material/IqcTable.tsx`, `apps/frontend/src/app/(authenticated)/master/part/page.tsx`, `apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx`, `apps/frontend/src/app/(authenticated)/master/iqc-item/components/{IqcGroupTab.tsx,IqcGroupModal.tsx,IqcLinkModal.tsx,IqcLinkTab.tsx,IqcDetailPanel.tsx}`, `apps/frontend/src/app/(authenticated)/material/iqc/page.tsx`, `apps/frontend/src/app/(authenticated)/inspection/history/page.tsx`, `packages/shared/src/{types/com-code.ts,constants/com-code-values.ts}`.
- T-MAT-LOT-IQC-UID-SEPARATE (codex, 2026-06-11): MAT_LOTS 시드 LOT와 IQC_LOGS UID 중복 해소 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_mat_lot_iqc_uid_separate.sql`.
- T-IQC-CODE-ALIGN (codex, 2026-06-11): IQC 검사방법/검사유형 공통코드 분리 및 화면 매핑 통일 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`, `apps/backend/src/modules/material/dto/iqc-history.dto.ts`, `apps/backend/src/modules/material/services/iqc-history.service.ts`, `apps/frontend/src/app/(authenticated)/master/part/page.tsx`, `apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx`, `apps/frontend/src/app/(authenticated)/master/part/components/IqcSettingModal.tsx`, `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupTab.tsx`, `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupModal.tsx`, `apps/frontend/src/app/(authenticated)/material/iqc/page.tsx`, `apps/frontend/src/components/material/IqcTable.tsx`, `apps/frontend/src/components/material/IqcModal.tsx`, `apps/frontend/src/app/(authenticated)/material/iqc-history/page.tsx`, `apps/frontend/src/app/(authenticated)/material/iqc/iqc-code-groups.structure.test.mjs`, `packages/shared/src/types/com-code.ts`, `packages/shared/src/constants/com-code-values.ts`, `docs/reports/db-schema-erd.md`.
- T-PROCESS-EQUIP-SEED (codex, 2026-06-11): 공정별 설비 마스터/공정-설비 매핑 시드 데이터 생성 및 JSHANES 적용 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_process_equipment_seed.sql`.
- T-KIOSK-FLOW-FIX (claude, 2026-06-11): 키오스크 단절 수정(백플러시 시드, by-order-no 집계, 진행률 서버화, 스캔 LOT 우선, 역분개 fromWarehouseId) 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_mat_auto_issue_config_seed.sql`, `apps/backend/src/modules/production/services/{job-order.service.ts,auto-issue.service.ts,auto-issue.service.spec.ts}`, `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx`, `apps/frontend/src/stores/kioskStore.ts`.

- T-MENU-SHELF-LIFE-REINSPECT (codex, 2026-06-11): 유수명자재 재검사 메뉴 미배치/카테고리 이동 오류 수정 완료 후 lock 해제. 파일: `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`, `apps/backend/src/modules/menu-categories/utils/menu-code-validator.structure.test.mjs`, `apps/backend/src/migrations/2026-06-11_shelf_life_reinspect_menu_restore.sql`.
- T-FE-THEME-PRESET (codex, 2026-06-11): 상단 컬러 테마 아이콘에서 선택 가능한 Orchid preset 추가 완료 후 lock 해제. 파일: `apps/frontend/src/app/globals.css`, `apps/frontend/src/stores/themeStore.ts`, `apps/frontend/src/components/layout/Header.tsx`.
- T-OQC-SHIP-TOGGLE (claude, 2026-06-11): OQC 사용여부 설정 추가 + 출하 3개 게이트 조건부 적용 완료 후 lock 해제. 파일: `apps/backend/src/modules/shipping/shipping.module.ts`, `apps/backend/src/modules/shipping/services/{ship-order.service.ts,shipment.service.ts}`, `apps/backend/src/migrations/2026-06-11_oqc_enabled_config_seed.sql`.

- T-PALLET-SCREEN-FIX (claude, 2026-06-11): 팔레트 화면-백엔드 계약 정합 + 팔레트 자동채번 완료 후 lock 해제. 파일: `apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx`, `apps/backend/src/shared/numbering.service.ts`, `apps/backend/src/modules/shipping/{dto/pallet.dto.ts,services/pallet.service.ts,services/pallet.service.spec.ts}`, `apps/backend/src/migrations/2026-06-11_seq_pallet_no_daily.sql`, `locales/{ko,en,zh,vi}.json`.
- T-PDA-API-UNIFY (claude, 2026-06-11): PDA 자재출고/출하 훅 웹 동일 계약 통일 완료 후 lock 해제. 파일: `apps/frontend/src/hooks/pda/useMatIssuingScan.ts`, `useShippingScan.ts`, `useShippingScan.types.ts`, `app/pda/material/issuing/*`, `app/pda/shipping/*`, `locales/{ko,en,zh,vi}.json`.
- T-SHIP-CROSSBOX-GUARD (claude, 2026-06-11): 교차 박스 중복 포장 가드 추가 완료 후 lock 해제. 파일: `apps/backend/src/modules/shipping/services/box.service.ts`, `apps/backend/src/modules/shipping/services/box.service.spec.ts`.
- T-TAB-LIMIT-10 (codex, 2026-06-11): 페이지 탭 제한 개수를 10개로 변경 완료 후 lock 해제. 파일: `apps/frontend/src/stores/tabStore.ts`, `apps/frontend/src/components/layout/TabKeepAlive.tsx`.
- T-CUSTOMER-INTRO-WORK-INSTRUCTION (codex, 2026-06-11): 고객용 제품 소개 자료 재생성 작업지시 문서 작성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction-work-instruction.md`.
- T-CUSTOMER-INTRO-MENU-SCREEN-DECK (codex, 2026-06-11): 현재 메뉴 화면 캡처 기반으로 고객용 제품 소개 PPTX/HTML을 15장으로 확장 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/hanes-mes-introduction.pptx`, `docs/presentation/assets/menu-captures/*`.
- T-CUSTOMER-INTRO-PRODUCT-DECK (codex, 2026-06-11): 고객용 제품 소개 자료로 HTML/PPTX 전면 재작성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/hanes-mes-introduction.pptx`.
- T-CUSTOMER-INTRO-PPTX (codex, 2026-06-11): 고객 소개용 가로형 PPTX 문서 생성, 레이아웃 검사 및 패키지 검증 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.pptx`.
- T-CUSTOMER-INTRO-HTML-REV (codex, 2026-06-11): 고객 소개 HTML 자료를 12장 워크플로우형으로 재구성하고 글자 크기/넘침 보정 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`.
- T-CUSTOMER-INTRO-HTML (codex, 2026-06-11): 고객 소개용 HTML 자료 생성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/assets/*`.
