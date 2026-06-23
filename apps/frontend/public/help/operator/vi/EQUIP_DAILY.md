---
menuCode: EQUIP_DAILY
audience: operator
title: Kiểm Tra Hằng Ngày — Hướng Dẫn Vận Hành
summary: Kiểm tra loại DAILY của bảng EQUIP_INSPECT_LOGS, cơ chế INTERLOCK, logic tự động phán định loại đo lường và xử lý sự cố
tags: [thiết-bị, kiểm-tra, hằng-ngày, vận-hành, DAILY, kết-quả, khóa-liên-động]
keywords: [EQUIP_INSPECT_LOGS, DAILY, kết-quả-kiểm-tra-hằng-ngày, OVERALL_RESULT, INTERLOCK, VISUAL, MEASURE, LSL, USL, DETAILS, CLOB]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM]
---

# Kiểm Tra Hằng Ngày — Hướng Dẫn Vận Hành

## Mục Đích & Vai Trò Hệ Thống
Đăng ký, xem và sửa đổi kết quả kiểm tra hằng ngày được lưu trong bảng `EQUIP_INSPECT_LOGS` với `INSPECT_TYPE='DAILY'`. Nếu kết quả kiểm tra là FAIL, trạng thái thiết bị liên kết tự động chuyển thành **INTERLOCK (khóa liên động)** để hạn chế vận hành thiết bị.

## Cấu Trúc Dữ Liệu
```
EQUIP_INSPECT_LOGS (PK: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE)
    │
    ├── INSPECT_TYPE = 'DAILY' (cố định)
    ├── OVERALL_RESULT = 'PASS' | 'FAIL' | 'CONDITIONAL'
    ├── DETAILS (CLOB): Mảng JSON kết quả từng hạng mục
    ├── INSPECTOR_NAME & INSPECT_AT
    │
    ├──▶ EquipMaster.status = 'INTERLOCK' (tự động khi FAIL)
    │
    └── Liên kết: EQUIP_INSPECT_ITEM_POOL → EQUIP_INSPECT_ITEM_MASTERS
              (Hạng mục kiểm tra DAILY của thiết bị)
```

---

## ① Nhật Ký Kiểm Tra — EQUIP_INSPECT_LOGS (Toàn Bộ Cột — DAILY)

| Trường Màn Hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã Thiết Bị | `EQUIP_CODE` | **PK (1/6)**. Thiết bị riêng lẻ. |
| Loại Kiểm Tra | `INSPECT_TYPE` | **PK (2/6)**. Cố định là `'DAILY'`. |
| Ngày Kiểm Tra | `INSPECT_DATE` | **PK (3/6)**. Ngày thực hiện kiểm tra. |
| Số Lệnh SX | `ORDER_NO` | Dùng cho kiểm tra WORKER (DAILY thường là null). |
| Ngày Sản Xuất | `WORK_DATE` | Khóa nghiệp vụ cho kiểm tra DAILY (theo ngày sản xuất). |
| Thời Gian Kiểm Tra | `INSPECT_AT` | Thời gian hoàn thành kiểm tra thực tế (TIMESTAMP). |
| Thời Gian BĐ Vận Hành | `OP_WINDOW_START_AT` | Thời gian bắt đầu làm việc trong ngày (liên kết WorkCalendar). |
| Thời Gian KT Vận Hành | `OP_WINDOW_END_AT` | Thời gian kết thúc làm việc trong ngày (liên kết WorkCalendar). |
| Tên Người Kiểm Tra | `INSPECTOR_NAME` | Tên người thực hiện kiểm tra. |
| Kết Quả Tổng Hợp | `OVERALL_RESULT` | `PASS`(Đạt) / `FAIL`(Không đạt) / `CONDITIONAL`(Có điều kiện). |
| Kết Quả Từng Mục | `DETAILS` | CLOB — Mảng JSON phán định từng hạng mục. |
| Ghi Chú | `REMARK` | Ghi chú liên quan đến kiểm tra. |
| Đa đối tượng thuê | `COMPANY`, `PLANT_CD` | **PK (4,5,6/6)**. Mã công ty (`40`) / Mã nhà máy (`1000`). |
| Người Tạo | `CREATED_BY` | Người đăng ký ban đầu. |
| Người Sửa | `UPDATED_BY` | Người sửa đổi cuối cùng. |
| Ngày Tạo | `CREATED_AT` | Thời gian tạo bản ghi. |
| Ngày Sửa | `UPDATED_AT` | Thời gian sửa bản ghi. |

---

## Cấu Trúc JSON DETAILS (CLOB)

Kết quả kiểm tra từng hạng mục được lưu dưới dạng mảng JSON trong cột CLOB:

```json
[
  {
    "itemCode": "EI-DAILY-001",
    "itemName": "Kiểm tra nút dừng khẩn cấp",
    "itemType": "VISUAL",
    "result": "PASS",
    "criteria": "Xác nhận hoạt động bình thường",
    "remark": "",
    "measureValue": null,
    "lsl": null,
    "usl": null
  },
  {
    "itemCode": "EI-DAILY-002",
    "itemName": "Đồng hồ áp suất chính",
    "itemType": "MEASURE",
    "result": "FAIL",
    "criteria": "5.0 ~ 7.0 kgf/cm²",
    "remark": "Áp suất 4.2, dưới giới hạn dưới",
    "measureValue": 4.2,
    "lsl": 5.0,
    "usl": 7.0
  }
]
```

---

## Cơ Chế INTERLOCK (Khóa Liên Động)

| Điều Kiện | Hành Động | Phương Thức Giải Phóng |
|------|------|----------|
| `OVERALL_RESULT = 'FAIL'` | `EquipMaster.status` → `'INTERLOCK'` tự động | Cần quy trình giải phóng riêng |
| `OVERALL_RESULT = 'PASS'` | `EquipMaster.status` → `'NORMAL'` tự động (nếu trạng thái trước đó là INTERLOCK) | Tự động |
| `OVERALL_RESULT = 'CONDITIONAL'` | Không thay đổi trạng thái thiết bị | - |

---

## Logic Tự Động Phán Định

### Tự Động Phán Định Loại Đo Lường (MEASURE)
```
if measureValue < LSL → FAIL (dưới giới hạn dưới)
if measureValue > USL → FAIL (vượt giới hạn trên)
if LSL <= measureValue <= USL → PASS (phạm vi bình thường)
```
- Người dùng cũng có thể chọn thủ công OK/NG

### Loại Phán Định (VISUAL)
- Người dùng trực tiếp chọn OK hoặc NG

---

## Phân Quyền
Quyền nhập kết quả kiểm tra thiết bị (công nhân/quản lý thiết bị). Tất cả người dùng có quyền xem.

## Xử Lý Sự Cố

| Triệu Chứng | Nguyên Nhân | Biện Pháp |
|------|------|------|
| Danh sách thiết bị bên trái trống | Chưa liên kết hạng mục kiểm tra DAILY cho thiết bị | Thêm hạng mục từ màn hình hạng mục kiểm tra theo thiết bị |
| Lưu kiểm tra thất bại | Chưa chọn người kiểm tra hoặc chưa nhập phán định mục | Xác nhận tất cả trường bắt buộc đã được nhập |
| Lưu FAIL nhưng thiết bị không INTERLOCK | Ngoại lệ logic dịch vụ hoặc lỗi giao dịch | Kiểm tra nhật ký và xử lý INTERLOCK thủ công |
| Nhập giá trị đo không tự động phán định | LSL/USL chưa được đặt trong danh mục | Đặt LSL/USL trong danh mục hạng mục kiểm tra |
| Nút lưu bị vô hiệu hóa | Chưa chọn người kiểm tra hoặc thiếu phán định một số mục | Đảm bảo tất cả trường đã được nhập đầy đủ |
| Lưu trùng lặp cùng thiết bị·ngày | Đã tồn tại bản ghi đã hoàn thành kiểm tra | Xử lý bằng cách sửa đổi (PUT) |

## Dữ Liệu & Liên Kết
- **Bảng**: `EQUIP_INSPECT_LOGS` (kết quả kiểm tra), `EQUIP_INSPECT_ITEM_POOL` (ánh xạ), `EQUIP_INSPECT_ITEM_MASTERS` (tiêu chuẩn hạng mục), `EQUIP_MASTERS` (trạng thái thiết bị)
- **Liên kết**: Chia sẻ dữ liệu với popup màn hình kết quả sản xuất, thay đổi trạng thái INTERLOCK thiết bị
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
