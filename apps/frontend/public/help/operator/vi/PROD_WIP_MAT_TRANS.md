---
menuCode: PROD_WIP_MAT_TRANS
audience: operator
title: Xuất Nhập Vật Tư Công Đoạn — Hướng Dẫn Vận Hành
summary: Tham chiếu đầy đủ cột WIP_MAT_TRANSACTIONS, ý nghĩa loại giao dịch công đoạn, cấu trúc liên kết tồn kho WIP và xử lý sự cố
tags: [sản xuất, WIP, công đoạn, xuất nhập, vận hành, thiết bị]
keywords: [WIP_MAT_TRANSACTIONS, WIP_MAT_STOCKS, xuất nhập công đoạn, WIP_IN, PROD_CONSUME, CANCEL_REF_ID, tồn kho thiết bị, EQUIP_CODE, ITEM_MASTERS, EQUIP_MASTERS]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# Xuất Nhập Vật Tư Công Đoạn — Hướng Dẫn Vận Hành

## Mục Đích·Vai Trò Hệ Thống
Tra cứu tất cả giao dịch tồn kho WIP nguyên vật liệu được quản lý theo thiết bị (công đoạn) từ bảng `WIP_MAT_TRANSACTIONS`. Mỗi khi nguyên vật liệu được nhập vào `WIP_MAT_STOCKS` (tồn kho công đoạn) hoặc tiêu hao trong sản xuất, giao dịch được tự động ghi lại. Khi hủy, giao dịch hủy được liên kết với giao dịch gốc qua `CANCEL_REF_ID`, hỗ trợ theo dõi minh bạch và kiểm toán dòng tồn kho công đoạn.

## Cấu Trúc Dữ Liệu
```
WIP_MAT_TRANSACTIONS (PK: TRANS_NO — WTXYYMMDD-NNNNN)
    │
    ├── Thông tin cơ bản: TRANS_TYPE, QTY, STATUS
    ├── Thiết bị: EQUIP_CODE → EQUIP_MASTERS (equipName)
    ├── Mặt hàng/LOT: ITEM_CODE → ITEM_MASTERS, MAT_UID → MAT_LOTS
    ├── Tham chiếu: REF_TYPE + REF_ID (ORDER_NO v.v.)
    └── Chuỗi hủy: CANCEL_REF_ID → WIP_MAT_TRANSACTIONS.TRANS_NO
            │
            └── WIP_MAT_STOCKS (PK: COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + MAT_UID)
                    ├── QTY (tổng tồn kho công đoạn)
                    ├── AVAILABLE_QTY (khả dụng)
                    └── RESERVED_QTY (đã đặt trước)
```

---

## ① Giao Dịch Công Đoạn — WIP_MAT_TRANSACTIONS (Toàn Bộ Cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Điểm vận hành |
|------|------|------|
| Số giao dịch | `TRANS_NO` | **PK**. Định danh duy nhất giao dịch công đoạn. Định dạng: `WTXYYMMDD-NNNNN`. |
| Loại giao dịch | `TRANS_TYPE` | `WIP_IN` / `WIP_IN_CANCEL` / `PROD_CONSUME` / `PROD_CONSUME_CANCEL`. |
| Mã thiết bị | `EQUIP_CODE` | Thiết bị nơi giao dịch phát sinh. Tham chiếu `EQUIP_MASTERS.EQUIP_CODE`. |
| Mã mặt hàng | `ITEM_CODE` | Nguyên vật liệu giao dịch. Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| Số LOT | `MAT_UID` | Số serial LOT. Tham chiếu `MAT_LOTS.MAT_UID`. |
| Số lượng | `QTY` | Số lượng biến động. WIP_IN(+), PROD_CONSUME(-), hủy thì ngược dấu. |
| Kho xuất | `FROM_WAREHOUSE_ID` | Kho nguyên vật liệu cấp cho WIP_IN. |
| Số lệnh SX | `ORDER_NO` | Số lệnh sản xuất (ProdOrder) liên quan. |
| Loại tham chiếu | `REF_TYPE` | Loại tài liệu gốc (ví dụ: WORK_ORDER). |
| ID tham chiếu | `REF_ID` | Số tài liệu gốc. |
| Tham chiếu hủy | `CANCEL_REF_ID` | Tham chiếu `TRANS_NO` gốc khi hủy. NULL = giao dịch bình thường. |
| Trạng thái | `STATUS` | `DONE`(bình thường) / `CANCELED`(đã hủy). Mặc định `DONE`. |
| Ghi chú | `REMARK` | Ghi chú bổ sung. |
| Công nhân | `WORKER_NO` | ID công nhân xử lý giao dịch. |
| Đa khách thuê | `COMPANY`, `PLANT_CD` | Phạm vi mã công ty(`40`) / mã nhà máy(`1000`). |
| Thời gian tạo | `CREATED_AT` | Thời điểm đăng ký giao dịch. Hiển thị ở cột thời gian. |
| Thời gian sửa | `UPDATED_AT` | Thời điểm sửa cuối cùng. |

---

## Chi Tiết Loại Giao Dịch

| Loại | Mô tả | Dấu QTY | Ảnh hưởng WIP_MAT_STOCKS |
|------|-------|---------|-------------------|
| WIP_IN | Đưa nguyên vật liệu từ kho vào thiết bị (công đoạn) | + | Tồn kho công đoạn tăng |
| WIP_IN_CANCEL | Hủy WIP_IN — trả nguyên vật liệu về kho | - | Tồn kho công đoạn giảm |
| PROD_CONSUME | Tiêu hao nguyên vật liệu trong sản xuất tại thiết bị | - | Tồn kho công đoạn giảm |
| PROD_CONSUME_CANCEL | Hủy PROD_CONSUME — hoàn lại nguyên vật liệu | + | Tồn kho công đoạn tăng |

---

## Cấu Trúc Liên Kết Tồn Kho WIP

Mối quan hệ giữa các phương thức service và loại giao dịch được tạo:

| Phương thức Service | TRANS_TYPE được tạo | Ảnh hưởng WIP_MAT_STOCKS |
|-------------|-------------------|----------------|
| `addStockInTx()` | WIP_IN | `QTY` +, `AVAILABLE_QTY` + |
| `deductStockInTx()` | PROD_CONSUME | Khấu trừ FIFO (có thể chỉ định ưu tiên LOT) |
| `restoreInTx(ADD_BACK)` | WIP_IN_CANCEL | Khôi phục khi hủy |
| `restoreInTx(DEDUCT_BACK)` | PROD_CONSUME_CANCEL | Khôi phục khi hủy |

> `addStockInTx` thực hiện UPSERT trên `WIP_MAT_STOCKS` — nếu chưa có bản ghi cho tổ hợp `EQUIP_CODE + ITEM_CODE + MAT_UID` thì tạo mới, nếu có thì cộng dồn.

---

## Cấu Trúc Chuỗi Hủy

```
WIP_IN gốc (TRANS_NO = 'WTX20250601-00001', QTY = +100)
    │
    ├── Khi hủy → tạo WIP_IN_CANCEL (QTY = -100, CANCEL_REF_ID = TRANS_NO gốc)
    │               Gốc STATUS = 'CANCELED'
    │
    └── WIP_MAT_STOCKS: số lượng LOT đó -100
```

---

## Xử Lý Sự Cố

| Triệu chứng | Nguyên nhân | Biện pháp |
|------|------|------|
| Không có kết quả | Bộ lọc quá hẹp (thiết bị/loại/ngày) | Đặt lại bộ lọc hoặc mở rộng phạm vi |
| Giao dịch thiết bị cụ thể không hiển thị | Bộ lọc thiết bị đang chọn sai | Kiểm tra bộ lọc chọn thiết bị |
| Số lượng là 0 hoặc NULL | Giao dịch gốc đã bị hủy | Kiểm tra chuỗi hủy qua `CANCEL_REF_ID` |
| Số LOT không hiển thị | `MAT_UID` là NULL cho giao dịch này | Giao dịch không áp dụng LOT (xử lý theo số lượng) |
| Ghi chú trống | `REMARK` không có giá trị | Không bắt buộc, bình thường |

## Dữ Liệu·Liên Kết
- **Bảng**: `WIP_MAT_TRANSACTIONS` (sổ cái giao dịch), `WIP_MAT_STOCKS` (tồn kho công đoạn), `EQUIP_MASTERS` (thiết bị), `ITEM_MASTERS` (mặt hàng)
- **Liên kết**: Lệnh sản xuất (`PROD_ORDER`), nhập/xuất kho nguyên vật liệu, nhập kết quả sản xuất
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
- **Đánh số**: `SEQ_WIP_TX.NEXTVAL` → định dạng `WTXYYMMDD-NNNNN`
