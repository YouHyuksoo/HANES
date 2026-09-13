# THN 관리계획서 vs HANES 기능 대조 (2026-09-14)

- 원본: `C:\Users\hsyou\Desktop\THN 관리계획서.pdf` (20p, 스캔, IATF 양산 Control Plan)
- 대조 기준: HANES `menuConfig.ts`, `CONTROL_PLANS`/`CONTROL_PLAN_ITEMS`, `packages/shared/src/constants/process.ts`
- 범위: 비교. DB 시드/화면 이관은 하지 않음.

## 문서가 말하는 공정 흐름

| THN 공정기호 | 공정명 | HANES PROCESS_CODES | HANES 화면 |
|---|---|---|---|
| A50 | 자재입고/입고검사 | (자재, IQC) | `QC_IQC`, `QC_IQC_PART_SPEC`, `MAT_ARRIVAL` |
| A51 | 자재보관 | (재고) | `MAT_SHELF_LIFE`, `INV_MAT_STOCK` |
| A52 | 자재불출(공정부입) | CUTTING 투입 전 | `MAT_ISSUE`, `PROD_KITTING` |
| B51 | 전조선 절단 | CUTTING | `PROD_SPEC_SETUP`, `PROD_INPUT_EQUIP` |
| C50 | 압착준비 | CRIMPING | 키팅/작업대, 자주검사 |
| C51 | 측각압착 (10T PRESS) | CRIMPING | `QC_TERMINAL_CRIMP_SPEC`, `QC_SPC` |
| C52 | 일반압착 (2T/6T/30T) | CRIMPING | 동일 |
| C53 | 결수축 접착/TUBE 가열 | HEAT (공통코드만, PROCESS_ORDER에는 없음) | 설비일상점검 |
| D50 | 반제품 검사 | INSPECTION | `QC_SELF_INSPECT_HISTORY`, `QC_INSPECT` |
| E50 | 초원자재 준비 (TUBE 절단 등) | CUTTING/ASSEMBLY | 설비일상점검, 자주검사 |
| H50~H67 | 외장재 조립 (지그/테이프/B-CABLE/프로텍터/체결) | ASSEMBLY | `PROD_INPUT_ASSEMBLY`, 자주검사 |
| I50 | 수동연동식 통합회로검사 | INSPECTION | `INSP_INTEGRATED`, `INSP_PROTOCOL` |
| L50 | 최종검사 | INSPECTION | `QC_OQC`, `QC_INSPECT` |
| M50 | 포장 | PACKING | 제품입고/출하, 라벨 |

HANES `PROCESS_ORDER`는 CUTTING → CRIMPING → ASSEMBLY → INSPECTION → PACKING 다섯 단계다. THN의 A50~A52(입고/보관/불출), C53(가열), E50(TUBE 절단), D50(반제품검사)는 이 다섯에 직접 1:1이 아니다.

## 특별특성 코드 불일치

| THN | 의미(문서) | HANES `specialCharClass` |
|---|---|---|
| C | Critical (회로, 크림프하이트, 토크) | `CC` |
| I | Important (누락, 파손, 구조, 기밀, DIM’S) | 없음. `SC`/`HI`로 근사 |
| C.S | Critical + SPC (크림프하이트) | `CC` + SPC 화면 별도 |

이관 시 매핑 규칙을 정해야 한다. DTO enum은 `CC`/`SC`/`HI`만 허용.

## 컬럼 길이 제약 (이관 시 잘림)

`CONTROL_PLAN_ITEMS.SPECIFICATION` varchar 500. THN 규격란은 공차표+불량정의+반응계획이 한 칸에 들어가 500자를 넘는 행이 많다. 이관하면 규격/관리방법/반응계획으로 쪼개야 한다.

평가방법·시료수·주기는 화면에서 공통코드 셀렉트(`INSPECT_METHOD`, `SAMPLE_SIZE`, `SAMPLE_FREQ`, `CONTROL_METHOD`)다. THN 값은 자유문장(육안, 전수, 초중종물/1EA, 마이크로메다). 공통코드에 없거나 코드값과 안 맞으면 저장은 가능해도 UI 셀렉트가 빈 값으로 보인다.

## 공정별 상세 갭

### A50 입고검사 — 부분 대응

요구: PDA 스캔으로 거래명세서 품번/품명/수량 대조, ERP 등록. 품목군별 육안(WIRE 인쇄/색상/도체, HOUSING LANCE/버, 단자 이동/감김, SEAL, W/CABLE, TAPE, C/TUBE). VOC·체크리스트 주기검사.

있음: 입하, IQC, AQL, 품목별 IQC 항목, PDA/라벨.

없음: THN 품목군 육안 문장을 IQC 항목으로 시드하지 않음. VOC 1/6개월, 체크리스트 1/12개월 스케줄.

### A51 보관 — 부분 대응

요구: 360일 이상 재고는 재검사 의뢰. FIFO. 혼입/변형. BOX 입고일자 스티커. PVC TAPE는 유효수명 15일.

있음: 유효기한 화면, FIFO 출고 정책(`FIFO_ENABLED` 등, 2026-09-09 감사갭).

확인 필요: 360일 고정 재검사, TAPE 15일 규칙이 품목 유효기한으로 들어가 있는지.

### A52 불출 — 부분 대응

요구: 피더 자주검사 전수(찢김, 혼입, ERP 수량).

있음: 출고/키팅.

없음: 피더 전수 육안을 출고 완료 조건으로 강제하는 화면.

### 절단 B51 — 부분 대응

요구: 길이 공차표(~1000 +3/0 … 3001+ +10/0), 탈피공차, 꼬임 2가닥 이하, 바코드 리더 작업전 점검, 보호캡 SQ별 수량.

있음: 라우팅 전선길이/탈피, 설비연동, 불량코드 CUT001~004.

없음: 공차표·보호캡 수량표를 시스템이 판정.

### 압착 C51/C52 — 대응 강함

요구: 10T/2T/6T/30T 유압, Applicator 디스크=크림프하이트, 크림프하이트 C특성 ±0.05(30T는 ±0.10), 인장력 표, 초중종물 300개, Cpk, SPC 전산지시서.

있음: `TERMINAL_CRIMP_SPECS`, 라우팅 압착높이, SPC Cpk/Ppk 분리, 측정값 수신, 불량 CRM001~005(높이/폭/인장/윈도우/벨마우스).

갭: THN 초중종물 정의(동일조건 LOT, 연속 시 초=첫, 중=1/3~2/3, 종=최종)를 SPC 샘플 주기로 맞춘 설정인지. Applicator 보관/DISK 대조는 자주검사.

### C53 TUBE 가열 — 약함

요구: 500±20℃, 냉각, 실작업온도/속도 인터록, 수지 공극 ●특성.

있음: 설비일상점검 기록.

없음: HEAT를 `PROCESS_ORDER`에 넣지 않음. 온도 인터록은 설비.

### D50 반제품 검사 — 부분 대응

요구: 확대경, 도체압착 높이 SPEC ±0.05, 전수검사 CHECK SHEET 전산, 내전압 DC 3.0kV / 2mA, GO/NO GAGE.

있음: 자주검사, 검사지원구(`QC_INSPECT_AID`), 통합검사.

갭: 반제품 전용 CHECK SHEET와 HV 3.0kV 전수 기록을 공정 실적에 묶는 여부.

### 조립 H50~ — 부분 대응

요구: 지그 일상(POLE 유격/변형), 테이프 overlap, 부품누락, B/CABLE CLIP, 프로텍터, 체결토크 C특성(차종별 kgf).

있음: 조립 투입, 키팅, 검사기 연동, 자주검사.

없음: 지그 일상과 토크 스펙을 품목/차종별로 마스터화한 화면은 검사지원구/설비점검에 분산.

### I50 회로/기밀 — 대응 강함(스펙 시드 필요)

요구: 하네스테스터, 기밀 0.7±0.2 bar 충전 후 0.3 bar 2s, 고전압 케이블 3.0kV/2.0mA.

있음: `INSP_INTEGRATED`, `INSP_PROTOCOL`, EQUIP_PROTOCOLS 측정값 인덱스.

갭: THN 수치를 프로토콜/스펙에 넣었는지.

### L50 최종 / M50 포장 — 부분 대응

요구: ALC/BAR 코드, 누락 I특성, 구조/기밀/내전압/회로/DIM’S, BOX 수량.

있음: OQC, 라벨, 출하.

## HANES에 있고 THN 문서에 없는 것 (범위 밖)

PPAP, FAI, CAPA, 고객불만, 변경점, 감사, 교육훈련, 개선요청 증적. 관리계획서 실행이 아니라 QMS 상위 프로세스다.

## 이관 시 권장 순서

1. THN 공정기호 → HANES 공정마스터 코드 매핑 테이블 (A50을 IQC로 둘지 별도 RECEIVING 공정으로 둘지 결정).
2. 특별특성 C/I/C.S → CC/SC/HI.
3. `CONTROL_PLAN_ITEMS`에 공정 단위 요약행 이관 (규격 500자 분할).
4. A50 육안 → `QC_IQC_PART_SPEC` 항목.
5. 압착 공차/인장 → `TERMINAL_CRIMP_SPECS` + SPC 한계.
6. 기밀/HV/토크 → 검사 프로토콜.
7. 360일/TAPE 15일 → 품목 유효기한.

품목코드·회사/공장 스코프가 정해지기 전에는 CONTROL_PLANS INSERT를 하지 않는다. 관리계획서는 품목 FK다.
