---
sources:
  - apps/frontend/src/app/(authenticated)/production/input-assembly/page.tsx
  - apps/frontend/src/app/(authenticated)/production/input-assembly/components/SgScanPanel.tsx
  - apps/frontend/src/app/(authenticated)/production/input-assembly/components/AssemblyActionBar.tsx
  - apps/frontend/src/app/(authenticated)/production/input-assembly/hooks/useAssemblyScanSession.ts
  - apps/backend/src/modules/production/services/subprocess-kitting.service.ts
  - packages/shared/src/utils/assembly-sg-rules.ts
verifiedCommit: e2b1fa8f
---

# 실적입력(조립) — 업무 흐름과 변경 영향

- 메뉴: `PROD_INPUT_ASSEMBLY`, `/production/input-assembly`
- 대조: 2026-09-07, 위 HEAD 위의 미커밋 작업본 포함.

## 작업 흐름

설비 선택 → 설비의 현재 작업지시 복원 또는 완제품 작업지시 선택 → 원자재 공정재고 준비 → 반제품 SG 세트 스캔 → 조립 실행(FG 발행) → 실물 FG 스캔으로 확정 → 다음 제품 조립.

사용자가 확인한 김천 마그나 검사 순서는 **조립 → 통전 → 육안 → 포장**이다. 조립 확정은 검사 합격을 의미하지 않는다. FG는 조립 후에도 `ISSUED`이며, 통전 합격 정보와 육안 합격 상태가 포장 조건이다.

## 화면 상태와 스캔 유지

- 설비는 localStorage에서 복원한다. SG 세트는 현재 화면 세션에만 보관한다.
- `useAssemblyScanSession`이 SG 목록과 기본값 ON인 지속 옵션을 관리한다.
- 같은 품목의 여러 SG 잔량을 합산하여 완제품 1개분 BOM 수량이 준비됐는지 판단한다. 중복 라벨은 추가하지 않는다.
- 서버 확정 응답의 `sgLabels`로 잔량·상태를 갱신한다. 클라이언트에서 임의로 1씩 차감하지 않는다.
- 지속 ON: 잔량이 남고 상태가 `IN_STOCK`/`MOUNTED`인 라벨만 유지한다. 소진 라벨은 제거한다. 부족한 세트는 보충 스캔 전 다음 조립을 막는다.
- 지속 OFF: 확정마다 목록을 비운다. 수동 초기화 및 설비·작업지시 변경도 목록을 비운다.
- 확정 실패 시 실제 SG 조회 API로 잔량을 다시 읽는다. 구버전 확정 응답에 잔량이 없으면 목록을 비워 재스캔하게 한다.
- 발행 중, 확정 중, 발행된 FG가 있을 때 설비·작업지시 변경을 막는다. 확정 전 SG 보충은 가능하다.
- 요청 중 동기 ref 가드로 반복 발행·확정을 막고, 서버는 FG 행 잠금과 기존 실적·계보 조회로 중복 확정을 차단한다.

## API와 책임

| 동작 | API | 처리 |
| --- | --- | --- |
| 요구량 조회 | `GET /production/subprocess-kitting/assembly-requirements/{orderNo}` | BOM 반제품/원자재 요구량 |
| SG 스캔·재조회 | `GET /production/subprocess-kitting/sg-label/{barcode}` | 실제 잔량·상태·품목 |
| FG 발행 | `POST /production/subprocess-kitting/issue-label` | FG 채번 및 `ISSUED` 라벨 저장 |
| 확정 | `POST /production/subprocess-kitting/confirm` | 실적·SG·원자재·계보·제품 WIP를 한 트랜잭션에서 반영 |

`confirmAssembly`는 tenant와 작업지시 상태, FG 소속 및 상태, 설비, 유효 BOM, SG 품목·잔량을 검증한다. SG 잠금은 바코드 정렬 순서로 획득하고 실제 소비 순서는 사용자가 스캔한 순서를 따른다. Oracle의 `FETCH FIRST + FOR UPDATE` 제약 때문에 FG/SG는 tenant 조건을 붙인 raw `SELECT ... FOR UPDATE` 후 엔티티를 읽는다.

공유 `planAssemblySgConsumption`이 동일 품목 BOM 요구량을 합산하고 필요한 양만 SG별로 배분한다. 프론트 준비 판정과 서버 소비량 계산이 이 규칙을 같이 사용한다. 원자재는 라우팅 ISSUE 자재 배정 필터 적용 후 설비 공정재고에서 BOM 소요량을 차감하며 부족하면 전체 확정을 롤백한다.

## DB 영향

| 테이블 | 발행·확정 효과 |
| --- | --- |
| `FG_LABELS` | 발행 INSERT. 조립 확정 후 `ISSUED` 유지 |
| `SG_LABELS` | 실제 BOM 소비량 차감, 잔량 있으면 `MOUNTED`, 소진 시 `CONSUMED` |
| `PRODUCT_GENEALOGY` | FG → SG 및 실제 소비 원자재 LOT, 실제 소비수량 기록 |
| `PROD_RESULTS` | FG당 양품 1 실적 |
| `JOB_ORDERS` | 실적 합계로 수량·상태 동기화 |
| `WIP_MAT_STOCKS`, `WIP_MAT_TRANSACTIONS` | 설비 원자재 차감 및 수불 기록 |
| `PRODUCT_STOCKS`, `PRODUCT_TRANSACTIONS` | FG_WIP 양품 1 적재 및 수불 기록 |

발행과 확정은 별도 요청이다. 확정 실패 시 이미 발행한 FG는 재시도 대상으로 남는다. 출력은 `printFg`와 기존 Print Agent 흐름을 따른다.

## 변경 영향 지도

| 변경 종류 | 확인할 위치 |
| --- | --- |
| SG 요구량·소비 규칙 | shared `assembly-sg-rules.ts`, backend `confirmAssembly`/`getAssemblyRequirements`, 두 focused spec |
| 지속 옵션·잔량 표시 | `useAssemblyScanSession`, `SgScanPanel`, page 확정 응답 처리, locales 4개 |
| FG 발행·스캔 가드 | page, `AssemblyActionBar`, backend `issueLabel`/`confirmAssembly` |
| 자재 장착 안내 | `EquipMaterialMountPanel`, `equip-material.service.ts` |
| 검사 순서 | `continuity-inspect.service.ts`, 마그나 라우팅 migration, 포장 `box.service.ts` |

## 검증 범위

2026-09-07 실제 로그인 브라우저에서 6 SG 스캔 전후 실행 버튼, 지속 옵션 전환, 초기화를 확인했다. 실제 JSHANES 서비스 호출에서는 한 트랜잭션 안에 시험 원자재 수량을 준비해 연속 2건 확정 및 SG 10→9→8, 중복 확정·SG 누락 차단을 확인하고 롤백했다. 현재 현장 설비 원자재 가용재고는 0이므로 실제 생산 커밋 또는 브라우저 연속 생산 완료를 주장하지 않는다.
