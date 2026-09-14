# 불용창고 분리 설계 — 원자재 불량 / 제품 불용 창고 구분

- 작성일: 2026-09-14
- 상태: 설계 확정 (구현 전)
- 관련 화면: `/material/iqc-defect-receive` (IQC 불합격 자재 입고), `/product/defect-transfer` (제품 불량창고입고)

## 1. 배경 — 지금 무엇이 문제인가

JSHANES 실측(2026-09-14) 기준 `WAREHOUSE_TYPE='DEFECT'` 창고가 두 개다.

| 창고코드 | 창고명 | 유형 | 기본 | 생성일 | 재고 | 코드 참조 |
|---|---|---|---|---|---|---|
| `DEFECT` | 불량품창고 | DEFECT | Y | 2026-02-25 | 자재 17건 / 16,800 (전부 RAW_MATERIAL) | `warehouse.service.ts:252` 기본 시드 |
| `WH-DEFECT` | 불용창고 | DEFECT | N | 2026-04-02 | 0건 | `scripts/migration/77_thn_gap_phase1_columns.sql:22` 생성, `iqc-history.service.spec.ts` 픽스처 |

둘의 유형이 같아서 **시스템이 둘을 구분하지 못한다.** 결과로 두 가지가 생긴다.

1. **오선택 가능** — IQC 불합격 입고 화면은 `warehouseType="DEFECT"`로 창고를 거르므로
   드롭다운에 두 창고가 모두 뜬다. 작업자가 원자재를 불용창고에 넣을 수 있고, 막는 장치가 없다.
2. **자동이동 목적지가 불확실** — 아래 두 곳이 정렬 없이 `findOne`으로 DEFECT 타입 한 건을 집는다.
   현재는 우연히 `DEFECT`가 잡히지만 행 순서에 의존한다.
   - `iqc-history.service.ts:832` (IQC 불합격 자동이동)
   - `shelf-life-reinspect.service.ts:233` (유효기간 재검사 불합격)

또한 반제품·완제품 불량은 현재 창고 이동 없이 공정창고(`SFG_WIP`/`FG_WIP`)에
`QUALITY_STATUS='DEFECT'`로 남는다(실측 4건 / 43). 제품 불량입고 화면
`/product/defect-transfer`이 이미 있으나 목적지 기본값이 `'DEFECT'`라
제품 불량도 원자재와 같은 창고로 들어가게 되어 있다.

### 1-1. 함께 드러난 기존 결함 (이번 변경과 독립)

`rework.service.ts:549`·`:581`이 재작업 합격분·폐기분의 출발지를 `fromWarehouseId: 'DEFECT'`로
하드코딩한다. 그런데 생산실적의 불량 적재(`prod-result.service.ts:2186-2243`
`adsorbDefectStockInTx`)는 불량을 **`FG_WIP`/`SFG_WIP`에 `qualityStatus='DEFECT'`로** 넣는다.
`DEFECT` 창고가 아니다. 즉 `:549`는 지금도 재고를 찾지 못한다.

`:562-576`이 부족분을 신규 입고로 보충하므로, 재작업 합격 시 **양품이 새로 생기고 불량 수량은
그대로 남는다** — `:537` 주석이 "이중계상 방지"라고 적은 바로 그 사고다. 폐기분(`:581`)은
이동 0건으로 조용히 넘어가 SCRAP 이력이 남지 않는다.

아직 사고가 드러나지 않은 이유는 재작업 실적이 0건이기 때문이다
(`PRODUCT_TRANSACTIONS` `REF_TYPE='REWORK'` 0행, 2026-09-14 실측). 잠재 결함이다.
이번 변경으로 제품 불량 목적지가 `WH-DEFECT`로 바뀌면 이 코드는 영구히 맞을 수 없게 되므로
**함께 고친다.**

## 2. 결정 사항

- **불용창고(`WH-DEFECT`)는 반제품·완제품 불량 전용 창고다.**
- **불량품창고(`DEFECT`)는 원자재 전용으로 남긴다.**
- **반제품·완제품 불량은 불용창고로 이동하는 것이 원칙이다.** 공정창고에 품질상태로만 남은
  불량은 "미처리"로 보고 제품 불량입고 화면이 대상으로 띄운다(현행 화면이 이미 그렇게 동작한다).
- **구분은 창고유형으로 강제한다.** 운영 설정이나 화면 기본값이 아니라 타입 자체를 분리해,
  각 화면이 자기 유형만 조회하면 반대쪽이 목록에 아예 나타나지 않게 한다.

### 목표 상태

| | 불량품창고 | 불용창고 |
|---|---|---|
| 창고코드 | `DEFECT` | `WH-DEFECT` |
| 창고유형 | `DEFECT` (유지) | `UNUSABLE` (신규) |
| 대상 품목 | 원자재 | 반제품·완제품 |
| 입구 화면 | IQC 불합격 입고 | 제품 불량창고입고 |
| 기본창고 | `IS_DEFAULT='Y'` (현행) | `IS_DEFAULT='Y'` (신규 설정) |

## 3. 왜 창고유형 분리인가

검토한 대안은 셋이다.

| 방식 | 구분 강제력 | 변경 범위 | 판단 |
|---|---|---|---|
| **창고유형 분리 (채택)** | 구조적 — 화면 필터가 갈려 오선택 자체가 불가능 | 공통코드·shared 상수·i18n·DB·백엔드 | 채택 |
| sys-config로 창고코드 고정 | 중간 — 기능은 맞는 창고를 쓰지만 드롭다운에는 둘 다 남음 | 작음 | 오선택이 남아 기각 |
| 화면 기본값만 지정 | 없음 — 작업자가 반대쪽을 고를 수 있음 | 가장 작음 | 기각 |

창고유형은 `WAREHOUSE_TYPE_DTO` 공통코드와 `@harness/shared`의 `WAREHOUSE_TYPE_DTO_VALUES`
상수를 주 출처로 쓰고 DTO 검증(`@IsIn`)까지 걸려 있어 새 유형을 추가하는 경로가 닦여 있다.

다만 **단일 출처는 아니다.** shared 밖에 유형 목록이 중복으로 하드코딩된 곳이 넷이다
(`warehouse-master.tools.ts:3`의 배열과 `:4-6`의 `WH_TYPE_HINT` 프롬프트 문자열,
`warehouse-tools.provider.ts:8`, `inventory/stock/page.tsx:25-32`). 구현 시 전부 손봐야 한다.

## 4. 변경 지점

### 4-1. 단일 출처 (이 순서를 지켜야 한다)

1. `packages/shared` — `WAREHOUSE_TYPE_DTO_VALUES`에 `UNUSABLE` 추가
2. **`pnpm --filter @harness/shared build` 재빌드** — 앱 tsconfig가 `dist`를 해석하므로
   재빌드 없이는 FE/BE 타입체크가 새 값을 보지 못한다
3. `COM_CODES` — `WAREHOUSE_TYPE_DTO / UNUSABLE / 불용` MERGE (`SORT_ORDER`는 기존 값과 충돌 없게)
4. i18n 4개 파일(ko·en·zh·vi) — `comCode.WAREHOUSE_TYPE_DTO.UNUSABLE`

### 4-2. DB

5. `WAREHOUSES` — `WH-DEFECT`의 `WAREHOUSE_TYPE`을 `UNUSABLE`로, `IS_DEFAULT='Y'` 설정.
   재고 0건이라 데이터 손실이 없다. 적용 전후 건수를 기록한다.

6. `warehouse.service.ts:244-254` `initDefaultWarehouses` — 기본 창고 목록에
   `{ code:'WH-DEFECT', name:'불용창고', type:'UNUSABLE', isDefault:true }` 추가.
   이게 없으면 신규 회사/공장에 불용창고가 생기지 않아 제품 불량입고가 첫 사용에서 실패한다.
   `scripts/migration/77_thn_gap_phase1_columns.sql:22`가 `WH-DEFECT`를 `DEFECT` 유형으로
   생성하므로 그 스크립트의 유형도 함께 고친다(신규 DB 대상).

### 4-3. 백엔드 — 목적지 창고 해석기를 공용으로 둔다

제품 불량창고를 찾는 로직을 한 서비스 안에 인라인하지 않고 **공용 함수 하나**로 두고,
소비처가 모두 그것을 부르게 한다. 아래 7~9번이 같은 출처를 보게 하는 것이 이번 설계의 핵심이다.

7. `product-inventory.service.ts` (612·616·623·630행) — 제품 불량입고 목적지를 `UNUSABLE` 기준으로 전환.
   현재 구조는 `dto.toWarehouseId || 'DEFECT'`로 코드를 먼저 정하고 코드로 조회하므로
   `:623`의 유형 폴백은 **도달 불가능한 죽은 코드**다. 이 구조를 걷어내고 해석기 호출로 바꾼다.
   도착창고 검증도 `UNUSABLE`로 맞춘다.
8. **`rework.service.ts:549`·`:581`** — `fromWarehouseId: 'DEFECT'` 하드코딩을 해석기 기준으로 교체.
   §1-1의 기존 결함을 함께 해소한다. `:537` 주석도 실제 동작에 맞게 고친다.
   **`:562-576`의 "부족분 신규 입고 보충" 폴백은 제거한다.** 이중계상이 흘러나온 통로이고,
   "불량재고 도입 전 데이터"라는 전제가 지금은 성립하지 않는다. 제거 후에는 불량재고가
   부족하면 재작업 합격이 `BadRequestException`으로 실패한다 — 조용히 재고를 만들어내는 것보다
   원인이 드러나는 편이 맞다(프로젝트 규칙: 추측성 폴백 금지, 실패는 크게).
9. **`repair-stock.service.ts:39`** — 허용 창고유형 `['WIP','FG','DEFECT']`에 `'UNUSABLE'` 추가.
   `repair-lookup.service.ts:25`가 창고유형 필터 없이 `qualityStatus:'DEFECT'`로만 대상을 뽑아
   `WH-DEFECT` 재고가 수리 화면 목록에 뜨므로, 추가하지 않으면 **목록에는 보이는데 시작은
   거부되는** 상태가 된다.
10. `iqc-history.service.ts:832`, `shelf-life-reinspect.service.ts:233` —
    `findOne` 조건에 `isDefault:'Y'`를 더해 목적지를 확정한다(원자재용이므로 `DEFECT` 유지).
    유형 분리와 별개로 존재하던 불확실성이며 함께 제거한다.
11. `ai-page-tools` — `warehouse-master.tools.ts:3` 배열, `:4-6` `WH_TYPE_HINT` 프롬프트 문자열,
    `warehouse-tools.provider.ts:8` 배열(`:61` `normalizeWhType`이 검증에 사용) 세 곳에 `UNUSABLE` 추가.

### 4-3-1. 함께 고치는 jest 스펙 2개

- `product-inventory.service.spec.ts:562-564,569,581` — `warehouseCode:'DEFECT'` 정확 일치 단언
- `iqc-history.service.spec.ts:936` — `where:{ warehouseType:'DEFECT', useYn:'Y' }` 정확 일치 단언

`shelf-life-reinspect.service.spec.ts`와 `arrival.service.spec.ts`는 영향 없음을 확인했다
(전자는 반환값 mock, 후자는 무관한 자재입하 음성 테스트).

### 4-4. 프론트

12. IQC 불합격 입고 화면 — `warehouseType="DEFECT"` 필터 그대로 둔다.
    유형이 갈리면서 불용창고가 드롭다운에서 자동으로 빠진다. **이 변경만으로 오선택이 해소된다.**
    (`WarehouseSelect`→`useMasterOptions`가 유형을 서버 쿼리로 그대로 넘기는 것을 확인했다.)
13. 제품 불량입고 화면 — 목적지가 서버 기본값이라 선택 UI는 필요 없다.
    다만 어느 창고로 들어가는지 화면에 드러나지 않으므로 **입고 대상 영역에 "입고 창고: 불용창고"
    표시를 추가한다.** 문구는 i18n 4개 파일에 넣는다.
14. `inventory/stock/page.tsx:25-32` — 창고유형 필터 하드코딩 배열에 `UNUSABLE` 추가
    (+ i18n 4파일). 없으면 제품재고 화면에서 불용창고를 필터로 고를 수 없다.
15. `master/warehouse/types.ts:28-33` `WAREHOUSE_TYPE_COLORS` — `UNUSABLE` 색 지정(경미).

창고등록 화면(`master/warehouse`)은 `useComCodeOptions('WAREHOUSE_TYPE_DTO')`를 쓰므로
3번 공통코드 MERGE만으로 자동 반영된다 — 별도 수정 불필요.

## 5. 배포 순서 제약

**DB 마이그레이션과 백엔드 배포는 하나의 창(window)으로 묶어야 한다.** 어느 쪽을 먼저 해도
그 사이 구간이 깨지기 때문이다.

- DB 먼저 → 구 빌드의 `UpdateWarehouseDto.@IsIn([...WAREHOUSE_TYPE_DTO_VALUES])`가 `UNUSABLE`을
  거부한다. 그 구간에 창고등록 화면에서 `WH-DEFECT`를 저장하면 400이다
  (`WarehouseForm.tsx:63-64`가 유형을 항상 실어 보낸다).
- 코드 먼저 → 해석기 조회가 null이 되어 제품 불량입고가 `'불량창고가 설정되어 있지 않습니다.'`로
  전면 실패한다.

`hswbs.haengsung.com:3002` 배포 서버는 로컬 dev와 별개지만 **DB를 공유**하므로 그 창에 포함한다.
두 유형을 모두 허용하는 폴백은 쓰지 않는다 — 조용한 0건 처리가 §1-1에서 본 사고의 형태다.

## 6. 검증

- 백엔드 jest 전량 + FE/BE `tsc --noEmit`
- 실화면 2건
  - 자재 1건 IQC 불합격 입고 → `MAT_STOCKS.WAREHOUSE_CODE='DEFECT'` 확인,
    드롭다운에 불용창고가 없음을 확인
  - 제품 1건 불량입고 → `PRODUCT_STOCKS.WAREHOUSE_CODE='WH-DEFECT'` 확인
- 트랜잭션 테이블로 이동 이력 대조
- 마이그레이션 전후 `WAREHOUSES` / 재고 건수 기록
- **재작업 경로 회귀** — §1-1 결함을 고친 뒤, 제품 불량 1건을 불용창고에 넣고
  재작업 합격 처리 시 `PRODUCT_TRANSACTIONS`에 이동(`REWORK_IN`) 1건만 남고
  보충 입고(`WIP_IN`)가 생기지 않는 것을 확인한다. 현재 이 경로 이력은 0건이다.
- **폴백 제거 회귀** — 불량재고가 부족한 상태에서 재작업 합격을 시도하면
  재고가 새로 생기지 않고 예외로 실패하는 것을 단위 테스트로 고정한다.
- **수리 인수 경로** — 불용창고 재고로 수리 시작이 되는지 확인(9번 미적용 시 거부된다)

## 7. 범위 밖 (별도 판단)

- `WAREHOUSE_TYPE` 공통코드 그룹이 `WAREHOUSE_TYPE_DTO`와 값이 어긋나 있다
  (`RAW_MATERIAL`·`FINISHED`·`MRB`·`HOLD`는 실제 `WAREHOUSES`에 쓰이지 않는다).
  또한 실제 데이터의 `RM` 유형은 어느 코드그룹에도 없다. 이번 변경과 독립된 마스터 정리 건이다.
- `WAREHOUSES.WAREHOUSE_GROUP` 컬럼은 `WH-DEFECT` 한 행에만 값(`DEFECT`)이 있고
  코드에서 아무도 읽지 않는다. 유형 분리 후 불필요하므로 정리 대상이지만 이번 범위에 넣지 않는다.
- 공정창고에 이미 쌓인 불량 4건(`SFG_WIP` 3 / `FG_WIP` 1)을 일괄 이동할지는 운영 판단이다.
  화면에서 건별로 처리 가능하다.
- `tools/seed/08_seed_monitoring_boards.sql:206-207`이 `SEMI_PRODUCT`/`FINISHED` 재고를
  `DEFECT` 창고에 시드한다. 새 정책과 모순이나 시드 데이터라 운영 영향은 없다.
- `repair-lookup.service.ts:25`가 창고유형 필터 없이 수리 대상을 뽑는 것은 구조적으로
  느슨하다. 이번에는 허용유형 추가로 대응하고, 조회 자체를 좁히는 건 별도 건으로 둔다.
