---
menuCode: INV_MAT_PHYSICAL_INV_APPLY
audience: user
title: Phản ánh Kiểm kê Vật tư
summary: Màn hình xem xét·điều chỉnh số lượng quét PDA sau kiểm kê và phản ánh vào tồn kho hệ thống
tags: [tồn kho, kiểm kê, phản ánh, điều chỉnh, số lượng]
keywords: [phản ánh kiểm kê, nhập số lượng kiểm kê, xác nhận chênh lệch, điều chỉnh tồn kho, PHYSICAL_COUNT, xác nhận kiểm kê]
related: [INV_MAT_PHYSICAL_INV, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Phản ánh Kiểm kê Vật tư

## Mục đích màn hình
Sau khi hoàn tất phiên kiểm kê, xem xét số lượng kiểm kê đã quét bằng PDA, nếu cần thì sửa trực tiếp và phản ánh (Apply) vào tồn kho hệ thống. Đây là bước cuối cùng để thực sự phản ánh chênh lệch phát sinh từ kiểm kê vào số lượng tồn kho.

## Bố cục màn hình
- **Phía trên — 4 thẻ thống kê**: Tổng số / Đã kiểm kê / Khớp / Không khớp
- **Khu vực lọc**: Năm tháng chuẩn + chọn kho + nhập từ khóa
- **Danh sách DataGrid**: Hiển thị số lượng hệ thống, số lượng kiểm kê, chênh lệch theo mặt hàng. Cột số lượng kiểm kê có thể **sửa trực tiếp**.
- **Nút Phản ánh kiểm kê**: Kích hoạt khi có mục không khớp.

---

## ① Cột Danh sách DataGrid

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Kho(warehouseName)** | Kho nơi tồn kho đang nằm. |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng kiểm kê. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng kiểm kê. |
| **Serial vật tư(matUid)** | Số LOT/serial. |
| **Số lượng hệ thống(qty)** | Số lượng tồn kho hiện tại trên hệ thống. |
| **Số lượng kiểm kê(countedQty)** | Số lượng kiểm kê đã quét PDA. **Có thể nhấp trực tiếp để sửa**. |
| **Chênh lệch(diffQty)** | Số lượng kiểm kê - Số lượng hệ thống. Dương (xanh) / Âm (đỏ) / 0 (xanh lá). |
| **Thời gian kiểm kê(countedAt)** | Thời điểm quét PDA lần cuối. |

---

## Trình tự thực hiện
1. Chọn năm tháng chuẩn và kho trong bộ lọc phía trên để tra cứu kết quả kiểm kê.
2. So sánh **số lượng kiểm kê** của từng mặt hàng trong danh sách với kết quả quét PDA.
3. Nếu cần, **nhấp trực tiếp vào số lượng kiểm kê để sửa** (sửa lỗi).
4. Nhấn nút **Phản ánh kiểm kê** để xác nhận lần cuối trong modal xác nhận.
5. Sau khi phản ánh hoàn tất, xác nhận số lượng tồn kho đã thay đổi tại [Tra cứu Tồn kho Vật tư].

## Quy tắc nhập / Kiểm tra
- Số lượng kiểm kê phải là số nguyên **từ 0 trở lên**.
- Trước khi phản ánh, nhất định phải kiểm tra lại các mục không khớp. Sau khi phản ánh, rất khó để khôi phục.

## Màn hình liên quan
- [Quản lý Kiểm kê Vật tư](/inventory/material-physical-inv) — Bắt đầu·kết thúc phiên kiểm kê và giám sát quét PDA
- [Tra cứu Tồn kho Vật tư](/inventory/material-stock) — Xác nhận trạng thái tồn kho đã phản ánh
