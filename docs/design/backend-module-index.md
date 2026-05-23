# Backend Module Index

## 목적

백엔드 모듈 전체를 전수 기준으로 나열하고, 각 모듈의 책임, 대표 파일, 하위 모듈 구조를 빠르게 찾기 위한 인덱스 문서다.
기준 원본은 `apps/backend/src/modules`의 현재 구현이다.

## 읽는 방법

1. 먼저 상위 모듈 목록에서 도메인 위치를 찾는다.
2. 다음으로 도메인별 상세에서 대표 컨트롤러와 서비스를 확인한다.
3. 하위 모듈이 있는 경우 서브모듈 단위까지 내려가서 책임을 확인한다.

## 상위 모듈 전수 목록

| 모듈 | 역할 | 구조 특징 |
|---|---|---|
| `auth` | 인증, 로그인, 토큰 처리 | 단일 모듈 |
| `user` | 사용자 관리 | 단일 모듈 |
| `role` | 권한 관리 | 단일 모듈 |
| `num-rule` | 번호 채번 규칙 | 단일 모듈 |
| `master` | 기준정보 관리 | 다수 컨트롤러/서비스 조합 |
| `material` | 자재 입하, 검사, 입고, 재고, LOT, 실사 | 다수 컨트롤러/서비스 조합 |
| `inventory` | 완제품 재고, 완제품 실사, 창고 | 다수 컨트롤러/서비스 조합 |
| `production` | 생산계획, 작업지시, 실적, 자동출고, 시뮬레이션 | 다수 컨트롤러/서비스 조합 |
| `quality` | 품질 하위 도메인 집합 | 서브모듈 분리형 |
| `shipping` | 고객주문, 출하지시, 출하, 박스, 팔레트, 반품 | 다수 컨트롤러/서비스 조합 |
| `equipment` | 설비, 점검, PM, 금형, 설비성 소모품 | 다수 컨트롤러/서비스 조합 |
| `outsourcing` | 외주 발주, 납품, 입고 | 단일 도메인 모듈 |
| `customs` | 보세, 통관, 수불 이력 | 단일 도메인 모듈 |
| `consumables` | 일반 소모품 수불 및 재고 | 단일 도메인 모듈 |
| `interface` | ERP 및 외부 시스템 연동 | 다수 컨트롤러/서비스 조합 |
| `scheduler` | 배치, 실행기, 알림, 로그 | 서비스 + 실행기 조합 |
| `system` | 시스템 설정, 문서, 교육, 활동 로그 | 다수 컨트롤러/서비스 조합 |
| `workflow` | 워크플로우 요약 API | 단일 모듈 |
| `dashboard` | 대시보드 집계 | 단일 모듈 |

## 도메인별 상세 인덱스

### `auth`

- 역할: 인증, 로그인, 토큰 처리
- 대표 파일
- `apps/backend/src/modules/auth/*`

### `user`

- 역할: 사용자 관리
- 대표 파일
- `apps/backend/src/modules/user/*`

### `role`

- 역할: 권한 관리
- 대표 파일
- `apps/backend/src/modules/role/*`

### `num-rule`

- 역할: 번호 채번 규칙
- 대표 파일
- `apps/backend/src/modules/num-rule/*`

### `master`

- 역할: 기준정보와 참조 데이터 관리
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
- 주요 서비스
- `bom.service.ts`
- `com-code.service.ts`
- `company.service.ts`
- `department.service.ts`
- `equip-bom.service.ts`
- `equip-inspect.service.ts`
- `iqc-group.service.ts`
- `iqc-item.service.ts`
- `iqc-item-pool.service.ts`
- `iqc-part-link.service.ts`
- `label-template.service.ts`
- `model-suffix.service.ts`
- `part.service.ts`
- `partner.service.ts`
- `plant.service.ts`
- `process.service.ts`
- `process-capa.service.ts`
- `prod-line.service.ts`
- `routing.service.ts`
- `routing-group.service.ts`
- `shift-pattern.service.ts`
- `transfer-rule.service.ts`
- `vendor-barcode-mapping.service.ts`
- `work-calendar.service.ts`
- `work-instruction.service.ts`
- `worker.service.ts`
- 대표 API 접두사
- `master/*`

### `material`

- 역할: 입하, IQC, 입고, LOT, 자재 재고, 자재 실사, 자재 수불
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
- 주요 서비스
- `adjustment.service.ts`
- `arrival.service.ts`
- `hold.service.ts`
- `iqc-history.service.ts`
- `issue-request.service.ts`
- `label-print.service.ts`
- `lot-merge.service.ts`
- `lot-split.service.ts`
- `mat-issue.service.ts`
- `mat-lot.service.ts`
- `mat-out-request.service.ts`
- `mat-stock.service.ts`
- `misc-receipt.service.ts`
- `physical-inv.service.ts`
- `po-status.service.ts`
- `purchase-order.service.ts`
- `receipt-cancel.service.ts`
- `receive-label.service.ts`
- `receiving.service.ts`
- `scrap.service.ts`
- `shelf-life.service.ts`
- `shelf-life-reinspect.service.ts`
- 대표 API 접두사
- `material/*`

### `inventory`

- 역할: 완제품 재고, 완제품 실사, 창고, 제품 보류
- 대표 컨트롤러
- `inventory.controller.ts`
- `product-physical-inv.controller.ts`
- `warehouse.controller.ts`
- `product-hold.controller.ts` 계열
- 대표 서비스
- `inventory.service.ts`
- `product-inventory.service.ts`
- `product-physical-inv.service.ts`
- `warehouse.service.ts`
- `product-hold.service.ts`
- 대표 API 접두사
- `inventory/*`

### `production`

- 역할: 생산계획, 작업지시, 생산실적, 자동출고, 시뮬레이션, 생산 조회
- 주요 컨트롤러
- `job-order.controller.ts`
- `prod-plan.controller.ts`
- `prod-result.controller.ts`
- `product-label.controller.ts`
- `production-views.controller.ts`
- `repair.controller.ts`
- `sample-inspect.controller.ts`
- `simulation.controller.ts`
- 주요 서비스
- `auto-issue.service.ts`
- `auto-plan.service.ts`
- `job-order.service.ts`
- `prod-plan.service.ts`
- `prod-result.service.ts`
- `product-label.service.ts`
- `production-views.service.ts`
- `repair.service.ts`
- `sample-inspect.service.ts`
- `simulation-data.service.ts`
- `simulation.service.ts`
- `simulation-helper.ts`
- 대표 API 접두사
- `production/*`

### `quality`

- 역할: 품질 하위 도메인 묶음
- 하위 모듈
- `audit`: 감사 관리
- `change-management`: CAPA, 변경관리, 고객불만
- `continuity-inspect`: 연속성 검사
- `defects`: 불량 로그
- `fai`: 초도품 검사
- `inspection`: 검사결과, 추적성
- `oqc`: 출하 검사
- `ppap`: PPAP
- `rework`: 재작업
- `spc`: SPC, MSA
- 대표 API 접두사
- `quality/*`

### `shipping`

- 역할: 고객주문, 출하지시, 출하, 박스, 팔레트, 출하이력, 반품
- 주요 컨트롤러
- `box.controller.ts`
- `customer-order.controller.ts`
- `pallet.controller.ts`
- `ship-history.controller.ts`
- `ship-order.controller.ts`
- `ship-return.controller.ts`
- `shipment.controller.ts`
- 주요 서비스
- `box.service.ts`
- `customer-order.service.ts`
- `pallet.service.ts`
- `ship-history.service.ts`
- `ship-order.service.ts`
- `ship-return.service.ts`
- `shipment.service.ts`
- 대표 API 접두사
- `shipping/*`

### `equipment`

- 역할: 설비 마스터, 점검, PM, 금형, 설비성 소모품
- 대표 컨트롤러
- `equip-master.controller.ts`
- `daily-inspect.controller.ts`
- `pm-plan.controller.ts`
- `mold.controller.ts`
- `consumable.controller.ts`
- 대표 서비스
- `equip-master.service.ts`
- `equip-inspect.service.ts`
- `pm-plan.service.ts`
- `mold.service.ts`
- `consumable.service.ts`
- 대표 API 접두사
- `equipment/*`

### `outsourcing`

- 역할: 외주 발주, 납품, 입고
- 대표 컨트롤러
- `outsourcing.controller.ts`
- 대표 서비스
- `outsourcing.service.ts`
- 대표 API 접두사
- `outsourcing/*`

### `customs`

- 역할: 보세, 통관, 수불 이력
- 대표 컨트롤러
- `customs.controller.ts`
- 대표 서비스
- `customs.service.ts`
- 대표 API 접두사
- `customs/*`

### `consumables`

- 역할: 일반 소모품 수불 및 재고
- 대표 컨트롤러
- `consumables.controller.ts`
- 대표 서비스
- `consumables.service.ts`
- 대표 API 접두사
- `consumables/*`

### `interface`

- 역할: ERP 및 외부 시스템 연동
- 대표 컨트롤러
- `erp-material.controller.ts`
- `interface.controller.ts`
- 대표 서비스
- `erp-material.service.ts`
- `interface.service.ts`
- 대표 API 접두사
- `interface/*`

### `scheduler`

- 역할: 배치 설정, 실행기, 로그, 알림
- 하위 폴더
- `config`
- `controllers`
- `dto`
- `executors`
- `services`
- 대표 서비스
- `scheduler-job.service.ts`
- `scheduler-log.service.ts`
- `scheduler-noti.service.ts`
- `sql.executor.ts`
- 대표 API 접두사
- `scheduler/*`

### `system`

- 역할: 시스템 설정, 문서, 교육, 활동 로그
- 대표 컨트롤러
- `activity-log.controller.ts`
- `comm-config.controller.ts`
- `document.controller.ts`
- `training.controller.ts`
- 대표 서비스
- `activity-log.service.ts`
- `comm-config.service.ts`
- `document.service.ts`
- `training.service.ts`
- 대표 API 접두사
- `system/*`

### `workflow`

- 역할: 워크플로우 요약 API
- 대표 파일
- `workflow.controller.ts`
- `workflow.service.ts`
- 대표 API 접두사
- `workflow/summary`

### `dashboard`

- 역할: 대시보드 집계
- 대표 파일
- `dashboard.controller.ts`
- `dashboard.service.ts`
- 대표 API 접두사
- `dashboard/*`

## 문서 사용 주의사항

1. 이 문서는 요약본이 아니라 전수 인덱스다.
2. 세부 비즈니스 규칙은 서비스 코드와 `domain-workflows.md`를 함께 본다.
3. 모듈 책임은 여기서 찾고, 저장소 배치는 `module-map.md`에서 본다.
4. 시스템 상위 구조는 `01-system-architecture.md`를 먼저 보면 된다.

## 함께 읽을 문서

- [01-system-architecture.md](C:/Project/HANES/docs/core/01-system-architecture.md)
- [module-map.md](C:/Project/HANES/docs/core/module-map.md)
- [domain-workflows.md](C:/Project/HANES/docs/core/domain-workflows.md)
- [04-backend-api-endpoints.md](C:/Project/HANES/docs/core/04-backend-api-endpoints.md)
