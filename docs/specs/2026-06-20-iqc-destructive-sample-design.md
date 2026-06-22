# IQC 검사유형 분리 (AQL / 파괴검사) — 1단계 설계

- 작성일: 2026-06-20
- 작업 ID: T-IQC-INSPECTION-TYPE-SPLIT
- 선행: 검사항목별 AQL 판정(커밋 655f32e0), 항목별 영구저장(2044b737)

## 1. 배경 / 문제

현재 IQC 판정은 "샘플(입하 시리얼) 개체 × 검사항목" 매트릭스로, **모든 샘플에 모든 검사항목을 동일하게 수행**한다. 외관·치수·통전·내전압 같은 **비파괴 검사**는 같은 샘플로 가능하므로 이 모델이 맞다.

그러나 **파괴검사**(압착 단면, 인장강도, 용착강도, 절단해체)는 검사 후 제품을 쓸 수 없어 **"샘플 = 검사대상" 등식이 깨진다.** 파괴샘플은 일반 AQL 샘플과 별도로 채취하며, AQL 샘플링과 무관하게 LOT당 고정 수량(인장 5, 단면 3 등)으로 운영한다.

따라서 **AQL 샘플링과 파괴검사를 검사유형으로 분리**해야 한다.

```
LOT
 ├ 일반(AQL) 샘플   ─ 외관/치수/통전/내전압 (같은 샘플 공유)
 └ 파괴 샘플(별도)  ─ 인장 5 / 단면 3 (LOT당 고정, AQL 무관)
```

## 2. 결정 사항 (확정)

| 항목 | 결정 |
|---|---|
| 검사유형 분리 | `INSPECTION_TYPE`: AQL / DESTRUCTIVE / FULL |
| 샘플수 방식 | AQL=검사수준 자동(ISO 2859-1) / DESTRUCTIVE·FIXED=고정 |
| 파괴 샘플수 기준 | **LOT당 고정 N개** (SAMPLE_QTY 단일 컬럼) |
| 파괴검사 판정 | **불량 0건=PASS, 1건+=FAIL** (무관용, Ac 0) |
| 최종 LOT | AQL 전체 PASS AND 파괴 전체 PASS AND Critical 없음 → PASS, 그 외 FAIL |
| 기본 동작 | "모든 AQL 샘플 × 모든 AQL 항목"은 그대로 유지 |

## 3. 데이터 모델 — `IQC_PART_SPEC_ITEMS` 확장

기존(`DEFECT_GRADE`, `INSPECTION_LEVEL`, `AQL`)에 추가(비파괴 ADD):

| 컬럼 | 타입 | 의미 |
|---|---|---|
| `INSPECTION_TYPE` | VARCHAR2(12) | `AQL` / `DESTRUCTIVE` / `FULL`. 기본 AQL |
| `SAMPLE_METHOD` | VARCHAR2(8) | `AQL`(자동) / `FIXED`(고정). 기본 AQL |
| `SAMPLE_QTY` | NUMBER | FIXED/DESTRUCTIVE일 때 LOT당 고정 샘플수 |

- 공통코드 신규: `IQC_INSPECT_TYPE`(AQL/DESTRUCTIVE/FULL), `IQC_SAMPLE_METHOD`(AQL/FIXED)
- 예시(품목 1개):
  | 항목 | TYPE | METHOD | SAMPLE_QTY | GRADE | LEVEL | AQL |
  |---|---|---|---|---|---|---|
  | 외관 | AQL | AQL | (자동) | MINOR | II | 2.5 |
  | 통전 | AQL | AQL | (자동) | CRITICAL | II | - |
  | 내전압 | AQL | AQL | (자동) | MAJOR | II | 1.0 |
  | 인장 | DESTRUCTIVE | FIXED | 5 | MAJOR | - | - |
  | 단면 | DESTRUCTIVE | FIXED | 3 | CRITICAL | - | - |

## 4. 샘플수 산출 규칙

| 조건 | 요구 샘플수 |
|---|---|
| `INSPECTION_TYPE=AQL` (METHOD=AQL) | LOT + 검사수준 → ISO 2859-1 `AQL-{level}-{aql}` → `sampleSize` (현재 resolveSeverityRule) |
| `DESTRUCTIVE` 또는 `METHOD=FIXED` | `SAMPLE_QTY` 고정 (AQL 무관) |
| `FULL` | LOT 전수 |

## 5. 판정 로직 — `resolveIqcPolicyByItem` 확장

항목을 `INSPECTION_TYPE`별로 분기:

- **AQL 항목**: (현행 유지) CRITICAL이면 불량 1건+ FAIL / MAJOR·MINOR면 검사수준+AQL→Ac/Re, 불량>Ac FAIL. 분모=AQL 샘플크기.
- **DESTRUCTIVE / FIXED 항목**: 요구수량=`SAMPLE_QTY`. 검사자가 검사수량·불량수 입력. **불량>0 → FAIL** (Ac 0). 분모=SAMPLE_QTY.
- **FULL 항목**: 전수, 불량>0 → FAIL.

**최종 LOT**: 모든 항목 결과를 종합 — 하나라도 FAIL이면 LOT FAIL (= AQL 전체 PASS ∧ 파괴 전체 PASS ∧ Critical 없음).

반환 `itemResults[]`에 추가: `inspectionType`, `requiredQty`(요구수량), `inspectedQty`(검사수량).

## 6. 검사 입력 (검사 모달)

검사 영역을 둘로 분리:

1. **AQL 검사** (현행 유지) — 시리얼(샘플) 스캔/조회 → 샘플별 × AQL항목 측정 매트릭스.
2. **파괴/FULL 검사** (신규) — 별도 영역, 항목별 집계 입력:

   | 검사항목 | 검사유형 | 요구수량 | 검사수량 | 불량수 | 결과 |
   |---|---|---|---|---|---|
   | 인장 | 파괴 | 5 | 5 | 0 | PASS |
   | 단면 | 파괴 | 3 | 3 | 1 | FAIL |

   - 파괴 항목은 개체 측정값이 아니라 **검사수량 + 불량수**만 입력(요구수량 대비 검증).

**LOT 판정 종합**: AQL 매트릭스 판정 + 파괴검사 입력 판정 → 하나라도 FAIL → LOT FAIL.

## 7. 이력 (IQC_LOGS)

`ITEM_RESULTS`(JSON)에 검사유형·요구수량·검사수량 추가(스키마 변경 없음, JSON 필드 확장). 파괴검사 집계는 `details`에 별도 섹션(`destructive: [{inspItemCode, requiredQty, inspectedQty, defectQty, result}]`)으로 저장.

## 8. UI — 검사계획 표시

품목별 IQC 항목관리(`IqcSpecPanel`) 그리드에 컬럼 추가: **검사유형 / 샘플방식 / 샘플수**. 편집 시 검사유형이 DESTRUCTIVE/FIXED면 SAMPLE_QTY 입력 활성, AQL이면 검사수준/AQL 활성.

## 9. 1단계 범위 / 이후

**1단계 (본 설계)**
- `IQC_PART_SPEC_ITEMS` 검사유형/샘플방식/고정샘플수 컬럼 + 공통코드
- 품목별 IQC 화면 검사유형/샘플수 표시·편집
- `resolveIqcPolicyByItem` 검사유형 분기 판정
- 검사 모달 파괴검사 별도 입력 영역
- 이력 itemResults/details 파괴검사 반영

**2단계 이후 (범위 외)**
- `IQC_SAMPLE` / `IQC_SAMPLE_RESULT` 정규화 테이블 (현재는 JSON 유지)
- 교대당·일자당 등 샘플 주기(SAMPLE_BASIS) 확장
- 파괴샘플 별도 시리얼/재고 차감 연계

## 10. 영향 / 리스크

- `IQC_PART_SPEC_ITEMS` 컬럼 ADD(비파괴). 기존 항목은 `INSPECTION_TYPE=AQL` 기본 → 기존 동작 유지.
- 검사유형 미설정(NULL) 품목은 전부 AQL로 간주 → 하위호환.
- 검사 모달 입력 UI에 파괴검사 영역 추가(중간 규모 FE 변경).
- DDL 후 `IQC_PART_SPEC_ITEMS`/`IQC_LOGS` 의존 PL/SQL 재컴파일 점검(ORA-04068 방지).
