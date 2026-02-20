# 자재 출고 3가지 방식 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 자재 출고 페이지(`/material/issue`)에 출고요청처리, 수동출고, 바코드스캔 3개 탭을 구현하여 LOT 기반 자재 출고를 지원한다.

**Architecture:** 백엔드에 출고요청(MAT_ISSUE_REQUESTS) 엔티티와 서비스를 추가하고, 기존 MatIssueService에 스캔 출고 메서드를 추가한다. 프론트엔드는 탭 구조로 재구성하며, 각 탭은 독립 컴포넌트 + API 연동 훅으로 구성한다.

**Tech Stack:** NestJS + TypeORM (백엔드), Next.js + React Query + TanStack Table (프론트엔드), Axios API 클라이언트

---

## Task 1: 백엔드 - 출고요청 엔티티 생성

**Files:**
- Create: `apps/backend/src/entities/mat-issue-request.entity.ts`
- Create: `apps/backend/src/entities/mat-issue-request-item.entity.ts`

**Step 1: MatIssueRequest 엔티티 생성**

`apps/backend/src/entities/mat-issue-request.entity.ts`:
```typescript
/**
 * @file mat-issue-request.entity.ts
 * @description 자재 출고요청 헤더 엔티티 - 생산현장에서 자재창고에 출고를 요청하는 단위
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_ISSUE_REQUESTS' })
@Index(['status'])
@Index(['requestDate'])
export class MatIssueRequest {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'REQUEST_NO', length: 50, unique: true })
  requestNo: string;

  @Column({ name: 'JOB_ORDER_ID', length: 50, nullable: true })
  jobOrderId: string | null;

  @Column({ name: 'REQUEST_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  requestDate: Date;

  @Column({ name: 'STATUS', length: 20, default: 'REQUESTED' })
  status: string;

  @Column({ name: 'REQUESTER', length: 100 })
  requester: string;

  @Column({ name: 'APPROVER', length: 100, nullable: true })
  approver: string | null;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'REJECT_REASON', length: 500, nullable: true })
  rejectReason: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
```

**Step 2: MatIssueRequestItem 엔티티 생성**

`apps/backend/src/entities/mat-issue-request-item.entity.ts`:
```typescript
/**
 * @file mat-issue-request-item.entity.ts
 * @description 자재 출고요청 품목 엔티티 - 요청 건별 품목과 수량을 관리
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_ISSUE_REQUEST_ITEMS' })
@Index(['requestId'])
@Index(['partId'])
export class MatIssueRequestItem {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'REQUEST_ID', length: 50 })
  requestId: string;

  @Column({ name: 'PART_ID', length: 50 })
  partId: string;

  @Column({ name: 'REQUEST_QTY', type: 'int' })
  requestQty: number;

  @Column({ name: 'ISSUED_QTY', type: 'int', default: 0 })
  issuedQty: number;

  @Column({ name: 'UNIT', length: 20 })
  unit: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

**Step 3: 커밋**
```bash
git add apps/backend/src/entities/mat-issue-request.entity.ts apps/backend/src/entities/mat-issue-request-item.entity.ts
git commit -m "feat: add MatIssueRequest and MatIssueRequestItem entities"
```

---

## Task 2: 백엔드 - 출고요청 DTO 생성

**Files:**
- Create: `apps/backend/src/modules/material/dto/issue-request.dto.ts`
- Create: `apps/backend/src/modules/material/dto/scan-issue.dto.ts`

**Step 1: 출고요청 DTO**

`apps/backend/src/modules/material/dto/issue-request.dto.ts`:
```typescript
/**
 * @file issue-request.dto.ts
 * @description 출고요청 CRUD 및 승인/반려/출고처리 DTO
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IssueRequestItemDto {
  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiProperty({ description: '요청 수량' })
  @IsInt()
  @Min(1)
  requestQty: number;

  @ApiProperty({ description: '단위' })
  @IsString()
  @MaxLength(20)
  unit: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreateIssueRequestDto {
  @ApiPropertyOptional({ description: '작업지시 ID' })
  @IsOptional()
  @IsString()
  jobOrderId?: string;

  @ApiProperty({ description: '요청 품목 목록', type: [IssueRequestItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueRequestItemDto)
  items: IssueRequestItemDto[];

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class IssueRequestQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '상태', enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'] })
  @IsOptional()
  @IsString()
  @IsIn(['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'])
  status?: string;

  @ApiPropertyOptional({ description: '검색어 (요청번호, 작업지시)' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class RejectIssueRequestDto {
  @ApiProperty({ description: '반려 사유' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class RequestIssueItemDto {
  @ApiProperty({ description: '요청 품목 ID' })
  @IsString()
  requestItemId: string;

  @ApiProperty({ description: '출고할 LOT ID' })
  @IsString()
  lotId: string;

  @ApiProperty({ description: '출고 수량' })
  @IsInt()
  @Min(1)
  issueQty: number;
}

export class RequestIssueDto {
  @ApiProperty({ description: '출고 품목 매칭 목록', type: [RequestIssueItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestIssueItemDto)
  items: RequestIssueItemDto[];

  @ApiPropertyOptional({ description: '출고 창고 코드' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}
```

**Step 2: 스캔 출고 DTO**

`apps/backend/src/modules/material/dto/scan-issue.dto.ts`:
```typescript
/**
 * @file scan-issue.dto.ts
 * @description 바코드 스캔 출고 DTO - LOT번호를 스캔하여 전량 출고
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ScanIssueDto {
  @ApiProperty({ description: '스캔된 LOT번호' })
  @IsString()
  lotNo: string;

  @ApiPropertyOptional({ description: '출고 창고 코드' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '출고 유형 (기본: PROD)' })
  @IsOptional()
  @IsString()
  issueType?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}
```

**Step 3: 커밋**
```bash
git add apps/backend/src/modules/material/dto/issue-request.dto.ts apps/backend/src/modules/material/dto/scan-issue.dto.ts
git commit -m "feat: add issue request and scan issue DTOs"
```

---

## Task 3: 백엔드 - 출고요청 서비스 구현

**Files:**
- Create: `apps/backend/src/modules/material/services/issue-request.service.ts`

**Step 1: IssueRequestService 구현**

전체 서비스 로직 구현 (CRUD + 승인/반려 + 출고요청 기반 출고처리). 핵심 메서드:

- `create(dto)`: 요청번호 자동생성(REQ-YYYYMMDD-NNN) + 품목 저장
- `findAll(query)`: 페이지네이션 + 필터 + 품목/파트 정보 평탄화
- `findById(id)`: 상세 조회 (품목 포함)
- `approve(id)`: REQUESTED → APPROVED
- `reject(id, reason)`: REQUESTED → REJECTED
- `issueFromRequest(id, dto)`: APPROVED 요청의 품목을 LOT 매칭하여 출고

`issueFromRequest`는 기존 `MatIssueService.create()`를 호출하여 실제 출고를 수행하고, 요청 품목의 `issuedQty`를 갱신한다. 모든 품목이 완전 출고되면 요청 상태를 `COMPLETED`로 변경한다.

**Step 2: 커밋**
```bash
git add apps/backend/src/modules/material/services/issue-request.service.ts
git commit -m "feat: implement IssueRequestService with CRUD and issue processing"
```

---

## Task 4: 백엔드 - 출고요청 컨트롤러 + 스캔 출고 API

**Files:**
- Create: `apps/backend/src/modules/material/controllers/issue-request.controller.ts`
- Modify: `apps/backend/src/modules/material/services/mat-issue.service.ts` (scanIssue 추가)
- Modify: `apps/backend/src/modules/material/controllers/mat-issue.controller.ts` (scan 엔드포인트 추가)
- Modify: `apps/backend/src/modules/material/services/mat-stock.service.ts` (available 재고 조회 추가)
- Modify: `apps/backend/src/modules/material/controllers/mat-stock.controller.ts` (available 엔드포인트 추가)

**Step 1: IssueRequestController 생성**

API 엔드포인트:
```
POST   /material/issue-requests              → create
GET    /material/issue-requests              → findAll
GET    /material/issue-requests/:id          → findById
PATCH  /material/issue-requests/:id/approve  → approve
PATCH  /material/issue-requests/:id/reject   → reject
POST   /material/issue-requests/:id/issue    → issueFromRequest
```

**Step 2: MatIssueService에 scanIssue 메서드 추가**

```typescript
async scanIssue(dto: ScanIssueDto) {
  // 1. lotNo로 LOT 조회
  const lot = await this.matLotRepository.findOne({
    where: { lotNo: dto.lotNo, deletedAt: IsNull() },
  });
  // 2. 검증 (존재, IQC PASS, 수량 > 0)
  // 3. 기존 create() 호출 { items: [{ lotId: lot.id, issueQty: lot.currentQty }] }
  // 4. 품목 정보 포함하여 반환
}
```

**Step 3: MatIssueController에 scan 엔드포인트 추가**

```
POST /material/issues/scan → scanIssue
```

**Step 4: MatStockService에 findAvailable 메서드 추가**

IQC 합격(PASS) LOT만 포함하는 출고 가능 재고 목록 조회. LOT 조인하여 iqcStatus 필터링.

**Step 5: MatStockController에 available 엔드포인트 추가**

```
GET /material/stocks/available → findAvailable
```

**Step 6: 커밋**
```bash
git add apps/backend/src/modules/material/
git commit -m "feat: add issue request controller, scan issue API, and available stocks endpoint"
```

---

## Task 5: 백엔드 - 모듈 등록 + LOT 조회 API

**Files:**
- Modify: `apps/backend/src/modules/material/material.module.ts`
- Modify: `apps/backend/src/modules/material/controllers/mat-lot.controller.ts` (by-lotno 엔드포인트 추가)
- Modify: `apps/backend/src/modules/material/services/mat-lot.service.ts` (findByLotNo 메서드 추가)

**Step 1: material.module.ts 수정**

TypeOrmModule.forFeature에 `MatIssueRequest`, `MatIssueRequestItem` 추가.
controllers에 `IssueRequestController` 추가.
providers에 `IssueRequestService` 추가.

**Step 2: MatLotService에 findByLotNo 메서드 추가**

```typescript
async findByLotNo(lotNo: string) {
  // LOT 조회 + 품목(PartMaster) 정보 조인하여 반환
}
```

**Step 3: MatLotController에 by-lotno 엔드포인트 추가**

```
GET /material/lots/by-lotno/:lotNo → findByLotNo
```

**Step 4: 백엔드 빌드 확인**

Run: `cd apps/backend && pnpm build`
Expected: 컴파일 성공

**Step 5: 커밋**
```bash
git add apps/backend/src/
git commit -m "feat: register issue request module, add LOT lookup by lotNo"
```

---

## Task 6: 프론트엔드 - 출고 페이지 탭 구조 + 출고요청 탭

**Files:**
- Rewrite: `apps/frontend/src/app/(authenticated)/material/issue/page.tsx`
- Create: `apps/frontend/src/components/material/IssueRequestTab.tsx`
- Create: `apps/frontend/src/hooks/material/useIssueRequests.ts`
- Create: `apps/frontend/src/components/material/IssueFromRequestModal.tsx`

**Step 1: useIssueRequests 훅 생성**

React Query 기반 API 연동 훅:
- `useApiQuery`로 출고요청 목록 조회 (`/material/issue-requests`)
- `useApiMutation`으로 승인/반려/출고처리
- 필터 상태 관리 (searchText, statusFilter)
- 통계 계산 (상태별 카운트)

**Step 2: IssueRequestTab 컴포넌트 생성**

기존 IssuePage의 UI를 기반으로 탭 1 구현:
- 통계카드 4개 (요청/승인/진행/완료)
- 필터 (검색 + 상태 드롭다운)
- DataGrid (요청번호, 요청일, 작업지시, 품목수, 총수량, 상태, 요청자, 액션)
- 액션: REQUESTED → 승인/반려 버튼, APPROVED → 출고처리 버튼

**Step 3: IssueFromRequestModal 생성**

출고요청 기반 출고처리 모달:
- 요청 정보 표시 (요청번호, 작업지시, 요청자)
- 품목별 테이블: 품목코드 | 품목명 | 요청수량 | 기출고량 | 잔여량 | LOT선택 | 출고수량
- LOT 선택 드롭다운: 해당 품목의 IQC PASS LOT 목록
- 일괄 출고 버튼

**Step 4: IssuePage 탭 구조로 재작성**

```tsx
// 탭 상태 관리
const [activeTab, setActiveTab] = useState<'request' | 'manual' | 'scan'>('request');

// 탭 네비게이션
<div className="flex border-b border-border">
  <TabButton active={activeTab === 'request'} onClick={() => setActiveTab('request')}>
    출고요청처리
  </TabButton>
  <TabButton active={activeTab === 'manual'} onClick={() => setActiveTab('manual')}>
    수동출고
  </TabButton>
  <TabButton active={activeTab === 'scan'} onClick={() => setActiveTab('scan')}>
    바코드스캔
  </TabButton>
</div>

// 탭 콘텐츠
{activeTab === 'request' && <IssueRequestTab />}
{activeTab === 'manual' && <ManualIssueTab />}
{activeTab === 'scan' && <BarcodeScanTab />}
```

**Step 5: 빌드 확인**

Run: `cd apps/frontend && pnpm build`
Expected: 컴파일 성공 (탭2, 탭3은 플레이스홀더)

**Step 6: 커밋**
```bash
git add apps/frontend/src/
git commit -m "feat: restructure issue page with tabs, implement issue request tab"
```

---

## Task 7: 프론트엔드 - 출고요청 페이지 API 연동

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/material/request/page.tsx`
- Modify: `apps/frontend/src/hooks/material/useIssueRequestData.ts`
- Modify: `apps/frontend/src/components/material/RequestModal.tsx`

**Step 1: useIssueRequestData 훅을 API 연동으로 전환**

Mock 데이터를 제거하고 `useApiQuery`/`useApiMutation` 사용:
- GET `/material/issue-requests` → 요청 목록
- POST `/material/issue-requests` → 요청 생성
- 품목 검색: GET `/master/parts?search=...`

**Step 2: RequestModal에서 실제 API 호출**

`handleSubmit`에서 `useApiMutation`으로 POST 요청. 성공 시 쿼리 무효화 + 모달 닫기.

**Step 3: 빌드 확인 + 커밋**
```bash
git add apps/frontend/src/
git commit -m "feat: connect issue request page to backend API"
```

---

## Task 8: 프론트엔드 - 수동출고 탭

**Files:**
- Create: `apps/frontend/src/components/material/ManualIssueTab.tsx`
- Create: `apps/frontend/src/hooks/material/useManualIssue.ts`

**Step 1: useManualIssue 훅 생성**

- `useApiQuery`로 출고 가능 재고 조회 (`/material/stocks/available`)
- 체크박스 선택 상태 관리
- 선택 품목별 출고수량 입력 상태
- `useApiMutation`으로 출고 처리 (`POST /material/issues`)

**Step 2: ManualIssueTab 컴포넌트 생성**

- 필터: 창고 선택(useWarehouseOptions) + 품목 검색
- DataGrid: 체크박스 | 창고 | 품목코드 | 품목명 | LOT번호 | IQC상태 | 가용수량 | 출고수량(입력) | 단위
- 하단: 선택 {N}건 / 총 출고수량: {합계} + [출고처리] 버튼
- 출고 처리 성공 시 → 재고 목록 새로고침 + 선택 초기화

**Step 3: 빌드 확인 + 커밋**
```bash
git add apps/frontend/src/
git commit -m "feat: implement manual issue tab with stock selection"
```

---

## Task 9: 프론트엔드 - 바코드 스캔 탭

**Files:**
- Create: `apps/frontend/src/components/material/BarcodeScanTab.tsx`
- Create: `apps/frontend/src/hooks/material/useBarcodeScan.ts`
- Create: `apps/frontend/src/components/material/ScanResultCard.tsx`

**Step 1: useBarcodeScan 훅 생성**

```typescript
function useBarcodeScan() {
  const [scanInput, setScanInput] = useState('');
  const [scannedLot, setScannedLot] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);

  // LOT 조회 (스캔 시)
  const lookupLot = async (lotNo: string) => {
    const res = await api.get(`/material/lots/by-lotno/${lotNo}`);
    setScannedLot(res.data.data);
  };

  // 스캔 출고 실행
  const scanIssueMutation = useApiMutation('/material/issues/scan', 'post');

  const handleScan = async () => {
    if (!scanInput.trim()) return;
    await lookupLot(scanInput.trim());
  };

  const handleIssue = async () => {
    if (!scannedLot) return;
    await scanIssueMutation.mutateAsync({ lotNo: scannedLot.lotNo });
    setScanHistory(prev => [{ ...scannedLot, issuedAt: new Date() }, ...prev]);
    setScannedLot(null);
    setScanInput('');
  };

  return { scanInput, setScanInput, scannedLot, scanHistory, handleScan, handleIssue, isLoading };
}
```

**Step 2: ScanResultCard 컴포넌트 생성**

스캔된 LOT 정보 카드:
- 품목코드, 품목명, LOT번호, 현재수량, IQC상태, 공급업체
- 출고 가능 여부 표시 (IQC PASS + 수량 > 0)
- [출고] [취소] 버튼

**Step 3: BarcodeScanTab 컴포넌트 생성**

- 상단: 스캔 입력 필드 (autoFocus, Enter 키 트리거)
- 중앙: ScanResultCard (스캔 결과 표시)
- 하단: 금일 스캔 출고 이력 DataGrid

스캔 입력 필드는:
- 탭 진입 시 자동 포커스
- Enter 키 → LOT 조회 → 정보 표시 → [출고] 클릭 → 전량 출고 → 입력 클리어 + 재포커스
- 에러 시 메시지 표시 (LOT 없음, IQC 미합격 등)

**Step 4: 빌드 확인 + 커밋**
```bash
git add apps/frontend/src/
git commit -m "feat: implement barcode scan tab with auto-focus and scan history"
```

---

## Task 10: 통합 확인 + 정리

**Step 1: 불필요한 Mock 데이터 정리**

- `useIssueData.ts`: Mock 데이터 제거, API 연동으로 전환 또는 삭제
- 기존 `IssueTable.tsx`, `IssueProcessModal.tsx`: 더 이상 사용하지 않으면 삭제

**Step 2: i18n 번역 키 추가**

`apps/frontend/src/locales/ko.json`에 추가:
```json
{
  "material": {
    "issue": {
      "tabs": {
        "request": "출고요청처리",
        "manual": "수동출고",
        "scan": "바코드스캔"
      },
      "scan": {
        "placeholder": "LOT 바코드를 스캔하세요...",
        "result": "스캔 결과",
        "issueAll": "전량 출고",
        "history": "금일 스캔 출고 이력",
        "notFound": "LOT를 찾을 수 없습니다",
        "iqcFail": "IQC 미합격 LOT입니다",
        "depleted": "이미 소진된 LOT입니다",
        "success": "출고 완료"
      },
      "manual": {
        "selectWarehouse": "창고 선택",
        "selectedCount": "선택 {count}건",
        "totalIssueQty": "총 출고수량",
        "issueSelected": "선택 출고"
      }
    }
  }
}
```

**Step 3: 전체 빌드 확인**

```bash
cd /c/Project/HANES && pnpm build
```

**Step 4: 최종 커밋**
```bash
git add .
git commit -m "feat: complete material issue system with 3 issue modes"
```

---

## 의존성 그래프

```
Task 1 (엔티티) ──→ Task 2 (DTO) ──→ Task 3 (서비스) ──→ Task 4 (컨트롤러) ──→ Task 5 (모듈 등록)
                                                                                        ↓
Task 6 (탭 구조 + 출고요청탭) ←──────────────────────────────────────────────────────────┘
   ↓
Task 7 (출고요청 페이지 API 연동)
   ↓
Task 8 (수동출고 탭) ──→ Task 9 (바코드 스캔 탭) ──→ Task 10 (통합 확인)
```

Tasks 1-5: 백엔드 (순차)
Tasks 6-9: 프론트엔드 (Task 5 완료 후, 8과 9는 독립적이므로 병렬 가능)
Task 10: 통합 정리
