---
sources:
  - apps/frontend/src/app/globals.css
  - apps/frontend/src/components/ui/Modal.tsx
  - apps/frontend/src/components/ui/Badge.tsx
  - docs/standards/anti-patterns.md
verifiedCommit: 08949e5b
---

# 디자인 시스템 개요

이 문서는 `docs/design/` 8개 문서(overview, theme, layout, buttons, data-grid, navigation, modals, forms)의 색인이며,
전 화면에 공통 적용되는 최상위 금지 규칙을 정의한다. 세부 규칙은 각 개별 문서를 따른다.

## 규칙
| 항목 | 규칙 | 근거 |
|---|---|---|
| 배경색 | 카드/배지/행 등 상태 구분에 파스텔 배경(`bg-green-50`, `bg-red-50`, `bg-blue-50` 등 `-50` 셰이드)을 사용해서는 안 된다. 텍스트 색상 또는 테두리(`border-*`)로 구분해야 한다 | 사용자 확정 규칙(feedback_no_pastel_colors), `globals.css` safelist가 `-50` 셰이드를 제외하고 `100,200,300,600,700,800,900`만 허용 |
| 브라우저 네이티브 다이얼로그 | `alert()`, `confirm()`, `window.prompt()`를 사용해서는 안 된다. 확인/경고는 `ConfirmModal`(`components/ui/Modal.tsx`), 입력은 `Modal` 기반 폼 패널을 사용해야 한다 | 사용자 확정 규칙, `Modal.tsx`의 `ConfirmModal` export |
| 아이콘 | Lucide 아이콘을 화면 장식 목적으로 무작위 배치해서는 안 된다. 버튼/배지/상태 표시 등 의미가 있는 자리에만 사용해야 한다 | AI-slop 안티패턴 |
| 반복 화면 구조 | 필터·목록·상세 UI를 화면마다 새로 작성하지 말고 `components/shared/`, `components/ui/`, `components/data-grid/`의 공통 컴포넌트를 우선 검토해야 한다 | `docs/standards/anti-patterns.md`(UI 안티패턴 2번) |
| 코드성 값 | 상태/유형처럼 코드화된 값은 자유입력 텍스트가 아니라 공통코드 선택 컴포넌트(`ComCodeSelect`)나 배지(`StatusBadge`)로 표시해야 한다 | `forms.md`, `data-grid.md` 참조 |

## 문서 색인
- [theme.md](./theme.md) — Tailwind v4 CSS 토큰(OKLCH), 다크모드, 색상 테마 전환
- [layout.md](./layout.md) — 페이지 골격, 좌측 목록 + 우측 슬라이드 패널 표준
- [buttons.md](./buttons.md) — 버튼 variant/size, 패널 액션 버튼 배치
- [data-grid.md](./data-grid.md) — DataGrid, 컬럼 팩토리, 상태 배지 단일출처
- [navigation.md](./navigation.md) — 메뉴 설정 구조, 메뉴 추가 워크플로우
- [modals.md](./modals.md) — 모달 크기 표준
- [forms.md](./forms.md) — QtyInput, BarcodeScanInput, ComCodeSelect, 날짜 기본값

## 사용 컴포넌트/토큰
- 전역 토큰: `apps/frontend/src/app/globals.css` (`:root`, `.dark`, `@theme inline`)
- 확인/경고 모달: `apps/frontend/src/components/ui/Modal.tsx`의 `ConfirmModal`
- 의미별 배지: `apps/frontend/src/components/ui/Badge.tsx` (variant: info/success/warning/error/neutral, 모두 `-100` 셰이드)

## 금지 (안티패턴)
- `bg-*-50` 계열 파스텔 배경을 카드·배지·강조 영역에 사용 — 현재 코드베이스에도 잔존 위반이 있다(예: `components/production/JobOrderSelectModal.tsx`, `components/material/IqcModal.tsx`의 hover 상태). 신규 작성 시 재사용 금지, 발견 시 리팩터링 대상으로 취급한다.
- `window.confirm()` 사용 — 현재 `app/(authenticated)/production/specification-setup/page.tsx`에 잔존 위반이 있다. 신규 코드에서 재사용 금지.
- 목적 없는 그라디언트, 과도한 글래스모피즘, 화면마다 다른 버튼 스타일 체계.
- 상태값을 색상으로만 구분하고 텍스트 라벨을 생략하는 방식.
