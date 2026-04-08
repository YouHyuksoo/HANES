# HANES Module Map

## 개요

HANES는 Turborepo 기반 모노레포이며, 현재 문서 기준의 핵심 실행 축은 `apps/backend`와 `apps/frontend`다.
이 문서는 저장소를 처음 보는 사람이 코드 구조를 빠르게 파악할 수 있도록 모듈 지도를 제공한다.

## 저장소 구조

### Backend

- 경로: `apps/backend`
- 역할: NestJS API, TypeORM 엔티티, Oracle 연동, 업무 서비스

### Frontend

- 경로: `apps/frontend`
- 역할: Next.js App Router 기반 화면, 인증 후 업무 화면, PDA 화면

## 백엔드 도메인 맵

### 공통 기반

- `auth`: 로그인, 토큰, 인증 처리
- `user`: 사용자 관리
- `role`: 권한 관리
- `num-rule`: 번호 채번 규칙
- `workflow`: 워크플로우 요약 API
- `dashboard`: 대시보드 집계

### 기준정보

- `master`: 회사, 거래처, 품목, BOM, 공정, 라우팅, 창고, 작업자, 공통코드 등 마스터

### 자재 및 재고

- `material`: 입하, IQC, 입고, 자재재고, LOT, 자재출고, 실사
- `inventory`: 완제품 재고, 완제품 실사, 창고, 제품 보류

### 생산

- `production`: 생산계획, 작업지시, 생산실적, 자동출고, 시뮬레이션, 라벨, 재작업 연계

### 품질

- `quality/inspection`: 검사결과, 추적성
- `quality/defects`: 불량로그
- `quality/spc`: SPC, MSA
- `quality/oqc`: 출하검사
- `quality/rework`: 재작업
- `quality/fai`, `quality/ppap`, `quality/audit`, `quality/change-management`

### 출하 및 대외 업무

- `shipping`: 고객주문, 출하지시, 출하, 박스, 팔레트, 반품, 출하이력
- `outsourcing`: 외주 발주, 납품, 입고
- `customs`: 보세 및 통관 관련 흐름

### 설비 및 기타 운영

- `equipment`: 설비, 금형, 점검, PM, 설비성 소모품
- `consumables`: 일반 소모품 수불 및 재고
- `scheduler`: 배치 작업, 실행 로그, 알림
- `interface`: ERP/BOM/자재 인터페이스
- `system`: 문서, 설정, 활동로그, 교육, PDA 권한

## 프론트엔드 화면 맵

### 일반 웹 화면

- 경로: `apps/frontend/src/app/(authenticated)`
- 대표 그룹
- `master`
- `material`
- `production`
- `quality`
- `shipping`
- `equipment`
- `inventory`
- `system`
- `workflow`

### PDA 화면

- 경로: `apps/frontend/src/app/pda`
- 대표 그룹
- `material/receiving`
- `material/issuing`
- `material/inventory-count`
- `product/inventory-count`
- `shipping`
- `equip-inspect`

## 핵심 엔티티 군

### 자재 흐름

- `MatArrival`
- `MatLot`
- `IqcLog`
- `MatReceiving`
- `MatStock`
- `StockTransaction`

### 생산 흐름

- `ProdPlan`
- `JobOrder`
- `ProdResult`
- `ProductStock`
- `ProductTransaction`

### 출하 흐름

- `ShipmentOrder`
- `ShipmentLog`
- `BoxMaster`
- `PalletMaster`
- `FgLabel`

## 의존 방향

1. `master`는 대부분의 도메인이 참조한다.
2. `material`은 입하, IQC, 입고, 자재재고의 중심이다.
3. `production`은 계획, 작업지시, 생산실적, WIP/FG 재고를 연결한다.
4. `quality`는 생산과 출하 전후의 품질 상태를 제어한다.
5. `shipping`은 박스, 팔레트, 출하와 완제품 재고 차감을 묶는다.

## 함께 읽을 문서

- [backend-module-index.md](C:/Project/HANES/docs/core/backend-module-index.md)
- [domain-workflows.md](C:/Project/HANES/docs/core/domain-workflows.md)
- [04-backend-api-endpoints.md](C:/Project/HANES/docs/core/04-backend-api-endpoints.md)
