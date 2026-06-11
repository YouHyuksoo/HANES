# JOURNAL

Append new entries at the top.

Use this heading format for every new entry:

```md
## YYYY-MM-DD HH:mm Agent
```

Use local time in 24-hour format.

## 2026-06-11 12:56 Codex

- 작업: `T-CUSTOMER-INTRO-PPTX` 고객 소개용 HANES MES 가로형 PPTX 문서 생성.
- 산출물: `docs/presentation/hanes-mes-introduction.pptx`.
- 구성: HTML 소개 자료의 12장 워크플로우 구성을 PowerPoint 문서로 변환. 고객 설명용으로 기준정보, 자재 LOT, 생산/키오스크, 검사/품질, 불량 조치, 제품/출하 추적 흐름과 핵심 장점을 간결하게 구성.
- 검증: artifact-tool로 PPTX 빌드 완료. 레이아웃 검사 결과 12개 슬라이드 기준 오류 0개. PPTX 패키지 검증 결과 슬라이드 12장, 미디어 9개, 빈 미디어 0개. 렌더 contact sheet로 전체 슬라이드 시각 확인 완료.
- 정리: 빌드용 임시 작업 폴더 `outputs/019eb42d-791a-7821-9b1c-7a16a7d3686e/presentations/hanes-mes-introduction` 삭제 완료.

## 2026-06-11 12:39 Codex

- 작업: `T-CUSTOMER-INTRO-HTML-REV` 고객 소개 HTML 자료 워크플로우형 보강.
- 변경: 기존 8장 자료를 12장으로 재구성. 글자 크기 축소, 제목 침범/겹침 보정, `기준정보 → 자재 입하 → IQC/입고 → 생산 준비 → 현장 실행 → 검사/품질 → 제품/출하` 순서의 워크플로우 맵 추가.
- 메뉴 보강: 품목마스터, BOM 관리, 공정/라인, 라우팅, IQC품목규격, 설비점검항목, 월간생산계획, 작업지시관리, 자재출고요청, 생산진도현황, WIP재고, 실적입력 키오스크, 통전검사 실적, 불량등록관리, 수리/재작업, OQC, SPC, 제품재고조회, 포장, 출하지시, 출하처리, 반품관리 등을 소개 흐름에 노출.
- 검증: 로컬 Chrome + Playwright로 `docs/presentation/hanes-mes-introduction.html` 로드 확인. 슬라이드 12개, 본문 이미지 9개 참조 모두 로드, 모든 `.canvas` overflow X/Y 없음 확인.

## 2026-06-11 12:27 Claude

- 작업 1: 스케줄러 알림 벨 임시 비활성화 (커밋 `1f439a7`).
  - `NotificationBell.tsx` 폴링 60초 → 30분, 백그라운드 탭 폴링 중지(`visibilitychange` 시 즉시 갱신).
  - 백엔드 미기동 시 unread-count 폴링이 ECONNREFUSED 에러 리포트 모달을 띄우는 노이즈 때문에 `Header.tsx`에서 `<NotificationBell />` 렌더링·import 주석 처리. 재활성화는 Header 주석 2곳 해제.
- 작업 2: 앱 탭 재진입 초기화 + 최대 6개 제한 (커밋 `2fd6335`).
  - `tabStore.ts`: zustand persist 제거(비영속) → 새로고침/재진입 시 탭 초기화. `MAX_TABS=10→6`, 초과 시 자동 제거 대신 추가 차단 + `limitNoticeOpen` 플래그, `addTab`이 boolean 반환.
  - `useTabSync.ts`: 현재 경로 탭이 없으면(딥링크/새로고침) `findMenuItemByPath`(menuConfig 신규 유틸)로 탭 자동 등록 — 비영속 전환 후 빈 화면 방지.
  - `SidebarMenu.tsx`: 탭 추가 차단 시 `e.preventDefault()`로 페이지 이동도 차단. `TabBar.tsx`: 한도 초과 안내 Modal(md). `TabKeepAlive.tsx`: `MAX_ALIVE 8→6`.
  - i18n: `tabs.limitTitle`/`tabs.limitMessage` ko/en/zh/vi 4개 파일 추가.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과, 구조 테스트 2건 통과(sidebar-menu-navigation, tab-keep-alive-unique-paths), locale JSON 4종 파싱 정상. dev 서버 가동 중이라 `pnpm build` 미실행.

## 2026-06-11 12:00 Codex

- 작업: `T-CUSTOMER-INTRO-HTML` 고객 소개용 HANES MES 가로형 HTML 자료 생성.
- 산출물: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/assets/01-material-receive.png`, `02-input-kiosk.png`, `03-inspection-result.png`, `04-quality-defect.png`, `05-shipping-box-stock.png`.
- 구성: 16:9 가로 슬라이드 8장. 하네스 업종 특성에 맞춰 자재 LOT/시리얼 추적, 키오스크 작업, 통전검사, 불량관리, 박스/개별제품 출하 추적성을 고객 소개 관점으로 요약.
- 검증: 로컬 Chrome + Playwright로 HTML 로드 확인, 슬라이드 수 8개 확인, 본문 이미지 5개 모두 `naturalWidth=1600`, `naturalHeight=900` 로드 확인.
- 참고: `/shipping/pack`, `/shipping/order`, `/production/pack-result`는 `domcontentloaded` 대기에서 타임아웃되어 소개자료에는 안정적으로 캡처된 `/shipping/box-stock`을 사용.
