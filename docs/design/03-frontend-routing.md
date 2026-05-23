# HANES MES 프론트엔드 라우팅 인덱스

## 목적

이 문서는 프론트엔드 라우트를 도메인 기준으로 전수에 가깝게 파악하기 위한 인덱스 문서다.
기준 원본은 `apps/frontend/src/app`의 현재 폴더 구조다.

## 기준 위치

- 루트: `apps/frontend/src/app`
- 인증 영역: `apps/frontend/src/app/(authenticated)`
- PDA 영역: `apps/frontend/src/app/pda`

## 상위 라우팅 구조

```mermaid
graph TD
    ROOT[src/app] --> PUBLIC[public]
    ROOT --> AUTH[(authenticated)]
    ROOT --> PDA[pda]
```

## 공개 영역

- `page.tsx`
- `login/page.tsx`

## 인증 영역 전수 그룹

- `dashboard`
- `master`
- `material`
- `inventory`
- `production`
- `quality`
- `inspection`
- `shipping`
- `sales`
- `equipment`
- `customs`
- `outsourcing`
- `consumables`
- `system`
- `workflow`
- `interface`
- `product`

## 도메인별 라우트 인덱스

### `master`

- `bom`
- `code`
- `company`
- `equip`
- `equip-inspect`
- `gauge`
- `iqc-item`
- `label`
- `part`
- `partner`
- `process`
- `process-capa`
- `prod-line`
- `routing`
- `vendor-barcode`
- `warehouse`
- `work-calendar`
- `work-instruction`
- `worker`

### `material`

- `adjustment`
- `arrival`
- `arrival-stock`
- `hold`
- `iqc`
- `iqc-history`
- `issue`
- `lot`
- `lot-merge`
- `lot-split`
- `misc-receipt`
- `physical-inv`
- `po`
- `po-status`
- `receipt-cancel`
- `receive`
- `receive-history`
- `receive-label`
- `request`
- `scrap`
- `shelf-life`
- `stock`

### `inventory`

- `material-stock`
- `material-stock-history`
- `material-stock-take`
- `product-hold`
- `product-physical-inv`
- `product-physical-inv-history`
- `stock`
- `transaction`

### `production`

- `input-equip`
- `input-inspect`
- `input-material`
- `monthly-plan`
- `order`
- `pack-result`
- `progress`
- `repair`
- `result`
- `result-summary`
- `sample-inspect`
- `simulation`
- `wip-stock`

### `quality`

- `audit`
- `capa`
- `change-control`
- `complaint`
- `control-plan`
- `defect`
- `fai`
- `inspect`
- `msa`
- `oqc`
- `oqc-history`
- `ppap`
- `rework`
- `rework-history`
- `rework-inspect`
- `spc`
- `trace`

### `inspection`

- `history`
- `protocol`
- `result`

### `shipping`

- `confirm`
- `customer-po`
- `history`
- `order`
- `pack`
- `pallet`
- `return`

### `sales`

- `customer-po`
- `customer-po-summary`

### `equipment`

- `calibration`
- `daily-inspect`
- `inspect-config`
- `inspect-history`
- `mold`
- `mold-mgmt`
- `periodic-inspect`
- `periodic-result`
- `pm-calendar`
- `pm-plan`
- `pm-result`
- `status`

### 기타 인증 영역

- `customs`: `entry`, `stock`, `usage`
- `outsourcing`: `order`, `receive`, `vendor`
- `consumables`: `issuing`, `label`, `life`, `master`, `mount`, `receiving`, `stock`
- `interface`: `dashboard`, `log`, `manual`
- `system`: `comm-config`, `config`, `department`, `document`, `pda-roles`, `roles`, `scheduler`, `training`, `users`
- `workflow`: `components` 기반 요약 화면
- `product`: `issue`, `issue-cancel`, `receipt-cancel`, `receive`

## PDA 영역 전수 그룹

- `login`
- `menu`
- `settings`
- `equip-inspect`
- `material/adjustment`
- `material/inventory-count`
- `material/issuing`
- `material/menu`
- `material/receiving`
- `product/inventory-count`
- `shipping`

## 라우트 사용 주의사항

1. 웹과 PDA는 같은 앱 안에 있지만 흐름과 UI 패턴이 다르다.
2. `(authenticated)` 내부 라우트는 업무 도메인 기준으로 유지한다.
3. PDA는 스캔과 빠른 입력 흐름을 우선한다.
4. 컴포넌트 하위 폴더는 라우트 자체가 아니라 화면 구현 보조 구조다.

## 함께 읽을 문서

- [01-system-architecture.md](C:/Project/HANES/docs/core/01-system-architecture.md)
- [ui-screen-patterns.md](C:/Project/HANES/docs/core/ui-screen-patterns.md)
- [04-backend-api-endpoints.md](C:/Project/HANES/docs/core/04-backend-api-endpoints.md)
