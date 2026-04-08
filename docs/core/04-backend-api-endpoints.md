# HANES MES 백엔드 API 인덱스

## 목적

이 문서는 백엔드 API를 도메인 기준으로 전수에 가깝게 훑기 위한 인덱스 문서다.
기준 원본은 `apps/backend/src/modules/**/controllers`의 현재 구현이다.

## 기준 위치

- 루트 모듈: `apps/backend/src/app.module.ts`
- 컨트롤러 구현: `apps/backend/src/modules/**/controllers`
- 서비스 구현: `apps/backend/src/modules/**/services`

## 읽는 방법

1. 먼저 도메인 그룹에서 API 소속 영역을 찾는다.
2. 다음으로 대표 컨트롤러와 대표 경로를 본다.
3. 상태 전이나 상세 규칙은 서비스와 `domain-workflows.md`에서 확인한다.

## 상위 API 그룹

| 그룹 | 설명 |
|---|---|
| 인증/권한 | 로그인, 사용자, 역할, 메뉴 권한 |
| 기준정보 | 공통코드, 품목, BOM, 공정, 작업자, 창고, 라벨 등 |
| 자재 | 입하, IQC, 입고, LOT, 자재출고, 실사, 재고 |
| 완제품 재고 | 완제품 재고, 실사, 창고, 보류 |
| 생산 | 계획, 작업지시, 실적, 자동출고, 시뮬레이션 |
| 품질 | 검사결과, 추적성, 불량, SPC, OQC, 재작업, FAI, PPAP, 감사 |
| 출하 | 고객주문, 출하지시, 박스, 팔레트, 출하, 반품 |
| 설비 | 설비, 점검, PM, 금형, 설비성 소모품 |
| 외부 업무 | 외주, 통관, 소모품, 인터페이스 |
| 운영 | 시스템 설정, 문서, 교육, 대시보드, 스케줄러, 워크플로우 |

## 도메인별 API 인덱스

### 인증/권한

- 모듈: `auth`, `user`, `role`, `num-rule`
- 역할: 로그인, 사용자, 권한, 채번 규칙
- 기준 파일
- `apps/backend/src/modules/auth/*`
- `apps/backend/src/modules/user/*`
- `apps/backend/src/modules/role/*`
- `apps/backend/src/modules/num-rule/*`

### 기준정보

- 모듈: `master`
- 주요 컨트롤러
- `bom.controller.ts`
- `com-code.controller.ts`
- `company.controller.ts`
- `department.controller.ts`
- `equip-bom.controller.ts`
- `equip-inspect.controller.ts`
- `iqc-group.controller.ts`
- `iqc-item.controller.ts`
- `iqc-item-pool.controller.ts`
- `iqc-part-link.controller.ts`
- `label-template.controller.ts`
- `model-suffix.controller.ts`
- `part.controller.ts`
- `partner.controller.ts`
- `plant.controller.ts`
- `process.controller.ts`
- `process-capa.controller.ts`
- `prod-line.controller.ts`
- `routing.controller.ts`
- `routing-group.controller.ts`
- `shift-pattern.controller.ts`
- `transfer-rule.controller.ts`
- `vendor-barcode-mapping.controller.ts`
- `work-calendar.controller.ts`
- `work-instruction.controller.ts`
- `worker.controller.ts`
- 대표 경로 접두사
- `master/*`

### 자재

- 모듈: `material`
- 주요 컨트롤러
- `adjustment.controller.ts`
- `arrival.controller.ts`
- `hold.controller.ts`
- `iqc-history.controller.ts`
- `issue-request.controller.ts`
- `label-print.controller.ts`
- `lot-merge.controller.ts`
- `lot-split.controller.ts`
- `mat-issue.controller.ts`
- `mat-lot.controller.ts`
- `mat-stock.controller.ts`
- `misc-receipt.controller.ts`
- `physical-inv.controller.ts`
- `po-status.controller.ts`
- `purchase-order.controller.ts`
- `receipt-cancel.controller.ts`
- `receive-label.controller.ts`
- `receiving.controller.ts`
- `scrap.controller.ts`
- `shelf-life.controller.ts`
- 대표 경로 접두사
- `material/*`

### 완제품 재고

- 모듈: `inventory`
- 주요 컨트롤러
- `inventory.controller.ts`
- `product-physical-inv.controller.ts`
- `warehouse.controller.ts`
- `product-hold.controller.ts` 계열
- 대표 경로 접두사
- `inventory/*`

### 생산

- 모듈: `production`
- 주요 컨트롤러
- `job-order.controller.ts`
- `prod-plan.controller.ts`
- `prod-result.controller.ts`
- `product-label.controller.ts`
- `production-views.controller.ts`
- `repair.controller.ts`
- `sample-inspect.controller.ts`
- `simulation.controller.ts`
- 대표 경로 접두사
- `production/*`

### 품질

- 모듈: `quality`
- 하위 API 그룹
- `quality/inspection`: `inspect-result.controller.ts`, `trace.controller.ts`
- `quality/defects`: `defect-log.controller.ts`
- `quality/spc`: `spc.controller.ts`, `msa.controller.ts`, `control-plan.controller.ts`
- `quality/oqc`: `oqc.controller.ts`
- `quality/rework`: `rework.controller.ts`
- `quality/fai`: `fai.controller.ts`
- `quality/ppap`: `ppap.controller.ts`
- `quality/audit`: `audit.controller.ts`
- `quality/change-management`: `capa.controller.ts`, `change-order.controller.ts`, `complaint.controller.ts`
- `quality/continuity-inspect`: `continuity-inspect.controller.ts`
- 대표 경로 접두사
- `quality/*`

### 출하

- 모듈: `shipping`
- 주요 컨트롤러
- `box.controller.ts`
- `customer-order.controller.ts`
- `pallet.controller.ts`
- `ship-history.controller.ts`
- `ship-order.controller.ts`
- `ship-return.controller.ts`
- `shipment.controller.ts`
- 대표 경로 접두사
- `shipping/*`

### 설비

- 모듈: `equipment`
- 주요 컨트롤러
- `equip-master.controller.ts`
- `daily-inspect.controller.ts`
- `pm-plan.controller.ts`
- `mold.controller.ts`
- `consumable.controller.ts`
- 대표 경로 접두사
- `equipment/*`

### 외주, 통관, 소모품, 인터페이스

- `outsourcing`: `outsourcing.controller.ts`, `outsourcing/*`
- `customs`: `customs.controller.ts`, `customs/*`
- `consumables`: `consumables.controller.ts`, `consumables/*`
- `interface`: `interface.controller.ts`, `erp-material.controller.ts`, `interface/*`

### 운영

- `system`: `activity-log.controller.ts`, `comm-config.controller.ts`, `document.controller.ts`, `training.controller.ts`
- `scheduler`: `scheduler/*` 계열 컨트롤러와 실행기
- `workflow`: `workflow.controller.ts`, `workflow/summary`
- `dashboard`: `dashboard.controller.ts`, `dashboard/*`

## API 문서 사용 주의사항

1. 이 문서는 URI 전체 목록이 아니라 도메인별 엔드포인트 지도다.
2. 실제 파라미터와 응답 스키마는 DTO와 컨트롤러 구현을 기준으로 확인한다.
3. 상태 전이 API는 서비스와 워크플로우 문서를 같이 봐야 한다.

## 함께 읽을 문서

- [backend-module-index.md](C:/Project/HANES/docs/core/backend-module-index.md)
- [api-contract-guide.md](C:/Project/HANES/docs/core/api-contract-guide.md)
- [domain-workflows.md](C:/Project/HANES/docs/core/domain-workflows.md)
