---
menuCode: CONS_RECEIVING
audience: operator
title: Nhập kho vật tư tiêu hao — Hướng dẫn vận hành
summary: Hai đường nhập kho vật tư tiêu hao (xác nhận nhãn quét mã vạch / nhập thủ công) và DB mapping (CONSUMABLE_LOGS·CONSUMABLE_STOCKS·CONSUMABLE_MASTERS), phản ánh tồn kho·logic dấu, đánh số, phân quyền, xử lý sự cố, đa khách hàng
tags: [vật tư tiêu hao, nhập kho, nhập xuất, vận hành]
keywords: [nhập kho vật tư tiêu hao, nhập kho, nhập kho trả lại, IN, IN_RETURN, CONSUMABLE_LOGS, CONSUMABLE_STOCKS, CONSUMABLE_MASTERS, STOCK_QTY, conUid, CON_UID, PENDING, ACTIVE, SEQ_CONSUMABLE_LOGS, đánh số, phản ánh tồn kho, loại nhập kho, NEW, REPLACEMENT, đa khách hàng, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_LABEL, CONS_STOCK]
---

# Nhập kho vật tư tiêu hao — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình xử lý nhập kho để **xác nhận vật tư tiêu hao thành tồn kho trong kho**. Khi nhập kho, tồn kho sở hữu của master vật tư tiêu hao (`CONSUMABLE_MASTERS.STOCK_QTY`) tăng/giảm và bảng lịch sử nhập xuất (`CONSUMABLE_LOGS`) ghi 1 giao dịch được đánh số. Có hai đường nhập kho.

> Hai đường nhập kho:
> - **① Nhập kho quét mã vạch**(`POST /consumables/label/confirm`): Xác nhận instance riêng lẻ (`CONSUMABLE_STOCKS`, `CON_UID`) đã được đánh số từ phát hành nhãn từ `PENDING → ACTIVE`. Theo dõi theo đơn vị UID.
> - **② Nhập thủ công**(`POST /consumables/receiving`, `logType: 'IN'`): Tăng tồn kho bằng mã vật tư tiêu hao + số lượng, không có UID. Không tạo instance `CONSUMABLE_STOCKS`.

## Cấu trúc dữ liệu
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE, STOCK_QTY = tồn kho sở hữu)
   ├─ 1:N ─▶ CONSUMABLE_STOCKS (PK: CON_UID, status PENDING→ACTIVE→…) ← đối tượng nhập kho quét
   └─ 1:N ─▶ CONSUMABLE_LOGS   (khóa phức hợp: TRANS_DATE + SEQ, lịch sử nhập xuất) ← cả hai đường đều ghi
```
- Nhập quét: Chuyển trạng thái `CONSUMABLE_STOCKS` + 1 bản ghi `CONSUMABLE_LOGS`(IN) + `STOCK_QTY +1`.
- Nhập thủ công: 1 bản ghi `CONSUMABLE_LOGS`(IN) + `STOCK_QTY += qty`. (Không tạo instance)

## API
| Thao tác | Phương thức · Đường dẫn | Mô tả |
|------|------|------|
| Danh sách chờ nhập | `GET /consumables/label/pending` | Danh sách `CONSUMABLE_STOCKS.STATUS='PENDING'` |
| Xác nhận nhập quét | `POST /consumables/label/confirm` `{ conUid, location?, remark? }` | PENDING→ACTIVE, `STOCK_QTY +1`, log IN |
| Nhập trả lại quét | `POST /consumables/label/return` `{ conUid, returnReason? }` | ACTIVE→RETURNED, `STOCK_QTY -1`, log IN_RETURN |
| Xác nhận nhập nhiều cái | `POST /consumables/label/confirm-bulk` `{ conUids[], location? }` | confirm lặp tuần tự |
| Nhập thủ công | `POST /consumables/receiving` `{ consumableId, qty, logType:'IN', … }` | `STOCK_QTY += qty`, log IN (không tạo instance) |
| Danh sách lịch sử nhập | `GET /consumables/logs` | Bộ lọc `logType` / `logTypeGroup=RECEIVING` / khoảng thời gian |

> `SELECT * FROM CONSUMABLE_LOGS …` trên lưới màn hình chỉ là nhãn hiển thị, truy vấn thực tế qua API trên.

---

## ① Bảng quét mã vạch ↔ DB

| Mục màn hình | Cột DB / Tham số | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Chế độ nhập/trả lại | (rẽ nhánh yêu cầu) | Nhập=gọi `/label/confirm`, Trả lại=gọi `/label/return`. |
| Mã vạch UID | `ConfirmConReceivingDto.conUid` → `CONSUMABLE_STOCKS.CON_UID` | PK instance riêng lẻ đã đánh số từ phát hành nhãn. Xử lý ngay khi Enter. |
| Vị trí lưu trữ (nhập) | `ConfirmConReceivingDto.location` → `CONSUMABLE_STOCKS.LOCATION` | Ghi làm vị trí lưu trữ của UID đó khi xác nhận nhập (tùy chọn). |
| Lý do trả lại (trả) | `ReturnConReceivingDto.returnReason` → `CONSUMABLE_STOCKS.REMARK`, `CONSUMABLE_LOGS.RETURN_REASON` | Lý do trả lại. Ghi vào ghi chú instance và lý do log. |

### Danh sách chờ nhập — CONSUMABLE_STOCKS (STATUS='PENDING')
| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| UID | `CON_UID` | PK instance. |
| Mã vật tư tiêu hao | `CONSUMABLE_CODE` | FK master. |
| Tên vật tư tiêu hao | `CONSUMABLE_MASTERS.NAME` | JOIN từ master (thuộc tính `consumableName`). |
| Danh mục | `CONSUMABLE_MASTERS.CATEGORY` | Mã chung `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). |
| Ngày in nhãn | `LABEL_PRINTED_AT` | Thời gian phát hành nhãn. |
| Tên nhà cung cấp | `VENDOR_NAME` | Giá trị nhập khi phát hành nhãn (cũng có `VENDOR_CODE`). |

## ② Lưới lịch sử nhập — CONSUMABLE_LOGS (toàn bộ cột hiển thị)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Thời gian | `CREATED_AT` | Thời gian xử lý (TIMESTAMP). Tiêu chí sắp xếp (DESC). |
| (Khóa) Ngày giao dịch | `TRANS_DATE` | Khóa phức hợp. Lưu với nửa đêm (`00:00`) của ngày xử lý nhập. |
| (Khóa) Số thứ tự | `SEQ` | Khóa phức hợp. Đánh số từ sequence `SEQ_CONSUMABLE_LOGS`. |
| Mã vật tư tiêu hao | `CONSUMABLE_CODE` | FK master. |
| Tên vật tư tiêu hao | `CONSUMABLE_MASTERS.NAME` | Hiển thị JOIN. |
| UID | `CON_UID` | Chỉ có khi nhập quét. Nhập thủ công là null → `-`. |
| Loại | `LOG_TYPE` | `IN`(nhập)/`IN_RETURN`(nhập trả lại). Toàn bộ nhập xuất còn có OUT/OUT_RETURN/USAGE/REPLACE. |
| Số lượng | `QTY` | Số lượng nhập/trả (INT, mặc định 1). Màn hình hiển thị IN `+`, IN_RETURN `-` (giá trị lưu là dương). |
| Mã nhà cung cấp | `VENDOR_CODE` | Mã nhà cung cấp. |
| Tên nhà cung cấp | `VENDOR_NAME` | Tên nhà cung cấp. |
| Đơn giá | `UNIT_PRICE` | NUMBER(12,2). Đơn giá nhập. |
| Loại nhập | `INCOMING_TYPE` | `NEW`(mới)/`REPLACEMENT`(thay thế). Nhập quét cố định `NEW`. |
| Ghi chú | `REMARK` | Ghi nhớ nhập/trả. |
| Lý do trả hàng | `RETURN_REASON` | Lý do nhập trả lại (IN_RETURN). |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `UPDATED_AT` | Lịch sử tạo/sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000` (thuộc tính entity `company`, `plant`). |

> Cột riêng xuất kho `DEPARTMENT`/`LINE_CODE`/`EQUIP_CODE`/`ISSUE_REASON` nằm cùng bảng nhưng không dùng ở màn hình nhập kho (dùng ở màn hình xuất `CONS_ISSUING`).

## ③ Form nhập thủ công ↔ CONSUMABLE_LOGS

`POST /consumables/receiving` tự động điền `logType:'IN'` trong body và xử lý qua `createLog`.

| Mục màn hình | Trường DTO → Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Vật tư tiêu hao | `consumableId` → `CONSUMABLE_CODE` | Kiểm tra tồn tại (không có thì 404). |
| Số lượng | `qty` → `QTY` | `STOCK_QTY += qty`. Mặc định 1, tối thiểu 1. |
| Loại nhập | `incomingType` → `INCOMING_TYPE` | NEW/REPLACEMENT. |
| Mã/tên nhà cung cấp | `vendorCode`/`vendorName` → `VENDOR_CODE`/`VENDOR_NAME` | Nhà cung cấp. |
| Đơn giá | `unitPrice` → `UNIT_PRICE` | Đơn giá nhập (tùy chọn). |
| Ghi chú | `remark` → `REMARK` | Ghi nhớ (tùy chọn). |

## Logic nhập kho / phản ánh tồn kho
**Dấu tồn kho khi nhập thủ công (`createLog`)** — `stockDelta` theo `logType`:
- `IN` → `+qty`, `OUT` → `-qty`, `IN_RETURN` → `-qty`, `OUT_RETURN` → `+qty`.
- Nếu `stockDelta < 0` và `STOCK_QTY + stockDelta < 0` thì **lỗi thiếu tồn kho 400**.
- Giao dịch: Lưu 1 bản ghi `CONSUMABLE_LOGS` + cập nhật `CONSUMABLE_MASTERS.STOCK_QTY` (nguyên tử). Khi IN, cũng cập nhật `LAST_REPLACE` thành hiện tại.

**Xác nhận nhập quét (`confirmReceiving`)**:
1. Tra `CON_UID`. Nếu `STATUS != 'PENDING'` thì **400**(đã nhập).
2. `STATUS='ACTIVE'`, `RECV_DATE`=hiện tại, cập nhật `LOCATION`/`REMARK`.
3. `CONSUMABLE_MASTERS.STOCK_QTY` **+1**.
4. Ghi 1 bản ghi log IN vào `CONSUMABLE_LOGS` (có `CON_UID`, `INCOMING_TYPE='NEW'`).

**Trả lại quét (`returnByScan`)**: Chỉ cho phép `STATUS='ACTIVE'` (không thì 400) → `STATUS='RETURNED'`, `STOCK_QTY -1`, log IN_RETURN.

## Đánh số
- `CONSUMABLE_LOGS.SEQ`: Oracle sequence `SEQ_CONSUMABLE_LOGS.NEXTVAL`. Cùng `TRANS_DATE` (nửa đêm) tạo khóa phức hợp.
- `CON_UID` (instance): Được cấp qua kênh đánh số `CON_UID` ở giai đoạn phát hành nhãn (`CONS_LABEL`). Màn hình nhập kho không đánh số mà chỉ xác nhận UID hiện có.

## Thiết lập trước
- [Master vật tư tiêu hao](`CONSUMABLE_MASTERS`) phải đăng ký vật tư tiêu hao đích nhập với `USE_YN='Y'`.
- Nhập quét yêu cầu [Phát hành nhãn vật tư tiêu hao](`CONS_LABEL`) đã phát hành `CON_UID` ở trạng thái PENDING.
- Lựa chọn vị trí lưu trữ theo master vị trí (`useLocationOptions`).
- Mã chung: `CONSUMABLE_CATEGORY`(badge danh mục danh sách chờ).

## Quy trình vận hành
1. Phát hành `CON_UID` qua Phát hành nhãn (đường nhập quét) → hiển thị trong danh sách chờ nhập.
2. Quét UID ở chế độ nhập → xác nhận nhập (tồn kho +1, log IN).
3. Trường hợp không có UID thì nhập thủ công qua form **Đăng ký nhập** (tồn kho += qty).
4. Nhập sai thì quét UID ở chế độ **Trả lại** (ACTIVE→RETURNED, tồn kho -1).
5. Kiểm tra qua lưới lịch sử nhập (bộ lọc khoảng thời gian·loại).

## Phân quyền
Nhân viên phụ trách vật tư tiêu hao/vật tư (xử lý nhập·trả lại). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Danh sách chờ nhập trống | `CON_UID` chưa phát hành hoặc đã nhập hết | Phát hành UID tại [Phát hành nhãn vật tư tiêu hao] rồi thử lại |
| Khi quét "Đã ở trạng thái nhập kho"(400) | `STATUS != 'PENDING'` (đã ACTIVE...) | Kiểm tra lịch sử nhập. Không phải nhập trùng |
| Khi quét "Không tìm thấy UID"(404) | Sai UID/UID khác cơ sở/chưa phát hành | Kiểm tra UID·đa khách hàng(`COMPANY`/`PLANT_CD`) |
| Trả lại bị chặn(400) | UID không ở trạng thái ACTIVE | Chỉ trả lại được UID đã xác nhận nhập (đang hoạt động) |
| Nút đăng ký nhập thủ công bị vô hiệu | Chưa chọn vật tư tiêu hao | Chọn vật tư tiêu hao bằng kính lúp |
| Nhập thủ công/trả lại "Thiếu tồn kho"(400) | `STOCK_QTY + delta < 0` | Kiểm tra tồn kho hiện tại ở đường giảm (trả lại) |
| Nhập kho rồi mà tồn kho không tăng | Truy vấn phạm vi khác cơ sở | Kiểm tra phạm vi `COMPANY='40'`/`PLANT_CD='1000'` |

## Dữ liệu & Liên kết
- Bảng: `CONSUMABLE_LOGS`(lịch sử nhập xuất), `CONSUMABLE_STOCKS`(instance riêng lẻ/trạng thái), `CONSUMABLE_MASTERS`(tồn kho sở hữu `STOCK_QTY`)
- Liên kết: [Phát hành nhãn vật tư tiêu hao](`CONS_LABEL`, đánh số `CON_UID`), [Master vật tư tiêu hao](`CONSUMABLE_MASTERS`), [Tồn kho vật tư tiêu hao](`CONS_STOCK`), Xuất kho vật tư tiêu hao(`CONS_ISSUING`, cùng bảng log)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
