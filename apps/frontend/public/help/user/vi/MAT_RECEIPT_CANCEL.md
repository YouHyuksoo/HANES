---
menuCode: MAT_RECEIPT_CANCEL
audience: user
title: Hủy Nhập Vật tư
summary: Màn hình chọn giao dịch nhập đã hoàn tất để hủy (tạo reverse transaction) và xem lịch sử hủy
tags: [vật tư, nhập, hủy, tồn kho, reverse transaction]
keywords: [hủy nhập, hủy nhập vật tư, STOCK_TRANSACTIONS, lý do hủy, reverse transaction, DONE, CANCELED, MatStock]
related: [MAT_RECEIVE, MAT_ARRIVAL]
---

# Hủy Nhập Vật tư

## Mục đích màn hình
Chọn **giao dịch nhập đã hoàn tất (DONE)** để hủy và quản lý nội dung đó. Khi hủy, trạng thái giao dịch gốc chuyển thành `CANCELED`, một reverse transaction với dấu ngược lại được tự động tạo trong `STOCK_TRANSACTIONS` và tồn kho `MatStock` bị trừ đi.

> Dùng để hoàn tác việc nhập vật tư bị nhập sai hoặc phát hiện chất lượng bất thường.

## Bố cục màn hình
- **Phía trên — Khu vực lọc**: **Bộ lọc thời gian (DateRangeFilter)** để chỉ định kỳ nhập cần tra cứu, **nhập từ khóa** để tìm kiếm mã mặt hàng·tên mặt hàng·nhà cung cấp·số giao dịch. Nút **Làm mới (Refresh)** để cập nhật danh sách.
- **Phía dưới — Danh sách DataGrid**: Hiển thị các giao dịch nhập có thể hủy (DONE) và đã hủy (CANCELED). Bộ lọc trạng thái cho phép xem riêng **DONE (bình thường)** / **CANCELED (đã hủy)**.
- **Modal — Xử lý hủy**: Nhấp nút **Hủy** trong danh sách để mở modal xác nhận hủy. Xác nhận thông tin giao dịch và nhập **lý do hủy** để hoàn tất.

---

## ① Cột Danh sách DataGrid

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Ngày giao dịch(transDate)** | Ngày phát sinh giao dịch nhập. Có thể chỉ định phạm vi tra cứu bằng bộ lọc thời gian. |
| **Số giao dịch(transNo)** | Số định danh duy nhất (PK) của giao dịch nhập. |
| **Loại giao dịch(transType)** | Loại giao dịch. Trên màn hình hủy nhập chỉ hiển thị loại `RECEIVE`. |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng đã nhập. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng đã nhập. |
| **Serial vật tư(matUid)** | Serial duy nhất của LOT vật tư đã nhập. |
| **Nhà cung cấp(vendorName)** | Tên nhà cung cấp đã giao vật tư. |
| **Kho(warehouseName)** | Tên kho nơi vật tư được nhập. |
| **Số lượng(qty)** | Số lượng đã nhập. |
| **Trạng thái(status)** | Hiển thị `DONE` (bình thường, màu xanh lá) / `CANCELED` (đã hủy, màu đỏ). |
| **Hành động(actions)** | Có nút **Hủy**. Các giao dịch ở trạng thái `CANCELED` bị vô hiệu hóa nút. |

---

## ② Modal Xử lý Hủy

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Số giao dịch(transNo)** | Hiển thị số giao dịch gốc cần hủy. |
| **Ngày giao dịch(transDate)** | Hiển thị ngày giao dịch gốc. |
| **Mã mặt hàng / Tên mặt hàng** | Hiển thị mặt hàng cần hủy. |
| **Serial vật tư(matUid)** | Hiển thị serial của LOT cần hủy. |
| **Nhà cung cấp / Kho** | Hiển thị thông tin nhà cung cấp và kho. |
| **Số lượng hủy** | Hiển thị số lượng nhập gốc. |
| **Lý do hủy(reason)** | **Bắt buộc nhập**. Nhập cụ thể lý do hủy (ví dụ: "Trả lại do chất lượng kém", "Sửa lỗi số lượng nhập"). |
| **Xác nhận hủy** | Sau khi nhập lý do, nhấn nút **Hủy** để xác nhận. |

---

## Trình tự thực hiện
1. Chọn kỳ nhập cần tra cứu bằng **bộ lọc thời gian** phía trên và nhấn nút **Tìm kiếm**.
2. Tìm giao dịch nhập cần hủy trong danh sách và nhấp nút **Hủy**.
3. Trong modal hủy, xác nhận thông tin giao dịch và nhập **lý do hủy**.
4. Nhấn nút **Xác nhận hủy** để tạo reverse transaction và chuyển trạng thái giao dịch đó thành `CANCELED`.
5. Có thể xem lịch sử hủy bằng bộ lọc trạng thái trong danh sách.

## Quy tắc nhập / Kiểm tra
- Lý do hủy là **bắt buộc nhập**. Nếu để trống, nút hủy bị vô hiệu hóa.
- **Giao dịch đã hủy** không thể hủy lại (nút bị vô hiệu hóa).
- Các giao dịch không phải loại nhập (`RECEIVE`) không xuất hiện trên màn hình này và không phải đối tượng hủy.
- Nếu có **công việc tiếp theo (progress)** liên kết với giao dịch nhập cần hủy, có thể bị chặn hủy (ví dụ: LOT đó đã được đưa vào sản xuất).

## Câu hỏi thường gặp
- **H.** Có thể hoàn tác lại giao dịch đã hủy không? **Đ.** Sau khi hủy, không thể khôi phục. Nếu cần nhập lại, phải thực hiện quy trình nhập chính quy (MAT_RECEIVE).
- **H.** Không thấy giao dịch nhập trong danh sách? **Đ.** Kiểm tra bộ lọc thời gian có phù hợp không. Mặc định là trong ngày; các giao dịch nhập trước đó cần mở rộng kỳ tra cứu. Ngoài ra, chỉ hiển thị loại `RECEIVE`.
- **H.** Nút hủy bị vô hiệu hóa? **Đ.** Giao dịch đó đã ở trạng thái `CANCELED`, hoặc có công việc tiếp theo (đưa vào sản xuất...) khiến không thể hủy.
- **H.** Khi hủy, tồn kho thay đổi thế nào? **Đ.** Bị trừ từ `MatStock` bằng số lượng nhập gốc, và giao dịch ngược dấu được ghi vào `STOCK_TRANSACTIONS`.

## Màn hình liên quan
- [Quản lý Nhập Vật tư](/material/receive) — Màn hình xử lý nhập chính quy
- [Quản lý Hàng đến](/material/arrival) — Bước hàng đến·kiểm tra trước nhập
- [Tra cứu lịch sử Tồn kho](/inventory/transaction) — Tra cứu toàn bộ lịch sử giao dịch tồn kho
