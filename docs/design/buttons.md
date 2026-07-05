---
sources:
  - apps/frontend/src/components/ui/Button.tsx
  - apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx
verifiedCommit: 90ecd475
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
| 비활성 사유 노출 | 버튼을 비활성화할 때 이유가 있으면 `disabledReason`을 전달해 `title`/`aria-label`로 노출해야 한다 | `Button.tsx` L19, L89-121 |
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
