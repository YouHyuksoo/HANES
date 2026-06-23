---
menuCode: SHIP_ORDER
audience: operator
title: Lệnh xuất hàng — Hướng dẫn vận hành
summary: CRUD lệnh xuất hàng — khách hàng·số PO·ngày xuất hàng, thêm hạng mục/số lượng, chuyển DRAFT→CONFIRMED, in mã QR
tags: [xuất hàng, lệnh xuất hàng, vận chuyển, CRUD]
keywords: [SHIPMENT_ORDERS, SHIPMENT_ORDER_ITEMS, DRAFT, CONFIRMED, SHIPPED, CLOSED, SHIP_ORDER_STATUS, CUSTOMER, lệnh xuất hàng, xuất hàng, vận chuyển, khách hàng]
related: [SHIP_PACK, SHIP_PALLET]
---

# Lệnh xuất hàng — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Đăng ký và quản lý **lệnh xuất hàng (Ship Order)** chỉ định hạng mục và số lượng xuất cho khách hàng. Soạn/sửa ở trạng thái DRAFT, xác nhận (CONFIRMED) để tiến hành xuất thùng và xếp pallet.

```
DRAFT → CONFIRMED → SHIPPING → SHIPPED → CLOSED
```

## Cấu trúc dữ liệu
```
SHIPMENT_ORDERS (PK: SHIP_ORDER_NO, tự động đánh số)
   ├─ CUSTOMER_ID → PARTNER_MASTERS (khách hàng)
   ├─ CUSTOMER_PO_NO (số PO khách hàng)
   ├─ DUE_DATE / SHIP_DATE
   └─ STATUS: DRAFT → CONFIRMED → SHIPPING → SHIPPED → CLOSED

SHIPMENT_ORDER_ITEMS (PK: SHIP_ORDER_ID + SEQ)
   ├─ ITEM_CODE → ITEM_MASTERS (thành phẩm FINISHED)
   ├─ ORDER_QTY / SHIPPED_QTY
   └─ REMARK
```

## Bố cục màn hình

### Khu vực chính
- **Header**: Tiêu đề + nút Làm mới·Đăng ký
- **DataGrid**: `GET /shipping/orders?limit=5000`
  - Cột: thao tác·số lệnh·khách hàng·số PO·ngày giao·ngày xuất·số hạng mục·tổng số·trạng thái
  - Thao tác: in·xác nhận(DRAFT)·sửa(DRAFT)·xóa(DRAFT)
  - `HelpCircle` trên header trạng thái → tooltip giải thích trạng thái
  - Tìm kiếm: số lệnh, bộ lọc trạng thái

### Bảng phải (480px)
| Mục | Mô tả |
|------|-------------|
| Số lệnh xuất hàng | Tự động tạo (hiện khi sửa) |
| Khách hàng | Chọn đối tác loại `CUSTOMER` |
| Số PO khách hàng | Nhập thủ công (tối đa 100 ký tự) |
| Ngày giao / Ngày xuất | Date picker (ngày xuất bắt buộc) |
| Ghi chú | Văn bản tự do |
| Danh sách hạng mục | Nút `+` → `PartSearchModal`(thành phẩm) |
| Thẻ hạng mục | Mã·tên·đơn vị, số lượng(`QtyInput`), ghi chú, xóa |
| Tổng kết | Số hạng mục, tổng số lượng |

### Khu vực in (Mẫu lệnh xuất hàng A4)
- Biểu tượng `Printer` → Định dạng A4 dọc
- Mã QR(số lệnh), thông tin khách hàng, bảng hạng mục
- Ẩn trên màn hình qua CSS `@media print`

## Quy trình làm việc

### ① Tạo mới (POST /shipping/orders)
- Nhập khách hàng, ngày xuất, hạng mục trong bảng phải
- Không thể thêm hạng mục trùng (theo itemCode)
- Tất cả hạng mục phải `orderQty > 0` + ngày xuất bắt buộc

### ② Sửa (PUT /shipping/orders/:id)
- **Chỉ trạng thái DRAFT**
- Thêm/xóa hạng mục, thay đổi số lượng

### ③ Xác nhận (PUT /shipping/orders/:id/confirm)
- Chuyển DRAFT → CONFIRMED
- Không thể sửa/xóa sau khi xác nhận
- Cần ít nhất 1 hạng mục

### ④ Xóa (DELETE /shipping/orders/:id)
- **Chỉ trạng thái DRAFT**

### ⑤ In
- Khả dụng ở mọi trạng thái
- In A4 kèm mã QR

## Mã trạng thái (SHIP_ORDER_STATUS)

| Mã | Ý nghĩa | Thao tác cho phép |
|------|---------|-----------------|
| DRAFT | Đang soạn thảo | Sửa·Xóa·Xác nhận |
| CONFIRMED | Đã xác nhận | Xuất thùng·Xếp pallet |
| SHIPPING | Đang xuất hàng | Xuất một phần |
| SHIPPED | Đã xuất | Chỉ xem |
| CLOSED | Đã đóng | Chỉ xem |

## Khóa liên động

| Điều kiện | Mô tả |
|------|-------------|
| Ngày xuất trống | Nút lưu bị vô hiệu hóa |
| Số lượng hạng mục = 0 | Nút lưu bị vô hiệu hóa |
| Sau CONFIRMED | Sửa/xóa bị vô hiệu hóa |
| Xác nhận không có hạng mục | Nút xác nhận bị vô hiệu + tooltip |

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không chọn được hạng mục | Bộ lọc PartSearchModal | Chỉ chọn được thành phẩm |
| Xác nhận thất bại | Không có hạng mục | Thêm ít nhất 1 hạng mục |
| In không hoạt động | Trình duyệt chặn popup | Cho phép popup |
| Lưu thất bại | Thiếu trường bắt buộc | Kiểm tra ngày xuất và số lượng hạng mục |

## Dữ liệu & Liên kết
- Bảng: `SHIPMENT_ORDERS`, `SHIPMENT_ORDER_ITEMS`, `PARTNER_MASTERS`, `ITEM_MASTERS`
- Liên kết: Đóng gói (`/shipping/pack`) → Xếp pallet (`/shipping/pallet`) → Xuất hàng
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
