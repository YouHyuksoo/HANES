# claude Handoff

## Last Update

2026-06-11 12:27 (local)

## Completed

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
