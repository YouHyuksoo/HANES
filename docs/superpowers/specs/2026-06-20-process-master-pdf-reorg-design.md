# PROCESS_MASTERS 정비 설계 — THN 제조공정 흐름도 기준

- 작성일: 2026-06-20
- 작업 ID: T-PROCESS-MASTER-PDF-REORG
- 참조: `03.제조공정_THN.pdf` (와이어링하네스 공정 흐름도 — 저전압/고전압)
- 대상 DB: JSHANES (COMPANY=40, PLANT_CD=1000)

## 1. 목적

THN의 실제 제조공정 흐름도(PDF)에 맞춰 `PROCESS_MASTERS`를 정비한다.
- 저전압(LV)·고전압(HV) 두 라인을 모두 반영하고 라인 구분을 명시한다.
- **기존 `PROCESS_CODE`는 변경하지 않는다**(23개 테이블이 참조 중 — 운영 데이터 무손상).
- PDF에 있으나 시스템에 없는 제조공정을 신규 추가한다.
- 미사용 잉여 공정은 비활성한다.

## 2. 결정 사항 (확정)

| 항목 | 결정 |
|---|---|
| 정리 방식 | 마스터 정비(코드 유지). 코드 전면 교체 안 함 |
| 라인 범위 | 저전압·고전압 둘 다, 라인 구분 표시 |
| 라인 저장 | 신규 `LINE_TYPE` 컬럼 (`LV`/`HV`/`CM`=공통) |
| 공정 범위 | 제조 공정만. 수입검사·창고·포장·출하대기 제외(자재/출하 모듈 소관) |
| WELDR/TUBHT | 각각 PDF 초음파융착·열수축으로 재활용(명칭만 정비, 신규 추가 안 함) |

## 3. 스키마 변경 (비파괴)

```sql
ALTER TABLE PROCESS_MASTERS ADD (LINE_TYPE VARCHAR2(2));
-- LV=저전압 전용, HV=고전압 전용, CM=양 라인 공통. nullable(기존 행 무영향).
COMMENT ON COLUMN PROCESS_MASTERS.LINE_TYPE IS '공정 라인구분: LV=저전압 HV=고전압 CM=공통';
```

- DDL 후 `PROCESS_MASTERS` 의존 PL/SQL이 있으면 `ALTER ... COMPILE` (ORA-04068 1회성 방지).
- 엔티티 `process-master.entity.ts`에 `lineType: string | null` 추가(@Column nullable, type 명시).

## 4. SORT_ORDER 체계 (라인별 흐름순)

| 라인 | 범위 | 정렬 |
|---|---|---|
| LV | 1000~1999 | PDF 저전압 흐름순 |
| HV | 2000~2999 | PDF 고전압 흐름순 |
| CM | 3000~3999 | 공통(검사/조립/자재), 성격순 |

화면에서 라인 필터 시 `해당 LINE_TYPE + CM`을 `SORT_ORDER`로 정렬 표시.

## 5. 기존 18개 공정 — 코드 유지, 정비만

> `PROCESS_CODE`/참조 무변경. `PROCESS_NAME`·`LINE_TYPE`·`SORT_ORDER`만 갱신.

| CODE | 현재명 | → 정비명(PDF) | LINE_TYPE | SORT |
|---|---|---|---|---|
| ATCUT | 자동절단 | 자동절단 | LV | 1010 |
| ATCNS | 자동절단탈피 | 자동절단탈피 | LV | 1020 |
| STRPB | 양단탈피 | 양단탈피 | LV | 1030 |
| CRMPF | 전단압착 | 전단압착 | LV | 1040 |
| CRMPR | 후단압착 | 후단압착 | LV | 1050 |
| CRMPB | 양단압착 | 양단압착 | LV | 1060 |
| WELDR | 후단융착 | **초음파융착** | LV | 1120 |
| TUBHT | 튜브열처리 | **열수축** | LV | 1130 |
| HEXCP | 육각압착 | 육각압착 | HV | 2040 |
| SHDRM | 편조제거 | **실드편조절단** | HV | 2020 |
| TINSP | 단자검사 | 단자검사 | CM | 3010 |
| AINSP | 통합검사 | 통합검사 | CM | 3020 |
| OINSP | 외관검사 | **육안검사** | CM | 3030 |
| SASSY | 서브조립 | 서브작업(SUB) | CM | 3110 |
| MASSY | 조립 | 조립(배선/포선) | CM | 3120 |
| MTASY | 자재장착 | 자재장착 | CM | 3130 |
| AUXMT | 부자재장착 | 부자재부착 | CM | 3140 |
| TAPPN | 배판작업(테이핑) | 배판작업(테이핑) | CM | 3150 |

## 6. 신규 제조공정 (코드는 제안 — 검토 대상)

### 저전압 (LV)

| 제안 CODE | 명칭(PDF) | LINE_TYPE | SORT |
|---|---|---|---|
| SHDCT | 실드절단 | LV | 1070 |
| SACRP | 반자동압착 | LV | 1090 |
| MIDST | 중간탈피 | LV | 1100 |
| SJCRP | S/JOINT압착 | LV | 1110 |
| ATAPE | 자동테이핑(S/JOINT 보호) | LV | 1140 |
| TWIST | 트위스트 | LV | 1150 |
| CRINS | 절압물검사 | LV | 1160 |
| SACMB | 반제품조합 | LV | 1170 |
| TAPNG | 테이핑(분기부/ALL) | LV | 1180 |
| PROTC | 프로텍트체결 | LV | 1200 |
| STINS | 구조검사 | LV | 1210 |
| CIINS | 회로검사 | LV | 1220 |
| FUSIN | 퓨즈삽입/토크체결 | LV | 1230 |
| VISIN | 비전검사 | LV | 1240 |
| RLYIN | 릴레이기능검사 | LV | 1250 |
| FINSH | 마무리(D/CAP·비닐팩) | LV | 1260 |
| ABAG  | A/BAG 제작(별도) | LV | 1900 |

(저전압 신규 17개)

### 고전압 (HV)

| 제안 CODE | 명칭(PDF) | LINE_TYPE | SORT |
|---|---|---|---|
| CBLCT | 케이블절단 | HV | 2010 |
| TMCRP | 단자압착(고전압) | HV | 2050 |
| QCINS | QC검사(압착/내전압) | HV | 2060 |
| ATAPG | 자동TAP'G(C/TUBE·ALL테이핑) | HV | 2080 |

(고전압 신규 4개)

### 공통 (CM) — 양 라인 공유 [확정]

| 제안 CODE | 명칭 | LINE_TYPE | SORT |
|---|---|---|---|
| AUXIN | 부자재삽입(SEAL/튜브·클램프링/O링) | CM | 3160 |
| GRMMT | 그로멧체결 | CM | 3170 |

(공통 신규 2개)

> "배선(LV)"과 "조립작업(HV)"은 동일 개념(회로 포선)으로 보고 CM `MASSY` 공유.
> 고전압 SUB·통합검사·최종검사는 공통(CM: SASSY/AINSP/OINSP) 재사용.

### 확정 결과 (사용자 승인 2026-06-20)

1. **신규 공정 전부 추가** — 저전압 17 + 고전압 4 + 공통 2 = **신규 23개**.
2. **그로멧 = 공용(CM, GRMMT)**.
3. **부자재삽입 = 공용(CM, AUXIN 하나로 통합)** — 저전압 SEAL/튜브 + 고전압 클램프링/O링을 단일 공정으로.
4. **공정 코드 약자 = 본 제안 사용** (사내 표준 약자 없음).

> CM 공정(AUXIN/GRMMT 등)은 양 라인 공통이라 단일 SORT(3000번대)로 둔다. 라인 흐름 중간에 위치하는 공정이라도 화면 정렬에서는 CM 블록(뒤쪽)에 모인다 — 라인 구분이 우선 목적이므로 수용.

## 7. 미사용 잉여 공정 — 비활성

| CODE | 명칭 | 처리 |
|---|---|---|
| PRC-CUT | 절단 | `USE_YN='N'` |
| PRC-STRIP | 탈피 | `USE_YN='N'` |
| PRC-CRIMP | 압착 | `USE_YN='N'` |
| PRC-TEST | 도통검사 | `USE_YN='N'` |

근거: ROUTING_PROCESSES·JOB_ORDERS·PROD_RESULTS 어디에도 미참조(실측). 삭제 대신 비활성(이력 안전).

## 8. 적용 방법

1. **시드 스크립트** `tools/seed/seed_process_master_pdf.py` (멱등, dry-run 기본/`--commit`):
   - `LINE_TYPE` 컬럼 ADD (존재 시 skip)
   - 기존 18개 UPDATE(명칭/LINE_TYPE/SORT_ORDER)
   - 신규 공정 INSERT(없을 때만)
   - PRC-* 4개 `USE_YN='N'`
   - pre/post-check COUNT 출력
2. **엔티티**: `lineType` 필드 추가.
3. **화면(별도·최소)**: 공정 마스터 화면 라인 컬럼/필터, 설비선택 모달 라인별 그룹(선택).

## 9. 영향·리스크

- `PROCESS_CODE` 무변경 → 라우팅/작업지시/생산실적/genealogy/자주검사/SPC 등 23개 참조 무손상.
- `LINE_TYPE` nullable ADD → 기존 행 NULL 허용, 점진 채움.
- 기존 공정 명칭 변경(WELDR/TUBHT/SHDRM/OINSP)은 표시 라벨만 영향(코드 동일).
- 화면(공정마스터/설비모달)은 본 정비 이후 별도 작업으로 최소 반영.

## 10. 확정 요약

- 기존 18개 정비(코드 유지) + 신규 23개(LV 17·HV 4·CM 2) + PRC-* 4개 비활성.
- 최종 활성 공정: 18 + 23 = **41개**.
- 부자재삽입·그로멧은 공용(CM). 코드 약자는 본 제안 사용. 미결 없음.
