# 워크플로우 재점검 (구멍 수정 후)

- 작성: 2026-09-02
- HEAD: `476bc09d` + 로컬 구멍 수정 코드
- 방법: workflowMap 순서 + 현재 Controller/Service + JSHANES SYS_CONFIGS/BOX_MASTERS

운영 설정 (40/1000):

| 키 | 값 |
|---|---|
| OQC_ENABLED | Y |
| MAT_ISSUE_STOCK_CHECK | BLOCK |
| MAT_AUTO_ISSUE_TIMING | ON_CREATE |
| IQC_AUTO_RECEIVE | N |

---

워크플로우 노드별 판정은 대화 응답과 동일. 남은 구멍은 아래만 신규/미수정.

1. IQC FAIL 불용창고 이동은 여전히 MAT_STOCKS만 본다 (입고 전 FAIL은 입하대기에 남음).
2. 특채 입고는 입하대기를 안 줄인다 (출고는 특채 허용으로 막힘은 해소).
3. assignToPallet API는 OQC 미검사. 화면 기본 경로는 출하지시 API라 OQC_ENABLED=Y에서 막힘.
4. pallet.service.addBox는 OQC_ENABLED와 무관하게 PASS만 허용 (화면은 ship-order 경로).
5. 출하는 박스 입고 여부를 안 보고 FG FIFO만 친다.
6. reopenBox는 제품입고 전표를 안 본다.
7. 키오스크 MID FAIL도 완료로 치지만 서버는 PASS만 인정 (서버가 막음).
8. 서버 MID 임계값은 60 고정, 키오스크는 QC_MID_BLOCK_PCT.
9. WIP restore는 원본 PROD_CONSUME을 CANCELED로 안 바꿈 → 실적 수량 수정 2회 시 이중복원 가능.
10. ROUTING_MATERIALS 없으면 첫 실적에서 BOM 전체 차감.
11. 키오스크 실적과 키팅을 같은 지시에 같이 쓰면 이중소비 가능.
12. SHIPPED+PENDING 박스 100건은 과거 데이터. 신규 출하는 OQC=Y로 막힘.
