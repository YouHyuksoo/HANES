# claude Handoff

## Last Update

2026-05-27 16:10

## Completed

- **IQC005 ERP 3-key 입하 플로우**: PO/PO Line/Release Number 개념 반영 완료
  - `PurchaseOrderItem.lineNo` NOT NULL, `revNo` DEFAULT 1 마이그레이션 완료
  - `PoLineReceiptDto` + `receivePoLine` 서비스: `poSeq` → `lineNo + revNo` 대응
  - 품목 마스터 미등록(ERP 인터페이스 전) → 단일 LOT fallback 처리
  - `suppressErrorModal` 패턴: LOT_UNIT_QTY 조회 404 모달 억제
  - UI: 필터 툴바 인라인, + 수동입하 버튼 primary(pink)
  - E2E 검증: PO 5000000022, L1/R1, LDWX00017NA, 100EA → 시리얼 VH1-RM260527-00001 ✅

## Next

- **ERD 문서 갱신**: `python tools/generate_db_schema_doc.py` 실행 필요 (PO_ITEMS 스키마 변경)
- **T-011 Phase B**: IQC006 입하 이력 조회, 시리얼 상세 그리드, 입하 취소 기능
- **T-011 Phase C**: 라벨 프린터 백엔드/인쇄 통합
- **T-015**: ERP PO Interface Procedure (IF_PO) — 품목 마스터 인터페이스 포함
- **notifications unread-count 500 에러**: 가끔 500 반환, 조사 필요
