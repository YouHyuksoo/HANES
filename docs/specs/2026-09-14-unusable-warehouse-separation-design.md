# 불용창고 분리 설계 — 원자재 불량 / 제품 불용 창고 구분

- 작성일: 2026-09-14
- 상태: 설계 확정 (구현 전)
- 관련 화면: `/material/iqc-defect-receive` (IQC 불합격 자재 입고), `/product/defect-transfer` (제품 불량창고입고)

## 1. 배경 — 지금 무엇이 문제인가

JSHANES 실측(2026-09-14) 기준 `WAREHOUSE_TYPE='DEFECT'` 창고가 두 개다.

| 창고코드 | 창고명 | 유형 | 기본 | 생성일 | 재고 | 코드 참조 |
|---|---|---|---|---|---|---|
| `DEFECT` | 불량품창고 | DEFECT | Y | 2026-02-25 | 자재 17건 / 16,800 (전부 RAW_MATERIAL) | `warehouse.service.ts:252` 기본 시드 |
| `WH-DEFECT` | 불용창고 | DEFECT | N | 2026-04-02 | 0건 | 없음 |

둘의 유형이 같아서 **시스템이 둘을 구분하지 못한다.** 결과로 두 가지가 생긴다.

1. **오선택 가능** — IQC 불합격 입고 화면은 `warehouseType="DEFECT"`로 창고를 거르므로
   드롭다운에 두 창고가 모두 뜬다. 작업자가 원자재를 불용창고에 넣을 수 있고, 막는 장치가 없다.
2. **자동이동 목적지가 불확실** — 아래 두 곳이 정렬 없이 `findOne`으로 DEFECT 타입 한 건을 집는다.
   현재는 우연히 `DEFECT`가 잡히지만 행 순서에 의존한다.
   - `iqc-history.service.ts:831` (IQC 불합격 자동이동)
   - `shelf-life-reinspect.service.ts:232` (유효기간 재검사 불합격)

또한 반제품·완제품 불량은 현재 창고 이동 없이 공정창고(`SFG_WIP`/`FG_WIP`)에
`QUALITY_STATUS='DEFECT'`로 남는다(실측 4건 / 43). 제품 불량입고 화면
`/product/defect-transfer`이 이미 있으나 목적지 기본값이 `'DEFECT'`라
제품 불량도 원자재와 같은 창고로 들어가게 되어 있다.

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

창고유형이 이미 `WAREHOUSE_TYPE_DTO` 공통코드와 `@harness/shared`의
`WAREHOUSE_TYPE_DTO_VALUES` 상수로 단일 출처가 서 있고 DTO 검증(`@IsIn`)까지 걸려 있어,
새 유형을 추가하는 경로가 이미 닦여 있다. 강제력이 가장 큰 방식이 구현 비용도 감당 가능하다.

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

### 4-3. 백엔드

6. `product-inventory.service.ts` (612·623·630행) — 제품 불량입고 목적지를 `UNUSABLE` 기준으로 전환.
   하드코딩 `'DEFECT'` 대신 `warehouseType='UNUSABLE' AND isDefault='Y'` 조회로 바꿔
   창고코드 문자열에 의존하지 않게 한다. 도착창고 검증도 `UNUSABLE`로 맞춘다.
7. `iqc-history.service.ts:831`, `shelf-life-reinspect.service.ts:232` —
   `findOne` 조건에 `isDefault:'Y'`를 더해 목적지를 확정한다(원자재용이므로 `DEFECT` 유지).
   이 둘은 유형 분리와 별개로 존재하던 불확실성이며 함께 제거한다.
8. `ai-page-tools`의 `WH_TYPES` / `WAREHOUSE_TYPES` 배열 2곳에 `UNUSABLE` 추가

### 4-4. 프론트

9. IQC 불합격 입고 화면 — `warehouseType="DEFECT"` 필터 그대로 둔다.
   유형이 갈리면서 불용창고가 드롭다운에서 자동으로 빠진다. **이 변경만으로 오선택이 해소된다.**
10. 제품 불량입고 화면 — 목적지가 서버 기본값이라 선택 UI는 필요 없다.
    다만 어느 창고로 들어가는지 화면에 드러나지 않으므로 **입고 대상 영역에 "입고 창고: 불용창고"
    표시를 추가한다.** 문구는 i18n 4개 파일에 넣는다.

## 5. 검증

- 백엔드 jest 전량 + FE/BE `tsc --noEmit`
- 실화면 2건
  - 자재 1건 IQC 불합격 입고 → `MAT_STOCKS.WAREHOUSE_CODE='DEFECT'` 확인,
    드롭다운에 불용창고가 없음을 확인
  - 제품 1건 불량입고 → `PRODUCT_STOCKS.WAREHOUSE_CODE='WH-DEFECT'` 확인
- 트랜잭션 테이블로 이동 이력 대조
- 마이그레이션 전후 `WAREHOUSES` / 재고 건수 기록

## 6. 범위 밖 (별도 판단)

- `WAREHOUSE_TYPE` 공통코드 그룹이 `WAREHOUSE_TYPE_DTO`와 값이 어긋나 있다
  (`RAW_MATERIAL`·`FINISHED`·`MRB`·`HOLD`는 실제 `WAREHOUSES`에 쓰이지 않는다).
  또한 실제 데이터의 `RM` 유형은 어느 코드그룹에도 없다. 이번 변경과 독립된 마스터 정리 건이다.
- `WAREHOUSES.WAREHOUSE_GROUP` 컬럼은 `WH-DEFECT` 한 행에만 값(`DEFECT`)이 있고
  코드에서 아무도 읽지 않는다. 유형 분리 후 불필요하므로 정리 대상이지만 이번 범위에 넣지 않는다.
- 공정창고에 이미 쌓인 불량 4건(`SFG_WIP` 3 / `FG_WIP` 1)을 일괄 이동할지는 운영 판단이다.
  화면에서 건별로 처리 가능하다.
