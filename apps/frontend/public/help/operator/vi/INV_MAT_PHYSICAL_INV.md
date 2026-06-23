---
menuCode: INV_MAT_PHYSICAL_INV
audience: operator
title: Quản lý Kiểm kê Vật tư — Hướng dẫn vận hành
summary: Toàn bộ cột PHYSICAL_INV_SESSIONS + COUNT_DETAILS, quy trình kiểm kê (phiên→quét→phản ánh), cơ chế đóng băng tồn kho
tags: [tồn kho, kiểm kê, vận hành, phiên, đóng băng]
keywords: [PHYSICAL_INV_SESSIONS, PHYSICAL_INV_COUNT_DETAILS, kiểm kê, IN_PROGRESS, InventoryFreezeGuard, quét PDA, bắt đầu phiên, kết thúc phiên, phản ánh kiểm kê, MAT_STOCKS]
related: [INV_MAT_PHYSICAL_INV_APPLY, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Quản lý Kiểm kê Vật tư — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Quản lý phiên **Kiểm kê (Physical Inventory)** để tìm chênh lệch giữa tồn kho thực tế và tồn kho hệ thống. Khi bắt đầu phiên kiểm kê, giao dịch tồn kho của kho đó bị chặn (`InventoryFreezeGuard`) và có thể quét số lượng kiểm kê theo mặt hàng bằng PDA. Sau khi hoàn tất phiên, phản ánh kết quả kiểm kê vào tồn kho.

## Cấu trúc dữ liệu
```
PHYSICAL_INV_SESSIONS (PK: SESSION_DATE + SEQ)
    │
    ├── STATUS: IN_PROGRESS → COMPLETED
    ├── INV_TYPE: MATERIAL / PRODUCT
    │
    └──▶ PHYSICAL_INV_COUNT_DETAILS (PK: SESSION_DATE + SEQ + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
            │
            ├── SYSTEM_QTY (ảnh chụp nhanh tại thời điểm bắt đầu)
            ├── COUNTED_QTY (quét PDA tích lũy)
            └──▶ Khi phản ánh → Cập nhật MAT_STOCKS + STOCK_TRANSACTIONS + INV_ADJ_LOGS
```

---

## ① Phiên Kiểm kê — PHYSICAL_INV_SESSIONS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Ngày phiên | `SESSION_DATE` | **PK (1/2)**. Ngày tạo phiên. Tự động tạo (`SYSDATE`). |
| Số thứ tự | `SEQ` | **PK (2/2)**. Đánh số sequence. |
| Loại kiểm kê | `INV_TYPE` | `MATERIAL`(vật tư) / `PRODUCT`(sản phẩm). |
| Trạng thái | `STATUS` | `IN_PROGRESS`(đang tiến hành) / `COMPLETED`(hoàn tất) / `CANCELLED`(đã hủy). |
| Năm tháng chuẩn | `COUNT_MONTH` | Tháng kiểm kê. Định dạng `YYYY-MM`. |
| Mã kho | `WAREHOUSE_CODE` | Kho kiểm kê (NULL=toàn bộ). |
| Công ty | `COMPANY` | Đa khách hàng. |
| Nhà máy | `PLANT_CD` | Đa khách hàng. |
| Người bắt đầu | `STARTED_BY` | Người dùng bắt đầu phiên. |
| Người hoàn tất | `COMPLETED_BY` | Người dùng hoàn tất phiên. |
| Ngày hoàn tất | `COMPLETED_AT` | Thời điểm hoàn tất phiên. |
| Ghi chú | `REMARK` | Ghi nhớ. |
| Ngày tạo | `CREATED_AT` | Thời điểm tạo bản ghi. |
| Ngày sửa | `UPDATED_AT` | Thời điểm sửa bản ghi. |

---

## ② Chi tiết Kiểm kê — PHYSICAL_INV_COUNT_DETAILS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Ngày phiên | `SESSION_DATE` | **PK (1/5)**. Tham chiếu phiên cấp trên. |
| SEQ phiên | `SEQ` | **PK (2/5)**. Tham chiếu phiên cấp trên. |
| Mã kho | `WAREHOUSE_CODE` | **PK (3/5)**. |
| Mã mặt hàng | `ITEM_CODE` | **PK (4/5)**. |
| Serial vật tư | `MAT_UID` | **PK (5/5)**. Serial LOT. |
| Mã vị trí | `LOCATION_CODE` | Vị trí khi quét PDA. |
| Số lượng hệ thống | `SYSTEM_QTY` | Ảnh chụp nhanh số lượng tồn kho hệ thống tại thời điểm bắt đầu phiên. |
| Số lượng kiểm kê | `COUNTED_QTY` | Số lượng kiểm kê tích lũy từ quét PDA. |
| Người quét | `COUNTED_BY` | Người dùng quét lần cuối. |
| Vị trí thực tế | `ACTUAL_LOCATION` | Vị trí đặt thực tế đã xác nhận (dùng để điều chỉnh). |
| Ghi chú | `REMARK` | Ghi nhớ. |
| Ngày tạo | `CREATED_AT` | |
| Ngày sửa | `UPDATED_AT` | |

---

## Cơ chế đóng băng tồn kho (Freeze)

Trong khi phiên kiểm kê ở trạng thái `IN_PROGRESS`, `InventoryFreezeGuard` được áp dụng và chặn các giao dịch sau:

| Đối tượng chặn | Chi tiết |
|----------|------|
| Nhập vật tư | `POST /material/receiving` |
| Xuất vật tư | `POST /material/issue` |
| Điều chỉnh tồn kho | `POST /material/adjustment` |
| Chia/Gộp LOT | API liên quan |
| Di chuyển tồn kho | API liên quan |

> Đóng băng hoạt động bằng cách kiểm tra xem có dòng `IN_PROGRESS` trong `PHYSICAL_INV_SESSIONS` hay không. Tự động gỡ bỏ khi hoàn tất hoặc hủy phiên.

---

## Toàn bộ quy trình kiểm kê

```
1. [PC] Bắt đầu phiên → POST /material/physical-inv/session/start
    → INSERT PHYSICAL_INV_SESSIONS (IN_PROGRESS)
    → Bắt đầu chặn giao dịch tồn kho

2. [PDA] Quét hiện trường → POST /material/physical-inv/count
    → UPSERT PHYSICAL_INV_COUNT_DETAILS (countedQty tích lũy +1)
    → Quét lặp lại để tích lũy số lượng kiểm kê

3. [PC] Kết thúc phiên → POST /material/physical-inv/session/:date/:seq/complete
    → UPDATE PHYSICAL_INV_SESSIONS (COMPLETED)
    → Gỡ chặn giao dịch tồn kho

4. [PC] Phản ánh kiểm kê → POST /material/physical-inv
    → Cập nhật MAT_STOCKS.qty
    → STOCK_TRANSACTIONS (PHYSCOUNT_IN/OUT)
    → INV_ADJ_LOGS (PHYSICAL_COUNT)
```

---

## Phân quyền
Người dùng có quyền quản lý kiểm kê (quản trị viên vật tư/chất lượng). Quét PDA là công nhân hiện trường.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Lỗi "Đã có phiên đang tiến hành" | Đã tồn tại phiên IN_PROGRESS cùng loại | Hoàn tất phiên hiện tại rồi bắt đầu lại |
| Không nhập/xuất/điều chỉnh được (403) | Phiên kiểm kê đang IN_PROGRESS | Kết thúc hoặc hủy kiểm kê |
| Không quét PDA được | Không có phiên hoạt động hoặc kho không khớp | Xác nhận bắt đầu phiên và kiểm tra khớp kho |
| Số lượng kiểm kê hiển thị 0 | Chưa quét từ PDA hoặc UPSERT thất bại | Kiểm tra kết nối PDA và quét lại |
| Cột chênh lệch không tính | `countedQty` là NULL | Làm mới sau khi hoàn tất quét PDA |

## Dữ liệu & Liên kết
- **Bảng**: `PHYSICAL_INV_SESSIONS`, `PHYSICAL_INV_COUNT_DETAILS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `INV_ADJ_LOGS`
- **Liên kết**: Kết nối PDA (POST /count), trang Phản ánh Kiểm kê (Apply), Đóng băng tồn kho (InventoryFreezeGuard)
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
