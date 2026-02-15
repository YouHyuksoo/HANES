# 하네스 MES 설비 PLC 인터페이스

## 1. 설비 PC(MES) → 설비 PLC (제어 신호)

| 주소(Address) | 신호명 (Signal) | 기능 설명 |
|:------------:|:---------------:|----------|
| B0000 | Run Permitted | MES가 가동 승인 시 "1" (모든 인터락 해제 시) |
| B0001 | Daily Check OK | 08시 일상점검 완료 시 "1". 미완료 시 설비 구동 차단. |
| B0002 | Poka-Yoke OK | 지시서-자재-금형 바코드 매핑 일치 시 "1" |
| B0003 | Master Sample OK | 마스터 샘플(양/불) 검사 완료 이력 확인 시 "1" |
| B0004 | Life Interlock | 칼날/홀더 타수 수명 초과 시 "0" (가동 정지) |
| B0005 | Error Reset | MES에서 에러 확인 및 해제 시 PLC 에러 비트 리셋 |

## 2. 설비 PLC → 설비 PC(MES) (상태 신호)

| 주소(Address) | 신호명 (Signal) | 기능 설명 |
|:------------:|:---------------:|----------|
| B0100 | Request Permission | 작업자가 가동 버튼 클릭 시 MES에 승인 요청 |
| B0101 | Machine Running | 현재 설비 가동 중 상태 (실시간 가동률 산출용) |
| B0102 | Cycle Finish | 1개 타발/검사 완료 시 신호 (실적 카운팅) |
| B0103 | Machine Alarm | 설비 하드웨어 에러 발생 시 MES에 알람 전송 |
| D0200 (Word) | Current Stroke | 현재 어플리케이터/홀더의 누적 타수 (실시간 전송) |
