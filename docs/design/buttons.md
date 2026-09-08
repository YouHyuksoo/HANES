---
sources:
  - apps/frontend/src/components/ui/Button.tsx
  - apps/frontend/src/components/shared/HelpTooltip.tsx
  - apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx
verifiedCommit: 2bd66c2b
---

# 버튼 디자인 규칙

`apps/frontend/src/components/ui/Button.tsx`(단일 공통 버튼 컴포넌트)를 실측 소스로 삼는다.
프로젝트에 `components/ui/button*`(소문자, shadcn 스타일 분리 파일)는 존재하지 않는다 — 버튼은 이 파일 하나로 통합돼 있다.

## 규칙
| 항목 | 규칙 | 근거 |
|---|---|---|
| Variant 체계 | 버튼은 `primary`(기본 강조), `secondary`(카드 배경+테두리), `outline`(투명+테두리), `ghost`(배경 없음), `danger`(삭제/위험)의 5종만 사용해야 한다. 화면마다 임의 버튼 스타일을 새로 만들지 않는다 | `Button.tsx` L16, L51-79 |
| Size 체계 | 버튼 높이는 `sm`(h-9), `md`(h-10, 기본), `lg`(h-12) 3단계만 사용해야 한다 | `Button.tsx` L17, L82-86 |
| 우측 슬라이드 패널 액션 위치 | 우측 슬라이드 폼 패널의 저장/취소 버튼은 **패널 하단이 아니라 상단(헤더)**에 배치해야 한다 | 사용자 확정 규칙(feedback_panel_action_buttons_top), `PartFormPanel.tsx` L268-271 실제 구현(`<div className="flex items-center gap-2">` 안에 취소→저장 순으로 헤더에 위치) |
| 패널 액션 순서 | 패널 헤더에서 취소(`secondary`/`ghost`)를 먼저, 저장(`primary`)을 뒤에 배치해야 한다 | `PartFormPanel.tsx` L269-271 |
| 로딩 상태 | 비동기 액션 버튼은 `isLoading` prop으로 스피너(`Loader2`)를 표시하고, 로딩 중에는 자동으로 `disabled` 처리해야 한다. 별도 `disabled={loading}` 중복 관리를 하지 않는다 | `Button.tsx` L88, L105-113 |
| 비활성 사유 노출 | 버튼을 비활성화할 때 이유가 있으면 `disabledReason`을 전달해 컬럼 설명과 같은 공통 `HelpTooltip` 박스로 노출해야 한다. 현재 사유와 다음 행동을 구체적으로 작성하고 비활성 조건 자체는 변경하지 않는다 | `Button.tsx` L19, L89-121 |
| 모달 확인/취소 버튼 | `ConfirmModal`의 취소는 `ghost`, 확인은 상황에 따라 `primary`(일반) 또는 `danger`(파괴적 동작)를 사용해야 한다 | `components/ui/Modal.tsx`(`ConfirmModal` 내부 Button 사용부) |

## 사용 컴포넌트/토큰
- 공통 버튼: `apps/frontend/src/components/ui/Button.tsx` — props: `variant`, `size`, `isLoading`, `disabledReason`, `leftIcon`, `rightIcon`
- export 경로: `@/components/ui`(`index.ts`에서 `Button`, `ButtonProps` re-export)
- 아이콘은 `leftIcon`에 텍스트 앞, `rightIcon`에 텍스트 뒤 배치 — Lucide 아이콘을 직접 버튼 자식으로 나열하지 않는다.

## 금지 (안티패턴)
- 우측 슬라이드 패널의 저장/취소 버튼을 폼 하단에 배치하는 방식.
- `<button className="...">`을 화면마다 직접 작성해 `Button.tsx`의 variant 체계를 우회하는 방식.
- variant 5종 밖의 임의 색상 버튼(예: 화면 전용 `bg-purple-500` 버튼)을 새로 만드는 방식.
- 로딩 중임을 별도 텍스트("처리중...")로만 표시하고 `isLoading` prop을 쓰지 않는 방식.


## 비활성 안내 사용 기준 (2026-09-08)

- `Button disabledReason`은 비활성일 때 표준 박스를 표시한다. `isLoading`이면 처리중 안내를 자동 사용한다.
- 텍스트 버튼의 접근 가능한 이름은 액션명으로 유지한다. 설명을 버튼명으로 덮어쓰지 않는다.
- 공통 HelpTooltip은 포털 렌더, 키보드 포커스/Escape 닫기, 하단 공간 부족 시 상단 표시를 지원한다.
- 기존 raw 버튼/체크박스는 `<HelpTooltip description={reason} focusable={disabled}>`로 감싸고 비활성 자식에 `disabled:pointer-events-none`을 사용한다.
- 설명은 실제 disabled 조건과 같은 데이터에서 계산한다. 정책을 추정하거나 모든 비활성 버튼에 같은 추상 문구를 넣지 않는다.
- 업무 안내에는 DB 컬럼을 넣지 않는다. 기존 컬럼 설명의 DB 영역은 db prop을 지정했을 때만 표시한다.
- 영향 경로: Button.tsx → HelpTooltip.tsx → 각 호출부의 disabledReason. 공용 컴포넌트 변경 시 모달/전체너비 버튼/테이블 행 액션의 레이아웃과 키보드 사용을 함께 확인한다.
