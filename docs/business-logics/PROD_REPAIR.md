---
sources:
  - apps/frontend/src/app/(authenticated)/production/repair/
  - apps/backend/src/modules/production/controllers/repair.controller.ts
  - apps/backend/src/modules/production/dto/repair.dto.ts
  - apps/backend/src/modules/production/services/repair.service.ts
  - apps/backend/src/modules/production/services/repair-workflow.service.ts
  - apps/backend/src/modules/production/services/repair-stock.service.ts
  - apps/backend/src/modules/production/services/repair-target.service.ts
  - apps/backend/src/modules/production/services/repair-lookup.service.ts
  - packages/shared/src/utils/repair-rules.ts
  - apps/backend/src/modules/master/validation/rules/txn-invariant.rules.ts
verifiedCommit: e2b1fa8f
---

# PROD_REPAIR — 수리관리

2026-09-05 현재 working tree 구현 기준. 실제 JSHANES 종단 검증은 DB 연결 실패로 미완료다.

## 사용 흐름

1. **접수**: FG 바코드 스캔 또는 반제품/완제품 품목 선택 → 수량·작업자·발생/복귀공정·사용부품 저장. 신규 저장 후 동일 창에서 다음 단계를 계속한다.
2. **수리 시작**: 출고 창고 선택 → 수리 시작 확인. 수리오더/라벨 잠금, 실제 재고 인수 출고 후 `IN_REPAIR`로 바꾼다. 미저장 값이 있으면 다음 액션을 비활성화한다.
3. **수리 기록**: 사용한 원자재 부품과 누적 사용수량을 저장한다. 시작 이후 대상 품목·수량·시리얼·발생공정은 변경할 수 없다. 마지막 부품 삭제도 빈 배열로 저장된다.
4. **수리 완료 처리**: 수리결과와 재처리 구분을 선택한다. 사용부품은 원자재 LOT/창고별 배분 수량이 저장된 부품 수량과 정확히 같아야 한다.
   - 재사용(`REUSE`): 사용부품 소비 및 지정 복귀창고의 양품 입고와 함께 완료한다. FG는 `ISSUED`로 돌아가 지정 공정의 검사를 다시 수행한다.
   - 폐기(`SCRAP`): 사용부품 소비 후 종결한다. 인수 당시 출고한 수리대상은 양품으로 재입고하지 않는다. FG는 `VOIDED`로 바꾼다.
   - 재검후재사용(`REINSPECT`): 부품 소비/양품 복귀 없이 재검사 대기로 전환한다.
5. **재검사**: 검사자와 수리수량 전량의 합격/불합격을 판정한다. 부분수량 분할판정은 지원하지 않는다.
   - 합격: 부품 LOT 배분과 복귀창고를 확인하고 양품 입고 + 검사이력 + 수리종결을 한 트랜잭션으로 저장한다. FG는 `VISUAL_PASS` 및 새 검사번호로 연결된다.
   - 불합격: 검사이력을 남기고 수리중으로 되돌린다. 부품은 최종 종결까지 누적 사용수량으로 관리한다.
6. **완료 조회**: 완료 건은 조회만 가능하다. 재검사 이력도 같은 창에서 확인한다.

## 상태 규칙

| 단계 | STATUS | REPAIR_RESULT | DISPOSITION |
|---|---|---|---|
| 접수 | RECEIVED | 미지정 | 미지정/PENDING |
| 수리중 | IN_REPAIR | IN_PROGRESS | PENDING |
| 재검사 대기 | IN_REPAIR | COMPLETED | REINSPECT |
| 재검사 불합격 후 | IN_REPAIR | IN_PROGRESS | PENDING |
| 종결 | COMPLETED | COMPLETED/IMPOSSIBLE | REUSE/REINSPECT/SCRAP |

재검사 대기는 기존 세 필드의 조합이다. `repairStage`가 화면과 서버에서 동일하게 계산한다. 일반 PUT은 결과/재처리 구분을 전환할 수 없고 POST 전용 액션에서만 전환한다. `repairCompletionError`는 완료수리 결과, 작업자, 재처리 구분, 복귀공정의 공통 조건이다.

## 대상과 재고의 출처

- **FG 시리얼 수리**: 포장되지 않은 `VISUAL_FAIL` 라벨만 허용하며 해당 라벨 품목, 시리얼 동일성, 수량 1을 검증한다. 현재 외관불합격 API는 재고 품질을 변경하지 않으므로 FG는 선택 창고의 `GOOD` 재고에서 수리실로 인수한다. 이미 별도로 불량창고/DEFECT로 이관된 라벨의 실물 위치는 운영 검증 대상으로 남는다.
- **품목 단위 수리**: FG/시리얼 없이 반제품/완제품의 선택 창고 `DEFECT` 재고에서 수리수량을 인수한다. SG 묶음 시리얼별 잔량 재배분은 이 화면 범위가 아니다.
- **사용부품**: 활성 `RAW_MATERIAL` 기준정보와 실제 MAT_UID를 선택한다. 과거 `RepairUsedPart.prdUid`를 MAT_UID로 해석하지 않는다. 부품 자체가 반제품/완제품인 소비는 지원하지 않는다.
- 창고 총재고와 시리얼 추적은 기존 시스템처럼 각각 `PRODUCT_STOCKS`와 `FG_LABELS`가 담당한다. 복귀 공정은 제품 복귀 수불에 기록한다.
- 수리중 수량은 수리오더와 인수 원장으로 추적한다. 별도 수리창고 재고를 새로 생성하지 않는다.

## API와 저장 원자성

기본 경로 `/production/repairs`:

| 메소드/경로 | 동작 |
|---|---|
| GET /, GET /:date/:seq | 목록/상세 및 사용부품 |
| POST /, PUT /:date/:seq, DELETE /:date/:seq | 접수/기록수정/접수취소 |
| GET /barcode?barcode= | 실제 FG 라벨과 품목 조회 |
| GET /stock-options?itemCode=&barcode= | 수리대상 인수 창고 후보 |
| GET /material-options?itemCode= | 부품별 실제 창고/LOT 후보; 최종 IQC/보류 검증은 출고 서비스 수행 |
| POST /:date/:seq/start | 인수 출고와 수리 시작 |
| POST /:date/:seq/complete | 재사용·폐기 종결 또는 재검사 요청 |
| POST /:date/:seq/inspect | 재검사 전량 판정 및 합격 종결/불합격 복귀 |
| GET /:date/:seq/inspections | 수리 참조를 가진 검사이력 |

- `TransactionService.run`의 한 QueryRunner에서 오더 잠금·재고수불·부품 소비·라벨 상태·검사이력을 함께 커밋한다. 중간 실패는 전부 롤백한다.
- 제품수불은 `REF_TYPE=REPAIR`, `REF_ID=수리 SEQ`. 시작의 음수 출고가 실제 수리수량과 일치해야 종결할 수 있다. 이전 원장 없는 IN_REPAIR는 임의 양품 생성 없이 차단한다.
- 원자재 소비는 `MatIssueService.createInTx`의 IQC/보류/가용량 검증을 사용한다. MAT_ISSUE와 STOCK_TRANSACTIONS의 기존 연결을 유지하고 `REMARK=REPAIR:<SEQ>`로 수리 참조를 남긴다.
- 재검사는 기존 `INSPECT_RESULTS`를 사용한다. `INSPECT_DATA`에 repairRef/repairDate/qty/result/remark, inspectorId/inspectAt에 검사 근거를 보존한다. 채번은 기존 `SeqGeneratorService.getNo('INSPECT_RESULT', qr)`이다.
- 신규 REPAIR_DATE는 자정으로 정규화한다. 과거 시각 포함 DATE는 일자 범위로 찾고 실제 저장된 PK로 상세부품 조회/갱신/삭제한다. 원본 DB 날짜를 일괄 변경하지 않는다.
- 일반 제품수불 취소, 자재출고 취소, 원자재수불 직접 취소에서 수리 연결 원장만 취소를 차단한다.
- 외관검사·외관상태변경·통전재검사·라벨취소는 동일 FG 잠금 아래 진행 중 수리를 검사하여 외부 상태변경을 막는다.
- `TXN-REPAIR-001`은 오더수량/상태와 인수·복귀 제품원장 수량을 대조한다. 기존 원장 없는 과거 건은 제외한다.

## 변경 영향 지도

| 변경 항목 | 함께 확인할 파일 |
|---|---|
| 상태/완료 조건 | shared repair-rules, repair-workflow.service, RepairWorkflowPanel, RepairStatusCell |
| 등록/수정 필드 | repair.dto, repair.service, repair-target.service, RepairFormModal, repairColumns |
| 대상·FG 출처 | repair-lookup.service, repair-target.service, repair-stock.service, continuity-inspect.service |
| 사용부품 LOT/수불 | repair.dto, RepairMaterialAllocation, repair-stock.service, mat-issue.service, inventory.service |
| 재검사 증거 | repair-workflow.service, repair-lookup.service, INSPECT_RESULTS entity, RepairWorkflowPanel |
| 원장 취소/정합 | product-inventory.service, inventory.service, mat-issue.service, txn-invariant.rules |
| 문구/도움말 | repairText.ts(ko/en/zh/vi 신규 문구), 공통코드 REPAIR_STATUS/REPAIR_RESULT/REPAIR_DISPOSITION |

## 검증

- 수리/재고/자재출고/외관검사/불변식 focused Jest 테스트와 shared/backend/frontend typecheck.
- `repair-columns.structure.test.mjs`와 `repair-workflow.ui.test.mjs`. UI 테스트는 실제 localhost:3002 화면에 API 모의 응답을 사용한다. 생성된 업무 데이터나 실제 DB 판정으로 보고하면 안 된다.
- 실제 인증, 공통코드/창고/LOT/재고, 동시 처리와 rollback DB 증명은 JSHANES 연결 복구 후 종단 검증한다.
