# DECISIONS

Record durable technical or operational decisions here.

Format:

```md
## D-000 Short title
Status: Accepted | Proposed | Rejected
Decision:
- Decision text
Reason:
- Reason text
```

## D-20260609-MAT-RECEIVE-VENDOR-BARCODE
Status: Accepted
Decision:
- 자재입고 스캔 시 거래처/제조사 부착 바코드 원본은 `MAT_RECEIVINGS.VENDOR_BARCODE`에 입고 행 단위로 저장한다.
Reason:
- `VENDOR_BARCODE_MAPPINGS`는 기준정보 성격의 품목 매핑 테이블이고, 이번 요구는 실제 입고 시 스캔한 거래처 바코드와 자체 `matUid`의 실적 매핑을 남기는 것이므로 입고 이력에 직접 저장하는 편이 조회와 감사 추적에 맞다.
