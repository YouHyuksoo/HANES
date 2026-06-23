---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: operator
title: Lịch Kiểm Tra Định Kỳ — Hướng Dẫn Vận Hành
summary: Màn hình xem lịch và thực hiện kiểm tra PERIODIC, khác biệt với DAILY, cấu trúc API, xử lý khóa liên động
tags: [thiết-bị, kiểm-tra, định-kỳ, lịch, vận-hành, PERIODIC]
keywords: [EQUIP_PERIODIC_CALENDAR, lịch-kiểm-tra-định-kỳ, PERIODIC, INSPECT_TYPE, CALENDAR_DAY_SUMMARY, khóa-liên-động-thiết-bị]
related: [EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR]
---

# Lịch Kiểm Tra Định Kỳ — Hướng Dẫn Vận Hành

## Mục Đích & Vai Trò Hệ Thống
Tái sử dụng 3 thành phần (InspectCalendar, DaySchedulePanel, InspectExecuteModal) giống như lịch kiểm tra hằng ngày (`EQUIP_INSPECT_CALENDAR`) để xem và thực hiện kiểm tra dữ liệu `INSPECT_TYPE='PERIODIC'` trên lịch.

## Khác Biệt So Với Lịch DAILY

| Mục | Lịch Kiểm Tra Hằng Ngày | Lịch Kiểm Tra Định Kỳ |
|------|---------------|----------------|
| **INSPECT_TYPE** | `'DAILY'` | `'PERIODIC'` |
| **Đường dẫn API** | `/equipment/daily-inspect/calendar` | `/equipment/periodic-inspect/calendar` |
| **API Theo Ngày** | `/equipment/daily-inspect/calendar/day` | `/equipment/periodic-inspect/calendar/day` |
| **API Thực Hiện Kiểm Tra** | POST/PUT `/equipment/daily-inspect` | POST/PUT `/equipment/periodic-inspect` |
| **Tiêu đề** | Lịch Kiểm Tra Hằng Ngày | Lịch Kiểm Tra Định Kỳ |
| **Nút Tạo Tháng Hiện/Tiếp** | Có | Không |

## Cấu Trúc API

### Tổng Quan Lịch Tháng
`GET /equipment/periodic-inspect/calendar?year={yyyy}&month={MM}[&processCode={code}]`

Phản hồi: `CalendarDaySummary[]` — total, completed, pass, fail, status cho từng ngày

### Lịch Thiết Bị Theo Ngày
`GET /equipment/periodic-inspect/calendar/day?date={yyyy-MM-dd}[&processCode={code}]`

Phản hồi: `DayScheduleEquip[]` — equipCode, equipName, inspected, overallResult, items[] theo thiết bị

## Chia Sẻ Cửa Sổ Thực Hiện Kiểm Tra
`InspectExecuteModal` nhận `'PERIODIC'` qua prop `inspectType` và thực hiện kiểm tra với cùng giao diện:
- Chọn người kiểm tra (API danh mục công nhân)
- Chuyển đổi PASS/FAIL cho từng hạng mục
- Nhập nguyên nhân/ghi chú khi FAIL
- Kết quả tổng hợp tự động tính toán
- POST (mới) hoặc PUT (sửa đổi) khi lưu

## Xử Lý INTERLOCK
Khi lưu kết quả FAIL, `EquipMaster.status` tự động chuyển thành `'INTERLOCK'` (giống DAILY).

## Phân Quyền
Quyền nhập kết quả kiểm tra (công nhân/quản lý thiết bị). Tất cả người dùng có quyền xem.

## Xử Lý Sự Cố

| Triệu Chứng | Nguyên Nhân | Biện Pháp |
|------|------|------|
| Không có dữ liệu trên lịch | Không có thiết bị kiểm tra PERIODIC trong tháng | Xác nhận thiết bị mục tiêu kiểm tra định kỳ |
| Bảng bên phải trống khi chọn ngày | Không có dữ liệu lịch cho ngày đó | Kiểm tra ánh xạ hạng mục kiểm tra và cài đặt chu kỳ |
| Lưu kiểm tra thất bại | Chưa chọn người kiểm tra hoặc chưa nhập lý do FAIL | Xác nhận đã nhập đủ thông tin bắt buộc |

## Dữ Liệu & Liên Kết
- **Bảng**: `EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC')
- **Thành phần dùng chung**: 3 thành phần từ inspect-calendar/components/
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
