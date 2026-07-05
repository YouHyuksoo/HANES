---
sources:
  - docs/standards/master-part-page-standard.md
  - apps/frontend/src/hooks/useUnsavedGuard.ts
  - apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx
verifiedCommit: 64cde39a
---

# 레이아웃 디자인 규칙

기준 화면 `/master/part`(`docs/standards/master-part-page-standard.md`에서 실측 정리됨)와
공통 훅 `useUnsavedGuard`를 실측 소스로 삼는다. 마스터/기준정보류 화면의 좌측 목록 + 우측 슬라이드 패널 구조를 표준으로 한다.

## 규칙
| 항목 | 규칙 | 근거 |
|---|---|---|
| 페이지 헤더 | 제목/설명은 좌측, 주요 액션 버튼은 우측에 배치하고 한 줄로 유지해야 한다(여러 줄로 흩어 놓지 않는다) | `master-part-page-standard.md`(상단 액션 규칙 2, 나쁜 예시) |
| 상단 액션 순서 | 보조 액션(동기화/새로고침 등 outline 버튼) → 주요 생성 액션(primary 버튼) 순서로 고정해야 한다 | `master-part-page-standard.md`(상단 액션 규칙 1-4) |
| 목록 영역 | 필터 줄은 검색 입력을 맨 앞에 두고, 그 뒤에 선택형 필터(유형/사용여부 등)를 배치해야 한다. 그리드 옵션·전체화면 아이콘은 필터 줄 우측 끝에 둔다 | `master-part-page-standard.md`(목록 영역 규칙 1-3) |
| 상세/등록 UI | 등록/수정은 중앙 모달이 아니라 **우측 슬라이드 패널**을 우선해야 한다. 패널이 열려도 좌측 목록 구조와 배경 맥락은 유지해야 한다 | `master-part-page-standard.md`(우측 패널 규칙 1,5), 나쁜 예시(중앙 모달 전환 금지) |
| 패널 데이터 교체 | 우측 패널은 행 클릭마다 `key`로 리마운트하지 않고, 같은 컴포넌트 인스턴스가 `editingPart` 같은 prop 변화에 반응해 내부 폼 상태를 재계산하는 "equip식" 패턴을 따라야 한다 | `PartFormPanel.tsx`(`editingPart` prop 기반 `buildForm`, 리마운트 없이 상태 갱신) |
| 작성 중 데이터 보호 | 행 전환/새 항목/패널 닫기처럼 "작성 중인 내용을 버리는 동작"은 반드시 공통 `useUnsavedGuard`의 `guard()`로 감싸야 하고, 폼 패널은 `markDirty(dirty)`로 작성 중 여부를 부모에 보고해야 한다 | `useUnsavedGuard.ts` |
| 필수 필드 표시 | 폼 라벨의 필수 표시는 빨간 `*`를 라벨 옆에 붙여야 한다 | `master-part-page-standard.md`(우측 패널 규칙 6) |
| 폼 배치 | 기본정보 입력은 2열 그리드를 기본으로 하고, 코드성 값은 자유입력이 아닌 선택형 컴포넌트를 우선해야 한다 | `master-part-page-standard.md`(폼 배치 규칙 1-2) |

## 사용 컴포넌트/토큰
- 작성중 이탈 방지 훅: `apps/frontend/src/hooks/useUnsavedGuard.ts` — `markDirty(boolean)`, `guard(action)`, `guardModalProps`(그대로 `<ConfirmModal {...guardModalProps} />`에 스프레드)
- 우측 슬라이드 패널 참조 구현: `apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx`
- 슬라이드 애니메이션 클래스: `globals.css`의 `.animate-slide-in-right`, `.animate-slide-up`
- 레이아웃 상세 표준 문서: `docs/standards/master-part-page-standard.md`(품목 필드 변경 시 영향 파일 맵 포함)

## 금지 (안티패턴)
- 등록/수정 폼을 중앙 모달로 바꿔 목록 맥락을 끊는 방식(`master-part-page-standard.md` 나쁜 예시 1번).
- 상단 주요 액션을 여러 줄에 걸쳐 배치하는 방식(나쁜 예시 2번).
- 행 클릭마다 우측 패널 컴포넌트를 `key`로 강제 리마운트해 스크롤/포커스 상태를 잃는 방식.
- `guard()` 없이 작성 중 상태에서 바로 행을 전환하거나 패널을 닫아 입력 내용을 유실시키는 방식.
- 상태값을 색상만으로 표현하고 텍스트 표식을 제거하는 방식(나쁜 예시 3번, `overview.md` 파스텔 금지 규칙과 동일 취지).
