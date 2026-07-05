---
menuCode: MAT_LOT_MERGE
audience: operator
title: Gộp LOT vật tư — Hướng dẫn vận hành
summary: Cấu trúc DB gộp LOT vật tư (MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS), logic gộp (hủy bỏ gốc và đánh số serial mới), điều kiện gating, API, phạm vi đa khách hàng
tags: [vật tư, LOT, gộp, vận hành, DB, serial, nhập xuất]
keywords: [gộp lô, gộp LOT, gộp vật tư, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, MAT_UID, INIT_QTY, CURRENT_QTY, ARRIVAL_NO, ORIGIN, STATUS, MERGED, LOT_MERGE_IN, LOT_MERGE_OUT, gating nhập kho hoàn tất, đánh số, SEQ_MAT_SERIAL_DAILY, STOCK_TX, đa khách hàng, COMPANY, PLANT_CD, lot-split]
related: [MAT_LOT_SPLIT, MAT_ARRIVAL, QC_IQC]
---

# Gộp LOT vật tư — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình gộp nhiều LOT vật tư (`MAT_LOTS`) của cùng hạng mục·cùng đợt nhập hàng thành **một serial hợp nhất mới**. Khi gộp, tất cả LOT gốc bị hủy bỏ (`STATUS='MERGED'`, tồn kho 0) và **1 `MAT_UID` mới** có tổng số lượng được đánh số. Tồn kho (`MAT_STOCKS`) và sổ cái nhập xuất (`STOCK_TRANSACTIONS`) được cập nhật nhất quán theo đơn vị giao dịch. Đây là thao tác đối xứng với chia LOT, hỗ trợ tái gia công chia/gộp (kết quả chia có thể gộp lại, kết quả gộp có thể chia lại).

Cơ sở thiết kế: `docs/specs/2026-06-08-lot-split-merge-redesign-design.md`.

## Cấu trúc dữ liệu
```
MAT_LOTS (PK: MAT_UID)                      ← Theo dõi LOT·trạng thái
  STATUS: NORMAL → MERGED(hủy bỏ gốc)
  ORIGIN: Kế thừa serial đầu tiên để theo dõi chia·gộp
       │
       ├─ MAT_STOCKS (PK: COMPANY+PLANT_CD+WAREHOUSE_CODE+ITEM_CODE+MAT_UID)
       │     QTY / AVAILABLE_QTY / RESERVED_QTY  ← Tồn kho hiện tại (số lượng cơ sở gộp)
       │
       └─ STOCK_TRANSACTIONS (PK: TRANS_NO)      ← Sổ cái nhập xuất
             TRANS_TYPE: LOT_MERGE_OUT(xuất gốc) / LOT_MERGE_IN(nhập mới)
             REF_TYPE='LOT_MERGE', REF_ID=ORIGIN

Tham chiếu kiểm tra: MAT_ISSUE(lịch sử xuất kho), PART_MASTER(hạng mục), PARTNER_MASTER(nhà cung cấp)
```

> Số lượng gộp được dựa trên `MAT_STOCKS.QTY` (tồn kho hiện tại). Không phải `MAT_LOTS.CURRENT_QTY` mà cộng tồn kho thực tế.

---

## ① Danh sách LOT có thể gộp — MAT_LOTS + MAT_STOCKS (lưới)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Serial vật tư | `MAT_LOTS.MAT_UID` | PK. Khóa nhận dạng đối tượng gộp (mã vạch nhãn). |
| Mã hạng mục | `MAT_LOTS.ITEM_CODE` | Tham chiếu `PART_MASTER.ITEM_CODE`. Chỉ cho phép gộp cùng `ITEM_CODE`. |
| Tên hạng mục | `PART_MASTER.ITEM_NAME` | Gắn JOIN từ `attachMeta` (không phải cột). |
| Số lượng | `MAT_STOCKS.QTY` | Số lượng tồn kho hiện tại. Giá trị cơ sở để cộng dồn gộp. Gắn từ `attachMeta`. |
| Số nhập hàng | `MAT_LOTS.ARRIVAL_NO` | Chỉ gộp được LOT cùng số nhập hàng (kế thừa nhãn/thông tin nhập hàng). NULL thì không thể gộp. |
| Nhà cung cấp | `MAT_LOTS.VENDOR` | Mã nhà cung cấp. JOIN `PARTNER_MASTER.PARTNER_NAME` hiển thị thành `vendorName`. |
| Serial đầu tiên(nội bộ) | `MAT_LOTS.ORIGIN` | Theo dõi chia·gộp. LOT mới kế thừa (`base.origin || base.matUid`). Khóa sắp xếp lưới. |
| Đơn vị(nội bộ) | `PART_MASTER.UNIT` | Đơn vị hiển thị số lượng. Gắn từ `attachMeta`. |

> Điều kiện gating danh sách(`findMergeableLots`): `MAT_STOCKS.QTY > 0` AND `MAT_LOTS.STATUS='NORMAL'` AND `NVL(RESERVED_QTY,0)=0` AND **Nhập kho hoàn tất**(xem logic dưới).

---

## ② LOT vật tư — MAT_LOTS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| UID vật tư | `MAT_UID` (varchar2 50) | PK. Serial. LOT gộp mới được đánh số bằng `SEQ_MAT_SERIAL_DAILY` (`VH1-RM...`). |
| Mã hạng mục | `ITEM_CODE` (varchar2 50) | Hạng mục. LOT mới kế thừa hạng mục gốc. |
| Số lượng ban đầu | `INIT_QTY` (int) | Số lượng gốc bất biến. LOT mới tạo với `totalQty`(số lượng tổng cộng). Tiêu chuẩn so sánh gating nhập kho hoàn tất. |
| Số lượng hiện tại | `CURRENT_QTY` (int) | Số dư hiện tại. Gốc cập nhật thành 0 khi gộp, mới là `totalQty`. |
| Ngày nhập kho | `RECV_DATE` (date) | LOT mới kế thừa giá trị LOT quét đầu tiên (base). |
| Ngày sản xuất | `MANUFACTURE_DATE` (date) | LOT mới kế thừa base. |
| Hạn dùng | `EXPIRE_DATE` (date) | LOT mới kế thừa **ngày sớm nhất** trong các LOT gốc (bảo thủ). |
| Số nhập hàng | `ARRIVAL_NO` (varchar2 50) | Khóa cốt lõi gộp. Tất cả LOT gốc phải giống nhau. LOT mới kế thừa. |
| SEQ nhập | `ARRIVAL_SEQ` (number) | Kế thừa base. Dùng để phát hành nhãn. |
| Xuất xứ/theo dõi | `ORIGIN` (varchar2 50) | LOT mới = `base.origin || base.matUid`. Cũng ghi vào `REF_ID` sổ cái nhập xuất. |
| Nhà cung cấp | `VENDOR` (varchar2 50) | Kế thừa base. |
| Mã nhà sản xuất | `MFG_PARTNER_CODE` (varchar2 50) | Kế thừa base. Cùng đợt nhập hàng nên giả định cùng nhà sản xuất. In nhãn. |
| Số hóa đơn | `INVOICE_NO` (varchar2 50) | Kế thừa base. |
| Số PO | `PO_NO` (varchar2 50) | Kế thừa base. |
| Trạng thái IQC | `IQC_STATUS` (varchar2 20) | Kế thừa base. |
| Đặc cách | `SPECIAL_ACCEPT_YN` (char 1) | Mặc định N. |
| Trạng thái LOT | `STATUS` (varchar2 20) | `NORMAL`/`HOLD`/`DEPLETED`/`SPLIT`/`MERGED`. Gốc→`MERGED`, mới→`NORMAL`. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `'40'` / `'1000'`. Bộ lọc mọi truy vấn·lưu. |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Người dùng·thời gian tạo/sửa. |

---

## ③ Tồn kho vật tư — MAT_STOCKS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã kho | `WAREHOUSE_CODE` | PK (phức hợp). LOT mới kế thừa kho của LOT base. |
| Mã vị trí | `LOCATION_CODE` | Kế thừa base. |
| Mã hạng mục | `ITEM_CODE` | PK (phức hợp). |
| UID vật tư | `MAT_UID` | PK (phức hợp). |
| Số lượng | `QTY` | Tiêu chuẩn cộng dồn gộp. Gốc cập nhật thành 0, mới là `totalQty`. |
| Số lượng khả dụng | `AVAILABLE_QTY` | Gốc 0, mới `totalQty`. |
| Số lượng đặt trước | `RESERVED_QTY` | Lớn hơn 0 thì không thể gộp (gating·kiểm tra). Mới là 0. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | PK (phức hợp) phạm vi. |

---

## ④ Sổ cái nhập xuất — STOCK_TRANSACTIONS

Mỗi lần gộp ghi số lượng `LOT_MERGE_OUT` bằng số LOT gốc + 1 `LOT_MERGE_IN`.

| Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|
| `TRANS_NO` | PK. Đánh số bằng `NumberingService.next('STOCK_TX')`. |
| `TRANS_TYPE` | `LOT_MERGE_OUT`(xuất gốc, âm) / `LOT_MERGE_IN`(nhập mới, dương). |
| `TRANS_DATE` | Thời gian giao dịch. |
| `FROM_WAREHOUSE_ID` | OUT: kho LOT gốc. |
| `TO_WAREHOUSE_ID` | IN: kho LOT mới. |
| `ITEM_CODE` | Mã hạng mục. |
| `MAT_UID` | OUT: serial gốc / IN: serial mới. |
| `QTY` | OUT: `-tồn kho gốc` / IN: `+tổng số lượng`. |
| `REF_TYPE` | `'LOT_MERGE'`. |
| `REF_ID` | OUT: `MAT_UID` gốc / IN: `ORIGIN`(danh sách gốc ghi vào REMARK do giới hạn độ dài). |
| `REMARK` | Dạng `Gộp vật tư: [serial gốc] → mới (tổng số lượng)`. |
| `STATUS` | `'DONE'`. SQL gating nhập kho hoàn tất chỉ tổng hợp `STATUS <> 'CANCELED'`. |
| `WORKER_ID`, `CREATED_BY` | Người dùng xử lý. |
| `COMPANY`, `PLANT_CD` | Phạm vi đa khách hàng. |

---

## Logic gộp (thứ tự thao tác)

`POST /material/lot-merge` (`LotMergeService.merge`), giao dịch DB đơn (`TransactionService.run`):

1. Loại bỏ trùng lặp `sourceLotIds` rồi kiểm tra **từ 2 cái trở lên**.
2. Tra tất cả `MAT_UID` trong `MAT_LOTS` — thiếu thì 404. Kiểm tra khớp tenant.
3. Kiểm tra **cùng hạng mục** (`ITEM_CODE` duy nhất).
4. Kiểm tra **cùng số nhập hàng** (`ARRIVAL_NO` duy nhất, không được NULL).
5. Tra `MAT_STOCKS` → xây dựng map tồn kho theo serial.
6. Kiểm tra trạng thái/tồn kho/đặt trước/nhập kho hoàn tất theo LOT:
   - `STATUS='HOLD'` không được, `STATUS<>'NORMAL'` không được.
   - `QTY<=0` không được, `RESERVED_QTY>0` không được.
   - **Gating nhập kho hoàn tất**: `SUM(STOCK_TRANSACTIONS.QTY WHERE TRANS_TYPE IN ('RECEIVE','LOT_SPLIT_IN','LOT_MERGE_IN') AND STATUS<>'CANCELED') >= MAT_LOTS.INIT_QTY`.
7. Kiểm tra **lịch sử xuất kho**(không được nếu có `MAT_ISSUE` với `STATUS<>'CANCELED'`).
8. Tra hạng mục(`PART_MASTER`)·kiểm tra tenant.
9. Tính giá trị tổng: `totalQty=Σtồn kho`, `origin=base.origin||base.matUid`, `expireDate=MIN(hạn dùng gốc)`.
10. **Hủy bỏ gốc**: Với mỗi gốc, ghi sổ cái `LOT_MERGE_OUT`(−tồn kho) → `MAT_LOTS.STATUS='MERGED', CURRENT_QTY=0` → `MAT_STOCKS.QTY=0, AVAILABLE_QTY=0`.
11. **Đánh số serial mới**: Tạo `MAT_UID` bằng `numbering.nextMatSerial`, tạo `MAT_LOTS`(`STATUS='NORMAL'`, kế thừa thông tin base) + `MAT_STOCKS`(`QTY=AVAILABLE_QTY=totalQty`, `RESERVED_QTY=0`).
12. **Nhập mới** ghi sổ cái `LOT_MERGE_IN`(+tổng số lượng).
13. Phản hồi: `newLotNo`, `mergedLotNos`, `totalQty`, `itemCode`, `itemName`, `arrivalNo`, dữ liệu nhãn (tái sử dụng `MatLabelPreviewModal`).

> `by-barcode/:matUid`(`findByBarcode`) kiểm tra trước tư cách gộp (trạng thái/tồn kho/đặt trước/nhập kho hoàn tất/xuất kho) của 1 serial quét để sử dụng cho tích lũy frontend.

---

## API

| Mục đích | Đường dẫn |
|------|------|
| Danh sách LOT có thể gộp | `GET /material/lot-merge` (`search`, `itemCode`, `limit`) |
| Kiểm tra tư cách 1 mã vạch | `GET /material/lot-merge/by-barcode/:matUid` |
| Thực hiện gộp LOT | `POST /material/lot-merge` (`sourceLotIds[]`, `remark?`) — áp dụng `InventoryFreezeGuard` |

---

## Thiết lập trước (Master·Mã chung)

- LOT đích phải **nhập kho hoàn tất** (đã phản ánh vào `MAT_STOCKS` sau IQC đạt) mới hiển thị trong danh sách.
- Sequence đánh số serial mới(`SEQ_MAT_SERIAL_DAILY`)·khóa đánh số sổ cái(`STOCK_TX`) phải hoạt động bình thường.
- Nhà sản xuất(`PARTNER_MASTER`, `PARTNER_TYPE='MFG'`) phải được đăng ký để hiển thị tên nhà sản xuất trên nhãn.
- Khuyến nghị đặt mẫu nhãn danh mục `mat_lot` để in nhãn (`/master/label-templates`).
- Thời gian khóa sổ tồn kho (`InventoryFreezeGuard`) có thể chặn thực hiện gộp.

---

## Quy trình vận hành

1. Xác nhận LOT cần gộp từ danh sách/tìm kiếm hoặc quét mã vạch để tích lũy (từ 2 cái trở lên, cùng hạng mục·cùng số nhập hàng).
2. **Chọn gộp** → modal xác nhận kiểm tra tổng số lượng → **Thực hiện gộp**.
3. Hủy bỏ gốc·đánh số mới được xử lý trong một giao dịch (nếu thất bại một phần thì rollback toàn bộ).
4. In nhãn serial mới và dán lên thùng hợp nhất.

---

## Phân quyền

| Vai trò | Thao tác được phép |
|------|------|
| Người dùng thông thường | Tra LOT có thể gộp, tích lũy mã vạch, thực hiện gộp, in nhãn |
| Nhân viên logistics/vật tư | Giống trên |
| Người vận hành/quản trị viên | Trên + Khóa sổ tồn kho/xử lý ngoại lệ |

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không có LOT trong danh sách | Tồn kho 0 / có đặt trước / nhập chưa hoàn tất / trạng thái bất thường | Xác nhận nhập kho·bỏ đặt trước·kiểm tra trạng thái |
| "Chỉ gộp LOT đã nhập kho hoàn tất" | `SUM(nhập sổ cái) < INIT_QTY` | Tiến hành xác nhận nhập kho sau IQC đạt |
| "Hạng mục khác nhau" | `ITEM_CODE` của LOT tích lũy không khớp | Chỉ chọn LOT cùng hạng mục |
| "Chỉ LOT cùng số nhập hàng" | `ARRIVAL_NO` không khớp hoặc NULL | Chỉ gộp LOT cùng đợt nhập hàng |
| "LOT có số lượng đặt trước" | `RESERVED_QTY > 0` | Bỏ đặt trước/phân bổ rồi thử lại |
| "Đã có lịch sử xuất kho vật tư" | Có xuất kho đang hoạt động trong `MAT_ISSUE` | Dọn dẹp xuất kho LOT đó rồi thử lại |
| Đánh số serial mới thất bại | Sequence/khóa đánh số bất thường | Kiểm tra trạng thái `SEQ_MAT_SERIAL_DAILY`·`STOCK_TX` |
| Nút gộp bị vô hiệu | Tích lũy dưới 2 cái | Tích lũy từ 2 serial trở lên |
| Nhãn không in | Print Agent chưa chạy | Kiểm tra trạng thái Print Agent cục bộ |

---

## Dữ liệu & Liên kết

| Mục | Nội dung |
|------|------|
| Bảng chính | `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| Bảng tham chiếu | `MAT_ISSUE`(kiểm tra lịch sử xuất), `PART_MASTER`(hạng mục), `PARTNER_MASTER`(nhà cung cấp/nhà sản xuất) |
| Loại nhập xuất | `LOT_MERGE_OUT`(hủy bỏ gốc), `LOT_MERGE_IN`(nhập mới) — `REF_TYPE='LOT_MERGE'` |
| Đánh số | Serial mới `SEQ_MAT_SERIAL_DAILY`(`VH1-RM...`), sổ cái `STOCK_TX` |
| Màn hình liên kết | Chia LOT (đối xứng), Quản lý nhập hàng (cấp LOT), Kiểm tra nhập (gating IQC) |
| Phạm vi đa khách hàng | `COMPANY = '40'`, `PLANT_CD = '1000'` — bộ lọc chung cho mọi truy vấn·lưu |
