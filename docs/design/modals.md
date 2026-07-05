---
sources:
  - apps/frontend/src/components/ui/Modal.tsx
verifiedCommit: 90ecd475
---

# 모달 디자인 규칙

`apps/frontend/src/components/ui/Modal.tsx`(공통 `Modal` + `ConfirmModal`)를 실측 소스로 삼는다.
`dialog*`/`modal*`이라는 이름의 별도 파일은 없다 — 이 파일 하나가 프로젝트의 유일한 모달 컴포넌트다.

## 규칙
| 항목 | 규칙 | 근거 |
|---|---|---|
| 크기 체계 | 모달 크기는 `sm`(384px), `md`(512px), `lg`(576px), `xl`(672px), `2xl`(1024px), `full`(90vw/90vh) 6단계만 사용해야 한다 | `Modal.tsx` L24, L69-76 |
| 확인/알림 모달 | 단순 확인/경고(삭제 확인, 저장하지 않은 변경 등)는 **`md` 이상**을 사용해야 한다. `ConfirmModal`은 내부적으로 `size="md"`를 고정 사용한다 | `Modal.tsx` L199-203(`ConfirmModal`이 `size="md"` 하드코딩) |
| 일반 폼 모달 | 입력 필드가 여러 개인 등록/수정 폼 모달은 **`lg` 이상**을 사용해야 한다 | 실사용 예: `BomFormModal.tsx`, `AddCalendarModal.tsx`, `RoutingGroupManager.tsx` 그룹 모달이 `size="lg"` 또는 `size="md"`(단순 폼)를 사용 |
| DataGrid 포함 모달 | 내부에 `DataGrid`/표 형태 목록을 포함하는 모달은 **`xl` 이상**을 사용해야 한다 | 실사용 예: `PartFormModal.tsx`(품목 폼+이미지, `size="xl"`), `BomUploadModal.tsx`(업로드 미리보기 표, `size="xl"`), `FgLabelSelectModal.tsx`(라벨 목록, `size="xl"`), `IqcTemplatePickerModal.tsx`(템플릿 표, `size="xl"`) |
| 닫기 동작 | 모달은 ESC 키(`closeOnEsc`)와 오버레이 클릭(`closeOnOverlayClick`) 양쪽으로 닫히는 것을 기본값으로 해야 한다. 작성 중 데이터가 있는 폼 모달은 이 기본 닫기 대신 `layout.md`의 `useUnsavedGuard`로 감싸야 한다 | `Modal.tsx` L26-27, L44-64 |
| 파괴적 확인 | 삭제 등 되돌릴 수 없는 동작의 확인 모달은 `ConfirmModal`의 `variant="danger"`를 사용해 아이콘/버튼을 위험색으로 표시해야 한다 | `Modal.tsx` L152-176(`isDanger` 분기) |
| 렌더링 위치 | 모달은 `createPortal(modalContent, document.body)`로 body 최상단에 렌더링해 z-index 문제를 피해야 한다 | `Modal.tsx` L140 |

## 사용 컴포넌트/토큰
- 공통 모달: `apps/frontend/src/components/ui/Modal.tsx` — props: `isOpen`, `onClose`, `title`, `size`, `footer`, `closeOnOverlayClick`, `closeOnEsc`
- 확인 다이얼로그 헬퍼: 같은 파일의 `ConfirmModal` — props: `onConfirm`, `message`, `variant('default'|'danger')`, `isLoading`. 문자열 메시지는 클립보드 복사 버튼을 자동 제공한다(`copyText`)
- export 경로: `@/components/ui`(`index.ts`에서 `Modal`, `ConfirmModal` re-export)
- 헤더/본문/푸터 구조: 헤더(제목+닫기), 본문(`max-h-[75vh]` 스크롤), 푸터(우측 정렬 액션)로 고정된 3단 구조

## 금지 (안티패턴)
- `size` 6단계 밖의 임의 `max-w-[Npx]`를 컴포넌트별로 재정의하는 방식.
- `window.alert()`/`window.confirm()`으로 확인 흐름을 대체하는 방식 — 반드시 `ConfirmModal`을 사용해야 한다(`overview.md` 참조).
- DataGrid나 다컬럼 표를 `sm`/`md` 모달에 욱여넣는 방식(가로 스크롤/줄바꿈으로 가독성이 깨진다).
- 작성 중인 폼 모달을 오버레이 클릭 한 번으로 아무 경고 없이 닫는 방식.
