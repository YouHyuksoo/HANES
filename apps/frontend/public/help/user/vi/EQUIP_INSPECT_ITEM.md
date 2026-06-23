---
menuCode: EQUIP_INSPECT_ITEM
audience: user
title: Hạng mục kiểm tra theo thiết bị
summary: Màn hình quản lý hạng mục kiểm tra cho từng thiết bị bằng cách kết nối (ánh xạ) hạng mục kiểm tra vào thiết bị riêng lẻ và phát hành nhãn QR
tags: [equipment, inspection, mapping, items, assignment, QR]
keywords: [EQUIP_INSPECT_ITEM_POOL, equipment inspection items, inspection item mapping, per-equipment inspection, batch registration, QR label, DAILY, PERIODIC, PM, WORKER]
related: [EQUIP_INSPECT_ITEM_MASTER]
---

# Hạng mục kiểm tra theo thiết bị

## Mục đích màn hình
Kết nối (ánh xạ) các hạng mục kiểm tra đã đăng ký trong [Danh mục hạng mục kiểm tra] vào từng thiết bị để cấu hình các hạng mục kiểm tra cần thực hiện cho mỗi thiết bị. Các tab được phân chia theo loại kiểm tra (Hàng ngày/Định kỳ/PM/Công nhân) và có thể phát hành nhãn QR để sử dụng tại hiện trường.

## Bố cục màn hình
- **Bên trái — Danh sách thiết bị**: Hiển thị tất cả thiết bị được nhóm theo loại thiết bị. Có thể tìm thiết bị mong muốn bằng bộ lọc tìm kiếm.
- **Bên phải — Bảng hạng mục kiểm tra**: Hiển thị danh sách hạng mục kiểm tra của thiết bị đã chọn, phân loại theo tab loại kiểm tra (DAILY/PERIODIC/PM/WORKER).
- **Drawer — Thêm hạng mục kiểm tra**: Chọn hạng mục từ danh mục hạng mục kiểm tra trong bảng mở bằng nút ở góc trên bên phải và đăng ký hàng loạt.
- **Modal — Phát hành nhãn QR**: In nhãn mã QR cho từng hạng mục kiểm tra.

---

## ① Các cột danh sách hạng mục kiểm tra

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Ảnh (imageUrl)** | Hình ảnh tham khảo của hạng mục kiểm tra. |
| **Mã hạng mục (itemCode)** | Mã hạng mục từ danh mục hạng mục kiểm tra. |
| **Tên hạng mục (itemName)** | Tên của hạng mục kiểm tra. |
| **Tiêu chí đánh giá (criteria)** | Tiêu chí đánh giá OK/NG hoặc phạm vi đo lường. |
| **Chu kỳ (cycle)** | Chu kỳ thực hiện kiểm tra (DAILY/WEEKLY/MONTHLY, v.v.). |
| **Thứ tự (sortSeq)** | Thứ tự hiển thị của hạng mục kiểm tra trong thiết bị. |
| **Sử dụng (useYn)** | `Y` (xanh) = đang hoạt động, `N` (đỏ) = không hoạt động. |

## Trình tự sử dụng
1. Chọn thiết bị mong muốn từ danh sách thiết bị bên trái.
2. Chọn tab loại kiểm tra (DAILY/PERIODIC/PM/WORKER) ở góc trên bên phải.
3. Nhấp nút **Thêm hạng mục kiểm tra** để mở bảng drawer.
4. Đánh dấu các hạng mục cần thêm và nhấp nút **Đăng ký hàng loạt** để kết nối chúng với thiết bị.
5. Các hạng mục đã đăng ký có thể được xác nhận trong danh sách và có thể xóa nếu cần.
6. Sử dụng nút **Phát hành nhãn QR** để in nhãn mã QR cho từng hạng mục và dán tại hiện trường.

## Các tab loại kiểm tra
| Tab | Nội dung |
|------|------|
| **DAILY** | Các hạng mục kiểm tra hàng ngày thực hiện trước khi làm việc |
| **PERIODIC** | Các hạng mục kiểm tra định kỳ theo tháng/quý/nửa năm/năm |
| **PM** | Các hạng mục kiểm tra liên quan đến Bảo trì phòng ngừa (Preventive Maintenance) |
| **WORKER** | Các hạng mục kiểm tra do công nhân tự thực hiện |

## Màn hình liên quan
- [Danh mục hạng mục kiểm tra](/master/equip-inspect-item) — Màn hình thông tin tiêu chuẩn để đăng ký và chỉnh sửa hạng mục kiểm tra
