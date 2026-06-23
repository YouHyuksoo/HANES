---
menuCode: MAT_SHELF_LIFE_HISTORY
audience: operator
title: Lịch sử kiểm tra vật tư có hạn dùng — Hướng dẫn vận hành
summary: Tra cứu lịch sử tái kiểm tra vật tư có hạn dùng — ngày kiểm tra·LOT·hạng mục·số lần·kết quả PASS/FAIL·chi tiết đo lường
tags: [vật tư, hạn dùng, tái kiểm tra, lịch sử, tra cứu]
keywords: [SHELF_LIFE, HISTORY, REINSPECT, IQC_LOGS, RETEST, PASS, FAIL, retestRound, inspectDate, vật tư có hạn dùng, lịch sử kiểm tra, lịch sử tái kiểm tra]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_REINSPECT]
---

# Lịch sử kiểm tra vật tư có hạn dùng — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình chỉ đọc để tra cứu lịch sử tái kiểm tra (`RETEST`) vật tư có hạn dùng. Hiển thị ngày kiểm tra, LOT, hạng mục, số lần tái kiểm tra, kết quả PASS/FAIL và chi tiết các hạng mục đo lường.

```
IQC_LOGS (inspectType='RETEST') → Danh sách lịch sử → Chọn dòng → Modal chi tiết đo lường
```

## Cấu trúc dữ liệu
```
IQC_LOGS (PK: inspectDate + seq, inspectType='RETEST' cố định)
   ├─ matUid → MAT_LOTS (LOT)
   ├─ itemCode → PART_MASTERS (hạng mục)
   ├─ retestRound (số lần, tự động tăng)
   ├─ result (PASS / FAIL)
   ├─ inspectorName / destructSampleQty
   ├─ details (CLOB) — JSON hạng mục đo lường
   │   └─ [{ inspectItem, spec, lsl, usl, unit, measuredValue, judge }]
   └─ remark
```

## Bố cục màn hình
- **Header**: Tiêu đề + nút Làm mới
- **Thanh công cụ**:
  - Ô tìm kiếm (`LOT·품목 검색...` — lọc client `matUid`·`itemCode`·`itemName`·`inspectorName`)
  - Chọn hạng mục (`PartSelect`, khớp chính xác)
  - Lọc kết quả (`Tất cả`/`PASS`/`FAIL`, gọi lại server)
- **DataGrid**: `GET /material/shelf-life/reinspect?limit=2000`

| Cột | Mô tả |
|------|-------------|
| Thao tác | Nút Eye → modal chi tiết đo lường |
| Ngày KTra | `inspectDate` |
| LOT No. | `matUid` (monospace) |
| Mã hạng mục | `itemCode` (monospace) |
| Tên hạng mục | `itemName` (server JOIN) |
| Số lần TKT | `retestRound` (1, 2, 3...) |
| Kết quả | `result` (PASS/FAIL badge) |
| Người KTra | `inspectorName` |
| Ghi chú | `remark` |

### Modal chi tiết đo lường
- **Thông tin header**: Tên hạng mục · LOT No. · Số lần · Kết quả(badge) · Người KTra · SL mẫu · Ghi chú
- **Bảng hạng mục**:

| Cột | Mô tả |
|------|-------------|
| # | STT |
| Hạng mục KTra | `inspectItem` |
| Quy cách | `spec` |
| LSL | `lsl` |
| USL | `usl` |
| Giá trị đo | `measuredValue` |
| Phán định | PASS(CheckCircle) / FAIL(XCircle) |

※ Nếu details trống/null: hiển thị `"Không có dữ liệu đo lường (phán định thủ công)"`

## Quy trình

### ① Tra cứu lịch sử
- `GET /material/shelf-life/reinspect` — tất cả bản ghi `inspectType='RETEST'`
- Lọc kết quả (PASS/FAIL) → gọi lại server
- Tìm kiếm/Hạng mục → lọc client

### ② Xem chi tiết đo lường
- Nhấn nút Eye trên dòng
- Parse JSON `details` → hiển thị giá trị đo và phán định từng hạng mục
- Xem lý do PASS/FAIL

## Quy tắc chính

| Quy tắc | Mô tả |
|------|-------------|
| Chỉ đọc | Chỉ tra cứu (không sửa/xóa/tạo) |
| Chỉ RETEST | Chỉ hiển thị `inspectType='RETEST'` (loại INITIAL) |
| Tự động phán định | PASS/FAIL tự động dựa trên LSL/USL (thủ công → details=null) |

## Dữ liệu & Liên kết
- Bảng: `IQC_LOGS`, `MAT_LOTS`, `PART_MASTERS`
- Liên kết: Hiện trạng hạn dùng(`/material/shelf-life`) → Tái kiểm tra(`/material/shelf-life-reinspect`) → **Lịch sử TKT(hiện tại)**
- Tách biệt với lịch sử IQC(`/material/iqc-history`) — màn hình riêng cho RETEST
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
