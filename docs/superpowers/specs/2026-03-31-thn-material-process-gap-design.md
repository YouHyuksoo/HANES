# THN MES 자재 관리 프로세스 갭 분석 및 개선 설계

> **작성일:** 2026-03-31
> **근거 문서:** THN MES 자재 관리 프로세스_3.pdf (14페이지)
> **타겟:** 베트남 법인 (THN Vietnam) 기준, 한국 본사 호환
> **접근 방식:** 단계적 구현 (Phase 1 → 2 → 3)
> **ERP 인터페이스:** 포함 (양방향)
> **WMS:** WMS 유무 모두 대응 가능하도록 설계
> **한국→베트남 물류:** 범위 외 (베트남 입고 시점부터)

---

## 1. 갭 분석 요약

### 식별된 갭: 12개 + Minor 2건

| # | 갭 | THN 문서 요구 | 현재 HANES 상태 | 영향도 | Phase |
|---|-----|-------------|---------------|-------|-------|
| G1 | 입하 유형 분리 (유상/무상) | RM: ERP PO 기반, CM: 수동입력 — 별도 화면 | 단일 입하 화면 | 중 | 1 |
| G2 | PO 초과입하 방지 | PO수량 이상 입하 불가, 잔량 = 발주-입하+반품 | 반품합계 반영 미확인 | 중 | 1 |
| G3 | 입하 취소 조건 제한 | IQC 판정 이전에만 취소 (무검사품은 입고 전) | 취소 상태 체크 미확인 | 높 | 1 |
| G4 | IQC: 파일업로드 + 파괴검사 시료 | 검사성적서 업로드, 파괴검사 시료수량, 검사분류 | 해당 필드 미존재 | 높 | 1 |
| G5 | 검사필 스탬프 라벨 | 검사일+검사자 포함 스탬프 라벨 (감사 지적사항) | 별도 스탬프 라벨 없음 | 높 | 1 |
| G6 | IQC 불합격 자동처리 | 불량시리얼 채번→불용창고 자동이동→반품절차 | 자동처리 워크플로우 불완전 | 높 | 1 |
| G7 | 불출 요청서 발행/인쇄 + BOM | 작업지시 바코드, BOM 소요량/기불출량 표시 | 인쇄, 바코드 스캔, BOM 연동 미구현 | 높 | 2 |
| G8 | 불출자/수령인 바코드 스캔 | 사원 바코드 스캔으로 입력 | 수동 텍스트 입력 | 중 | 2 |
| G9 | 자재이동 권한 + 출고 승인 | 창고그룹별 권한, 기타출고 승인+재고잠금 | 권한 분리, 승인, 잠금 미구현 | 높 | 2 |
| G10 | 불출 자재 폐기 = 반납 후 폐기 | 반드시 반납 후에만 폐기 가능 | 반납 선행 체크 없음 | 중 | 2 |
| G11 | 유수명자재 재검사 워크플로우 | IQC 동일 재검 → 합격:기간연장, 불합격:불용창고 | 만료일 추적만, 재검사 워크플로우 없음 | 높 | 2 |
| G12 | ERP 인터페이스 (양방향) | ERP→MES: PO, MES→ERP: 입고/반품/출고/보정 | 인터페이스 레이어 미구현 | 높 | 3 |

### Minor 보완

| 항목 | 변경 | Phase |
|------|------|-------|
| 재고실사 위치보정 | `PhysicalInvCountDetail`에 `ACTUAL_LOCATION` 추가, 위치도 보정 | 2 |
| 병합 조건 검증 | `LotMergeService`에서 `ORIGIN_MAT_UID` 동일 여부 체크 | 2 |

### 사이트별 설정 분기 (베트남 vs 한국)

| 설정키 | 한국 | 베트남 | 용도 |
|--------|------|--------|------|
| `IQC_SAMPLE_ISSUE_MODE` | `AUTO_ISSUE` | `LOSS_ALLOW` | 파괴검사 시료 출고 방식 |
| `RETURN_MODE` | `RETURN` | `CANCEL` | 불출 자재 반환 방식 |
| `WMS_ENABLED` | `N` | `Y` | WMS 연동 여부 |

---

## 2. Phase 1: 입하 ~ 입고 프로세스 강화 (G1~G6)

### 2.1 사이트설정 기반구조 (공통 인프라)

**새 엔티티: `SiteConfig`** (테이블: `SITE_CONFIGS`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| COMPANY | VARCHAR2(10) | PK - 회사코드 |
| PLANT_CD | VARCHAR2(10) | PK - 공장코드 |
| CONFIG_KEY | VARCHAR2(50) | PK - 설정키 |
| CONFIG_VALUE | VARCHAR2(200) | 설정값 |
| DESCRIPTION | VARCHAR2(500) | 설명 |

**초기 설정키:**

| CONFIG_KEY | 한국 | 베트남 | 용도 |
|-----------|------|--------|------|
| `IQC_SAMPLE_ISSUE_MODE` | `AUTO_ISSUE` | `LOSS_ALLOW` | 파괴검사 시료 출고 방식 |
| `RETURN_MODE` | `RETURN` | `CANCEL` | 불출 자재 반환 방식 |
| `WMS_ENABLED` | `N` | `Y` | WMS 연동 여부 |
| `WMS_IMPORT_API` | - | `{URL}` | WMS→MES 이관 엔드포인트 |
| `ERP_EXPORT_ENABLED` | `Y` | `Y` | ERP 전송 활성화 |

**서비스: `SiteConfigService`** — `getConfig(company, plantCd, key)`, `setConfig()`, 캐싱 포함

### 2.2 G1: 입하 유형 분리 (유상/무상)

- 프론트엔드: `/material/arrival` 페이지에 탭 2개 (`유상(RM)` / `무상(CM)`)
- 유상 탭: ERP PO 목록 조회 → 선택 → 입하수량/인보이스/작업자 입력
- 무상 탭: 품목코드(셀렉트), 벤더(셀렉트), 수량, 인보이스 직접입력
- 백엔드: 기존 `createPoArrival()` / `createManualArrival()` 활용 (변경 최소)
- `MatArrival` 엔티티에 `ARRIVAL_TYPE` 컬럼 추가 (`RM` / `CM`)

### 2.3 G2: PO 초과입하 방지

- `ArrivalService.createPoArrival()` 검증 강화:
  - `입하잔량 = 발주수량 - 입하합계 + 반품합계`
  - `요청수량 > 입하잔량` → 에러
- `PurchaseOrderItem`에 `RETURN_QTY` 컬럼 추가 (또는 StockTransaction 집계)
- 프론트엔드: 입하 화면에 발주수량, 입하합계, 반품합계, 입하잔량 실시간 표시

### 2.4 G3: 입하 취소 조건 제한

- `ArrivalService.cancel()` 상태 체크 추가:
  - 검사대상품: IQC 판정 완료 시 취소 불가
  - 무검사품: 입고 완료 시 취소 불가
- `MatArrival` 상태 필드 활용: `PENDING` → `IQC_DONE` → `RECEIVED` 순서에서 `PENDING`에서만 취소 허용

### 2.5 G4: IQC 강화 (파일업로드 + 파괴검사 시료)

**`IqcLog` 엔티티 컬럼 추가:**

| 추가 컬럼 | 타입 | 설명 |
|----------|------|------|
| INSPECT_CLASS | VARCHAR2(10) | 검사분류: `FULL`(전수), `SAMPLE`(선별), `NONE`(무검사) |
| DESTRUCT_SAMPLE_QTY | NUMBER(10) | 파괴검사 시료 수량 |
| CERT_FILE_PATH | VARCHAR2(500) | 검사성적서 파일 경로 |
| INSPECTOR_NAME | VARCHAR2(50) | 검사자 이름 |
| INSPECT_DATE | DATE | 검사일 (당일 이후 불가) |

- 파일 업로드 API: `POST /material/iqc/:id/upload-cert`
- 사이트설정 `IQC_SAMPLE_ISSUE_MODE`에 따른 분기:
  - `AUTO_ISSUE`: 합격 판정 시 파괴검사 시료만큼 자동 기타출고
  - `LOSS_ALLOW`: 출고 안 함 (LOSS 범위 관리)

### 2.6 G5: 검사필 스탬프 라벨

- `LabelTemplate`에 새 템플릿 타입: `IQC_STAMP`
- 라벨 데이터: 검사일, 검사자 이름, 합격/불합격, 시리얼번호
- IQC 합격 판정 시 자동 라벨 생성 (기존 `LabelPrintService` 확장)
- 프론트엔드: IQC 화면에서 판정 후 "검사필 라벨 인쇄" 버튼

### 2.7 G6: IQC 불합격 자동처리

IQC 불합격 판정 시 자동 워크플로우:
1. 불량 시리얼 번호 채번 (기존 채번 로직 + 불량 접두사)
2. 불량 바코드 라벨 생성
3. `MatStock` → 불용창고(`DEFECT` 타입)로 자동 이동 (StockTransaction 생성)
4. 반품 대기 상태 설정

- `Warehouse` 엔티티에 `DEFECT` 타입 추가 (기존: RAW, PROD, WIP, FLOOR)

---

## 3. Phase 2: 불출 · 이동 · 출고 + 유수명 재검 (G7~G11)

### 3.1 G7: 불출 요청서 발행/인쇄 + BOM 연동

**`MatIssueRequestItem` 컬럼 추가:**

| 추가 컬럼 | 타입 | 설명 |
|----------|------|------|
| BOM_REQ_QTY | NUMBER(12,3) | BOM 소요량 (= BOM * 생산수량) |
| PREV_ISSUE_QTY | NUMBER(12,3) | 기 불출수량 |
| FLOOR_STOCK_QTY | NUMBER(12,3) | 현장재고 |

- `IssueRequestService.create()` 확장: 작업지시번호 기반 BOM 소요량 자동 조회
- 불출 요청서 PDF 생성: `GET /material/issue-requests/:id/print` (작업지시번호 바코드 포함)
- 작업지시 종료 시 해당 요청서로 불출 불가 검증
- 자재팀 화면: 작업지시 바코드 스캔 → 요청서 자동 조회

### 3.2 G8: 불출자/수령인 바코드 스캔

**`MatIssue` 컬럼 추가:**

| 추가 컬럼 | 타입 | 설명 |
|----------|------|------|
| ISSUER_ID | VARCHAR2(20) | 불출자 사번 |
| ISSUER_NAME | VARCHAR2(50) | 불출자 이름 |
| RECEIVER_ID | VARCHAR2(20) | 수령인 사번 |
| RECEIVER_NAME | VARCHAR2(50) | 수령인 이름 |

- 프론트엔드: 사원 바코드 스캔 필드 (스캔 시 사원정보 자동 조회, 수동 입력도 가능)

### 3.3 G9: 자재이동 권한 체계 + 출고 승인 워크플로우

#### (a) 창고그룹 개념

- `Warehouse` 엔티티에 `WAREHOUSE_GROUP` 컬럼 추가 (VARCHAR2(20))
- 예: 자재1창고, 자재2창고 → `MAT_STORE` / 현장창고 → `FLOOR`

#### (b) 이동 권한 분기

| 이동 유형 | 권한 | 처리 |
|----------|------|------|
| 동일 그룹 내 로케이션 이동 | 일반 작업자 | 즉시 처리 |
| 다른 그룹 간 이동 | 매니저급 | 승인 후 처리 |

#### (c) 기타출고 승인 워크플로우

**새 엔티티: `MatOutRequest`** (테이블: `MAT_OUT_REQUESTS`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| REQUEST_NO | VARCHAR2(20) | PK - 출고요청번호 |
| OUT_TYPE | VARCHAR2(10) | `RETURN`(반품), `SCRAP`(폐기), `OTHER`(기타) |
| STATUS | VARCHAR2(10) | `REQUESTED` → `APPROVED` → `COMPLETED` / `REJECTED` / `CANCELLED` |
| MAT_UID | VARCHAR2(30) | 대상 시리얼 |
| QTY | NUMBER(12,3) | 출고 수량 |
| REQUESTER_ID | VARCHAR2(20) | 요청자 |
| APPROVER_ID | VARCHAR2(20) | 승인자 |
| LOCK_YN | CHAR(1) | 재고 잠금 여부 (기본 'Y') |

- 요청 등록 시: `MatStock.reservedQty` 증가 → 이동·사용 불가
- 승인 시: 실제 출고 처리 (StockTransaction 생성)
- 취소 시: `reservedQty` 원복 → 잠금 해제

### 3.4 G10: 불출 자재 폐기 = 반납 후 폐기

- `ScrapService.scrap()` 선행 검증:
  - 대상 시리얼의 현재 위치가 FLOOR 타입 창고 → 에러: "불출된 자재는 반납 후 폐기해야 합니다"
- 사이트설정 `RETURN_MODE` 분기:
  - `RETURN` (한국): 반납 → 자재창고 복귀 → 폐기
  - `CANCEL` (베트남): 불출 취소 → 폐기

### 3.5 G11: 유수명자재 재검사 워크플로우

**새 엔티티: `ShelfLifeReInspect`** (테이블: `SHELF_LIFE_REINSPECTS`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| REINSPECT_NO | VARCHAR2(20) | PK - 재검번호 |
| MAT_UID | VARCHAR2(30) | 대상 시리얼 |
| INSPECTOR_ID | VARCHAR2(20) | 검사자 |
| INSPECT_DATE | DATE | 검사일 |
| RESULT | VARCHAR2(10) | `PASS` / `FAIL` |
| DESTRUCT_SAMPLE_QTY | NUMBER(10) | 파괴검사 시료수 |
| PREV_EXPIRY_DATE | DATE | 변경 전 만료일 |
| NEW_EXPIRY_DATE | DATE | 변경 후 만료일 (합격 시) |

- IQC와 동일한 검사항목 참조 (품목별 IQC 항목 기준정보)
- 단, 검사분류(전수/선별) 없음, 검사성적서 업로드 없음
- 합격: 품목정보의 `EXTEND_SHELF_DAYS` 값만큼 만료기간 연장
- 불합격: G6과 동일한 불합격 자동처리

### 3.6 Minor 보완

| 항목 | 변경 |
|------|------|
| 재고실사 위치보정 | `PhysicalInvCountDetail`에 `ACTUAL_LOCATION` 추가, 보정 시 위치도 업데이트 |
| 병합 조건 검증 | `LotMergeService`에서 `ORIGIN_MAT_UID` 동일 여부 체크 |

---

## 4. Phase 3: ERP · WMS 인터페이스 (G12)

### 4.1 모듈 구조

```
apps/backend/src/modules/interface/
├── interface.module.ts
├── erp/
│   ├── erp-import.service.ts      # ERP → MES (PO 수신)
│   ├── erp-export.service.ts      # MES → ERP (실적 전송)
│   ├── erp-api.client.ts          # ERP REST 클라이언트
│   └── dto/
├── wms/
│   ├── wms-import.service.ts      # WMS → MES (불출 자재 이관)
│   ├── wms-api.client.ts          # WMS REST 클라이언트
│   └── dto/
├── entities/
│   └── interface-log.entity.ts
└── scheduler/
    └── interface-scheduler.service.ts
```

### 4.2 InterfaceLog 엔티티

테이블: `INTERFACE_LOGS`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| LOG_ID | VARCHAR2(20) | PK - 로그번호 |
| IF_TYPE | VARCHAR2(20) | `ERP_PO_IMPORT`, `ERP_RECEIVE_EXPORT` 등 |
| DIRECTION | VARCHAR2(5) | `IN` / `OUT` |
| STATUS | VARCHAR2(10) | `SUCCESS` / `FAIL` / `RETRY` |
| REQUEST_PAYLOAD | CLOB | 요청 데이터 (JSON) |
| RESPONSE_PAYLOAD | CLOB | 응답 데이터 (JSON) |
| ERROR_MSG | VARCHAR2(1000) | 에러 메시지 |
| RETRY_COUNT | NUMBER(3) | 재시도 횟수 |
| CREATED_AT | TIMESTAMP | 생성일시 |

### 4.3 ERP → MES: PO 정보 수신

- `ErpImportService.syncPurchaseOrders()`: ERP에서 CONFIRMED 상태 PO 조회 → upsert
- 매핑: ERP PO번호, PO Line, Line Location ID → HANES PO 구조
- 스케줄: 매 30분 자동 동기화 (SiteConfig로 간격 조정 가능)

### 4.4 MES → ERP: 실적 전송 (4종)

| 메서드 | 트리거 시점 | 전송 데이터 |
|--------|-----------|-----------|
| `exportReceiving()` | 자재 입고 완료 시 | 입고번호, 품목, 수량, 입고일, PO번호 |
| `exportReturn()` | 반품 처리 완료 시 | 반품번호, 품목, 수량, 반품사유 |
| `exportIssue()` | 기타출고 승인 완료 시 | 출고번호, 품목, 수량, 출고유형 |
| `exportAdjustment()` | 재고보정 완료 시 | 보정번호, 품목, 변경수량, 사유 |

**전송 패턴:**
1. 트랜잭션 완료 후 이벤트 발행 (`EventEmitter2`)
2. `ErpExportService`가 이벤트 수신 → `InterfaceLog` 기록 → ERP API 호출
3. 실패 시: `RETRY` 상태 → 스케줄러가 최대 3회 재시도
4. 3회 실패 시: `FAIL` → 관리자 알림

비동기 처리: ERP 전송 실패가 MES 트랜잭션을 롤백하지 않음 (eventual consistency)

### 4.5 WMS → MES: 불출 자재 이관 (베트남)

- `WmsImportService.importIssuedMaterials()`: WMS에서 불출 완료 자재 수신
- 수신: 시리얼번호, 품목, 수량, 불출일시, 작업지시번호
- MES 처리: `MatLot` 생성 + `MatStock` 등록 (FLOOR 창고) + StockTransaction
- SiteConfig `WMS_ENABLED = 'N'` 시 비활성화
- 수신 방식: Pull (MES 폴링) + Push (`POST /interface/wms/import-issue`) 모두 지원

### 4.6 어댑터 패턴

```
ErpApiClient (interface)
├── OracleErpClient     # Oracle ERP Cloud
├── SapErpClient        # SAP (향후)
└── MockErpClient       # 개발/테스트용
```

SiteConfig `ERP_ADAPTER_TYPE` = `ORACLE` / `SAP` / `MOCK`

### 4.7 인터페이스 관리 화면

새 페이지: `/system/interface-log`
- 전송 이력 조회 (IF_TYPE, DIRECTION, STATUS, 날짜 필터)
- 실패 건 수동 재시도
- 오늘 성공/실패/대기 건수 통계 대시보드
