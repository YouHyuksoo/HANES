---
menuCode: MAT_LOT_SPLIT
audience: operator
title: Chia LOT vật tư — Hướng dẫn vận hành
summary: Cấu trúc DB chia LOT vật tư (MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS), gating nhập kho hoàn tất, logic hủy bỏ gốc→đánh số 2 mảnh mới, kế thừa theo dõi origin, phạm vi đa khách hàng
tags: [vật tư, LOT, chia, vận hành, DB, serial, nhập xuất]
keywords: [chia lô, chia LOT, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, MAT_UID, INIT_QTY, CURRENT_QTY, SPLIT, LOT_SPLIT_OUT, LOT_SPLIT_IN, gating nhập kho hoàn tất, RECEIVE, origin, nextMatSerial, STOCK_TX, isSplittable, InventoryFreezeGuard, đa khách hàng, COMPANY, PLANT_CD]
related: [MAT_LOT, MAT_LOT_MERGE, MAT_ARRIVAL, MAT_ISSUE]
---

# Chia LOT vật tư — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình chia một serial LOT vật tư (`MAT_LOTS`) đã nhập kho hoàn tất thành **hai serial mới**. Việc chia không đơn thuần tách rời bản gốc, mà **hủy bỏ serial gốc (STATUS='SPLIT', tồn kho 0) rồi đánh số mảnh số lượng chia·mảnh số lượng còn lại thành serial mới**. Mọi di chuyển số lượng được ghi vào sổ cái `STOCK_TRANSACTIONS` với `LOT_SPLIT_OUT`(xuất toàn bộ gốc) / `LOT_SPLIT_IN`(nhập mảnh mới), LOT mới kế thừa `ORIGIN`(serial đầu tiên) để duy trì khả năng truy xuất.

> Cơ sở thiết kế: `docs/specs/2026-06-08-lot-split-merge-redesign-design.md`. Phương thức hủy bỏ toàn bộ serial gốc → cả 2 mảnh kết quả đều là đánh số mới.

## Cấu trúc dữ liệu
```
MAT_LOTS (PK: MAT_UID)                ← Master theo dõi LOT
  └─ MAT_STOCKS (PK: COMPANY+PLANT_CD+WAREHOUSE_CODE+ITEM_CODE+MAT_UID)
        QTY / AVAILABLE_QTY / RESERVED_QTY   ← Tồn kho hiện tại

Khi thực hiện chia (giao dịch đơn):
  Gốc MAT_UID
    STATUS NORMAL → SPLIT, CURRENT_QTY → 0
    MAT_STOCKS QTY/AVAILABLE_QTY → 0
    STOCK_TRANSACTIONS: LOT_SPLIT_OUT (QTY = -toàn bộ)
  Serial mới A(số lượng chia), B(số lượng còn lại)  ← nextMatSerial đánh số
    MAT_LOTS INSERT mới (kế thừa ORIGIN)
    MAT_STOCKS INSERT mới
    STOCK_TRANSACTIONS: LOT_SPLIT_IN (QTY = +số lượng mảnh) × 2

Gating nhập kho hoàn tất:
  Σ STOCK_TRANSACTIONS.QTY (TRANS_TYPE IN RECEIVE/LOT_SPLIT_IN/LOT_MERGE_IN, STATUS<>CANCELED)
    >= MAT_LOTS.INIT_QTY
```

---

## ① Lưới LOT có thể chia — MAT_LOTS / MAT_STOCKS

Truy vấn danh sách là kết quả INNER JOIN `MAT_LOTS` và `MAT_STOCKS` với áp dụng gating nhập kho hoàn tất.

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Serial vật tư | `MAT_LOTS.MAT_UID` | PK. Định danh duy nhất LOT (mã vạch nhãn). Serial gốc đối tượng chia. |
| Mã hạng mục | `MAT_LOTS.ITEM_CODE` | Tham chiếu `ITEM_MASTERS.ITEM_CODE`. Khóa JOIN tên hạng mục·đơn vị. |
| Tên hạng mục | `ITEM_MASTERS.ITEM_NAME` | JOIN từ `PartMaster` theo `ITEM_CODE`. Hiển thị màn hình. |
| Số lượng hiện tại | `MAT_STOCKS.QTY` | Tồn kho hiện tại. Điều kiện danh sách `QTY > 1`. Số lượng chia phải nhỏ hơn giá trị này. |
| Đơn vị | `ITEM_MASTERS.UNIT` | Đơn vị từ master hạng mục. Hiển thị bên cạnh số lượng. |
| Nhà cung cấp | `MAT_LOTS.VENDOR` → `PARTNER_MASTERS.PARTNER_NAME` | JOIN `PartnerMaster` hàng loạt theo `VENDOR`(mã nhà cung cấp) (tránh N+1). Hiển thị mã nếu chưa mapping. |
| (Gating) | `MAT_LOTS.INIT_QTY` vs Σ sổ cái | Không hiển thị màn hình. Giá trị tiêu chuẩn đánh giá nhập kho hoàn tất. |
| (Bộ lọc danh sách) | `MAT_LOTS.STATUS = 'NORMAL'` | Chỉ NORMAL. Loại trừ SPLIT/MERGED/HOLD/DEPLETED. |
| (Bộ lọc danh sách) | `MAT_STOCKS.RESERVED_QTY = 0` | Có số lượng đặt trước thì loại khỏi danh sách. |

> Tổng hợp điều kiện danh sách: `MAT_STOCKS.QTY > 1` AND `MAT_LOTS.STATUS = 'NORMAL'` AND `NVL(RESERVED_QTY,0) = 0` AND vượt qua gating nhập kho hoàn tất.

---

## ② LOT vật tư — MAT_LOTS (toàn bộ cột liên quan chia)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| UID vật tư | `MAT_UID` | PK(varchar2 50). Mảnh mới được đánh số bằng `nextMatSerial`. |
| Mã hạng mục | `ITEM_CODE` | Mảnh mới kế thừa gốc. |
| Số lượng ban đầu | `INIT_QTY` | Số lượng gốc khi cấp (bất biến). Đối tượng so sánh gating nhập kho hoàn tất. Mảnh mới INSERT với số lượng mảnh. |
| Số lượng hiện tại | `CURRENT_QTY` | Số dư. Gốc cập nhật thành `0` khi chia. Mảnh mới là số lượng mảnh. |
| Ngày nhập kho | `RECV_DATE` | Mảnh mới kế thừa gốc. |
| Ngày sản xuất | `MANUFACTURE_DATE` | Mảnh mới kế thừa gốc. |
| Hạn dùng | `EXPIRE_DATE` | Mảnh mới kế thừa gốc. |
| Số nhập hàng | `ARRIVAL_NO` | Mảnh mới kế thừa gốc. Dùng cho nhãn·truy ngược. |
| SEQ nhập | `ARRIVAL_SEQ` | Mảnh mới kế thừa gốc. |
| Xuất xứ (serial đầu tiên) | `ORIGIN` | Khóa theo dõi chia·gộp. Kế thừa `ORIGIN` của gốc (nếu không có thì `MAT_UID` gốc) cho cả 2 mảnh. Cốt lõi genealogy. |
| Nhà cung cấp | `VENDOR` | Mã nhà cung cấp. Mảnh mới kế thừa. |
| Mã nhà sản xuất | `MFG_PARTNER_CODE` | Mảnh mới kế thừa. In nhãn với tên nhà sản xuất (kế thừa nhà sản xuất gốc). |
| Số hóa đơn | `INVOICE_NO` | Mảnh mới kế thừa. |
| Số PO | `PO_NO` | Mảnh mới kế thừa. |
| Trạng thái IQC | `IQC_STATUS` | Mảnh mới kế thừa (giữ kết quả kiểm tra đã qua). |
| Đặc cách | `SPECIAL_ACCEPT_YN` | Mặc định `N`. |
| Trạng thái LOT | `STATUS` | Gốc sau chia là `SPLIT`. Mảnh mới là `NORMAL`. Chỉ `NORMAL` mới có thể chia. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `'40'` / `'1000'`. Mảnh mới kế thừa. |

---

## ③ Tồn kho nguyên vật liệu — MAT_STOCKS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Một phần PK (phức hợp). |
| Mã kho | `WAREHOUSE_CODE` | PK (phức hợp). Mảnh mới kế thừa kho gốc. |
| Mã hạng mục | `ITEM_CODE` | PK (phức hợp). |
| UID vật tư | `MAT_UID` | PK (phức hợp). Mảnh mới là dòng mới với serial mới. |
| Vị trí | `LOCATION_CODE` | Mảnh mới kế thừa gốc. |
| Số lượng | `QTY` | Tổng số lượng. Gốc khi chia là `0`. Mảnh mới là số lượng mảnh. |
| Số lượng đặt trước | `RESERVED_QTY` | Điều kiện chặn chia (`> 0` thì không được). Mảnh mới là 0. |
| Số lượng khả dụng | `AVAILABLE_QTY` | Gốc khi chia là `0`. Mảnh mới là số lượng mảnh. |

---

## ④ Sổ cái nhập xuất — STOCK_TRANSACTIONS

Mỗi lần chia tạo 1 dòng `LOT_SPLIT_OUT` + 2 dòng `LOT_SPLIT_IN`.

| Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|
| `TRANS_NO` | PK. Đánh số bằng `NumberingService.next('STOCK_TX')`. |
| `TRANS_TYPE` | `LOT_SPLIT_OUT`(xuất toàn bộ gốc, QTY âm) / `LOT_SPLIT_IN`(nhập mảnh mới, QTY dương). |
| `TRANS_DATE` | Thời gian giao dịch. |
| `FROM_WAREHOUSE_ID` | Kho xuất của giao dịch OUT (kho gốc). |
| `TO_WAREHOUSE_ID` | Kho nhập của giao dịch IN (kế thừa kho gốc). |
| `ITEM_CODE` | Mã hạng mục (kế thừa gốc). |
| `MAT_UID` | OUT là serial gốc, IN là serial mảnh mới. |
| `QTY` | OUT là `-toàn bộ`, IN là `+số lượng mảnh`. INT. |
| `REF_TYPE` | `LOT_SPLIT`. |
| `REF_ID` | `MAT_UID` gốc (tham chiếu theo dõi chia). |
| `REMARK` | Ghi chú hoặc tự động tạo `Chia vật tư: {gốc}({toàn bộ}) → {số lượng chia} + {còn lại}`. |
| `WORKER_ID` | Người dùng xử lý. |
| `STATUS` | `DONE`. Khi tổng hợp gating nhập kho hoàn tất, điều kiện `STATUS <> 'CANCELED'`. |
| `COMPANY`, `PLANT_CD` | Phạm vi đa khách hàng. |

> Gating nhập kho hoàn tất công nhận `LOT_SPLIT_IN` / `LOT_MERGE_IN` ngoài `RECEIVE` là nhập kho. Do đó, serial kết quả chia·gộp cũng có thể tái chia·tái gộp.

---

## Logic thực hiện chia (split)

Thực hiện tuần tự trong giao dịch DB đơn (`TransactionService.run`):

1. Tra LOT gốc (phạm vi tenant) + kiểm tra tồn tại·khớp tenant.
2. Kiểm tra trạng thái: Chỉ cho phép `STATUS = 'NORMAL'` (chặn `HOLD`/khác).
3. **Gating nhập kho hoàn tất**: Σ`STOCK_TRANSACTIONS.QTY`(RECEIVE/LOT_SPLIT_IN/LOT_MERGE_IN, STATUS<>CANCELED) ≥ `INIT_QTY`.
4. Tra tồn kho gốc (`MAT_STOCKS`): Kiểm tra `QTY > 0`, `RESERVED_QTY = 0`, `splitQty < QTY`.
5. Kiểm tra lịch sử xuất kho (`MAT_ISSUES`): Chặn nếu có lịch sử xuất không phải CANCELED.
6. Kiểm tra hạng mục (`PartMaster`): Nếu `IS_SPLITTABLE = 'N'` thì không thể chia.
7. Tạo sổ cái `LOT_SPLIT_OUT`(QTY = `-toàn bộ`).
8. Hủy bỏ gốc: `MAT_LOTS.STATUS = 'SPLIT'`, `CURRENT_QTY = 0`; `MAT_STOCKS.QTY = AVAILABLE_QTY = 0`.
9. Với mỗi mảnh trong hai mảnh (`[splitQty, remainQty]`):
   - Đánh số serial mới bằng `nextMatSerial`.
   - INSERT mới `MAT_LOTS`(kế thừa thuộc tính gốc·`ORIGIN`, `STATUS = 'NORMAL'`).
   - INSERT mới `MAT_STOCKS`.
   - Tạo sổ cái `LOT_SPLIT_IN`(QTY = `+số lượng mảnh`).
10. Phản hồi bao gồm `label`(2 serial mới) → frontend xuất xem trước nhãn.

> `remainQty = totalQty - splitQty`, đảm bảo luôn `> 0` nhờ kiểm tra `splitQty < QTY`.

---

## Thiết lập trước (Master·Mã chung)

- LOT đích phải ở trạng thái **nhập kho hoàn tất** (đã hoàn tất nhập kho, tổng RECEIVE trong `STOCK_TRANSACTIONS` ≥ `INIT_QTY`).
- `IS_SPLITTABLE` trong master hạng mục (`ITEM_MASTERS`) là `N` thì không thể chia — hạng mục cho phép chia đặt thành `Y`.
- Đăng ký trước khóa đánh số: serial vật tư (`nextMatSerial`, sequence ngày `VH1-RM...`), giao dịch sổ cái (`STOCK_TX`).
- `InventoryFreezeGuard` — trong thời gian khóa sổ tồn kho (freeze), POST chia sẽ bị chặn.

---

## Quy trình vận hành

1. Xác nhận LOT đích đã nhập kho hoàn tất·NORMAL·không có đặt trước/lịch sử xuất kho.
2. Nút chia → nhập số lượng chia (nhỏ hơn số lượng hiện tại) → thực hiện chia.
3. Xem trước nhãn, in nhãn 2 serial mới, hủy bỏ nhãn gốc.
4. Sau chia, kiểm tra trong `MAT_LOTS`: gốc `STATUS = 'SPLIT'`, 2 cái mới `NORMAL`.

---

## Phân quyền

| Vai trò | Thao tác được phép |
|------|------|
| Người dùng thông thường | Tra LOT có thể chia, thực hiện chia, in nhãn |
| Nhân viên logistics/vật tư | Giống trên |
| Người vận hành/quản trị viên | Trên + thiết lập·bỏ khóa sổ tồn kho (freeze), đặt `IS_SPLITTABLE` hạng mục |

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| LOT không hiện trong danh sách | Chưa nhập kho hoàn tất / `QTY <= 1` / `RESERVED_QTY > 0` / `STATUS <> NORMAL` | Kiểm tra trạng thái·số lượng·đặt trước tại [Tình trạng LOT nguyên vật liệu]. Tiến hành nhập kho trước |
| "Chỉ chia LOT đã nhập kho hoàn tất" | Chưa vượt gating (tổng RECEIVE < INIT_QTY) | Tiến hành xác nhận nhập kho (xử lý nhập kho) trước |
| "LOT không ở trạng thái bình thường (NORMAL)" | Đã SPLIT/MERGED hoặc HOLD | Chọn LOT khác. Tạm giữ thì bỏ rồi tiến hành |
| "LOT có số lượng đặt trước" | `RESERVED_QTY > 0` | Dọn dẹp đặt trước trước (hủy/tiêu thụ) |
| "LOT đã có lịch sử xuất kho vật tư" | Có lịch sử xuất không phải CANCELED | Dọn dẹp xuất kho trước hoặc dùng LOT khác |
| "Hạng mục này không thể chia" | `ITEM_MASTERS.IS_SPLITTABLE = 'N'` | Đổi thành cho phép chia trong master hạng mục |
| "Số lượng chia phải nhỏ hơn tồn kho hiện tại" | `splitQty >= QTY` | Nhập lại nhỏ hơn số lượng hiện tại |
| POST chia bị chặn (freeze) | Thời gian khóa sổ tồn kho | Bỏ khóa sổ `InventoryFreezeGuard` rồi thử lại |
| Nhãn không in được | Print Agent chưa chạy | Kiểm tra trạng thái Print Agent cục bộ |

---

## Dữ liệu & Liên kết

| Mục | Nội dung |
|------|------|
| Bảng chính | `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| Tham chiếu kiểm tra | `MAT_ISSUES`(lịch sử xuất), `ITEM_MASTERS`(IS_SPLITTABLE·đơn vị), `PARTNER_MASTERS`(tên nhà cung cấp) |
| API | `GET /material/lot-split`(danh sách có thể chia), `POST /material/lot-split`(thực hiện chia) |
| Đánh số | Serial `nextMatSerial`(SEQ_MAT_SERIAL_DAILY), sổ cái `STOCK_TX` (`NumberingService`) |
| Bảo vệ | `InventoryFreezeGuard`(POST) |
| Theo dõi (genealogy) | Kế thừa `ORIGIN`(serial đầu tiên) + `STOCK_TRANSACTIONS.REF_ID`(MAT_UID gốc) |
| Màn hình liên kết | Quản lý nhập hàng (cấp LOT), Gộp LOT (phép toán ngược), Tình trạng LOT nguyên vật liệu, Xuất kho vật tư |
| Phạm vi đa khách hàng | `COMPANY = '40'`, `PLANT_CD = '1000'` — bộ lọc chung cho mọi truy vấn·lưu |
