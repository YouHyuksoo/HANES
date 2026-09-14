# 미완료 작업 기록: 수량 입력 천단위 표시(QtyInput) 전면 적용

- 작성시각: 2026-09-14 16:13 KST
- 작성자: agent (Claude Opus 5)
- 작업 범위: 프론트엔드 전역 수량 입력 필드 (`<input type="number">` → 공통 `components/shared/QtyInput`)
- 현재 상태: 사용자결정대기

## 완료한 것

- `apps/frontend/src/components/material/issue-request/IssueRequestCreatePanel.tsx` 요청수량 입력을 `QtyInput`으로 교체.
  - 브라우저 실측: `http://localhost:3002/material/request` → 작업지시 선택 → [신규 요청] 탭에서 요청수량이 `3,450`, `13,300`으로 천단위 표시되는 것 확인.
- 같은 유형 전수 프로브 수행(doubt 절차).
  - 프로브: `grep -rn 'type="number"' --include="*.tsx"` → 전체 116곳.
  - 수량 필드로 좁힘(주변 6줄에 `Qty|quantity` 포함) → 약 25개 파일.

## 미완료 / 남은 것

사용자가 "지금 화면만" 처리로 범위를 한정했다. 아래 24개 파일은 **의도적으로 미수정**이며 같은 결함이 남아 있다.

| 계열 | 파일 (괄호는 해당 파일의 `type="number"` 히트 수) |
|---|---|
| 자재 출고/입고 | `components/material/IqcModal.tsx`(7) · `IssueFromRequestModal.tsx`(2) · `IssueProcessModal.tsx` · `ManualIssueRequestPanel.tsx` · `RequestModal.tsx` · `ArrivalModal.tsx` · `app/(authenticated)/material/shelf-life-reinspect/components/ReinspectModal.tsx`(2) · `material/po/components/PoFormPanel.tsx`(2) · `app/pda/material/receiving/page.tsx` · `app/pda/material/adjustment/page.tsx` |
| 소모품 | `components/consumables/ReceivingFormPanel.tsx` · `ReceivingReturnPanel.tsx` · `IssuingFormPanel.tsx` · `IssuingReturnPanel.tsx` |
| 생산 | `production/monthly-plan/components/PlanFormPanel.tsx`(3) · `production/order/components/JobOrderFormPanel.tsx`(2) · `JobOrderCreateModal.tsx` |
| 영업/출하 | `sales/customer-po/components/{CustomerPoModal,CustomerPoFormPanel}.tsx`(각 2) · `shipping/customer-po/components/{CustomerPoModal,CustomerPoFormPanel}.tsx`(각 2) |
| 기준정보 | `master/part/components/{PartFormPanel,PartFormModal}.tsx` · `master/bom/components/BomFormModal.tsx` · `master/equip/components/EquipBomPanel.tsx` · `master/routing/components/RoutingMaterialEditor.tsx` · `master/iqc-item/components/IqcSpecPanel.tsx` |

전체 116곳 중 나머지(정렬순서, 주기, 검사 스펙값, 라벨 좌표, 차트 옵션 등)는 수량이 아니므로 이 규칙 대상이 아니다.

## 변경 파일

- `apps/frontend/src/components/material/issue-request/IssueRequestCreatePanel.tsx`: 요청수량 `<input type="number">` → `QtyInput`, `@/components/shared/QtyInput` import 추가.

## 검증 상태

- 실행함: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` → EXIT=0.
- 실행함: claude-in-chrome 으로 3002 실화면 확인(천단위 표시 정상).
- 실행 못함: 미수정 24개 파일에 대한 검증 없음(수정 자체를 하지 않음).

## 중단 사유

- 히트가 10곳을 크게 넘어 개별 버그가 아니라 관행 수준이라 범위 결정이 필요했고, 사용자가 "지금 화면만"으로 한정했다.

## 다음 작업자가 바로 할 일

1. `grep -rn 'type="number"' --include="*.tsx" apps/frontend/src` 로 현재 잔여 개수를 다시 센다(이 기록은 2026-09-14 기준).
2. 자재 출고/입고 계열 10개 파일부터 `QtyInput`으로 교체한다. 현장 수량 오입력 위험이 가장 큰 구간이다.
3. 교체 시 `QtyInput`은 `components/ui/Input`을 감싸 기본 높이가 `h-10`이다. 조밀한 표 안에서는 `className="h-8 py-1 text-right"` 로 낮춰야 행 높이가 유지된다.
4. `maxValue` 프롭으로 재고/잔량 클램프가 필요한 화면인지 개별 판단한다(출고 잔량, 입고 미납량 등).

## 주의사항

- `QtyInput`은 내부적으로 `type="text"` + `inputMode="numeric"` 이다. Playwright 시나리오에서 `fill()` 로 숫자를 넣을 때 콤마가 붙은 표시값과 비교하는 단언이 있으면 깨진다. 교체 대상 화면의 e2e/시나리오를 함께 확인할 것.
- `QtyInput`은 음수와 소수를 허용하지 않는다(`replace(/[^0-9]/g, '')`). 소수점 수량을 받는 필드는 그대로 교체하면 값이 잘린다. **교체 전 대상 컬럼의 DATA_SCALE을 실DB에서 확인할 것.**
  - 이번에 교체한 출고요청 요청수량은 안전함이 확인됐다: `MAT_ISSUE_REQUEST_ITEMS.REQUEST_QTY` = `NUMBER(10,0)` (스케일 0), 기존 281건 중 소수 0건(2026-09-14 JSHANES 실측). 기존 `type="number"`가 오히려 소수 입력을 허용해 Oracle 저장 시 반올림될 여지가 있었다.
  - 반면 BOM 소요량 `BOM_MASTERS.QTY_PER` = `NUMBER(10,4)` 이고 실제로 77건 중 11건이 소수(최소 0.093)다. BOM 소요량을 **입력**받는 화면(`master/bom/components/BomFormModal.tsx`, `master/routing/components/RoutingMaterialEditor.tsx` 등)은 `QtyInput`으로 교체하면 안 된다.
  - `PREV_ISSUE_QTY`, `FLOOR_STOCK_QTY`는 `NUMBER(12,3)`이지만 표시 전용이라 이번 변경과 무관하다.
