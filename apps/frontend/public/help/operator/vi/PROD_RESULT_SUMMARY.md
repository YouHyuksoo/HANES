---
menuCode: PROD_RESULT_SUMMARY
audience: operator
title: Tổng hợp kết quả sản xuất — Hướng dẫn vận hành
summary: Tổng hợp kết quả sản xuất theo thành phẩm — số lượng kế hoạch·tốt·lỗi·tỷ lệ đạt·tỷ lệ tốt·tỷ lệ lỗi theo hạng mục
tags: [sản xuất, kết quả, tổng hợp, tra cứu]
keywords: [PROD_RESULTS, JOB_ORDERS, PART_MASTERS, totalPlanQty, totalGoodQty, totalDefectQty, achieveRate, yieldRate, defectRate, kết quả sản xuất, tổng hợp, tỷ lệ tốt, tỷ lệ đạt]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# Tổng hợp kết quả sản xuất — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Tổng hợp kết quả sản xuất theo thành phẩm. Xem tỷ lệ đạt kế hoạch, tỷ lệ tốt và tỷ lệ lỗi trong nháy mắt.

```
JOB_ORDERS(kế hoạch) + PROD_RESULTS(kết quả) → Nhóm theo hạng mục → tỷ lệ đạt·tốt·lỗi
```

## Cấu trúc dữ liệu
```
PROD_RESULTS ← JOB_ORDERS → PART_MASTERS (ITEM_MASTERS)
```

## Bố cục màn hình
- **Header**: Tiêu đề + nút Làm mới
- **Thanh công cụ**: Tìm kiếm(mã·tên hạng mục) + DateRangeFilter (mặc định hôm nay)
- **DataGrid**: `GET /production/prod-results/summary/by-product`

| Cột | Mô tả | Công thức |
|------|-------------|---------|
| Mã hạng mục | `PART_MASTERS.ITEM_CODE` | |
| Tên hạng mục | `PART_MASTERS.ITEM_NAME` | |
| Loại hạng mục | `PART_MASTERS.ITEM_TYPE` | |
| Dây chuyền | `JOB_ORDERS.LINE_CODE` | |
| SL kế hoạch | `SUM(JOB_ORDERS.PLAN_QTY)` | |
| SL tốt | `SUM(PROD_RESULTS.GOOD_QTY)` | |
| SL lỗi | `SUM(PROD_RESULTS.DEFECT_QTY)` | |
| Tổng SX | `tốt + lỗi` | |
| Tỷ lệ đạt | `tốt / kế hoạch × 100` | |
| Tỷ lệ tốt | `tốt / (tốt + lỗi) × 100` | |
| Tỷ lệ lỗi | `lỗi / (tốt + lỗi) × 100` | |
| SL lệnh SX | `COUNT(DISTINCT JOB_ORDERS.ORDER_NO)` | |
| SL kết quả | `COUNT(PROD_RESULTS.RESULT_NO)` | |

## Điều kiện lọc
- **Khoảng thời gian**: `PROD_RESULTS.START_TIME`, mặc định hôm nay
- **Loại trừ**: `PROD_RESULTS.STATUS = 'CANCELED'`
- **Sắp xếp**: SL tốt giảm dần

## Chỉ số chính
| Chỉ số | Ý nghĩa | Mục tiêu |
|------|---------|--------|
| Tỷ lệ đạt | Kế hoạch vs thực tế | 100% ↑ |
| Tỷ lệ tốt | Tỷ lệ sản phẩm tốt | 100% ↑ |
| Tỷ lệ lỗi | Tỷ lệ sản phẩm lỗi | 0% ↓ |

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không có dữ liệu | Không có kết quả trong kỳ | Mở rộng khoảng thời gian |
| Tỷ lệ đạt 0% | Không có SL kế hoạch | Kiểm tra kế hoạch lệnh SX |
| Tỷ lệ tốt 100% | Chưa đăng ký lỗi | Kiểm tra đăng ký DefectLog |

## Dữ liệu & Liên kết
- Bảng: `PROD_RESULTS`, `JOB_ORDERS`, `PART_MASTERS`
- Liên kết: Lệnh SX(`/production/order`) → Nhập kết quả(`/production/input-kiosk`) → **Tổng hợp(hiện tại)**
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
