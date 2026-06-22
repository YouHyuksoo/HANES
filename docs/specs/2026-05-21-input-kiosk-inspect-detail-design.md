# input-kiosk 설비점검·자주검사 세부 기능 설계

**날짜:** 2026-05-21  
**참조:** `file:///C:/Users/hsyou/Desktop/설비점검 자주검사 통합.html` (19페이지)  
**대상 페이지:** `/production/input-kiosk`

---

## 1. 목적

현재 `input-kiosk` 페이지의 3개 모달(DailyInspectModal, WorkerInspectModal, SelfInspectModal)이 HTML 참조 설계와 비교했을 때 핵심 기능이 빠져 있다. 이를 완성한다.

### 현재 vs. 목표 비교

| 컴포넌트 | 현재 상태 | 목표 |
|---|---|---|
| DailyInspectModal | OK/NG 버튼만 | 측정형(값+자동판정)+판정형+종합판정배너 |
| WorkerInspectModal | 하드코딩 체크리스트 | API 연동+QR스캐너+종합판정 |
| SelfInspectModal | PASS/FAIL 버튼만 | 시료 N개 탭+측정형/판정형+LSL/USL |
| 중물 알림/차단 | 없음 | ComCode 기반 알림%, 차단% |
| NG 재검사 | 없음 | FAIL 항목 재검사 버튼 → 새 SEQ로 이력 insert |

---

## 2. DB 스키마 변경

### 기존 데이터 마이그레이션 정책

- ALTER TABLE로 컬럼 추가 시 `DEFAULT 'VISUAL'`로 기존 행 전체가 VISUAL(판정형)로 초기화된다.
- 기존 설비점검/자주검사 마스터 데이터는 모두 판정형이므로 이 정책이 올바른 기본값이다.
- 측정형(MEASURE)으로 변경이 필요한 항목은 마스터 관리 화면에서 수동으로 수정한다.

### 2.1 EQUIP_INSPECT_ITEM_MASTERS 컬럼 추가

```sql
ALTER TABLE EQUIP_INSPECT_ITEM_MASTERS ADD (
  ITEM_TYPE      VARCHAR2(20)  DEFAULT 'VISUAL',  -- MEASURE | VISUAL
  UNIT           VARCHAR2(20),                     -- 단위 (bar, ℃, mm 등)
  LSL_VALUE      NUMBER,                           -- 하한 (측정형만)
  USL_VALUE      NUMBER,                           -- 상한 (측정형만)
  WORKER_QR_CODE VARCHAR2(50)                      -- 작업자점검 QR 코드값 (WORKER 타입)
);
```

- `INSPECT_TYPE = 'WORKER'`인 행이 작업자설비점검 항목 (기존 DAILY와 별도 구분)
- `WORKER_QR_CODE`는 설비 부위에 부착된 QR의 페이로드

### 2.2 SELF_INSPECT_ITEMS 컬럼 추가

```sql
ALTER TABLE SELF_INSPECT_ITEMS ADD (
  ITEM_TYPE    VARCHAR2(20)  DEFAULT 'VISUAL',  -- MEASURE | VISUAL
  UNIT         VARCHAR2(20),
  LSL_VALUE    NUMBER,
  USL_VALUE    NUMBER,
  SAMPLE_COUNT NUMBER        DEFAULT 1           -- 초물 시료 수 (FIRST 시점에만 적용)
);
```

> **SAMPLE_COUNT 배치 결정**: 라우팅 자주검사 설정 테이블이 현재 없으므로 SELF_INSPECT_ITEMS에 둔다.
> 이 값은 품목·공정별 라우팅 설정이 도입되면 별도 테이블로 이전한다.

### 2.3 SELF_INSPECT_RESULTS 컬럼 추가

```sql
ALTER TABLE SELF_INSPECT_RESULTS ADD (
  SAMPLE_NO     NUMBER  DEFAULT 1,   -- 시료 번호 (1부터 시작, FIRST 시점 N개 시료)
  MEASURE_VALUE NUMBER               -- 측정값 (MEASURE 타입 항목만 저장)
);
```

- `SAMPLE_NO`는 저장 시 필수로 전달, 기존 행은 DEFAULT 1로 초기화
- `MEASURE_VALUE`는 MEASURE 타입이 아닌 경우 NULL

---

## 3. 백엔드 수정

### 3.1 EquipInspectItemMaster 엔티티

`apps/backend/src/entities/equip-inspect-item-master.entity.ts`에 컬럼 추가:
- `itemType: string` (default: 'VISUAL')
- `unit: string | null`
- `lslValue: number | null`
- `uslValue: number | null`
- `workerQrCode: string | null`

### 3.2 SelfInspectItem 엔티티

`apps/backend/src/entities/self-inspect-item.entity.ts`에 컬럼 추가:
- `itemType: string` (default: 'VISUAL')
- `unit: string | null`
- `lslValue: number | null`
- `uslValue: number | null`
- `sampleCount: number` (default: 1)

### 3.3 SelfInspectResult 엔티티

`apps/backend/src/entities/self-inspect-result.entity.ts`에 컬럼 추가:
- `sampleNo: number` (default: 1) — 시료 번호
- `measureValue: number | null` — MEASURE 타입 측정값

### 3.4 DTO/서비스 업데이트

- `master/dto/equip-inspect.dto.ts`: Create/Update DTO에 신규 컬럼 추가
- `master/services/equip-inspect.service.ts`: 기존 로직 유지, 새 필드 포함
- `production/dto/self-inspect.dto.ts` (또는 해당 DTO): `sampleNo`, `measureValue` 추가

### 3.5 마이그레이션 SQL

`apps/backend/src/migrations/` 에 마이그레이션 파일 추가:
- `2026-05-21_add_inspect_item_type_columns.sql` — 세 테이블 ALTER TABLE 포함

---

## 4. 프론트엔드 수정

### 4.1 DailyInspectModal

**파일:** `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx`

**변경 사항:**
- `InspectItem` 인터페이스 확장
  ```typescript
  interface InspectItem {
    seq: number;
    itemName: string;
    criteria?: string;
    itemType: 'MEASURE' | 'VISUAL';
    unit?: string;
    lslValue?: number | null;
    uslValue?: number | null;
  }
  ```
- 측정형(`MEASURE`): 숫자 input → LSL/USL 비교 → `OK`/`NG` 자동 판정
- 판정형(`VISUAL`): OK/NG 버튼 (기존 방식 유지)
- 항목별 `remark` 입력 (기존 전체 비고 → 항목별로 변경)
- NG 항목 행 배경색 `bg-red-50 dark:bg-red-950`
- 종합 판정 배너: 모든 항목 OK이면 초록, NG 있으면 빨간 깜빡임

### 4.2 WorkerInspectModal

**파일:** `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx`

**변경 사항:**
- 하드코딩 `DEFAULT_CHECK_ITEMS` 제거
- API 연동: `GET /master/equip-inspect-items?equipCode=&inspectType=WORKER&limit=100`
- 항목 결과 상태: `'OK' | 'NG' | ''` (미점검)
- QR 스캐너 input 필드 (모달 오픈 시 자동 포커스, `workerQrCode` 매칭)
  - 스캔 시 해당 항목 활성화 → OK/NG 버튼 표시
  - 미등록 QR 스캔 시 경고 toast
- 진행 현황: OK/NG/미점검 카운트 표시
- 종합 판정 배너 (한 항목이라도 NG = 전체 NG, 작업시작 차단)
- 저장 API: `POST /equipment/daily-inspect` (기존 일일점검 API 재사용, `inspectType=WORKER`)

### 4.3 SelfInspectModal (전면 재작성)

**파일:** `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/SelfInspectModal.tsx`

200줄 초과 가능성이 높으므로 하위 컴포넌트로 분리:
- `SelfInspectModal.tsx` — 메인 모달 (탭 관리, 저장 트리거, 종합 판정)
- `SelfInspectItemRow.tsx` — 항목 한 행 (MEASURE/VISUAL 분기, 자동 판정)

**인터페이스 변경:**
```typescript
interface InspectItem {
  id: string;
  itemName: string;
  standard: string | null;
  inspectMethod: 'DIRECT' | 'DELEGATE';
  timing: string;
  isDestructive: boolean;
  itemType: 'MEASURE' | 'VISUAL';
  unit?: string;
  lslValue?: number | null;
  uslValue?: number | null;
  sampleCount: number;
}

interface SampleItemResult {
  value?: string;        // 측정값 (MEASURE 타입)
  result: 'PASS' | 'FAIL' | 'PENDING' | null;
  remark?: string;
}
// results: Record<sampleIndex, Record<itemId, SampleItemResult>>
```

**시료 탭 로직:**
- FIRST: `items[0].sampleCount`개 탭
- MID/LAST: 항상 1개 탭
- 각 탭에서 모든 항목 완료 여부 체크
- 한 탭이라도 FAIL → 종합 FAIL

**측정형 자동 판정 규칙:**
- LSL 있고 value < LSL → FAIL
- USL 있고 value > USL → FAIL
- 그 외(값 입력 있음) → PASS (실시간 판정)

**저장 구조:**
- 시료별로 개별 POST (`sampleNo`, `measureValue` 파라미터 추가)
- 기존 API: `POST /production/self-inspect/results`

### 4.4 중물 알림/차단 로직

**파일:** `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx`

**추가 상태:**
- `midInspectDone: boolean` — 중물 검사 완료 여부 (kioskStore에 추가)
- WO 진행률을 `ProductionInputBar`에서 emit하여 page.tsx가 수신

**ComCode 읽기:**
```typescript
// QC_SELF 그룹에서 임계값 읽기
const { getCodeValue } = useComCode('QC_SELF');
const notifyPct = Number(getCodeValue('QC_MID_NOTIFY_PCT') ?? 40);
const blockPct  = Number(getCodeValue('QC_MID_BLOCK_PCT')  ?? 60);
```

**로직:**
- 진행률 계산: `savedResultCount / selectedJobOrder.orderQty * 100`
- `notifyPct` 이상 + 중물 미완료: 자주검사 버튼에 `animate-pulse` 추가
- `blockPct` 이상 + 중물 미완료: `ProductionInputBar`에 `blocked=true` 전달 → 저장 버튼 비활성화

### 4.5 NG 재검사 (자주검사)

**파일:** `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/SelfInspectModal.tsx`

**NG 재검사 플로우:**
- 저장 완료 후 FAIL 항목이 있으면 모달 하단에 "NG 재검사" 버튼 표시
- 재검사 버튼 클릭 시 해당 timing의 SelfInspectModal을 새로 열기
  - `reInspect: true` 플래그 전달
  - 기존 FAIL 항목만 표시 (필터)
  - `sampleNo`는 기존 최대 sampleNo + 1로 자동 부여
- 저장 시 동일 `POST /production/self-inspect/results` API 사용 (덮어쓰기 없이 새 행 insert)
- 이전 FAIL 결과는 유지, 최신 결과가 별도 행으로 누적됨
- 판정 기준: 해당 timing의 가장 최신 결과 기준으로 PASS/FAIL 결정

---

## 5. 구현 순서

1. **DB 마이그레이션** — 3개 테이블 컬럼 추가 SQL 실행
2. **백엔드 엔티티/DTO 수정** — `pnpm build` 확인
3. **DailyInspectModal** — 가장 단순, 먼저 구현
4. **WorkerInspectModal** — API 연동 + QR 스캐너
5. **SelfInspectModal** — 가장 복잡, 전면 재작성 + 하위 컴포넌트 분리
6. **NG 재검사** — SelfInspectModal 완료 후 추가
7. **중물 알림/차단** — page.tsx + kioskStore 수정 (ComCode 연동)
8. **pnpm build** 확인

---

## 6. 제약 사항

- 기존 `POST /production/self-inspect/results` API body에 `sampleNo: number`, `measureValue?: number` 파라미터 추가 필요
- WorkerInspectModal 저장은 기존 `POST /equipment/daily-inspect` 재사용 (별도 저장 API 없음)
- 400줄 제한: SelfInspectModal은 `SelfInspectItemRow` 분리 필수
- 중물 알림/차단 임계값은 QC_SELF 공통코드에서 읽고, 코드가 없으면 40%/60% fallback 사용
- NG 재검사는 덮어쓰기 없이 새 행 insert — `SELF_INSPECT_RESULTS`에 unique 제약 없음 확인됨
