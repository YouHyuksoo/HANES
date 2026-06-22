---
menuCode: MAT_ARRIVAL
audience: operator
title: Quản lý nhập hàng — Hướng dẫn vận hành
summary: Cấu trúc DB quản lý nhập hàng (MAT_ARRIVALS, MAT_LOTS, MAT_ARRIVAL_STOCKS, PURCHASE_ORDER_ITEMS), logic nhập hàng theo dòng PO, hủy bút toán đảo, liên kết IQC, phạm vi đa khách hàng
tags: [vật tư, nhập hàng, vận hành, DB, LOT, IQC, bút toán đảo]
keywords: [MAT_ARRIVALS, MAT_LOTS, MAT_ARRIVAL_STOCKS, MAT_ARRIVAL_TRANSACTIONS, PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, ARRIVAL_NO, MAT_UID, IQC_STATUS, LINE_STATUS, ARRIVAL_TYPE, MFG_PARTNER_CODE, bút toán đảo, đa khách hàng, COMPANY, PLANT_CD, hủy nhập hàng, đánh số LOT, serial]
related: [PUR_PO, QC_IQC, MAT_ARRIVAL_RESULT, MAT_ARRIVAL_TRANSACTION, INV_ARRIVAL_STOCK]
---

# Quản lý nhập hàng — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình **đăng ký nhập hàng theo dòng PO (đơn đặt hàng)** và đánh số serial LOT (`MAT_LOTS`) cho vật tư do nhà cung cấp giao. Khi nhập hàng, ba bảng `MAT_ARRIVALS`(lịch sử nghiệp vụ) + `MAT_LOTS`(theo dõi LOT) + `MAT_ARRIVAL_STOCKS`(tồn kho chờ nhập) được tạo đồng thời. Nhập kho (phản ánh vào tồn kho hiện tại `MAT_STOCKS`) là xử lý riêng sau khi IQC đạt.

## Cấu trúc dữ liệu
```
PURCHASE_ORDERS (PK: PO_NO)
  └─ PURCHASE_ORDER_ITEMS (PK: PO_ID + SEQ)
       │   LINE_STATUS: OPEN → PARTIAL → CLOSE
       │   RECEIVED_QTY cập nhật tích lũy
       ↓ Đăng ký nhập hàng
MAT_ARRIVALS (PK: ARRIVAL_NO + SEQ)
  ├─ MAT_LOTS (PK: MAT_UID)   ← Theo dõi LOT·IQC
  │     IQC_STATUS: PENDING → PASS/FAIL/HOLD
  └─ MAT_ARRIVAL_STOCKS (PK: COMPANY + PLANT_CD + MAT_UID)
         STATUS: AVAILABLE   ← Tồn kho nhập hàng chờ IQC

MAT_ARRIVAL_TRANSACTIONS (PK: TRANS_NO)
       ← Sổ cái nhập hàng·hủy (ARRIVAL_IN / ARRIVAL_CANCEL)
```

---

## ① Dòng PO — PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số PO | `PURCHASE_ORDERS.PO_NO` | PK. Điều kiện nhập hàng được: `STATUS IN ('CONFIRMED', 'PARTIAL')`. |
| Nhà cung cấp | `PURCHASE_ORDERS.PARTNER_ID / PARTNER_NAME` | Nhà cung cấp. Sao chép vào `MAT_ARRIVALS.VENDOR_ID/VENDOR_NAME`. |
| Ngày đặt hàng | `PURCHASE_ORDERS.ORDER_DATE` | Kiểu DATE. |
| Ngày giao hàng | `PURCHASE_ORDERS.DUE_DATE` | Kiểu DATE. Hiện không hiển thị trên màn hình. |
| Loại sử dụng | `PURCHASE_ORDERS.USE_TYPE` | Mã chung `PO_USE_TYPE`(ví dụ: PROD). Hiển thị trên lưới. |
| Số dòng | `PURCHASE_ORDER_ITEMS.LINE_NO` | Số thứ tự trong PO (L/N). |
| Số lần sửa đổi | `PURCHASE_ORDER_ITEMS.REV_NO` | Số lần sửa đổi dòng (R/N). Mặc định 1. |
| Mã hạng mục | `PURCHASE_ORDER_ITEMS.ITEM_CODE` | Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| Số lượng đặt | `PURCHASE_ORDER_ITEMS.ORDER_QTY` | INT. |
| Nhập tích lũy | `PURCHASE_ORDER_ITEMS.RECEIVED_QTY` | Tăng mỗi khi đăng ký nhập hàng. Số còn lại = ORDER_QTY − RECEIVED_QTY. |
| Trạng thái dòng | `PURCHASE_ORDER_ITEMS.LINE_STATUS` | `OPEN`(chưa nhập) / `PARTIAL`(nhập một phần) / `CLOSE`(hoàn tất). Server tự tính lại. |

---

## ② Header nhập hàng — MAT_ARRIVALS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số nhập hàng | `ARRIVAL_NO` | PK (phức hợp). Đánh số từ Oracle Sequence `ARRIVAL`. Nhiều hạng mục cùng đợt chia sẻ cùng `ARRIVAL_NO`. |
| SEQ | `SEQ` | PK (phức hợp). Số thứ tự trong cùng `ARRIVAL_NO`. Bắt đầu từ 1. |
| Số PO | `PO_NO` | Số PO đã kết nối. Nhập thủ công là NULL. |
| PO_ID | `PO_ID` | Tham chiếu `PURCHASE_ORDERS.PO_NO`. |
| PO_ITEM_ID | `PO_ITEM_ID` | Tham chiếu `PURCHASE_ORDER_ITEMS.SEQ`. |
| Số hóa đơn | `INVOICE_NO` | Số hóa đơn nhà cung cấp (theo dõi giao dịch). Hiện tại modal nhập PO không có UI nhập (chỉ nhập thủ công mới nhập). |
| ID nhà cung cấp | `VENDOR_ID` | Sao chép từ `PARTNER_ID` của PO. |
| Tên nhà cung cấp | `VENDOR_NAME` | Sao chép từ `PARTNER_NAME` của PO. |
| UID nhà cung cấp | `SUP_UID` | Serial vật tư do nhà cung cấp tự gán (tùy chọn). |
| Mã hạng mục | `ITEM_CODE` | Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| Số lượng nhập | `QTY` | INT. Số lượng đăng ký trong lần nhập này. |
| Mã kho | `WAREHOUSE_CODE` | Kho chứa hàng nhập. |
| Ngày nhập | `ARRIVAL_DATE` | TIMESTAMP. Lưu theo ngày nhập người dùng nhập. |
| Loại nhập | `ARRIVAL_TYPE` | `PO`(dựa trên đơn đặt hàng) / `MANUAL`(thủ công). |
| Nhân viên | `WORKER_ID` | ID người dùng đăng ký. |
| Trạng thái IQC | `IQC_STATUS` | `PENDING` ngay sau khi nhập. Thay đổi theo kết quả kiểm tra nhập. |
| Trạng thái | `STATUS` | `DONE` / `CANCELED`. Chuyển sang bút toán đảo khi hủy. |
| Ghi chú | `REMARK` | Ghi nhớ. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `'40'` / `'1000'`. |

---

## ③ LOT vật tư — MAT_LOTS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| UID vật tư | `MAT_UID` | PK. Đánh số dạng Oracle Sequence `VH1-RM...`. Định danh duy nhất LOT (mã vạch nhãn). |
| Mã hạng mục | `ITEM_CODE` | Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| Số lượng ban đầu | `INIT_QTY` | Số lượng gốc khi nhập. Giá trị bất biến. Không đổi dù có nhập xuất. |
| Số lượng hiện tại | `CURRENT_QTY` | Số dư hiện tại. Giảm khi cấp phát. LOT mới bằng INIT_QTY. |
| Ngày nhập kho | `RECV_DATE` | Ngày khi đăng ký nhập (TIMESTAMP). |
| Ngày sản xuất | `MANUFACTURE_DATE` | Ngày sản xuất vật tư (tùy chọn). Có thể nhập ở nhập thủ công. |
| Hạn dùng | `EXPIRE_DATE` | Ngày hết hạn. Hiện không tự động tính (NULL). |
| Số nhập hàng | `ARRIVAL_NO` | Tham chiếu `MAT_ARRIVALS.ARRIVAL_NO`. Dùng để truy ngược LOT. |
| SEQ nhập | `ARRIVAL_SEQ` | Kết nối với `MAT_ARRIVALS.SEQ`. |
| Xuất xứ | `ORIGIN` | Dùng cho theo dõi chia·gộp LOT. Khi nhập lần đầu, bằng `MAT_UID`. |
| Nhà cung cấp | `VENDOR` | `PARTNER_ID` của PO. |
| Mã nhà sản xuất | `MFG_PARTNER_CODE` | Nhà sản xuất thực tế (`PARTNER_MASTERS` loại MFG). Bắt buộc chọn trong modal nhập. Dùng để in nhãn. |
| Số hóa đơn | `INVOICE_NO` | Theo dõi giao dịch. |
| Số PO | `PO_NO` | Số PO đã kết nối. |
| Trạng thái IQC | `IQC_STATUS` | `PENDING`(chờ kiểm tra) / `PASS` / `FAIL` / `HOLD`. Cập nhật từ màn hình IQC. |
| Đặc cách | `SPECIAL_ACCEPT_YN` | `Y`=vật tư không đạt được chấp nhận đặc biệt làm hàng tốt. Mặc định `N`. |
| Trạng thái LOT | `STATUS` | `NORMAL`(bình thường) / `HOLD`(tạm giữ) / `DEPLETED`(đã cạn) / `SPLIT`(đã chia) / `MERGED`(đã gộp). |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `'40'` / `'1000'`. |

---

## ④ Tồn kho nhập hàng — MAT_ARRIVAL_STOCKS

Tồn kho chờ trước khi IQC thông qua. Sau khi đạt, chuyển sang `MAT_STOCKS`(tồn kho hiện tại nguyên vật liệu).

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| UID vật tư | `MAT_UID` | PK (phức hợp). Dòng tồn kho theo đơn vị LOT. |
| Số nhập hàng | `ARRIVAL_NO` | Số nhập hàng kết nối. |
| SEQ nhập | `ARRIVAL_SEQ` | Số thứ tự nhập hàng kết nối. |
| Mã kho | `WAREHOUSE_CODE` | Kho chứa. |
| Mã hạng mục | `ITEM_CODE` | Mã hạng mục vật tư. |
| Số lượng | `QTY` | Tổng số lượng sở hữu. |
| Số lượng khả dụng | `AVAILABLE_QTY` | Số lượng có thể cấp phát. Bằng 0 khi IQC HOLD. |
| Trạng thái | `STATUS` | `AVAILABLE`(khả dụng) / `HOLD`(tạm giữ IQC...). |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | PK (phức hợp). |

---

## ⑤ Sổ cái nhập hàng — MAT_ARRIVAL_TRANSACTIONS

| Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|
| `TRANS_NO` | PK. Số giao dịch. |
| `TRANS_TYPE` | `ARRIVAL_IN`(nhập) / `ARRIVAL_CANCEL`(hủy bút toán đảo). |
| `TRANS_DATE` | Thời gian giao dịch (TIMESTAMP). |
| `ARRIVAL_NO` | Số nhập hàng kết nối. |
| `ARRIVAL_SEQ` | Số thứ tự nhập hàng kết nối. |
| `WAREHOUSE_CODE` | Kho. |
| `ITEM_CODE` | Mã hạng mục. |
| `MAT_UID` | Serial LOT. |
| `QTY` | Số lượng (âm khi hủy). |
| `UNIT_PRICE` | Đơn giá (DECIMAL 12,4). |
| `TOTAL_AMOUNT` | Thành tiền (DECIMAL 14,2). |
| `REF_TYPE` | Loại tham chiếu (kết nối hủy...). |
| `REF_ID` | ID tham chiếu. |
| `CANCEL_REF_ID` | ID giao dịch gốc khi bút toán đảo. |
| `WORKER_ID` | Người dùng xử lý. |
| `STATUS` | `DONE` / `CANCELED`. |
| `COMPANY`, `PLANT_CD` | Phạm vi đa khách hàng. |

---

## Logic đăng ký nhập hàng (dựa trên PO)

1. Kiểm tra `PURCHASE_ORDERS.STATUS IN ('CONFIRMED', 'PARTIAL')`.
2. Kiểm tra vượt số còn lại (= `ORDER_QTY - RECEIVED_QTY`).
3. Đánh số `ARRIVAL_NO` bằng Oracle Sequence (khóa đánh số `ARRIVAL`).
4. Đánh số `MAT_UID` (serial vật tư) bằng Oracle Sequence (dạng `VH1-RM...`).
5. Tạo bản ghi `MAT_ARRIVALS`(`IQC_STATUS = 'PENDING'`, `STATUS = 'DONE'`).
6. Tạo bản ghi `MAT_LOTS`(`INIT_QTY = CURRENT_QTY = số lượng nhập`, `IQC_STATUS = 'PENDING'`).
7. Tạo bản ghi `MAT_ARRIVAL_STOCKS`(`STATUS = 'AVAILABLE'`).
8. Tạo bản ghi `MAT_ARRIVAL_TRANSACTIONS`(`TRANS_TYPE = 'ARRIVAL_IN'`).
9. Tăng `PURCHASE_ORDER_ITEMS.RECEIVED_QTY`.
10. Tính lại `PURCHASE_ORDER_ITEMS.LINE_STATUS`(OPEN → PARTIAL → CLOSE).
11. Tính lại `PURCHASE_ORDERS.STATUS`(CONFIRMED → PARTIAL → CLOSED).

> Tồn kho hiện tại (`MAT_STOCKS`) chỉ tăng khi **nhập kho** sau IQC đạt. Ở giai đoạn nhập hàng, chỉ chất vào `MAT_ARRIVAL_STOCKS`.

## Logic hủy nhập hàng (bút toán đảo)

- API: `POST /material/arrivals/cancel` (`transactionId`, `reason`)
- Không phải xóa mà là bút toán đảo: chuyển `MAT_ARRIVAL_TRANSACTIONS.STATUS` gốc thành `'CANCELED'`, tạo mới giao dịch `ARRIVAL_CANCEL` với số lượng ngược.
- `MAT_ARRIVALS.STATUS = 'CANCELED'`, trừ tồn kho `MAT_ARRIVAL_STOCKS`.
- Lý do hủy là bắt buộc, chỉ thực hiện được khi giao dịch gốc ở trạng thái `DONE` + `ARRIVAL_IN`.

---

## API

| Mục đích | Đường dẫn |
|------|------|
| Tra danh sách dòng PO | `GET /material/arrivals/po-lines` |
| Đăng ký nhập dòng PO | `POST /material/arrivals/po-line` |
| Đăng ký nhập thủ công | `POST /material/arrivals/manual` |
| Hủy nhập hàng | `POST /material/arrivals/cancel` |

---

## Thiết lập trước (Master·Mã chung)

- PO phải ở trạng thái `CONFIRMED` trở lên mới xuất hiện trong danh sách nhập.
- Master hạng mục (`ITEM_MASTERS`) cần đặt `LOT_UNIT_QTY` (đơn vị cấu thành serial) — nếu không đặt, toàn bộ số lượng nhập sẽ được cấp thành 1 LOT.
- Cần đăng ký trước kho nguyên vật liệu (`WAREHOUSES`, `WAREHOUSE_TYPE = 'RAW'`).
- Cần đăng ký trước nhà sản xuất (`PARTNER_MASTERS`, `PARTNER_TYPE = 'MFG'`).
- Mã chung: `PO_LINE_STATUS`(OPEN/PARTIAL/CLOSE), `PO_USE_TYPE`, `PO_STATUS`.
- Khuyến nghị đặt mẫu nhãn danh mục `mat_lot` để in nhãn (`/master/label-templates`).

---

## Phân quyền

| Vai trò | Thao tác được phép |
|------|------|
| Người dùng thông thường | Tra dòng PO, đăng ký nhập dựa trên PO, in nhãn |
| Nhân viên logistics/vật tư | Trên + nhập thủ công |
| Người vận hành/quản trị viên | Trên + hủy nhập hàng (bút toán đảo) |

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Dòng PO không hiện trong danh sách | `PURCHASE_ORDERS.STATUS` là `DRAFT` hoặc `CLOSED` | Xử lý CONFIRM PO tại Quản lý PO hoặc kiểm tra trạng thái |
| Nút nhập vật tư bị vô hiệu | `LINE_STATUS = 'CLOSE'` hoặc `REMAINING_QTY <= 0` | Kiểm tra số còn lại. Nếu cần, sửa số lượng đặt rồi xử lý lại |
| Lỗi số lượng nhập vượt số còn lại | `receivedQty > remainingQty` | Kiểm tra số lượng nhập trong phạm vi số còn lại |
| Số serial nhiều hơn dự kiến | `LOT_UNIT_QTY` đặt quá nhỏ | Sửa `LOT_UNIT_QTY` trong master hạng mục |
| Nhãn không in được | Print Agent chưa chạy hoặc lỗi cổng kết nối | Kiểm tra trạng thái Print Agent cục bộ |
| Trạng thái chờ IQC không đổi | Chưa đăng ký kiểm tra tại màn hình IQC | Tiến hành kiểm tra LOT đó tại màn hình IQC |
| Nút hủy nhập hàng không hiện | Giao dịch ở trạng thái `CANCELED` hoặc loại `ARRIVAL_CANCEL` | Đã hủy rồi. Cần tra giao dịch gốc |
| Sau nhập, số lượng `MAT_STOCKS` không đổi | Hoạt động bình thường. Nhập kho là xử lý riêng sau IQC đạt | Kiểm tra số lượng chờ IQC tại màn hình [Tồn kho nhập hàng] |

---

## Dữ liệu & Liên kết

| Mục | Nội dung |
|------|------|
| Bảng chính | `MAT_ARRIVALS`, `MAT_LOTS`, `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS`, `PURCHASE_ORDERS`, `PURCHASE_ORDER_ITEMS` |
| Master tham chiếu | `ITEM_MASTERS`, `PARTNER_MASTERS`, `WAREHOUSES` |
| Màn hình liên kết | Quản lý PO (trạng thái PO), Kiểm tra nhập (kết quả IQC), Kết quả nhập hàng (lịch sử·hủy), Tồn kho nhập hàng (tồn kho chờ) |
| Phạm vi đa khách hàng | `COMPANY = '40'`, `PLANT_CD = '1000'` — bộ lọc chung cho mọi truy vấn·lưu |
