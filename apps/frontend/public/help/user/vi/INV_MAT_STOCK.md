---
menuCode: INV_MAT_STOCK
audience: user
title: Tra cứu Tồn kho Vật tư
summary: Màn hình tra cứu tồn kho vật tư theo kho/mặt hàng, theo đơn vị serial hoặc tổng nhóm mặt hàng
tags: [tồn kho, vật tư, trạng thái, tra cứu, thời gian thực]
keywords: [MAT_STOCKS, tra cứu tồn kho, tồn kho an toàn, serial, LOT, hạn sử dụng, số lượng tồn kho, tồn kho khả dụng, tồn kho đã đặt trước]
related: [INV_TRANSACTION, INV_MAT_PHYSICAL_INV]
---

# Tra cứu Tồn kho Vật tư

## Mục đích màn hình
Tra cứu thời gian thực tồn kho vật tư đang nắm giữ theo kho·mặt hàng. Cung cấp chi tiết theo đơn vị serial (LOT) và tổng nhóm mặt hàng qua các tab, cho phép xem trạng thái so với tồn kho an toàn và hết hạn sử dụng trong nháy mắt.

## Bố cục màn hình
- **Hai tab**: **Chi tiết theo Serial** (đơn vị LOT riêng lẻ) / **Tổng nhóm mặt hàng** (tổng hợp theo mặt hàng)
- **Bộ lọc phía trên**: Dropdown chọn kho + ô tìm kiếm mã mặt hàng/tên mặt hàng
- **Danh sách DataGrid**: Hiển thị với cấu trúc cột khác nhau tùy theo tab đã chọn

---

## ① Cột Tab Chi tiết theo Serial

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng(itemCode)** | Mã mặt hàng tồn kho. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng tồn kho. |
| **Serial vật tư(matUid)** | Số LOT/serial riêng lẻ. Cùng mặt hàng nhưng serial khác nhau thì quản lý dưới dạng dòng riêng. |
| **Kho(warehouseName)** | Kho nơi tồn kho đang nằm. |
| **Số lượng(qty)** | Tổng số lượng tồn kho hiện đang lưu trữ trong kho. |
| **Tồn kho an toàn(safetyStock)** | Số lượng tiêu chuẩn tồn kho an toàn của mặt hàng đó (thiết lập trong master mặt hàng). |
| **Trạng thái(stockLevel)** | Mức đáp ứng tồn kho an toàn so với số lượng thực tế. **Thiếu**(đỏ) / **Cảnh báo**(vàng) / **Bình thường**(xanh lá). |
| **Ngày sản xuất(manufactureDate)** | Ngày sản xuất của LOT đó. |
| **Số ngày đã qua(elapsedDays)** | Số ngày đã trôi qua kể từ ngày sản xuất. |
| **Số ngày còn lại(remainingDays)** | Số ngày còn lại đến khi hết hạn sử dụng. **Âm là đã hết hạn**. |
| **Trạng thái hạn sử dụng(shelfLifeStatus)** | Trạng thái hạn sử dụng. **Hết hạn**(đỏ) / **Sắp hết hạn**(vàng) / **Bình thường**(xanh lá). |

---

## ② Cột Tab Tổng nhóm mặt hàng

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng(itemCode)** | Mã mặt hàng. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng. |
| **Tổng số lượng tồn kho(totalQty)** | Tổng số lượng tồn kho của mặt hàng đó trên tất cả kho. |
| **Tồn kho an toàn(safetyStock)** | Tiêu chuẩn tồn kho an toàn của mặt hàng. |
| **Trạng thái(stockLevel)** | Mức đáp ứng tồn kho an toàn so với tổng tồn kho. |
| **Số lượng serial(serialCount)** | Số LOT/serial mà mặt hàng đó đang nắm giữ. |
| **Số lượng kho(warehouseCount)** | Số kho mà mặt hàng đó được phân tán lưu trữ. |

---

## Trình tự thực hiện
1. Nhập **kho** và **từ khóa** (mã mặt hàng/tên mặt hàng) trong bộ lọc phía trên.
2. Xem trạng thái tồn kho theo đơn vị LOT riêng lẻ trong tab **Chi tiết theo Serial**.
3. Xem trạng thái tổng hợp theo mặt hàng trong tab **Tổng nhóm mặt hàng**.
4. Các mục thiếu tồn kho an toàn (màu đỏ) hoặc hết hạn sử dụng (màu đỏ) có thể cần xử lý ngay.
5. Có thể tải xuống kết quả tra cứu hiện tại dưới dạng tệp Excel bằng nút **Xuất** ở góc trên bên phải.

## Màn hình liên quan
- [Tra cứu lịch sử Tồn kho](/inventory/transaction) — Màn hình tra cứu lịch sử biến động tồn kho (nhập/xuất/di chuyển)
- [Quản lý Kiểm kê Vật tư](/inventory/material-physical-inv) — Màn hình đối chiếu tồn kho thực tế và hệ thống
