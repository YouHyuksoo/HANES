# JOURNAL

Append new entries at the top.

Use this heading format for every new entry:

```md
## YYYY-MM-DD HH:mm Agent
```

Use local time in 24-hour format.

## 2026-05-27 16:10 claude

### 입하 플로우 E2E 검증 완료 (IQC005 ERP 3-key 대응)

**변경 내용:**
1. `PurchaseOrderItem.lineNo` NOT NULL / `revNo` DEFAULT 1 — DB 마이그레이션 완료 (JSHANES)
2. `PoLineReceiptDto`: `poSeq` → `lineNo + revNo` (ERP L/N, R/N 대응)
3. `arrival.service.receivePoLine`: PO 라인 조회를 `lineNo + revNo` 비즈니스 키 기준으로 변경
4. `arrival.service.receivePoLine`: 품목 마스터 미등록 시 단일 LOT fallback (404 에러 제거)
5. `api.ts`: `suppressErrorModal` 옵션 추가 — LOT_UNIT_QTY 조회 404 모달 억제
6. `arrival/page.tsx`: 필터 툴바 인라인 이동, + 수동입하 버튼 primary(pink) 변경

**검증 결과 (2026-05-27 브라우저 테스트):**
- PO 5000000022 조회 → 90건, L/N + R/N 컬럼 표시 ✅
- L1/R1 클릭 → 입하 모달 `5000000022 / L1 / R1` 정상 ✅
- LOT_UNIT_QTY 404 에러 모달 없음 ✅
- 입하 100개, 제조사 M001 → 저장 → 시리얼 발급 확인 모달 ✅
- 시리얼 `VH1-RM260527-00001` 채번, 라벨 미리보기 ✅
- 잔량 35,380 → 35,280 실시간 반영 ✅
