---
menuCode: MAT_ADJUSTMENT
audience: user
title: Điều chỉnh Tồn kho
summary: Màn hình điều chỉnh thủ công chênh lệch giữa tồn kho thực tế và tồn kho hệ thống, xem lịch sử điều chỉnh
tags: [vật tư, tồn kho, điều chỉnh, hiệu chỉnh, kiểm kê]
keywords: [điều chỉnh tồn kho, hiệu chỉnh tồn kho, điều chỉnh số lượng, INV_ADJ_LOGS, kiểm kê, MANUAL_ADJ, chênh lệch tồn kho, tăng giảm]
related: [MAT_RECEIVE, MAT_ISSUE]
---

# Điều chỉnh Tồn kho

## Mục đích màn hình
**Điều chỉnh thủ công (Adjust)** chênh lệch giữa số lượng tồn kho thực tế trong kho và số lượng tồn kho ghi nhận trong hệ thống, quản lý nội dung đó dưới dạng lịch sử. Sử dụng cho phản ánh kết quả kiểm kê, sửa lỗi nhập/xuất, xử lý hư hỏng·thất lạc.

## Bố cục màn hình
- **Phía trên — 3 thẻ thống kê**: Tổng số lần điều chỉnh / Số lần tăng / Số lần giảm, xem tổng quan.
- **Phía dưới — Danh sách DataGrid**: Hiển thị lịch sử điều chỉnh kèm ngày tháng·mặt hàng·biến động số lượng·lý do. Có thể thu hẹp phạm vi tra cứu bằng bộ lọc thời gian và từ khóa.
- **Modal — Đăng ký điều chỉnh**: Nhấp nút **Đăng ký điều chỉnh** ở góc trên bên phải để mở modal đăng ký điều chỉnh mới. Sau khi đăng ký, tồn kho được phản ánh ngay lập tức (bỏ qua phê duyệt).

---

## ① Cột Danh sách DataGrid

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Ngày xử lý(createdAt)** | Thời điểm điều chỉnh được đăng ký. Chỉ hiển thị ngày tháng, có thể chỉ định phạm vi tra cứu bằng bộ lọc thời gian. |
| **Kho(warehouseCode)** | Mã kho nơi phát sinh điều chỉnh. |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng được điều chỉnh. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng được điều chỉnh. |
| **Trước điều chỉnh(beforeQty)** | Số lượng tồn kho hệ thống trước khi điều chỉnh. Hiển thị kèm đơn vị. |
| **Sau điều chỉnh(afterQty)** | Số lượng tồn kho hệ thống sau khi điều chỉnh. |
| **Chênh lệch(diffQty)** | Chênh lệch số lượng trước và sau điều chỉnh. **Dương (xanh)** = tăng tồn kho, **Âm (đỏ)** = giảm tồn kho. |
| **Lý do(reason)** | Lý do thực hiện điều chỉnh. |
| **Người xử lý(createdBy)** | Người dùng đã đăng ký điều chỉnh. |

---

## ② Trường Modal Đăng ký Điều chỉnh

| Trường | Vai trò / Ý nghĩa |
|------|------|
| **Kho(warehouseCode)** | Chọn kho có tồn kho cần điều chỉnh. |
| **Tìm kiếm mặt hàng(partSearch)** | Tìm kiếm và chọn mặt hàng cần điều chỉnh. Nhập từ 2 ký tự trở lên (mã mặt hàng hoặc tên mặt hàng) thì kết quả tìm kiếm hiển thị trong dropdown. |
| **Sau điều chỉnh(afterQty)** | Nhập **số lượng cuối cùng** sau khi áp dụng điều chỉnh. Chênh lệch với số lượng trước điều chỉnh được tự động tính và ghi vào diffQty. |
| **Lý do(reason)** | Nhập lý do điều chỉnh. Ví dụ: "Điều chỉnh chênh lệch kiểm kê", "Sửa nhập thiếu", "Hư hỏng thanh lý". |

---

## Trình tự thực hiện
1. Nhấp nút **Đăng ký điều chỉnh** ở phía trên để mở modal.
2. Chọn kho, tìm kiếm và chọn mặt hàng.
3. Nhập số lượng cuối cùng sau điều chỉnh và lý do, lưu lại (tồn kho được phản ánh ngay sau khi đăng ký).
4. Kiểm tra kết quả trong danh sách. Nếu diffQty dương là tăng tồn kho, âm là giảm tồn kho.

## Quy tắc nhập / Kiểm tra
- Kho·mặt hàng·số lượng·lý do đều là **bắt buộc nhập**. Nếu bất kỳ trường nào trống, nút lưu bị vô hiệu hóa.
- Số lượng sau điều chỉnh (afterQty) phải là số nguyên **từ 0 trở lên**.

## Câu hỏi thường gặp
- **H.** Đã đăng ký điều chỉnh sai thì có thể hủy không? **Đ.** Sau khi đăng ký, không có chức năng hủy (xóa). Để khôi phục, phải đăng ký điều chỉnh ngược lại (ví dụ: nếu đã tăng thì đăng ký giảm).
- **H.** Khác biệt giữa điều chỉnh và nhập·xuất là gì? **Đ.** Nhập/xuất là biến động tồn kho chính quy (nhập mua, xuất sản xuất), còn điều chỉnh là **hiệu chỉnh ngoại lệ** để khớp chênh lệch giữa số lượng hệ thống và thực tế.
- **H.** Lịch sử điều chỉnh được lưu giữ bao lâu? **Đ.** Nếu không có chính sách xóa riêng thì được lưu vĩnh viễn (chính sách hủy định kỳ theo quy định vận hành).

## Màn hình liên quan
- [Quản lý Nhập Vật tư](/material/receive) — Màn hình xử lý nhập chính quy
- [Quản lý Xuất Vật tư](/material/issue) — Màn hình xử lý xuất chính quy
