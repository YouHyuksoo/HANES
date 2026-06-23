---
menuCode: EQUIP_HISTORY
audience: operator
title: Tra Cứu Lịch Sử Kiểm Tra — Hướng Dẫn Vận Hành
summary: Truy vấn tổng hợp lịch sử kiểm tra (DAILY+PERIODIC) trên bảng EQUIP_INSPECT_LOGS, điều kiện lọc, cấu trúc truy vấn backend
tags: [설비, 점검, 이력, 운영, 통합조회, DAILY, PERIODIC]
keywords: [EQUIP_INSPECT_LOGS, EQUIP_HISTORY, 점검이력조회, INSPECT_TYPE, OVERALL_RESULT, 통합조회API, 데이터그리드]
related: [EQUIP_DAILY, EQUIP_PERIODIC]
---

# Tra Cứu Lịch Sử Kiểm Tra — Hướng Dẫn Vận Hành

## Mục Đích & Vai Trò Hệ Thống
Truy vấn tổng hợp tất cả bản ghi (DAILY + PERIODIC) từ bảng `EQUIP_INSPECT_LOGS`. Chỉ đọc; `InspectHistoryController` backend gọi `EquipInspectService.findAll()` mà không có điều kiện `inspectType`, trả về lịch sử của tất cả loại.

## Cấu Trúc Dữ Liệu
```
EQUIP_INSPECT_LOGS (PK: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE)
    │
    ├── INSPECT_TYPE: 'DAILY' hoặc 'PERIODIC' (không điều kiện khi truy vấn → tất cả)
    ├── OVERALL_RESULT: 'PASS' / 'FAIL' / 'CONDITIONAL'
    ├── EQUIP_CODE → EQUIP_MASTERS (JOIN mã·tên·loại thiết bị)
    └── DataGrid frontend hỗ trợ lọc cột·sắp xếp·xuất
```

## Cấu Trúc API

### Truy Vấn Danh Sách Lịch Sử Kiểm Tra
`GET /equipment/inspect-history?search={text}&inspectType={type}&equipType={type}&overallResult={result}&inspectDateFrom={date}&inspectDateTo={date}&limit=5000`

- `search`: Tìm kiếm một phần theo mã hoặc tên thiết bị
- `inspectType`: `'DAILY'` / `'PERIODIC'` (tất cả nếu không chỉ định)
- `equipType`: Giá trị mã chung `EQUIP_TYPE`
- `overallResult`: `'PASS'` / `'FAIL'` / `'CONDITIONAL'`
- `inspectDateFrom` / `inspectDateTo`: Phạm vi ngày kiểm tra

### Tóm Tắt Thống Kê
`GET /equipment/inspect-history/summary` — Dữ liệu thống kê kiểm tra

## Ánh Xạ Cột

| Cột màn hình | Cột DB | JOIN |
|---------|---------|------|
| Ngày kiểm tra | `LOG.INSPECT_DATE` | - |
| Loại kiểm tra | `LOG.INSPECT_TYPE` | - |
| Mã thiết bị | `LOG.EQUIP_CODE` | - |
| Tên thiết bị | `EQ.EQUIP_NAME` | `EQUIP_MASTERS` |
| Loại thiết bị | `EQ.EQUIP_TYPE` | `EQUIP_MASTERS` |
| Người kiểm tra | `LOG.INSPECTOR_NAME` | - |
| Kết quả | `LOG.OVERALL_RESULT` | - |
| Ghi chú | `LOG.REMARK` | - |

## Phân Quyền
Tất cả người dùng có thể truy vấn. Xuất Excel yêu cầu đăng nhập.

## Xử Lý Sự Cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không có kết quả truy vấn | Điều kiện lọc quá hẹp | Mở rộng bộ lọc và truy vấn lại |
| Bộ lọc khoảng thời gian không hoạt động | Định dạng ngày không khớp | Kiểm tra định dạng YYYY-MM-DD |
| Không hiển thị lịch sử thiết bị cụ thể | Thiết bị đã bị xóa hoặc EQUIP_CODE thay đổi | Kiểm tra dữ liệu master thiết bị |
| Xuất Excel thất bại | Quá nhiều dữ liệu | Thu hẹp khoảng thời gian trước khi xuất |

## Dữ Liệu & Liên Kết
- **Bảng**: `EQUIP_INSPECT_LOGS` (tất cả), `EQUIP_MASTERS` (JOIN tên/loại thiết bị)
- **Controller**: `InspectHistoryController` (controller độc lập, inspectType không cố định khi gọi `findAll()`)
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
