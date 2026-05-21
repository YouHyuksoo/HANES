# 개선요청 등록 기능 (Improvement Request) 설계 문서

## 개요

모든 페이지에서 공통으로 사용 가능한 개선요청 등록 기능. 사용자가 UI 요소를 클릭하여 시각적으로 선택하고, 해당 요소에 대한 개선 설명을 입력하면 DB에 저장된다. AI(Claude Code)가 DB를 직접 조회하거나 관리 UI를 통해 내용을 확인하고 구현에 반영한다.

---

## 아키텍처

### 전체 구조

```
[MainLayout]
  └── <ImprovementFAB />           ← 항상 화면 우하단에 떠 있는 FAB 버튼
        ├── <ImprovementOverlay />  ← 선택 모드 활성화 시 전체화면 오버레이
        └── <ImprovementRequestModal /> ← 요소 선택 후 설명 입력 폼

[improvementRequestStore]          ← Zustand 전역 상태
  ├── isActive: boolean
  ├── selectedElement: { text, tagName, boundingRect } | null
  └── capturedScreenshot: string | null (base64)

[Backend: ImprovementRequestsModule]
  ├── POST   /improvement-requests
  ├── GET    /improvement-requests
  ├── GET    /improvement-requests/:id
  └── PATCH  /improvement-requests/:id/status

[관리 UI]
  └── /settings/improvement-requests
```

### 오버레이 동작 원리

오버레이 `div`가 `mousemove` 이벤트를 캡처하면서 `document.elementFromPoint()`로 커서 아래 실제 DOM 요소를 감지한다. 감지된 요소에 주황색 테두리(`outline: 2px solid orange`)를 동적으로 적용한다. 클릭 시:
1. 오버레이를 잠시 `visibility: hidden`으로 숨김
2. `html2canvas`로 스크린샷 촬영
3. 오버레이 다시 숨기고 모달 오픈

---

## DB 스키마

### 테이블: `IMPR_REQUESTS`

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| `IMPR_ID` | VARCHAR2(36) | NOT NULL | UUID, PK |
| `PAGE_URL` | VARCHAR2(500) | NOT NULL | 요청 발생 페이지 URL |
| `ELEMENT_TEXT` | VARCHAR2(1000) | NULL | 클릭한 요소의 텍스트 내용 |
| `ELEMENT_TAG` | VARCHAR2(100) | NULL | 요소의 HTML 태그명 (button, div 등) |
| `DESCRIPTION` | VARCHAR2(2000) | NOT NULL | 사용자가 입력한 개선 설명 |
| `SCREENSHOT` | CLOB | NULL | base64 인코딩 스크린샷 이미지 |
| `STATUS` | VARCHAR2(20) | NOT NULL | PENDING / IN_PROGRESS / DONE |
| `REQUESTER_ID` | VARCHAR2(100) | NOT NULL | 요청자 login ID |
| `REQUESTER_NM` | VARCHAR2(200) | NULL | 요청자 이름 |
| `COMPANY` | VARCHAR2(10) | NOT NULL | 멀티테넌시 회사 코드 |
| `PLANT_CD` | VARCHAR2(10) | NOT NULL | 공장 코드 |
| `CREATED_AT` | TIMESTAMP | NOT NULL | 생성일시 |
| `UPDATED_AT` | TIMESTAMP | NOT NULL | 수정일시 |

### 마이그레이션 파일

`apps/backend/src/migrations/2026-05-21_create_impr_requests.sql`

---

## API 설계

### POST /improvement-requests
요청 등록. 인증된 사용자 누구나 사용 가능.

**Request Body:**
```json
{
  "pageUrl": "/equipment/daily-inspect",
  "elementText": "저장",
  "elementTag": "button",
  "description": "저장 버튼 클릭 후 성공 메시지가 너무 빨리 사라집니다",
  "screenshot": "data:image/png;base64,..."
}
```

**Response:** `201 Created` + 생성된 객체

### GET /improvement-requests
목록 조회. query: `status`, `page`, `limit`

### GET /improvement-requests/:id
상세 조회 (스크린샷 포함)

### PATCH /improvement-requests/:id/status
상태 변경. Body: `{ "status": "IN_PROGRESS" }`

---

## 프론트엔드 컴포넌트

### 파일 구조

```
src/
├── stores/
│   └── improvementRequestStore.ts        (~50줄)
├── services/
│   └── improvementRequestService.ts      (~40줄)
└── components/
    └── improvement/
        ├── ImprovementFAB.tsx             (~150줄) 조합 루트
        ├── ImprovementOverlay.tsx         (~120줄) 오버레이 + 하이라이트
        └── ImprovementRequestModal.tsx    (~150줄) 입력 폼 모달

src/app/(authenticated)/settings/improvement-requests/
├── page.tsx                               (~150줄) 목록 DataGrid
└── components/
    └── ImprovementDetailModal.tsx         (~130줄) 상세 + 스크린샷
```

### improvementRequestStore

```typescript
interface ImprovementRequestState {
  isActive: boolean;
  selectedElement: {
    text: string;
    tagName: string;
    boundingRect: DOMRect;
  } | null;
  capturedScreenshot: string | null;
  activate: () => void;
  deactivate: () => void;
  setSelectedElement: (el: SelectedElement) => void;
  setCapturedScreenshot: (src: string) => void;
  reset: () => void;
}
```

### ImprovementFAB

- 화면 우하단 고정 (`fixed bottom-6 right-6 z-50`)
- 비활성: 🔧 아이콘, 파란 배경
- 활성: ✕ 아이콘, 주황 배경
- ESC 키로도 비활성화
- `isActive` 시 상단 안내 배너 표시: "개선요청 모드 — 변경하고 싶은 요소를 클릭하세요"
- `MainLayout.tsx`에 단 한 줄 추가로 삽입

### ImprovementOverlay

- `fixed inset-0 z-40` 반투명 오버레이 (`bg-black/20`)
- `mousemove`: `document.elementFromPoint()` → 오버레이·FAB 제외한 요소 하이라이트
- 하이라이트: `outline: 2px solid #f97316` + `outline-offset: 2px` (inline style로 직접 적용/제거)
- `click`: 하이라이트 제거 → 스크린샷 촬영 → `setSelectedElement()` → 모달 오픈
- 스크린샷: `html2canvas(document.body, { scale: 0.5 })` (용량 절감)

### ImprovementRequestModal

- 선택 요소 선택 후 자동 오픈
- 읽기전용 섹션: 페이지 URL, 선택 요소 태그+텍스트, 스크린샷 썸네일
- 입력 섹션: `<textarea>` (description, required, 최대 2000자)
- 저장: `improvementRequestService.create()` → 성공 토스트 → `reset()` → 모달 닫기

### 관리 UI (`/settings/improvement-requests`)

- DataGrid: IMPR_ID(숨김), 페이지, 요소, 설명 요약, 요청자, 상태, 일시
- 상태 필터: ALL / PENDING / IN_PROGRESS / DONE
- 행 클릭 → `ImprovementDetailModal`: 스크린샷 전체, 전체 설명, 상태 변경 버튼

---

## i18n 키 (ko/en/zh/vi 4파일 동시 수정)

```json
"improvement": {
  "fabTooltip": "개선요청 등록",
  "modeActive": "개선요청 모드",
  "selectHint": "변경하고 싶은 요소를 클릭하세요",
  "exitHint": "ESC 또는 버튼을 눌러 종료",
  "modalTitle": "개선요청 등록",
  "pageUrl": "페이지",
  "selectedElement": "선택한 요소",
  "screenshot": "스크린샷",
  "description": "개선 내용",
  "descriptionPlaceholder": "어떻게 바꾸고 싶으신지 설명해 주세요",
  "submit": "요청 등록",
  "submitSuccess": "개선요청이 등록되었습니다",
  "submitError": "등록 중 오류가 발생했습니다",
  "managePage": "개선요청 관리",
  "statusPending": "대기",
  "statusInProgress": "처리중",
  "statusDone": "완료",
  "noScreenshot": "스크린샷 없음"
}
```

---

## 메뉴 등록

`menuConfig`에 `/settings/improvement-requests` 항목 추가 (설정 그룹).

---

## 의존성 추가

```bash
pnpm add html2canvas
pnpm add -D @types/html2canvas  # 필요 시
```

---

## 검증 기준

1. FAB 버튼이 모든 인증 페이지 우하단에 표시됨
2. 클릭 시 오버레이 활성화, 마우스 이동 시 요소 하이라이트
3. 요소 클릭 후 스크린샷 포함 모달 정상 오픈
4. 설명 입력 후 저장 시 DB에 레코드 생성 확인
5. `/settings/improvement-requests`에서 목록 조회 가능
6. `pnpm build` 에러 0건
