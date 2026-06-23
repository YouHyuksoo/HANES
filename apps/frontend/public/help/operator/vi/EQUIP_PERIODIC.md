---
menuCode: EQUIP_PERIODIC
audience: operator
title: Kiểm Tra Định Kỳ — Hướng Dẫn Vận Hành
summary: Kiểm tra loại PERIODIC trên bảng EQUIP_INSPECT_LOGS, khác biệt với DAILY, xử lý interlock, lập lịch theo chu kỳ
tags: [설비, 점검, 정기, 운영, PERIODIC, 결과, 인터록]
keywords: [EQUIP_INSPECT_LOGS, PERIODIC, 정기점검결과, OVERALL_RESULT, INTERLOCK, CYCLE, QUARTERLY, SEMI_ANNUAL, ANNUAL]
related: [EQUIP_PERIODIC_CALENDAR, EQUIP_DAILY]
---

# Kiểm Tra Định Kỳ — Hướng Dẫn Vận Hành

## Mục Đích & Vai Trò Hệ Thống
Đăng ký, xem và sửa kết quả kiểm tra định kỳ được lưu trong bảng `EQUIP_INSPECT_LOGS` với `INSPECT_TYPE='PERIODIC'`. Sử dụng cùng `EquipInspectService` với kiểm tra hàng ngày (DAILY), `inspectType` được cố định là `'PERIODIC'`.

## Khác Biệt với Kiểm Tra DAILY

| Hạng mục | Kiểm Tra Hàng Ngày (DAILY) | Kiểm Tra Định Kỳ (PERIODIC) |
|------|---------------|-------------------|
| **INSPECT_TYPE** | `'DAILY'` | `'PERIODIC'` |
| **Chu kỳ** | Hàng ngày | MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL |
| **Đường dẫn API** | `/equipment/daily-inspect` | `/equipment/periodic-inspect` |
| **Lọc hạng mục** | `inspectType=DAILY` | `inspectType=PERIODIC` |
| **Controller** | `DailyInspectController` | `PeriodicInspectController` |
| **Service** | `EquipInspectService` (giống) | `EquipInspectService` (giống) |
| **Biểu tượng trang** | `ClipboardCheck` | `CalendarCheck` |
| **Tiêu đề** | Kiểm Tra Hàng Ngày | Kiểm Tra Định Kỳ |

## Điểm Chung với Kiểm Tra Hàng Ngày
- Tái sử dụng component `EquipListPanel`, `InspectEntryPanel`
- Logic lưu kiểm tra: POST (mới) / PUT (sửa)
- Xử lý interlock: Khi FAIL, `EquipMaster.status = 'INTERLOCK'`
- Cấu trúc JSON DETAILS (CLOB) giống nhau

## Lập Lịch Kiểm Tra Định Kỳ

`getCalendarSummary()` và `getDaySchedule()` của `EquipInspectService` xác định thiết bị mục tiêu dựa trên:

| Giá trị CYCLE | Ngày kiểm tra mục tiêu |
|---------|-----------|
| MONTHLY | Ngày 1 hàng tháng |
| QUARTERLY | Ngày đầu quý (1/1, 4/1, 7/1, 10/1) |
| SEMI_ANNUAL | Ngày đầu nửa năm (1/1, 7/1) |
| ANNUAL | Ngày 1 tháng 1 hàng năm |

## Cấu Trúc Dữ Liệu
`EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC') — Sử dụng cùng bảng/cột hoàn toàn như DAILY.

Hạng mục kiểm tra định kỳ được lọc từ `EQUIP_INSPECT_ITEM_POOL` với điều kiện `INSPECT_TYPE='PERIODIC'`.

## Xử Lý Sự Cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Thiết bị không hiển thị trong danh sách kiểm tra định kỳ | Hạng mục PERIODIC chưa được gán cho thiết bị | Vào màn hình Hạng mục Kiểm tra Thiết bị → tab PERIODIC → Thêm |
| Thiết bị không có hạng mục kiểm tra | Không có liên kết PERIODIC trong EQUIP_INSPECT_ITEM_POOL | Đăng ký dữ liệu master sau đó ánh xạ |
| Nút lưu bị vô hiệu hóa | Chưa chọn người kiểm tra hoặc thiếu đánh giá một số hạng mục | Kiểm tra tất cả các trường bắt buộc |
| Không kích hoạt interlock khi lưu FAIL | Ngoại lệ máy chủ hoặc vấn đề giao dịch | Kiểm tra log |

## Dữ Liệu & Liên Kết
- **Bảng**: `EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC'), `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_MASTERS`
- **Component dùng chung**: EquipListPanel, InspectEntryPanel từ daily-inspect/components/
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
