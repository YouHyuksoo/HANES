---
menuCode: INV_TRANSACTION
audience: user
title: Tra cứu Lịch sử Tồn kho
summary: Màn hình tra cứu mọi biến động tồn kho vật tư (nhập/xuất/di chuyển/điều chỉnh/thanh lý)
tags: [tồn kho, lịch sử tồn kho, tra cứu, giao dịch]
keywords: [STOCK_TRANSACTIONS, lịch sử tồn kho, nhập, xuất, di chuyển, điều chỉnh, thanh lý, LOT, tra cứu giao dịch]
related: [INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Tra cứu Lịch sử Tồn kho

## Mục đích màn hình
Tra cứu lịch sử tất cả giao dịch tồn kho vật tư (nhập·xuất·di chuyển·điều chỉnh·thanh lý v.v.). Có thể theo dõi mọi nội dung biến động tồn kho theo ngày·loại.

## Bố cục màn hình
- **Danh sách DataGrid**: Hiển thị 13 cột bao gồm số giao dịch, loại, ngày, kho, mặt hàng, số lượng, trạng thái
- **Bộ lọc phía trên**: Chọn loại giao dịch + phạm vi ngày + tìm kiếm số LOT

---

## ① Cột Danh sách DataGrid

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Số giao dịch(transNo)** | Số định danh duy nhất cho mỗi biến động tồn kho. |
| **Loại(transType)** | Loại biến động tồn kho. Bao gồm **Nhập/Xuất/Di chuyển/Điều chỉnh/Thanh lý**... được phân biệt bằng chip màu. |
| **Ngày xử lý(transDate)** | Thời điểm giao dịch được xử lý. |
| **Kho xuất(fromWarehouse)** | Kho mà tồn kho đi ra (khi xuất/di chuyển). |
| **Kho nhập(toWarehouse)** | Kho mà tồn kho đi vào (khi nhập/di chuyển). |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng bị biến động. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng bị biến động. |
| **Số LOT(matUid)** | Số LOT/serial liên quan đến giao dịch đó. |
| **Số lượng(qty)** | Số lượng biến động. **Dương (+) = tăng tồn kho, Âm (-) = giảm tồn kho**. |
| **Trạng thái(status)** | Trạng thái giao dịch. `DONE` (xử lý bình thường, xanh lá) / `CANCELED` (đã hủy, đỏ). |
| **Giao dịch gốc(original)** | Số giao dịch gốc khi hủy (chỉ hiển thị với giao dịch hủy). |
| **Ghi chú(remark)** | Ghi chú bổ sung cho giao dịch. |

## Trình tự thực hiện
1. Nhập loại giao dịch, kỳ tra cứu, số LOT trong bộ lọc phía trên.
2. Xem thông tin chi tiết của giao dịch cụ thể trong kết quả tra cứu.
3. Có thể tìm dữ liệu mong muốn bằng chức năng lọc·sắp xếp cột.
4. Có thể tải xuống kết quả dưới dạng Excel bằng nút **Xuất**.

## Các loại giao dịch chính
| Loại | Ý nghĩa | Dấu số lượng |
|------|------|----------|
| RECEIVE | Nhập vật tư | + |
| MAT_OUT | Xuất vật tư | - |
| ADJUST_IN | Điều chỉnh tăng | + |
| ADJUST_OUT | Điều chỉnh giảm | - |
| TRANSFER | Di chuyển giữa các kho | Kho xuất -, Kho nhập + |
| LOT_SPLIT_IN/OUT | Chia LOT | Đã chia -, Được tạo + |
| SCRAP | Thanh lý | - |
| MISC_IN | Nhập khác | + |
| PROD_CONSUME | Tiêu thụ sản xuất | - |

## Màn hình liên quan
- [Tra cứu Tồn kho Vật tư](/inventory/material-stock) — Màn hình tra cứu trạng thái tồn kho hiện tại
- [Điều chỉnh Tồn kho](/material/adjustment) — Màn hình đăng ký điều chỉnh thủ công tồn kho
