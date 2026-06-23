---
menuCode: EQUIP_PERIODIC
audience: user
title: Kiểm Tra Định Kỳ
summary: Màn hình đăng ký và quản lý kết quả kiểm tra định kỳ (PERIODIC) thiết bị theo chu kỳ
tags: [설비, 점검, 정기, PERIODIC, 결과, 관리]
keywords: [EQUIP_PERIODIC, 정기점검, 설비정기점검, PERIODIC, 점검결과, PASS, FAIL]
related: [EQUIP_PERIODIC_CALENDAR, EQUIP_DAILY, EQUIP_INSPECT_ITEM]
---

# Kiểm Tra Định Kỳ

## Mục Đích Màn Hình
Đăng ký và quản lý kết quả kiểm tra định kỳ (PERIODIC) thiết bị theo chu kỳ (tháng/quý/nửa năm/năm). Sử dụng bố cục chia trái/phải giống với kiểm tra hàng ngày, xử lý dữ liệu kiểm tra loại PERIODIC.

## Bố Cục Màn Hình
- **Bên trái — Danh sách thiết bị**: Hiển thị thiết bị cần kiểm tra định kỳ được phân nhóm theo loại thiết bị.
- **Bên phải — Bảng nhập kiểm tra**: Hiển thị danh sục hạng mục kiểm tra PERIODIC và biểu mẫu nhập đánh giá cho thiết bị đã chọn.

## Các Trường trong Bảng Nhập Kiểm Tra

| Trường | Vai trò / Ý nghĩa |
|------|------|
| **Ngày kiểm tra** | Ngày thực hiện kiểm tra định kỳ. |
| **Người kiểm tra (Bắt buộc)** | Chọn người kiểm tra từ danh mục nhân viên. |
| **Giờ bắt đầu** | Thời gian bắt đầu kiểm tra. |
| **Danh sách hạng mục kiểm tra** | Các hạng mục kiểm tra PERIODIC liên kết với thiết bị. |
| **Nhập đánh giá** | Nhập kết quả OK (Đạt) / NG (Không đạt) hoặc giá trị đo cho từng hạng mục. |
| **Đánh giá tổng hợp** | Tự động hiển thị sau khi tổng hợp kết quả tất cả hạng mục. |

## Trình Tự Sử Dụng
1. Chọn thiết bị cần kiểm tra định kỳ từ danh sách bên trái.
2. Xác nhận/chọn ngày kiểm tra và người kiểm tra ở bảng bên phải.
3. Nhập kết quả cho từng hạng mục kiểm tra (loại đánh giá OK/NG, loại đo lường nhập số liệu).
4. Nếu có hạng mục NG, nhập chi tiết lỗi.
5. Lưu bằng nút **Lưu (PASS)** hoặc **Lưu (NG)**.

## Màn Hình Liên Quan
- [Lịch Kiểm Tra Định Kỳ](/equipment/periodic-inspect-calendar) — Xem tình trạng kiểm tra định kỳ theo lịch tháng
- [Kiểm Tra Hàng Ngày](/equipment/daily-inspect) — Màn hình kiểm tra hàng ngày
- [Danh Mục Hạng Mục Kiểm Tra](/master/equip-inspect-item) — Đăng ký hạng mục kiểm tra
