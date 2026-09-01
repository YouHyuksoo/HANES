# 워크플로우 남은 구멍 수정

- 작성일: 2026-09-02
- 작성 계기: 2026-09-02 재점검에서 남은 구멍을 코드로 막기

## 요약 (결론 먼저)

입고 FAIL 입하대기 잔류, 특채 입고 미차감, 미입고 박스 출하, 입고 후 재개봉, assignToPallet OQC 우회, WIP 이중복원, 빈 ROUTING_MATERIALS 전량 차감, 키오스크 LAST 미차단을 고쳤다.

## 상세

| 구멍 | 수정 |
|---|---|
| IQC FAIL이 MAT_STOCKS만 이동 | 입하재고가 있으면 불용창고 MAT_STOCKS로 이동하고 입하대기는 DEPLETED |
| 특채 입고가 입하대기를 안 줄임 | MAT_STOCKS가 없으면 `decreaseArrivalStock` |
| 출하가 박스 입고를 안 봄 | `shipBox`/`shipOrderPallets`가 BOX WIP_OUT/FG_IN DONE 전표 필수 |
| reopenBox가 제품입고를 안 봄 | 입고 전표가 있으면 재개봉 거부 |
| assignToPallet이 OQC 미검사 | `OQC_ENABLED=Y`이면 PASS만 적재 |
| restoreInTx가 원본을 CANCELED로 안 바꿈 | WIP/PROC 원본 거래를 CANCELED |
| ROUTING_MATERIALS 없으면 BOM 전체 차감 | 라우팅이 있는데 배정이 없으면 차감 skip |
| 키오스크 LAST 미차단 | LAST 항목이 있고 다음 수량이 계획수량에 닿으면 실적 비활성. MID/LAST는 PASS만 완료 |

검증:

- backend jest 7 spec 126 pass
- kiosk LAST structure test 2 pass
- FE/BE tsc 0
- 키오스크 브라우저 E2E는 playwright-cli open 타임아웃으로 미실행. 화면 게이트는 구조 테스트로 확인

고치지 않은 항목:

- 키오스크+키팅 동일 지시 이중소비 (설계)
- 서버 MID 임계값 60 고정 vs `QC_MID_BLOCK_PCT` (공통코드 연동 별도)
- SHIPPED+PENDING 과거 박스 100건 (운영 데이터)

## 후속 조치 (있으면)

- 리뷰 후 커밋
- 키오스크 LAST는 계획수량 직전 작업지시로 현장 확인
