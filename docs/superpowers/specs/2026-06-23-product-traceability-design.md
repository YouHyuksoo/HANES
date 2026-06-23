# 추적성 종합 조회 (Product Traceability) 신규 설계

- 작성일: 2026-06-23
- 대상 화면: `/quality/trace` (추적성조회) — **기존 4M 화면 교체**
- 목적: 제품 시리얼 1건을 기준으로 연관된 모든 추적 정보를 데이터 소스별 섹션으로 구분하여 한 화면에서 전부 역추적한다.

## 1. 배경 / 문제

현재 `/quality/trace`는 시리얼 기준 4M(Man/Machine/Material/Method) 탭 화면이다. 다음 한계가 있다.

- 제품에 투입된 **반제품(SG)의 생산이력**을 역추적하지 못한다.
- 투입 자재의 **PO(발주) → 입하 → IQC(수입검사) → 입고** 단계를 역추적하지 못한다.
- 포장/입고/출하(박스·팔레트번호, 일시)가 일부만 노출된다.
- 4M 추상화 탭이라 "어느 테이블의 무슨 데이터인지"가 드러나지 않는다.

## 2. 목표 / 확정 사항

- **라우트**: 기존 `/quality/trace` 교체. 메뉴/경로는 1개 유지.
- **API**: 단일 종합 API 일괄 조회 (`GET /quality/trace?serial=...`). 응답 DTO를 신규 종합 구조로 전면 교체.
- **역추적 깊이**: 제품 → 반제품(1단계) → 원자재 PO/IQC 전체.
  - 반제품(SG)이 소비한 자재 LOT도 제품 직접투입 자재와 **동일하게** PO→IQC까지 펼친다.
  - `SG→SG` 다단계 재귀는 현재 데이터(PRODUCT_GENEALOGY)에 기록이 없으므로 **이번 범위 제외**(구조만 재귀 가능하게 둔다).
- **백엔드**: 기존 `trace.service.ts`는 보존(개조하지 않음). 신규 `ProductTraceabilityService` + 신규 DTO를 작성하고 컨트롤러 응답만 신규 서비스로 교체한다.
- **성능**: 모든 하위 조회는 `In()` 배치로 N+1을 회피한다.
- **멀티테넌시**: 모든 조회에 `COMPANY`, `PLANT_CD` 스코프를 포함한다.

## 3. 데이터 모델 / 조인키 (실측 확인)

### 3.1 제품 체인
| From | To | Join |
|------|----|------|
| 시리얼 | FG_LABELS | `FG_BARCODE = serial` |
| FG_LABELS | PART_MASTER | `ITEM_CODE` |
| FG_LABELS | PROD_RESULTS / JOB_ORDERS | `ORDER_NO` |
| PROD_RESULTS | INSPECT_RESULTS | `RESULT_NO = PROD_RESULT_ID` (시리얼 격리: `FG_BARCODE`/`SERIAL_NO = serial`) |
| FG_LABELS | INSPECT_RESULTS | `FG_BARCODE` (통전/외관 결과) |
| FG_LABELS | TRACE_LOGS | `SERIAL_NO` (공정 타임라인, 있으면 우선 사용) |
| FG_LABELS.boxNo | BOX_MASTERS | `BOX_NO` |
| BOX_MASTERS.palletNo | PALLET_MASTERS | `PALLET_NO` |

### 3.2 반제품 체인
| From | To | Join |
|------|----|------|
| FG_BARCODE | PRODUCT_GENEALOGY | `PARENT_TYPE='FG' AND PARENT_KEY=FG_BARCODE AND CHILD_TYPE='SG'` → `CHILD_KEY = SG_BARCODE` |
| SG_BARCODE | SG_LABELS | `SG_BARCODE` |
| SG_LABELS | PROD_RESULTS | `ORDER_NO` (반제품 작업지시) / `RESULT_NO` |
| SG 작업지시 | INSPECT_RESULTS | `PROD_RESULT_ID` / 반제품 검사 |
| SG 작업지시 | MAT_ISSUES | `ORDER_NO` (반제품이 투입한 자재) |

### 3.3 원자재 체인 (제품 직접투입 + 반제품 투입 공통)
| From | To | Join |
|------|----|------|
| FG_BARCODE | PRODUCT_GENEALOGY | `PARENT_TYPE='FG' AND CHILD_TYPE='MAT_LOT'` → `CHILD_KEY = matUid` (직접투입) |
| 작업지시 | MAT_ISSUES | `ORDER_NO` → `MAT_UID` (투입 자재 LOT) |
| MAT_ISSUES | MAT_LOTS | `MAT_UID` |
| MAT_LOTS | PURCHASE_ORDERS | `PO_NO` |
| MAT_LOTS | MAT_ARRIVALS | `ARRIVAL_NO + ARRIVAL_SEQ` |
| MAT_LOTS | IQC_LOGS | `MAT_UID` 우선, 없으면 `ARRIVAL_NO` |
| MAT_LOTS | MAT_RECEIVINGS | `MAT_UID` (+ `ARRIVAL_NO/SEQ`) |
| MAT_LOTS | PARTNER_MASTERS | `VENDOR`(공급사명) |

> 자재 LOT 수집 우선순위: `PRODUCT_GENEALOGY`(genealogy 기록이 있으면 정확) → 보강으로 `MAT_ISSUES.ORDER_NO`. 두 소스를 `matUid`로 합집합(dedupe)한다.

## 4. API 설계

### 4.1 엔드포인트
- `GET /quality/trace?serial={FG_BARCODE}`
- 인증: `JwtAuthGuard`. `@Company()`, `@Plant()` 주입.
- 결과 없으면 `data: null` (404 아님). 기존 계약 유지.

### 4.2 응답 DTO (`ProductTraceabilityDto`)

```ts
interface ProductTraceabilityDto {
  product: {                         // ① 기본정보
    serialNo: string; itemCode: string; itemNo: string; itemName: string;
    orderNo: string | null; status: string; issuedAt: string | null;
    productionDate: string | null;
  };
  processHistory: ProcessStep[];     // ② 공정 생산이력 (시간순)
  inspections: InspectionRecord[];   // ③ 검사 기록
  packaging: {                       // ④ 포장·입고·출하
    boxNo: string | null; boxPackedAt: string | null;
    palletNo: string | null; palletPackedAt: string | null;
    shippedAt: string | null;
  };
  materials: MaterialTrace[];        // ⑤ 직접투입 자재 + PO/IQC 중첩
  semiProducts: SemiProductTrace[];  // ⑥ 투입 반제품 (재귀)
}

interface ProcessStep {
  process: string; processName: string; equipmentNo: string; equipmentName: string;
  operator: string; timestamp: string; result: 'PASS' | 'FAIL' | 'WORK';
  goodQty?: number; defectQty?: number; detail?: string;
}

interface InspectionRecord {
  inspectType: string; result: 'PASS' | 'FAIL'; inspectorId: string;
  inspectAt: string; equipCode: string | null; errorDetail: string | null;
}

interface MaterialTrace {
  matUid: string; itemCode: string; itemName: string; usedQty: number; unit: string;
  vendorCode: string | null; vendorName: string | null;
  po:       { poNo: string; orderDate: string | null; partnerName: string | null } | null;
  arrival:  { arrivalNo: string; arrivalDate: string | null; qty: number } | null;
  iqc:      { result: string; inspectType: string; inspectorName: string | null;
              inspectDate: string | null; certFilePath: string | null } | null;
  receiving:{ receiveNo: string; receiveDate: string | null } | null;
  issue:    { orderNo: string | null; issueQty: number; issueDate: string | null } | null;
}

interface SemiProductTrace {
  sgBarcode: string; itemCode: string; itemName: string; consumedQty: number;
  status: string; issueProcessCode: string | null;
  processHistory: ProcessStep[];     // 반제품 공정 생산이력
  inspections: InspectionRecord[];   // 반제품 검사 기록
  materials: MaterialTrace[];        // 반제품이 투입한 자재 (⑤와 동일 구조)
}
```

## 5. 백엔드 구조

- 신규 파일: `apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts`
- 신규 DTO 파일: `apps/backend/src/modules/quality/inspection/dto/product-traceability.dto.ts`
- 컨트롤러(`trace.controller.ts`)는 `ProductTraceabilityService.getBySerial()`을 호출하도록 교체. 기존 `TraceService`는 주입 유지(타 사용처 있으면 보존).
- 내부 헬퍼:
  - `resolveMaterialTraces(matUids[], company, plant)`: matUid 목록 → MAT_LOTS/PO/ARRIVAL/IQC/RECEIVING/ISSUE를 각각 `In()` 일괄 조회 후 `MaterialTrace[]` 조립. 직접투입·반제품투입에서 재사용.
  - `resolveProcessHistory(orderNo, serial, ...)`: TRACE_LOGS 우선, 없으면 PROD_RESULTS+INSPECT_RESULTS(시리얼 격리)로 공정 타임라인 조립.
  - `resolveInspections(prodResultNos[], fgOrSgBarcode, ...)`: 시리얼/바코드로 격리된 검사 기록.

### 5.1 시리얼 격리 (기존 버그 반영)
- 한 `PROD_RESULT_ID`에는 동일 작업지시의 여러 제품 검사결과가 묶인다. 검사·타임라인 펼침은 반드시 `FG_BARCODE = serial OR SERIAL_NO = serial`로 필터한다. (2026-06-23 수정된 동작과 동일 원칙)

## 6. 프론트 화면 구조

- 파일: `apps/frontend/src/app/(authenticated)/quality/trace/page.tsx` 전면 재작성.
- 레이아웃: 상단 검색바 + 제품 요약 헤더, 그 아래 **세로 스택 섹션(카드)**. 최상위 컨테이너는 `overflow-y-auto`(2026-06-23 스크롤 수정 유지).
- 섹션:
  1. 제품 기본정보 — 요약 그리드
  2. 공정 생산이력 — 타임라인(현 디자인 재사용)
  3. 검사 기록 — 리스트/표 (통전/외관)
  4. 포장·입고·출하 — 박스·팔레트·출하 요약
  5. 투입 자재 — 표, 각 행 **펼침**(아코디언) 시 발주·입하·IQC·입고 중첩 표시
  6. 투입 반제품 — 아코디언, 펼치면 반제품 공정이력 + 검사 + 반제품 투입자재(자재도 5와 동일 펼침)
- 상태 텍스트/색상은 하드코딩 금지, `ComCodeBadge`/공통코드 사용. 검사 결과 배지는 파스텔 배경 금지(텍스트/테두리 구분).
- i18n: ko/en/zh/vi 4파일 동시. 신규 섹션 라벨 키 추가.

## 7. 화면 트리 (참고)

```
제품  FG26062300301
├─ ① 기본정보
├─ ② 공정 생산이력 (제품 본공정)
├─ ③ 검사 기록 (통전/외관)
├─ ④ 포장·입고·출하
├─ ⑤ 투입 자재 (직접투입)
│   └─ 자재 LOT → 발주·입하·IQC·입고  (중첩)
└─ ⑥ 투입 반제품
    └─ 반제품 SG바코드 (소비량)
       ├─ 반제품 공정 생산이력
       ├─ 반제품 검사 기록
       └─ 반제품 투입 자재 LOT
           └─ 발주·입하·IQC·입고  (중첩)
```

## 8. 엣지 케이스

- 시리얼 미존재 → `data: null`.
- 반제품 없음(직접 제조) → `semiProducts: []`.
- genealogy 기록 없음 → MAT_ISSUES 기반 보강으로만 자재 표시(부분 추적). LOT의 PO/IQC가 없으면 해당 nested 필드는 `null`.
- TRACE_LOGS 없음 → PROD_RESULTS fallback(시리얼 격리).
- IQC 미실시/특채 → `iqc.result`에 실제 상태 반영, 숨기지 않음.

## 9. 비범위 (YAGNI)

- `SG→SG` 다단계 재귀 추적 (데이터 부재).
- 정방향 추적(자재 LOT → 어떤 제품들에 투입됐나) — 별도 화면.
- 출하 거래처/납품서 상세 — 포장·출하 요약까지만.
- 추적 결과 PDF/Excel 내보내기 — 후속.

## 10. 검증 기준

- `FG26062300301` 조회 시: 검사 기록은 본인 1건만(시리얼 격리), 자재 LOT마다 PO/IQC가 있으면 중첩 표시, 반제품이 있으면 ⑥에 생산이력+자재까지 펼쳐짐.
- `pnpm --filter @harness/backend exec tsc --noEmit` 0 에러.
- N+1 없음(섹션당 고정 횟수 쿼리, `In()` 배치).
