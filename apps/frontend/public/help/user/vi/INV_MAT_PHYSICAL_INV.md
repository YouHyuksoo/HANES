---
menuCode: INV_MAT_PHYSICAL_INV
audience: user
title: Quản lý Kiểm kê Vật tư
summary: Màn hình bắt đầu·hoàn tất phiên kiểm kê và giám sát trạng thái quét PDA
tags: [tồn kho, kiểm kê, hậu cần, phiên, PDA]
keywords: [kiểm kê, Physical Inventory, phiên kiểm kê, IN_PROGRESS, quét PDA, số lượng kiểm kê, số lượng hệ thống, chênh lệch]
related: [INV_MAT_PHYSICAL_INV_APPLY, INV_MAT_STOCK]
---

# Quản lý Kiểm kê Vật tư

## Mục đích màn hình
Quản lý phiên **Kiểm kê (Physical Inventory)** để so sánh tồn kho thực tế và tồn kho hệ thống. Bắt đầu phiên kiểm kê để cho phép quét tồn kho bằng PDA, sau khi hoàn tất phiên thì xác nhận kết quả.

## Bố cục màn hình
- **Phía trên — Bộ lọc Năm tháng chuẩn/Kho/Tìm kiếm**: Chọn tiêu chí tra cứu.
- **Hiển thị trạng thái phiên**: Nếu có phiên kiểm kê đang tiến hành, hiển thị ở phía trên.
- **Danh sách DataGrid**: Hiển thị số lượng hệ thống / số lượng kiểm kê PDA / chênh lệch theo mặt hàng.
- **Nút Bắt đầu / Kết thúc kiểm kê**: Bắt đầu hoặc hoàn tất phiên.

---

## ① Cột Danh sách DataGrid

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Kho(warehouseName)** | Kho nơi tồn kho đang nằm. |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng kiểm kê. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng kiểm kê. |
| **Serial vật tư(matUid)** | Số LOT/serial. |
| **Số lượng hệ thống(qty)** | Số lượng tồn kho hệ thống tại thời điểm bắt đầu kiểm kê. |
| **Số lượng kiểm kê(countedQty)** | Số lượng kiểm kê đã nhập bằng cách quét PDA. Nếu chưa được quét, hiển thị `-`. |
| **Chênh lệch(diffQty)** | Số lượng kiểm kê - Số lượng hệ thống. **Dương (xanh)** = thực tế nhiều hơn, **Âm (đỏ)** = thực tế ít hơn, **0 (xanh lá)** = khớp. |
| **Thời gian kiểm kê(countedAt)** | Thời điểm quét PDA lần cuối. |
| **Ngày kiểm kê cuối(lastCountDate)** | Ngày mặt hàng đó được kiểm kê lần cuối. |

---

## ② Quản lý Phiên Kiểm kê

| Thao tác | Mô tả |
|------|------|
| **Bắt đầu kiểm kê** | Chọn năm tháng chuẩn và kho để bắt đầu phiên kiểm kê. Sau khi bắt đầu, **mọi biến động tồn kho (nhập·xuất·điều chỉnh) đều bị chặn**, và có thể quét kiểm kê bằng PDA. |
| **Kết thúc kiểm kê** | Khi quét PDA hoàn tất, kết thúc phiên. Sau khi kết thúc, việc chặn biến động tồn kho được gỡ bỏ. |
| **Phản ánh kiểm kê** | Sau khi kết thúc, xem xét số lượng kiểm kê và phản ánh vào tồn kho tại màn hình [Phản ánh Kiểm kê Vật tư]. |

> ⚠️ Sau khi bắt đầu kiểm kê, tất cả giao dịch biến động tồn kho như nhập vật tư, xuất, điều chỉnh, chia/gộp LOT đều bị chặn.

## Trình tự thực hiện
1. Nhấn nút **Bắt đầu kiểm kê**, chọn năm tháng chuẩn và kho để bắt đầu phiên.
2. Quét mặt hàng trong kho đó bằng PDA để nhập số lượng kiểm kê.
3. Làm mới màn hình để giám sát thời gian thực trạng thái quét PDA.
4. Khi tất cả quét hoàn tất, nhấn nút **Kết thúc kiểm kê** để kết thúc phiên.
5. Xem xét kết quả kiểm kê và phản ánh vào tồn kho tại màn hình [Phản ánh Kiểm kê Vật tư].

## Màn hình liên quan
- [Phản ánh Kiểm kê Vật tư](/inventory/material-physical-inv-apply) — Màn hình phản ánh số lượng kiểm kê vào tồn kho
- [Tra cứu Tồn kho Vật tư](/inventory/material-stock) — Màn hình tra cứu trạng thái tồn kho hiện tại
