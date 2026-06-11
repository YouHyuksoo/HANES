# LOCKS

Before editing, add a lock entry. Mark it released when done.

## Active Locks

```md
- T-KIOSK-FLOW-FIX (claude, 2026-06-11): 키오스크 단절 3건 수정 — 백플러시 설정 시드, by-order-no 실적 집계, 진행률 서버 기준화, 스캔 LOT 우선 차감. 파일: `apps/backend/src/migrations/2026-06-11_mat_auto_issue_config_seed.sql`, `apps/backend/src/modules/production/services/{job-order.service.ts,auto-issue.service.ts,auto-issue.service.spec.ts}`, `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx`, `apps/frontend/src/stores/kioskStore.ts`
```

## History

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
