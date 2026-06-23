---
menuCode: PROD_RESULT
audience: operator
title: Kết quả sản xuất — Hướng dẫn vận hành
summary: Tra cứu·sửa·hủy kết quả sản xuất theo công đoạn — CUT/CRIMP/ASSY/INSP/PACK, hiển thị avatar công nhân, tự động khôi phục tồn kho khi hủy
tags: [sản xuất, kết quả, tra cứu, sửa, hủy]
keywords: [PROD_RESULTS, JOB_ORDERS, RUNNING, DONE, CANCELED, goodQty, defectQty, cycleTime, prdUid, kết quả sản xuất, kết quả công việc, hủy kết quả, khôi phục tồn kho]
related: [PROD_RESULT_SUMMARY, PROD_INPUT_KIOSK, PROD_ORDER]
---

# Kết quả sản xuất — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Tra cứu·sửa·hủy kết quả sản xuất theo công đoạn (CUT/CRIMP/ASSY/INSP/PACK). Hiển thị avatar công nhân. Khi hủy, tự động khôi phục vật tư và tồn kho sản phẩm.

```
RUNNING → DONE (hoàn thành) / CANCELED (hủy → khôi phục tồn kho)
```

## Cấu trúc dữ liệu
```
PROD_RESULTS (PK: RESULT_NO, tự động đánh số)
   ├─ ORDER_NO → JOB_ORDERS (lệnh SX)
   ├─ EQUIP_CODE → EQUIP_MASTER (thiết bị)
   ├─ WORKER_NO → WORKER_MASTERS (công nhân)
   ├─ GOOD_QTY / DEFECT_QTY (tốt/lỗi)
   ├─ START_TIME / END_TIME / CYCLE_TIME
   └─ STATUS: RUNNING → DONE / CANCELED
```

## Bố cục màn hình
- **Header**: Tiêu đề + nút Làm mới
- **Thanh công cụ**: Tìm kiếm (số kết quả·lệnh·UID) + lọc công đoạn (CUT/CRIMP/ASSY/INSP/PACK) + DateRangeFilter (mặc định hôm nay)
- **DataGrid**: `GET /production/prod-results?limit=5000`

| Cột | Mô tả |
|------|-------------|
| Số kết quả | `RESULT_NO` (PK) |
| Ngày làm việc | `START_TIME` |
| Công đoạn | `PROCESS_CODE` (ComCodeBadge) |
| Lệnh SX | `ORDER_NO` |
| Tên hạng mục | `JOB_ORDERS → PART_MASTERS.ITEM_NAME` |
| Dây chuyền | `JOB_ORDERS.LINE_CODE` |
| Thiết bị | `EQUIP_MASTER.EQUIP_NAME` |
| Công nhân | `WORKER_MASTERS` (avatar + tên) |
| UID sản phẩm | `PRD_UID` |
| SL tốt | `GOOD_QTY` (xanh) |
| SL lỗi | `DEFECT_QTY` (đỏ) |
| Tỷ lệ lỗi | `DEFECT_QTY / (GOOD_QTY + DEFECT_QTY) × 100` |
| Thời gian | `START_TIME ~ END_TIME` |
| Chu kỳ | `CYCLE_TIME` (giây) |
| Trạng thái | `STATUS` (RUNNING/DONE/CANCELED) |
| Thao tác | Sửa·Hủy·Xóa |

## Quy trình

### ① Tra cứu
- Lọc theo công đoạn (CUT/CRIMP/ASSY/INSP/PACK)
- Khoảng thời gian (START_TIME)
- Tìm theo lệnh·số kết quả·UID sản phẩm

### ② Sửa
`PUT /production/prod-results/{resultNo} { goodQty, defectQty, remark }`
- Chỉ RUNNING/DONE
- Thay đổi số lượng → tự động đảo ngược/tái phát hành vật tư + điều chỉnh tồn kho

### ③ Hủy
`POST /production/prod-results/{resultNo}/cancel { remark }`
- RUNNING/DONE → CANCELED
- Khôi phục: vật tư, tồn kho sản phẩm, giải phóng thiết bị
- Chặn nếu hạ nguồn đã tiến hành (FG_LABELS·BOX·PALLET·SHIPMENT)

### ④ Xóa
`DELETE /production/prod-results/{resultNo}`
- Chỉ CANCELED

## Quy tắc chính

| Quy tắc | Mô tả |
|------|-------------|
| Tự động trừ vật tư | BOM khi tạo (ON_CREATE) và hoàn thành (ON_COMPLETE) |
| Tải tồn kho tức thì | Tốt→WIP_MAIN, Lỗi→DEFECT |
| Khóa liên động BOM thiết bị | Chặn nếu BOM thiết bị ≠ hạng mục lệnh |
| Tự động thăng hạng lệnh | Kết quả đầu→RUNNING, đạt kế hoạch→auto DONE |
| Tự động gán ca | Qua SHIFT_PATTERNS |
| Đếm số lần khuôn | Tăng CONSUMABLE_MASTER.currentCount khi hoàn thành |

## Khóa liên động

| Điều kiện | Mô tả |
|------|-------------|
| Hủy khi hạ nguồn tồn tại | Chặn nếu FG_LABELS/BOX/PALLET/SHIPMENT tồn tại |
| Đã CANCELED | Chỉ xóa |
| Thay đổi ORDER_NO | Không cho phép |
| Thay đổi STATUS trực tiếp | Phải qua complete/cancel API |

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không có kết quả | Không dữ liệu trong kỳ | Nới lỏng bộ lọc |
| Không hủy được | Đóng gói/xuất hàng đã tiến hành | Kiểm tra hạ nguồn, xử lý ngược |
| Không sửa được | Trạng thái CANCELED | Hủy và làm lại |
| Không tạo được | BOM thiết bị không khớp | Kiểm tra BOM thiết bị |

## Dữ liệu & Liên kết
- Bảng: `PROD_RESULTS`, `JOB_ORDERS`, `EQUIP_MASTER`, `WORKER_MASTERS`, `PART_MASTERS`, `DEFECT_LOGS`, `FG_LABELS`, `SG_LABELS`, `PRODUCT_TRANSACTIONS`, `MAT_ISSUES`, `STOCK_TRANSACTIONS`, `BOX_MASTERS`, `PALLET_MASTERS`, `SHIPMENT_LOGS`
- Liên kết: Lệnh SX(`/production/order`) → **Kết quả SX(hiện tại)** → Tổng hợp(`/production/result-summary`)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
