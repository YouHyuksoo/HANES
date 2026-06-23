---
menuCode: INV_MAT_STOCK
audience: operator
title: Tra cứu Tồn kho Vật tư — Hướng dẫn vận hành
summary: Toàn bộ cột bảng MAT_STOCKS, logic xác định trạng thái tồn kho, cấu trúc liên kết LOT và xử lý sự cố
tags: [tồn kho, vật tư, vận hành, tra cứu, tồn kho an toàn]
keywords: [MAT_STOCKS, MAT_LOTS, tra cứu tồn kho, tồn kho an toàn, tồn kho khả dụng, QTY, RESERVED_QTY, AVAILABLE_QTY, theo serial, SAFETY_STOCK, hạn sử dụng, ITEM_MASTERS]
related: [INV_TRANSACTION, INV_MAT_PHYSICAL_INV]
---

# Tra cứu Tồn kho Vật tư — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Tra cứu thời gian thực trạng thái tồn kho vật tư theo kho·mặt hàng dựa trên bảng `MAT_STOCKS`. Hỗ trợ ra quyết định vận hành tồn kho bằng cách hiển thị tình trạng thiếu tồn kho so với tồn kho an toàn (`SAFETY_STOCK`) của master mặt hàng (`ITEM_MASTERS`), và trạng thái hết hạn so với hạn sử dụng LOT (`MAT_LOTS.EXPIRE_DATE`).

## Cấu trúc dữ liệu
```
MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
    │
    ├── QTY (Tổng tồn kho) = RESERVED_QTY (Đã đặt trước) + AVAILABLE_QTY (Khả dụng)
    │
    ├──▶ ITEM_MASTERS.ITEM_CODE — Tên mặt hàng(itemName), Đơn vị(unit), Tồn kho an toàn(safetyStock)
    │
    ├──▶ MAT_LOTS.MAT_UID — Ngày sản xuất(manufactureDate), Hạn sử dụng(expireDate)
    │
    └──▶ WAREHOUSES.WAREHOUSE_CODE — Tên kho(warehouseName)
```

---

## ① Tồn kho — MAT_STOCKS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Công ty | `COMPANY` | **PK (1/5)**. Đa khách hàng. `'40'`. |
| Nhà máy | `PLANT_CD` | **PK (2/5)**. Đa khách hàng. `'1000'`. |
| Mã kho | `WAREHOUSE_CODE` | **PK (3/5)**. Kho lưu trữ tồn kho. |
| Mã mặt hàng | `ITEM_CODE` | **PK (4/5)**. Mặt hàng tồn kho. Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| Serial vật tư | `MAT_UID` | **PK (5/5)**. Định danh đơn vị LOT. Tham chiếu `MAT_LOTS.MAT_UID`. |
| Vị trí | `LOCATION_CODE` | Vị trí đặt chi tiết trong kho (tùy chọn). |
| Tổng số lượng | `QTY` | Tổng số lượng tồn kho hiện đang lưu trữ trong kho. |
| Số lượng đã đặt trước | `RESERVED_QTY` | Số lượng đã được đặt trước do yêu cầu xuất... |
| Số lượng khả dụng | `AVAILABLE_QTY` | Số lượng có thể sử dụng ngay (= QTY - RESERVED_QTY). |
| Ngày kiểm kê cuối | `LAST_COUNT` | Thời điểm kiểm kê (Physical Count) lần cuối. |
| Người tạo | `CREATED_BY` | Người đăng ký đầu tiên. |
| Người sửa | `UPDATED_BY` | Người sửa cuối cùng. |
| Ngày tạo | `CREATED_AT` | Thời điểm đăng ký đầu tiên. |
| Ngày sửa | `UPDATED_AT` | Thời điểm sửa cuối cùng. |

> **Quan hệ số lượng tồn kho**: `QTY = RESERVED_QTY + AVAILABLE_QTY`. Số lượng thực tế có thể xuất là `AVAILABLE_QTY`.

---

## Logic xác định trạng thái tồn kho

So sánh tiêu chuẩn `SAFETY_STOCK` (tồn kho an toàn) của master mặt hàng với số lượng thực tế (`QTY`) để hiển thị trạng thái 3 cấp:

| Trạng thái | Điều kiện | Hiển thị |
|------|------|------|
| **Thiếu (Shortage)** | `QTY < SAFETY_STOCK × 0.5` | Huy hiệu đỏ |
| **Cảnh báo (Caution)** | `QTY < SAFETY_STOCK` | Huy hiệu vàng |
| **Bình thường (Normal)** | `QTY ≥ SAFETY_STOCK` | Huy hiệu xanh lá |

## Logic xác định trạng thái hạn sử dụng

So sánh `EXPIRE_DATE` của LOT với ngày hiện tại để hiển thị trạng thái hạn sử dụng 3 cấp:

| Trạng thái | Điều kiện | Hiển thị |
|------|------|------|
| **Hết hạn (Expired)** | `remainingDays ≤ 0` | Huy hiệu đỏ + nền dòng màu đỏ |
| **Sắp hết hạn (Imminent)** | `remainingDays ≤ 10` | Huy hiệu vàng + nền dòng màu vàng |
| **Bình thường (Normal)** | `remainingDays > 10` | Huy hiệu xanh lá |

---

## Quy trình vận hành
1. Thường xuyên tra cứu trạng thái tồn kho để xác nhận mặt hàng thiếu tồn kho an toàn và LOT hết hạn sử dụng.
2. Xem xét đặt hàng hoặc di chuyển từ kho khác cho mặt hàng thiếu tồn kho an toàn.
3. Xử lý thanh lý hoặc trả lại LOT hết hạn, lập kế hoạch sử dụng ưu tiên cho LOT sắp hết hạn.

## Phân quyền
Tất cả người dùng có quyền tra cứu tồn kho (quản trị viên thông tin cơ sở·sản xuất·vật tư). Chỉ xem (không thể sửa).

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không thấy mặt hàng cụ thể trong danh sách | Kho đó không có tồn kho (không có dòng trong `MAT_STOCKS`) | Nhập hoặc điều chỉnh |
| Số lượng khác với thực tế | Thiếu hoặc trùng lặp nhập/xuất | Kiểm tra lịch sử nhập/xuất sau đó điều chỉnh |
| Số lượng khả dụng nhỏ hơn tổng số lượng | Có yêu cầu xuất (đặt trước LOT) | Kiểm tra trạng thái đặt trước, hủy đặt trước nếu cần |
| LOT hết hạn hiển thị màu đỏ | `remainingDays ≤ 0` | Thanh lý·trả lại hoặc sử dụng sau khi phê duyệt chất lượng |
| Hiển thị thiếu tồn kho an toàn không chính xác | Giá trị `SAFETY_STOCK` chưa được thiết lập hoặc không chính xác | Xác nhận·sửa tiêu chuẩn tồn kho an toàn trong master mặt hàng |

## Dữ liệu & Liên kết
- **Bảng**: `MAT_STOCKS` (tồn kho), `MAT_LOTS` (thông tin LOT), `ITEM_MASTERS` (mặt hàng), `WAREHOUSES` (kho)
- **Liên kết**: Nhập vật tư → tăng `MAT_STOCKS`, Xuất vật tư → giảm `MAT_STOCKS`, Điều chỉnh tồn kho → tăng/giảm `MAT_STOCKS`
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
