# THN 제조공정 검사 커버리지 점검

기준 문서: `C:\Document\고객별프로젝트\행성사\03.제조공정_THN.pdf` (2쪽, 저전압/고전압 제조공정)

## 결론

기존 HANES는 수입검사, 단자, 구조, 통전, 내전압, 리크, 최종 육안 및 고전압 통합검사를 지원한다. PDF에 독립 공정으로 명시됐지만 전용 저장 경로가 없던 저전압의 퓨즈삽입/토크, 비전, 릴레이 기능검사를 `INSPECT_RESULTS` 기반 검사 스테이션으로 보완했다.

| PDF 검사 공정 | HANES 대응 | 결과 반영 및 이력 |
| --- | --- | --- |
| 자재 수입검사 | IQC | 자재 LOT IQC 상태 및 IQC 이력 |
| 절압물/QC 검사 | 단자검사 | `INSPECT_RESULTS(TERMINAL)` + FG 라벨 검사 연결 |
| 구조검사 | 구조검사 | `INSPECT_RESULTS(STRUCTURE)` + 구조 판정 |
| 회로검사 | 통전검사 | `INSPECT_RESULTS(CONTINUITY)` + 회로라벨 + FG 검사 판정 |
| 리크/내전압 | 개별 및 통합검사 | `INSPECT_RESULTS(LEAK/HIPOT)` + 실측 JSON + 품목 스펙 판정 |
| 퓨즈 삽입/토크 | 신규 토크검사 | `INSPECT_RESULTS(TORQUE)` + 토크 실측 JSON + 상하한 판정 |
| 비전검사 | 신규 비전검사 | `INSPECT_RESULTS(VISION)` + FG별 합불/불량사유 |
| 릴레이 기능검사 | 신규 릴레이 기능검사 | `INSPECT_RESULTS(RELAY_FUNCTION)` + FG별 합불/불량사유 |
| 최종검사 | 기존 육안검사 | `INSPECT_RESULTS(VISUAL)` + 라벨·커넥터·부착물·테이핑·치수 최종 판정 |

## 저장 흐름

화면은 검사유형별 대기 FG 라벨을 조회하고 작업자·설비·사전점검 게이트를 통과한 뒤 `POST /quality/continuity-inspect/inspect`를 호출한다. 서버는 작업지시와 FG 라벨을 tenant 범위로 검증하고, 검사 결과를 `INSPECT_RESULTS`에 추가한다. 토크는 `INSPECT_ITEM_SPECS(TORQUE)` 상하한으로 서버 재판정하며, 비전·릴레이 기능검사는 회로라벨을 요구하지 않는 수동 합불형이다. 합격/불합격은 해당 FG 라벨의 검사 참조와 판정 필드에 연결되고, 전체 이력은 `/inspection/history`가 `INSPECT_RESULTS`에서 조회한다.

## 별도 연동이 필요한 범위

PDF의 압착높이·압착력·절단감지·SQ 이중방지·자동압입·로봇암 비전 같은 설비 센서 자동수집은 프로토콜과 설비별 데이터 규격이 있어야 자동화할 수 있다. 이번 보완은 작업자가 실제 제품 단위로 판정하고 이력을 남기는 MES 경로까지이며, 장비별 원시 신호 수집은 설비 통신 사양 확정 후 추가 연동 대상이다.

## 실제 검증 증거

- 대상: `FG26090400413`, 작업지시 `WO2609020194`, 검사기 `EQ-TEST-01`, 작업자 `N91H00_WK05`
- `IR26092401037`: `TORQUE`, PASS, `INSPECT_DATA.torque=0.5`
- `IR26092401038`: `VISION`, FAIL, `ERROR_CODE=QA_TEST`
- `IR26092401039`: `RELAY_FUNCTION`, PASS
- 세 건 모두 `INSPECT_RESULTS`에 제품·작업자·설비와 함께 보존됐다.
- `FG_LABELS`의 공통 검사 참조는 가장 최근 결과 `IR26092401039`, `INSPECT_PASS_YN=Y`로 갱신됐다. 공정별 과거 합불은 공통 포인터가 아니라 `INSPECT_RESULTS` 이력에서 추적한다.
