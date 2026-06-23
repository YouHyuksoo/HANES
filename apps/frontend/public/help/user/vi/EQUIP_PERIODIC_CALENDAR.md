---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: user
title: Lịch Kiểm Tra Định Kỳ
summary: Màn hình xem tình trạng kiểm tra định kỳ (PERIODIC) theo tháng trên lịch và thực hiện kiểm tra cho từng thiết bị
tags: [thiết-bị, kiểm-tra, định-kỳ, lịch, PERIODIC]
keywords: [EQUIP_PERIODIC_CALENDAR, lịch-kiểm-tra-định-kỳ, PERIODIC, kiểm-tra-định-kỳ-thiết-bị, tình-trạng-kiểm-tra-hàng-tháng]
related: [EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM]
---

# Lịch Kiểm Tra Định Kỳ

## Mục Đích Màn Hình
Xem tình trạng kiểm tra định kỳ (PERIODIC) theo tháng dưới dạng lịch, xác nhận hạng mục kiểm tra của thiết bị theo ngày và thực hiện kiểm tra. Sử dụng giao diện người dùng giống như lịch kiểm tra hằng ngày nhưng hiển thị dữ liệu loại PERIODIC.

## Bố Cục Màn Hình
- **Trên — Thẻ thống kê**: Tổng hợp hiển thị tổng số lịch kiểm tra trong tháng, số đã hoàn thành, số không đạt và số chưa hoàn thành (trễ hạn).
- **Trái — Lưới lịch**: Hiển thị tình trạng kiểm tra theo ngày trên lịch tháng, được phân biệt bằng màu sắc.
- **Phải — Bảng kiểm tra thiết bị theo ngày**: Hiển thị đối tượng kiểm tra và kết quả theo thiết bị cho ngày đã chọn.

## Phân Biệt Màu Sắc Lịch

| Trạng Thái | Màu Sắc | Ý Nghĩa |
|------|------|------|
| **Tất cả Đạt (ALL_PASS)** | Xanh lá | Tất cả thiết bị trong ngày đã kiểm tra xong, tất cả hạng mục đạt |
| **Có Không Đạt (HAS_FAIL)** | Đỏ | Kết quả kiểm tra trong ngày có chứa FAIL (Không đạt) |
| **Đang Tiến Hành (IN_PROGRESS)** | Vàng | Một số thiết bị đã kiểm tra xong, một số chưa hoàn thành |
| **Chưa Bắt Đầu (NOT_STARTED)** | Xám | Có đối tượng kiểm tra nhưng chưa bắt đầu |
| **Quá Hạn (OVERDUE)** | Viền đỏ | Đã quá hạn kiểm tra nhưng chưa hoàn thành |

## Trình Tự Sử Dụng
1. Nhấp vào ngày trên lịch để chọn.
2. Bảng bên phải hiển thị danh sách đối tượng kiểm tra theo thiết bị cho ngày đó.
3. Nhấp nút **Thực hiện Kiểm tra** hoặc **Sửa đổi** trên thẻ thiết bị.
4. Trong cửa sổ thực hiện kiểm tra, chọn người kiểm tra, nhập phán định PASS/FAIL cho từng hạng mục và nhập lý do lỗi.
5. Sau khi lưu, lịch và bảng sẽ tự động làm mới.

## Màn Hình Liên Quan
- [Kết Quả Kiểm Tra Định Kỳ](/equipment/periodic-inspect) — Màn hình quản lý kết quả kiểm tra định kỳ dưới dạng danh sách
- [Lịch Kiểm Tra Hằng Ngày](/equipment/inspect-calendar) — Màn hình quản lý kiểm tra hằng ngày (DAILY) qua lịch
