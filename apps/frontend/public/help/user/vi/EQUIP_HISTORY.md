---
menuCode: EQUIP_HISTORY
audience: user
title: Tra Cứu Lịch Sử Kiểm Tra
summary: Màn hình tra cứu tổng hợp toàn bộ lịch sử kiểm tra hàng ngày (DAILY) và định kỳ (PERIODIC)
tags: [설비, 점검, 이력, 조회, 통합]
keywords: [EQUIP_HISTORY, 점검이력, 설비점검이력, 통합조회, DAILY, PERIODIC, 검색]
related: [EQUIP_DAILY, EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR, EQUIP_PERIODIC_CALENDAR]
---

# Tra Cứu Lịch Sử Kiểm Tra

## Mục Đích Màn Hình
Tra cứu tổng hợp tất cả lịch sử kiểm tra hàng ngày (DAILY) và định kỳ (PERIODIC). Đây là màn hình chỉ đọc, cho phép tìm kiếm lịch sử mong muốn với nhiều điều kiện lọc khác nhau.

## Bố Cục Màn Hình
- **Khu vực lọc**: Từ khóa + Loại kiểm tra (Hàng ngày/Định kỳ) + Loại thiết bị + Kết quả (Đạt/Không đạt/Có điều kiện) + Khoảng thời gian
- **Danh sách DataGrid**: Hiển thị lịch sử kiểm tra phù hợp với điều kiện tìm kiếm dưới dạng bảng. Hỗ trợ lọc cột và xuất Excel.

## Các Cột DataGrid

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Ngày kiểm tra** | Ngày thực hiện kiểm tra. |
| **Loại kiểm tra** | Phân loại DAILY (Hàng ngày) hoặc PERIODIC (Định kỳ). |
| **Mã thiết bị** | Mã duy nhất của thiết bị được kiểm tra. |
| **Tên thiết bị** | Tên của thiết bị được kiểm tra. |
| **Loại thiết bị** | Phân loại loại thiết bị. |
| **Người kiểm tra** | Tên người thực hiện kiểm tra. |
| **Kết quả** | Kết quả tổng hợp (PASS / FAIL / CONDITIONAL). |
| **Ghi chú** | Ghi chú bổ sung liên quan đến kiểm tra. |

## Trình Tự Sử Dụng
1. Thiết lập điều kiện ở khu vực lọc phía trên (Loại kiểm tra, Loại thiết bị, Kết quả, Khoảng thời gian).
2. Nhấp nút **Tra cứu** để tìm kiếm lịch sử.
3. Xem từng bản ghi trong danh sách kết quả.
4. Nếu cần, có thể tải xuống dữ liệu qua chức năng xuất Excel.

## Điều Kiện Lọc

| Bộ lọc | Mô tả |
|------|------|
| **Từ khóa** | Tìm kiếm theo mã thiết bị hoặc tên thiết bị. |
| **Loại kiểm tra** | Chọn Tất cả / Kiểm tra hàng ngày (DAILY) / Kiểm tra định kỳ (PERIODIC). |
| **Loại thiết bị** | Lọc theo loại thiết bị cụ thể. |
| **Kết quả** | Lọc theo PASS / FAIL / CONDITIONAL. |
| **Khoảng thời gian** | Chọn ngày bắt đầu và ngày kết thúc của ngày kiểm tra. |

## Màn Hình Liên Quan
- [Kiểm Tra Hàng Ngày](/equipment/daily-inspect) — Màn hình nhập kết quả kiểm tra hàng ngày
- [Kiểm Tra Định Kỳ](/equipment/periodic-inspect) — Màn hình nhập kết quả kiểm tra định kỳ
- [Lịch Kiểm Tra Hàng Ngày](/equipment/inspect-calendar) — Xem tình trạng kiểm tra theo lịch
