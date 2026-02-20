# 자재 출고 시스템 설계서

## 1. 개요

자재 출고 관리 페이지(`/material/issue`)를 3가지 출고 방식을 지원하도록 재구성한다.

| 방식 | 탭 이름 | 설명 |
|------|---------|------|
| 출고요청 처리 | 출고요청처리 | `/material/request`에서 생성된 요청을 승인/반려하고 일괄 출고 |
| 수동 출고 | 수동출고 | 재고 목록에서 LOT를 선택하여 수량 입력 후 출고 |
| 바코드 스캔 | 바코드스캔 | LOT 바코드 스캔 시 해당 LOT 전량 자동 출고 |

---

## 2. 바코드 규격

- **형식**: LOT번호만 (예: `LOT-2026-0220-001`)
- **스캔 출고 수량**: LOT의 `currentQty` 전량 출고
- **발행 시점**: IQC 합격 후 라벨 일괄 발행

---

## 3. 백엔드 설계

### 3.1 신규 엔티티: MAT_ISSUE_REQUESTS (출고요청 헤더)

```
MAT_ISSUE_REQUESTS
├── id: UUID (PK)
├── requestNo: string (UNIQUE) - 요청번호 (REQ-YYYYMMDD-NNN)
├── jobOrderId: string (FK → JOB_ORDERS.id) - 작업지시
├── requestDate: timestamp - 요청일
├── status: string - REQUESTED | APPROVED | REJECTED | COMPLETED
├── requester: string - 요청자
├── approver: string? - 승인자
├── approvedAt: timestamp? - 승인일시
├── rejectReason: string? - 반려사유
├── remark: string? - 비고
├── company: string?
├── plant: string?
├── createdBy: string?
├── updatedBy: string?
├── createdAt: timestamp
├── updatedAt: timestamp
└── deletedAt: timestamp? (소프트 삭제)
```

### 3.2 신규 엔티티: MAT_ISSUE_REQUEST_ITEMS (출고요청 품목)

```
MAT_ISSUE_REQUEST_ITEMS
├── id: UUID (PK)
├── requestId: UUID (FK → MAT_ISSUE_REQUESTS.id)
├── partId: string (FK → PART_MASTERS.id) - 품목
├── requestQty: number - 요청수량
├── issuedQty: number (기본: 0) - 출고된 수량
├── unit: string - 단위
├── remark: string?
├── createdAt: timestamp
└── updatedAt: timestamp
```

### 3.3 신규 API 엔드포인트

#### 출고요청 관리
```
POST   /material/issue-requests              - 출고요청 생성
GET    /material/issue-requests              - 출고요청 목록 조회
GET    /material/issue-requests/:id          - 출고요청 상세 (품목 포함)
PATCH  /material/issue-requests/:id/approve  - 출고요청 승인
PATCH  /material/issue-requests/:id/reject   - 출고요청 반려
POST   /material/issue-requests/:id/issue    - 출고요청 기반 일괄 출고
```

#### 바코드 스캔 출고
```
GET    /material/lots/by-lotno/:lotNo        - LOT번호로 LOT 조회 (스캔용)
POST   /material/issues/scan                 - 바코드 스캔 출고 (LOT 전량)
```

#### 수동 출고 (재고 조회)
```
GET    /material/stocks/available            - 출고 가능한 재고 목록 (IQC PASS만)
```

### 3.4 DTO 설계

#### CreateIssueRequestDto
```typescript
{
  jobOrderId?: string;
  items: {
    partId: string;
    requestQty: number;
    unit: string;
  }[];
  remark?: string;
}
```

#### ScanIssueDto
```typescript
{
  lotNo: string;          // 스캔된 LOT번호
  warehouseCode?: string; // 출고 창고 (기본: LOT의 현재 창고)
  issueType?: string;     // 출고유형 (기본: PROD)
  workerId?: string;
  remark?: string;
}
```

#### RequestIssueDto (출고요청 기반 일괄 출고)
```typescript
{
  items: {
    requestItemId: string;   // 요청 품목 ID
    lotId: string;           // 출고할 LOT
    issueQty: number;        // 출고 수량
  }[];
  warehouseCode?: string;
  workerId?: string;
  remark?: string;
}
```

### 3.5 서비스 로직

#### ScanIssue 플로우
```
1. lotNo로 MAT_LOTS 조회
2. 검증:
   - LOT 존재 여부
   - iqcStatus === 'PASS'
   - status !== 'DEPLETED'
   - currentQty > 0
3. 기존 MatIssueService.create() 호출
   - items: [{ lotId: lot.id, issueQty: lot.currentQty }]
4. 출고 결과 반환 (품목정보 + 출고수량)
```

#### RequestIssue 플로우 (출고요청 기반)
```
1. 요청 상태 확인 (APPROVED만 출고 가능)
2. 각 품목별 LOT 매칭 및 검증
3. MatIssueService.create() 호출
4. 요청 품목의 issuedQty 갱신
5. 모든 품목 출고 완료 시 요청 상태 → COMPLETED
```

---

## 4. 프론트엔드 설계

### 4.1 페이지 구조 (`/material/issue`)

```
IssuePage
├── 탭 네비게이션 (출고요청처리 | 수동출고 | 바코드스캔)
├── 탭 1: IssueRequestTab
│   ├── 통계카드 (요청/승인/완료/반려)
│   ├── 필터 (검색 + 상태 드롭다운)
│   ├── 요청 목록 테이블
│   │   └── 행 클릭 → 상세 모달
│   └── IssueFromRequestModal (출고처리 모달)
│       ├── 요청 정보 표시
│       ├── 품목별 LOT 매칭 테이블
│       └── 일괄 출고 버튼
├── 탭 2: ManualIssueTab
│   ├── 필터 (창고 선택 + 품목 검색)
│   ├── 재고 목록 DataGrid (IQC PASS만)
│   │   └── 체크박스 선택 가능
│   ├── 선택 품목 요약 영역
│   └── 수량 입력 + 출고 버튼
└── 탭 3: BarcodeScanTab
    ├── 스캔 입력 필드 (자동 포커스)
    ├── 스캔 결과 카드 (LOT정보 + 품목 + 수량)
    ├── 출고 확인/취소 버튼
    └── 금일 스캔 출고 이력 테이블
```

### 4.2 탭 1: 출고요청 처리

**데이터 흐름:**
1. GET `/material/issue-requests` → 요청 목록
2. 승인 버튼 → PATCH `/material/issue-requests/:id/approve`
3. 반려 버튼 → PATCH `/material/issue-requests/:id/reject`
4. 출고처리 버튼 → 모달 열기
5. 모달에서 LOT 선택 → POST `/material/issue-requests/:id/issue`

**테이블 컬럼:**
요청번호 | 요청일 | 작업지시 | 품목수 | 총수량 | 상태 | 요청자 | 액션

### 4.3 탭 2: 수동 출고

**데이터 흐름:**
1. GET `/material/stocks/available` → 출고 가능 재고
2. 체크박스로 LOT 선택
3. 수량 입력 (기본: LOT 전량)
4. POST `/material/issues` → 출고 처리

**테이블 컬럼:**
선택 | 창고 | 품목코드 | 품목명 | LOT번호 | 가용수량 | 출고수량(입력) | 단위

### 4.4 탭 3: 바코드 스캔

**데이터 흐름:**
1. 스캔 입력 (Enter 키 트리거)
2. GET `/material/lots/by-lotno/:lotNo` → LOT 정보 조회
3. 정보 표시 (품목명, LOT번호, 현재수량, IQC상태)
4. POST `/material/issues/scan` → 전량 출고
5. 성공 시 이력 테이블에 추가 + 알림

**스캔 입력 필드:**
- 자동 포커스 (페이지 진입 시, 출고 완료 후)
- Enter 키로 스캔 트리거
- 스캔 후 입력 필드 자동 클리어

---

## 5. 파일 목록

### 백엔드 (신규)
```
apps/backend/src/modules/material/
├── entities/
│   ├── mat-issue-request.entity.ts      (신규)
│   └── mat-issue-request-item.entity.ts (신규)
├── dto/
│   ├── issue-request.dto.ts             (신규)
│   └── scan-issue.dto.ts               (신규)
├── services/
│   └── issue-request.service.ts         (신규)
├── controllers/
│   └── issue-request.controller.ts      (신규)
└── material.module.ts                   (수정 - 신규 서비스/컨트롤러 등록)
```

### 백엔드 (수정)
```
apps/backend/src/modules/material/
├── services/
│   └── mat-issue.service.ts             (수정 - scanIssue 메서드 추가)
├── controllers/
│   └── mat-issue.controller.ts          (수정 - scan 엔드포인트 추가)
└── services/
    └── mat-stock.service.ts             (수정 - available 재고 조회 추가)
```

### 프론트엔드 (신규/수정)
```
apps/frontend/src/
├── app/(authenticated)/material/issue/
│   └── page.tsx                         (전면 재작성 - 탭 구조)
├── components/material/
│   ├── IssueRequestTab.tsx              (신규)
│   ├── ManualIssueTab.tsx               (신규)
│   ├── BarcodeScanTab.tsx               (신규)
│   ├── IssueFromRequestModal.tsx        (신규)
│   └── ScanResultCard.tsx               (신규)
├── hooks/material/
│   ├── useIssueRequests.ts              (신규 - API 연동)
│   ├── useManualIssue.ts                (신규 - API 연동)
│   ├── useBarcodeScan.ts                (신규 - 스캔 로직)
│   └── useIssueData.ts                  (삭제 또는 대체)
```

---

## 6. 데이터 흐름 요약

```
[생산현장] /material/request
    ↓ 출고요청 생성 (POST /material/issue-requests)
    ↓
[자재창고] /material/issue → 탭1: 출고요청처리
    ↓ 승인 → LOT 매칭 → 일괄 출고
    ↓
[자재창고] /material/issue → 탭2: 수동출고
    ↓ 재고 조회 → LOT 선택 → 수량 입력 → 출고
    ↓
[자재창고] /material/issue → 탭3: 바코드스캔
    ↓ LOT 바코드 스캔 → 전량 자동 출고
    ↓
[공통] MatIssueService.create()
    ├── LOT.currentQty 차감
    ├── MatStock.qty 차감
    └── MAT_ISSUES 이력 생성
```
