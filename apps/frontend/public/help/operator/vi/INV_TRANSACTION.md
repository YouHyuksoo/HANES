---
menuCode: INV_TRANSACTION
audience: operator
title: Tra cứu Lịch sử Tồn kho — Hướng dẫn vận hành
summary: Toàn bộ cột STOCK_TRANSACTIONS, ý nghĩa theo loại giao dịch, cấu trúc chuỗi hủy và xử lý sự cố
tags: [tồn kho, lịch sử tồn kho, vận hành, tra cứu, giao dịch]
keywords: [STOCK_TRANSACTIONS, TRANS_TYPE, TRANS_NO, CANCEL_REF_ID, lịch sử tồn kho, RECEIVE, MAT_OUT, ADJUST, TRANSFER, SCRAP]
related: [INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Tra cứu Lịch sử Tồn kho — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Tra cứu mọi biến động tồn kho vật tư được ghi trong bảng `STOCK_TRANSACTIONS`. Có thể theo dõi tất cả lịch sử tồn kho như nhập·xuất·di chuyển·điều chỉnh·thanh lý theo loại·ngày; khi hủy, giao dịch gốc và giao dịch hủy được kết nối qua `CANCEL_REF_ID`.

## Cấu trúc dữ liệu
```
STOCK_TRANSACTIONS (PK: TRANS_NO)
    │
    ├── Thông tin cơ bản: TRANS_TYPE, TRANS_DATE, QTY, STATUS
    ├── Kho: FROM_WAREHOUSE_ID → WAREHOUSES, TO_WAREHOUSE_ID → WAREHOUSES
    ├── Mặt hàng/LOT: ITEM_CODE → ITEM_MASTERS, MAT_UID → MAT_LOTS
    ├── Tham chiếu: REF_TYPE + REF_ID (đơn hàng/lệnh sản xuất... tham chiếu gốc)
    └── Chuỗi hủy: CANCEL_REF_ID → STOCK_TRANSACTIONS.TRANS_NO (tự tham chiếu)
        └── Truy ngược bằng CANCEL_REF_ID để tìm giao dịch gốc khi hủy
```

---

## ① Lịch sử Tồn kho — STOCK_TRANSACTIONS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số giao dịch | `TRANS_NO` | **PK**. Khóa tự nhiên. Được tạo theo quy tắc đánh số. |
| Loại giao dịch | `TRANS_TYPE` | Phân loại tồn kho. `RECEIVE`, `MAT_OUT`, `ADJUST_IN`, `TRANSFER`... Hiển thị chip màu trên màn hình. |
| Ngày giao dịch | `TRANS_DATE` | Thời điểm xử lý giao dịch. Mặc định `CURRENT_TIMESTAMP`. |
| Kho xuất | `FROM_WAREHOUSE_ID` | Kho giảm tồn kho (khi xuất·di chuyển). NULL nếu chỉ nhập đơn thuần. |
| Kho nhập | `TO_WAREHOUSE_ID` | Kho tăng tồn kho (khi nhập·di chuyển). NULL nếu chỉ xuất đơn thuần. |
| Mã mặt hàng | `ITEM_CODE` | Mặt hàng biến động. Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| Số LOT | `MAT_UID` | Số serial khi giao dịch theo đơn vị LOT. NULL nếu xử lý theo số lượng. |
| Số lượng | `QTY` | Số lượng biến động. Dương=tăng tồn kho (nhập), Âm=giảm tồn kho (xuất). |
| Đơn giá | `UNIT_PRICE` | Đơn giá mặt hàng (khi nhập). |
| Tổng tiền | `TOTAL_AMOUNT` | Tổng tiền (= QTY × UNIT_PRICE). |
| Loại tham chiếu | `REF_TYPE` | Loại tài liệu gốc. `JOB_ORDER`, `SUBCON_ORDER`, `PO`... |
| ID tham chiếu | `REF_ID` | Số tài liệu gốc. |
| Tham chiếu hủy | `CANCEL_REF_ID` | Nếu giao dịch này là hủy thì là `TRANS_NO` gốc. NULL nếu là giao dịch bình thường. |
| Công nhân | `WORKER_NO` | ID công nhân. |
| Ghi chú | `REMARK` | Ghi chú bổ sung. |
| Trạng thái | `STATUS` | `DONE` (bình thường) / `CANCELED` (đã hủy). Mặc định `DONE`. |
| Tài khoản tồn kho | `ACCOUNT` | Phân loại tài khoản tồn kho dựa trên mã chung. |
| Người phê duyệt | `APPROVER_ID` | Người phê duyệt giao dịch cần phê duyệt như xuất khác. |
| Ngày phê duyệt | `APPROVED_AT` | Thời điểm xử lý phê duyệt. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi mã công ty(`40`) / mã nhà máy(`1000`). |
| Người tạo | `CREATED_BY` | Người đăng ký. |
| Người sửa | `UPDATED_BY` | Người sửa. |
| Ngày tạo | `CREATED_AT` | Thời điểm tạo bản ghi. |
| Ngày sửa | `UPDATED_AT` | Thời điểm sửa bản ghi. |

---

## Chi tiết loại giao dịch (`TRANS_TYPE`)

| Loại | Mô tả | Dấu QTY | Hiệu ứng tồn kho |
|------|------|---------|----------|
| RECEIVE | Nhập vật tư (mua·trả lại) | + | Tăng tồn kho nhập |
| MAT_OUT | Xuất vật tư (sản xuất·sửa chữa) | - | Giảm tồn kho xuất |
| MAT_OUT_CANCEL | Hủy xuất | + | Phục hồi tồn kho xuất |
| ADJUST_IN | Điều chỉnh tăng | + | Tăng tồn kho kho đó |
| ADJUST_OUT | Điều chỉnh giảm | - | Giảm tồn kho kho đó |
| TRANSFER | Di chuyển giữa các kho | N/A | Kho xuất -, Kho nhập + |
| LOT_SPLIT_IN | Chia LOT (nhập) | + | Tăng tồn kho LOT mới được chia |
| LOT_SPLIT_OUT | Chia LOT (xuất) | - | Giảm tồn kho LOT gốc |
| SCRAP | Thanh lý | - | Giảm tồn kho (thanh lý) |
| MISC_IN | Nhập khác | + | Tăng tồn kho nhập |
| PROD_CONSUME | Tiêu thụ sản xuất | - | Giảm tồn kho xuất |
| PROD_CONSUME_CANCEL | Hủy tiêu thụ sản xuất | + | Phục hồi tồn kho xuất |

---

## Cấu trúc chuỗi hủy

Giao dịch hủy được tạo dưới dạng **giao dịch mới**, với `CANCEL_REF_ID` ghi lại `TRANS_NO` gốc:

```
Giao dịch gốc (TRANS_NO = 'RCP-20250101-001', QTY = +100, STATUS = 'DONE')
    ↓ Khi hủy
Giao dịch hủy (TRANS_NO = 'CCL-20250101-001', QTY = -100, STATUS = 'DONE',
                CANCEL_REF_ID = 'RCP-20250101-001')
    ↓ Và
Cập nhật gốc (STATUS = 'CANCELED')
```

Khi xem giao dịch hủy trên màn hình, cột `Giao dịch gốc` hiển thị `TRANS_NO` gốc để có thể truy vết.

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không thấy giao dịch cụ thể | Bộ lọc phạm vi ngày hoặc loại giao dịch đang được áp dụng | Bỏ điều kiện lọc và tra cứu lại |
| Số lượng hiển thị là 0 | Sau khi hủy, trạng thái gốc chuyển thành CANCELED | Kiểm tra chuỗi hủy bằng `CANCEL_REF_ID` |
| Không hiển thị tên kho | `FROM_WAREHOUSE_ID` hoặc `TO_WAREHOUSE_ID` là NULL | Nhập/xuất đơn thuần chỉ có một trong hai kho |
| RECEIVE nhưng số lượng âm | Giao dịch hủy được tạo với loại RECEIVE | Xác nhận gốc bằng `CANCEL_REF_ID` |

## Dữ liệu & Liên kết
- **Bảng**: `STOCK_TRANSACTIONS` (lịch sử tồn kho), `MAT_STOCKS` (tồn kho), `MAT_LOTS` (LOT)
- **Liên kết**: `ITEM_MASTERS`, `WAREHOUSES`, tài liệu gốc như đơn đặt hàng/lệnh sản xuất...
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
