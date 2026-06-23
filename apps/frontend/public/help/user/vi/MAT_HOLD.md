---
menuCode: MAT_HOLD
audience: user
title: Quản lý Giữ Tồn kho Vật tư
summary: Màn hình giữ (tạm ngừng sử dụng) hoặc giải giữ LOT vật tư
tags: [vật tư, giữ, LOT, tạm ngừng sử dụng, chặn]
keywords: [giữ tồn kho, HOLD, giữ LOT, chặn vật tư, giữ chất lượng, MAT_LOTS, tạm ngừng sử dụng, giải giữ]
related: [INV_MAT_STOCK]
---

# Quản lý Giữ Tồn kho Vật tư

## Mục đích màn hình
Quản lý **giữ tồn kho (tạm ngừng sử dụng)** hoặc **giải giữ** theo đơn vị LOT (serial) vật tư. Sử dụng khi cần tạm dừng sử dụng LOT cụ thể do vấn đề chất lượng hoặc lý do khác. LOT bị giữ không thể sử dụng cho xuất·sản xuất.

## Bố cục màn hình
- **Phía trên — 3 thẻ thống kê**: Tổng số LOT / Đang giữ / Bình thường
- **Khu vực lọc**: Từ khóa + chọn trạng thái LOT (Tất cả/Bình thường/Đang giữ)
- **Danh sách DataGrid**: Hiển thị trạng thái theo LOT và nút hành động giữ/giải giữ
- **Modal**: Nhập lý do khi giữ hoặc giải giữ

---

## ① Cột Danh sách DataGrid

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Số LOT(matUid)** | Số LOT/serial vật tư bị giữ. |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng tương ứng với LOT. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng tương ứng với LOT. |
| **Số lượng hiện tại(qty)** | Số lượng hiện đang nắm giữ của LOT đó. |
| **Nhà cung cấp(vendor)** | Nhà cung cấp (nhà cung ứng) đã cung cấp LOT đó. |
| **Trạng thái(status)** | Trạng thái hiện tại của LOT. **HOLD**(đỏ) = tạm ngừng sử dụng, **NORMAL**(xanh lá) = bình thường. |

---

## Trình tự thực hiện
1. **Giữ**: Nhấp vào biểu tượng 🔒 (khóa) của LOT cần giữ trong danh sách. Nhập lý do trong modal và xác nhận. LOT đó chuyển sang trạng thái `HOLD` và bị chặn xuất/sử dụng.
2. **Giải giữ**: Nhấp vào biểu tượng 🔓 (mở khóa) của LOT đang bị giữ. Nhập lý do trong modal và xác nhận. LOT được phục hồi về trạng thái `NORMAL`.
3. Có thể dùng bộ lọc trạng thái để xem riêng các LOT **đang giữ**.

## Màn hình liên quan
- [Tra cứu Tồn kho Vật tư](/inventory/material-stock) — Màn hình xem trạng thái tồn kho của LOT bị giữ
