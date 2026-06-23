---
menuCode: SHIP_PALLET
audience: operator
title: Xếp pallet — Hướng dẫn vận hành
summary: Quản lý pallet xuất hàng — tạo pallet·gán/tháo thùng·CLOSE/REOPEN·in nhãn·chỉ thùng OQC PASS mới được xếp
tags: [xuất hàng, pallet, xếp, thùng, nhãn]
keywords: [PALLET_MASTERS, BOX_MASTERS, SHIPMENT_ORDERS, OPEN, CLOSED, LOADED, SHIPPED, PALLET_STATUS, OQC_STATUS, pallet, xếp pallet, gán thùng, in nhãn]
related: [SHIP_PACK, SHIP_ORDER]
---

# Xếp pallet — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Tạo pallet xuất hàng và gán thùng. Pallet hóa các thùng CLOSED+OQC PASS theo lệnh xuất hàng CONFIRMED. Sau CLOSE, in nhãn pallet và chờ xuất hàng.

```
Lệnh xuất CONFIRMED → Tạo Pallet(OPEN) → Gán thùng → CLOSE → In nhãn → LOADED → SHIPPED
```

## Luồng trạng thái (Pallet)
```
OPEN → CLOSED(đã in nhãn) → LOADED(đã phân bổ vận chuyển) → SHIPPED(đã xuất)
CLOSED → OPEN (có thể mở lại)
```

## Cấu trúc dữ liệu
```
PALLET_MASTERS (PK: PALLET_NO)
   ├─ SHIP_ORDER_NO → SHIPMENT_ORDERS
   ├─ BOX_COUNT / TOTAL_QTY (tự động tính)
   ├─ STATUS: OPEN → CLOSED → LOADED → SHIPPED
   └─ CLOSE_TIME / SHIPPED_TIME / SHIPMENT_ID

BOX_MASTERS (PK: BOX_NO + COMPANY + PLANT_CD)
   ├─ ITEM_CODE → ITEM_MASTERS
   ├─ PALLET_NO → PALLET_MASTERS
   ├─ STATUS: OPEN → CLOSED → SHIPPED
   └─ OQC_STATUS: PENDING / PASS / FAIL
```

## Bố cục màn hình

### Phía trên
- **Header**: Tiêu đề + nút Làm mới·Tạo Pallet
- **Trái(2/3)**: DataGrid — danh sách pallet
  - Cột: thao tác·số lệnh·số pallet·số thùng·tổng số·trạng thái·số xuất·ngày tạo
  - Thao tác: gán thùng(OPEN)·CLOSE(OPEN)·mở lại(CLOSED)·in nhãn(CLOSED+)
  - Tìm kiếm: số pallet, quét mã vạch, bộ lọc trạng thái
  - `HelpCircle` trên header trạng thái → tooltip giải thích
- **Phải(1/3)**: Chi tiết pallet đã chọn
  - Thông tin tóm tắt pallet
  - Danh sách thùng đã gán (có thể tháo ở OPEN)
  - Thông tin thùng: số thùng·mã hạng mục·số lượng·OQC status

### Modal tạo pallet
- Quét/chọn lệnh xuất CONFIRMED → tạo pallet
- Chỉ chọn được lệnh trạng thái CONFIRMED

### Modal gán thùng
- Nút `+` hoặc quét mã vạch thùng
- Thùng khả dụng: `CLOSED` + `unassigned=true` + `oqcStatus=PASS`
- Thùng OQC FAIL không thể gán

### Modal nhãn (PalletLabelModal)
- Mã vạch Code128 (bwip-js)
- Số thùng·tổng số·trạng thái·tên hạng mục
- Có thể chọn mẫu (master/label-templates)
- Hỗ trợ chế độ tự động in
- Khổ giấy: 100mm × 120mm

## Quy trình làm việc

### ① Tạo pallet
`POST /shipping/orders/{shipOrderNo}/pallets`
- Chọn lệnh xuất CONFIRMED (quét hoặc chọn danh sách)
- Giới hạn 1 pallet mỗi lệnh

### ② Gán thùng
`POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes`
- Quét thùng hoặc chọn từ danh sách
- Hỗ trợ chọn nhiều
- Chỉ OQC PASS + CLOSED + chưa gán

### ③ Đóng pallet
`POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/close`
- Chuyển OPEN → CLOSED
- Có thể in nhãn sau CLOSE

### ④ Mở lại pallet
`POST /shipping/pallets/{palletNo}/reopen`
- Chuyển CLOSED → OPEN
- Để gán lại/tháo thùng

### ⑤ In nhãn
- Mở modal nhãn ở trạng thái CLOSED+
- Mã vạch Code128 (bwip-js)
- Chọn mẫu·in

## Điều kiện gán thùng

| Điều kiện | Mô tả |
|------|-------------|
| BOX_MASTERS.STATUS = CLOSED | Thùng đã đóng gói |
| OQC_STATUS = PASS | OQC kiểm tra đạt |
| PALLET_NO = NULL | Chưa gán vào pallet khác |
| Cùng lệnh xuất | Chỉ hạng mục khớp lệnh |

## Khóa liên động

| Điều kiện | Mô tả |
|------|-------------|
| Thùng OQC FAIL | Không thể gán |
| Thùng đã gán | Không thể gán trùng |
| Lệnh không CONFIRMED | Không thể tạo pallet |
| Pallet SHIPPED/LOADED | Không thể đóng/mở lại |
| 1 pallet mỗi lệnh | Giới hạn tạo |

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không tạo được pallet | Lệnh chưa CONFIRMED | Xác nhận lệnh trước |
| Không gán được thùng | OQC chưa PASS | Hoàn thành kiểm tra ngoại quan |
| Thùng không tìm thấy | Đã gán rồi | Kiểm tra thùng chưa gán |
| Nút CLOSE bị vô hiệu | 0 thùng | Gán thùng trước |
| Nhãn không in | Cài đặt máy in | Kiểm tra cài đặt in trình duyệt |

## Dữ liệu & Liên kết
- Bảng: `PALLET_MASTERS`, `BOX_MASTERS`, `SHIPMENT_ORDERS`, `SHIPMENT_ORDER_ITEMS`
- Liên kết: Lệnh xuất(`/shipping/order`) → Đóng gói(`/shipping/pack`) → **Xếp pallet(hiện tại)** → Xuất hàng
- Điều kiện OQC: Cần kiểm tra ngoại quan(`/quality/inspect`) PASS
- Nhãn: bwip-js Code128, hệ thống thiết kế `master/label-templates`
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
