# claude Handoff

## Last Update

2026-06-11 18:05 (local)

## Completed

- 출하관리 잘못된 검증 데이터 전체 삭제: BOX/PALLET/SHIPMENT/SHIP_ORDER/OQC/PTX/PRODUCT_STOCKS 전부 0건으로 클린, FG 라벨 6건 VISUAL_PASS 원복. 가드 수정 보고서의 "BX2606090001 오염 데이터 정리 필요" 항목도 함께 해소됨. 상세는 JOURNAL 18:05.
- T-SHIP-CROSSBOX-GUARD: 교차 박스 중복 포장 가드 — `box.service.ts`에 `assertSerialsNotPackedElsewhere()` 추가, create/update/addSerial 3개 경로에서 다른 박스 SERIAL_LIST 검사 후 409. 단위테스트 17건(신규 4건) 통과, tsc 통과, API 실증 완료. 미커밋 상태. 잔여: ①기존 데이터 BX2606090001 serialList에 T001~T005 잔존(가드 이전 오염, 정리 필요), ②TOCTOU 완전 차단은 BOX_SERIALS 정규화 테이블 필요.
- 출하관리 8개 메뉴 실증 테스트 (코드 수정 없음): 포장→OQC→팔레트→출하지시→출하확정→역분개→취소→반품 전 구간 API+실DB 검증. 상태머신/재고 트랜잭션/역분개 일관성 모두 정상. 발견 이슈 5건은 JOURNAL 2026-06-11 17:50 항목 참조 — 핵심: ①교차 박스 중복 포장 허용(addSerial), ②fg/receive warehouseId 무시, ③반품 모듈 상태전이·재고처리 미구현, ④OQC 채번 MAX+1, ⑤시드 잔재 정합 깨짐. 테스트 데이터 *CLAUDETEST* 네이밍으로 DB 잔존.
- 스케줄러 알림 벨 임시 비활성화 (`1f439a7`): 폴링 60초→30분 + 백그라운드 탭 중지로 바꾼 뒤, 백엔드 미기동 시 ECONNREFUSED 에러 리포트 노이즈로 `Header.tsx`에서 `<NotificationBell />` 자체를 주석 처리. 재활성화는 Header의 주석 2곳(import, 렌더링)만 해제하면 됨.
- 앱 탭 동작 변경 (`2fd6335`): tabStore persist 제거(재진입 시 탭 초기화), MAX_TABS 6 + 초과 시 추가 차단·안내 모달(TabBar), useTabSync가 딥링크/새로고침 경로를 menuConfig(`findMenuItemByPath`)로 탭 자동 등록, TabKeepAlive MAX_ALIVE 6. i18n `tabs.limitTitle/limitMessage` 4개 언어 추가.
- 검증: frontend tsc --noEmit 통과, layout 구조 테스트 2건 통과, locale JSON 파싱 정상. dev 서버 가동 중이라 `pnpm build`는 미실행.

## In Progress / Watch

- 없음. LOCKS/TASKS는 비어 있음 (codex의 T-CUSTOMER-INTRO-HTML은 완료·해제됨).
- 주의: 탭은 이제 비영속이라 localStorage `harness-tabs` 키는 더 이상 사용하지 않음(잔존해도 무해). 탭 한도 정책 바꿀 땐 `tabStore.MAX_TABS`와 `TabKeepAlive.MAX_ALIVE`를 함께 조정할 것.
- 알림 벨을 다시 켜는 요청이 오면 Header 주석 해제 + 백엔드 `/scheduler/notifications/*` 기동 여부 확인.

## Next AI Should

1. Read `AGENTS.md`.
2. Read `.ai-coordination/README.md`, `STATE.md`, `TASKS.md`, `DECISIONS.md`, and `LOCKS.md`.
3. Read `PROTOCOL.md` for conflicts, stale locks, broad changes, DB changes, or review handoff.
4. Claim files in `LOCKS.md` before editing.
5. Keep `TASKS.md` active-work-only.
6. Update `JOURNAL.md` and its own handoff file before stopping.
