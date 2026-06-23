---
menuCode: SHIP_PALLET_SHIP
audience: operator
title: Xuất Hàng Pallet — Hướng Dẫn Vận Hành
summary: Quy trình xác nhận xuất hàng của PALLET_MASTERS·SHIPMENT_LOGS, logic trừ tồn kho, cấu trúc giao dịch và xử lý sự cố
tags: [xuất-hàng, pallet, xác-nhận-xuất-hàng, vận-hành, SHIPPED, tồn-kho]
keywords: [SHIP_PALLET_SHIP, PALLET_MASTERS, SHIPMENT_LOGS, SHIPMENT_ORDER, PALLET_NO, CLOSED, SHIPPED, xác-nhận-xuất-hàng, trừ-FG-tồn-kho, FIFO]
related: [SHIP_ORDER, SHIP_PALLET]
---

# Xuất Hàng Pallet — Hướng Dẫn Vận Hành

## Mục Đích·Vai Trò Hệ Thống
Xử lý pallet ở trạng thái chất xếp xong (CLOSED) thành trạng thái đã xác nhận xuất hàng (SHIPPED). **Tự động đánh số xuất hàng** → Tạo `ShipmentLog` → `PalletMaster.STATUS='SHIPPED'` → `BoxMaster.STATUS='SHIPPED'` → `FgLabel.STATUS='SHIPPED'` → **Trừ tồn kho FG (FIFO)** → Tăng `ShipmentOrderItem.shippedQty` → Khi tất cả mặt hàng đã xuất hết thì `ShipmentOrder.STATUS='CLOSED'`. Toàn bộ được xử lý trong một giao dịch duy nhất.

## Cấu Trúc Dữ Liệu
```
ShipmentOrder (lệnh xuất hàng, STATUS=CONFIRMED)
    │
    ├── ShipmentOrderItem (số lượng xuất theo mặt hàng)
    │
    └── PALLET_MASTERS (PK: COMPANY + PLANT_CD + PALLET_NO)
            │   STATUS: OPEN → CLOSED → SHIPPED
            │   BOX_COUNT, TOTAL_QTY
            │   SHIP_ORDER_NO (→ ShipmentOrder)
            │   SHIPMENT_ID (→ ShipmentLog.SHIP_NO)
            │
            ├── BOX_MASTERS (PK: COMPANY + PLANT_CD + BOX_NO)
            │       STATUS: OPEN → CLOSED → SHIPPED
            │       PART_CODE, QTY
            │
            └── FG_LABELS (khi có serial)
                    STATUS: SHIPPED
```

---

## ① Pallet Master — PALLET_MASTERS (Toàn Bộ Cột)

| Trường màn hình | Cột DB | Vai trò / Ý nghĩa · Điểm vận hành |
|------|------|------|
| Số Pallet | `PALLET_NO` | **PK (3/3)**. Định danh duy nhất của pallet. |
| Số thùng | `BOX_COUNT` | Số thùng đã chất lên pallet. |
| Tổng số lượng | `TOTAL_QTY` | Tổng số lượng sản phẩm (tổng QTY các thùng). |
| Trạng thái | `STATUS` | `OPEN` / `CLOSED` / `LOADED` / `SHIPPED`. Chỉ CLOSED mới xuất được. |
| Thời gian chất xếp xong | `CLOSE_TIME` | Thời điểm pallet chuyển CLOSED. |
| Thời gian xuất hàng | `SHIPPED_TIME` | Thời điểm SHIPPED. |
| Số xuất hàng | `SHIPMENT_ID` | Tham chiếu `ShipmentLog.SHIP_NO` (được gán khi xác nhận xuất). |
| Số lệnh xuất hàng | `SHIP_ORDER_NO` | Tham chiếu `ShipmentOrder.SHIP_ORDER_NO`. |
| Người chất xếp | `LOADED_BY` | Người hoàn tất chất xếp. |
| Đa đối tượng thuê | `COMPANY`, `PLANT_CD` | **PK (1,2/3)**. Mã công ty(`40`)/Mã nhà máy(`1000`). |
| Người tạo | `CREATED_BY` | Người tạo pallet. |
| Người sửa | `UPDATED_BY` | Người sửa cuối cùng. |

---

## ② Nhật ký xuất hàng — SHIPMENT_LOGS (Toàn Bộ Cột)

| Cột DB | Vai trò / Ý nghĩa |
|---------|------|
| `SHIP_NO` | **PK (3/3)**. Số xuất hàng (tự động đánh số từ sequence). |
| `SHIP_DATE` | Ngày xuất hàng. |
| `SHIP_TIME` | Thời gian xuất hàng (thời điểm giao dịch). |
| `DESTINATION` | Điểm đến (tham chiếu lệnh xuất hàng). |
| `CUSTOMER` | Khách hàng (tham chiếu lệnh xuất hàng). |
| `SHIP_ORDER_NO` | Số lệnh xuất hàng. |
| `PALLET_COUNT` | Số pallet xuất hàng. |
| `BOX_COUNT` | Số thùng xuất hàng. |
| `TOTAL_QTY` | Tổng số lượng xuất hàng. |
| `STATUS` | `LOADED`(đã chất xếp để xuất) / `SHIPPED`(đã xác nhận xuất) |
| `ERP_SYNC_YN` | Đồng bộ ERP hay không (`Y`/`N`). |
| `COMPANY`, `PLANT_CD` | **PK (1,2/3)**. |

---

## Chi Tiết Giao Dịch Xác Nhận Xuất Hàng

Khi gọi `POST /shipping/orders/:id/ship-pallets`, `ShipOrderService.shipOrderPallets()` được thực thi:

1. **Giai đoạn xác thực**:
   - Kiểm tra lệnh xuất hàng `status === 'CONFIRMED'`
   - Kiểm tra mặt hàng yêu cầu khớp với mặt hàng trong lệnh xuất
   - Kiểm tra từng `PALLET_NO` có `status === 'CLOSED'`
   - Kiểm tra `shipmentId === null` (chưa xuất)
   - Kiểm tra tất cả thùng dưới pallet đều ở trạng thái `CLOSED` + OQC PASS
   - Kiểm tra danh sách serial khớp với số lượng thùng

2. **Thực thi trong giao dịch**:
   - Sinh số xuất hàng → tạo `ShipmentLog` (status=`LOADED`)
   - Cập nhật `PalletMaster`: `shipmentId=shipNo, status='SHIPPED', shippedTime=now`
   - Cập nhật `BoxMaster`: `status='SHIPPED', shippedAt=now`
   - Cập nhật `FgLabel`: `status='SHIPPED'` (khi có serial)
   - `ProductInventory.issueStockByItemFifoInTx()` — Trừ tồn kho FG theo phương pháp FIFO
   - `ShipmentOrderItem.shippedQty += box.qty`
   - Khi tất cả mặt hàng đã xuất hết, `ShipmentOrder.status = 'CLOSED'`

---

## Luồng Trạng Thái

```
OPEN (tạo pallet)
  │
  ▼
CLOSED (chất xếp xong = sẵn sàng xuất)
  │
  ▼ [Quét + xác nhận xuất trên màn hình Xuất Hàng Pallet]
SHIPPED (đã xác nhận xuất hàng)
  ├── Đã trừ tồn kho
  ├── BoxMaster.STATUS → SHIPPED
  └── Khi tất cả mặt hàng trong lệnh đã xuất → ShipmentOrder.CLOSED
```

---

## Phân Quyền
Quyền xử lý xuất hàng (nhân viên xuất hàng/kho). Tất cả người dùng có quyền xem.

## Xử Lý Sự Cố

| Triệu chứng | Nguyên nhân | Biện pháp |
|------|------|------|
| Danh sách lệnh xuất hàng trống | Không có lệnh ở trạng thái CONFIRMED | Đăng ký lệnh xuất hàng → xử lý xác nhận(phê duyệt) |
| Không quét được pallet | Pallet không ở trạng thái CLOSED | Hoàn tất chất xếp trên màn hình Chất xếp Pallet |
| Lỗi "Pallet đã xuất hàng" | Pallet đã ở trạng thái SHIPPED | Kiểm tra lịch sử xuất hàng |
| Nút Xác nhận xuất hàng bị vô hiệu hóa | Chưa nhập pallet hợp lệ | Quét hoặc nhập số pallet |
| Trừ tồn kho thất bại | Thiếu tồn kho | Kiểm tra tồn kho FG và bổ sung |
| Lỗi không khớp serial | Danh sách serial không khớp với số lượng thùng | Kiểm tra lịch sử quét serial |

## Dữ Liệu·Liên Kết
- **Bảng**: `PALLET_MASTERS`, `BOX_MASTERS`, `SHIPMENT_LOGS`, `SHIPMENT_ORDER`, `SHIPMENT_ORDER_ITEM`, `FG_LABEL`
- **Liên kết**: Tồn kho FG (trừ FIFO), đồng bộ ERP (`ERP_SYNC_YN`)
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
