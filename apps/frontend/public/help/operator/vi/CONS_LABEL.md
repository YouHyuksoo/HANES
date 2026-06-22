---
menuCode: CONS_LABEL
audience: operator
title: Phát hành nhãn vật tư tiêu hao — Hướng dẫn vận hành
summary: Đánh số UID (conUid) vật tư tiêu hao·tạo instance chưa nhập kho (PENDING), logic in nhãn/tái phát hành, mapping CONSUMABLE_STOCKS·LABEL_PRINT_LOGS, quy tắc đánh số (F_GET_CON_UID), mẫu nhãn, liên kết xác nhận nhập kho, phân quyền·xử lý sự cố·đa khách hàng
tags: [vật tư tiêu hao, nhãn, phát hành, in ấn, vận hành]
keywords: [CONSUMABLE_STOCKS, CONSUMABLE_MASTERS, LABEL_PRINT_LOGS, CON_UID, conUid, F_GET_CON_UID, CON_UID_SEQ, UID vật tư tiêu hao, đánh số, PENDING, ACTIVE, CON_STOCK_STATUS, phát hành nhãn, mẫu nhãn, LABEL_TEMPLATES, in ấn, tái phát hành, print agent, ZPL, BROWSER, đa khách hàng, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_RECEIVING]
---

# Phát hành nhãn vật tư tiêu hao — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình đánh số **UID (`CON_UID`)** để theo dõi riêng lẻ dựa trên master vật tư tiêu hao (`CONSUMABLE_MASTERS`), tạo **instance chưa nhập kho (PENDING)** trong `CONSUMABLE_STOCKS`, và in·tái phát hành nhãn. Phát hành không phải là nhập kho mà là **tạo đối tượng theo dõi + in nhãn**; việc nhập kho thực tế (tăng tồn kho) được xác nhận bằng quét mã vạch tại [Nhập kho vật tư tiêu hao](`CONS_RECEIVING`).

> API (controller `consumables/label`): master có thể phát hành `GET /consumables/label/masters`, đánh số UID+tạo PENDING `POST /consumables/label/create`, danh sách chưa nhập `GET /consumables/label/pending`, xác nhận nhập kho 1 cái/nhiều cái `POST /consumables/label/confirm`·`confirm-bulk`, quét trả lại/xuất/hủy xuất `POST /consumables/label/return`·`issue`·`issue-return`. Tra instance panel phải qua `GET /consumables/stocks`(tham số `consumableCode`·`status`), ghi bổ sung lịch sử in qua `POST /material/label-print/log`, mẫu qua `GET /master/label-templates?category=jig`.
>
> `SELECT * FROM CON_LABELS ...` dưới lưới màn hình chỉ là nhãn hiển thị, tên bảng thực tế là `CONSUMABLE_STOCKS`.

## Cấu trúc dữ liệu
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)         Master vật tư tiêu hao
   └─ 1:N ─▶ CONSUMABLE_STOCKS (PK: CON_UID)     Instance riêng lẻ (đơn vị phát hành)
                 status: PENDING → ACTIVE → MOUNTED/ISSUED/RETURNED ...

LABEL_PRINT_LOGS (PK: PRINTED_AT + SEQ)          Lịch sử phát hành nhãn
   category='con_uid', UID_LIST=mảng JSON UID đã phát hành
```
- 1 lần phát hành = tạo `qty` dòng `CONSUMABLE_STOCKS` + 1 bản ghi `LABEL_PRINT_LOGS`.
- Panel chưa nhập kho chỉ hiển thị các dòng `status='PENDING'` của cùng master (lọc phía client).

## ① Danh sách đối tượng phát hành — CONSUMABLE_MASTERS / tổng hợp (CONSUMABLE_STOCKS)

`GET /consumables/label/masters` trả về master `useYn='Y'` kèm tổng hợp instance.

| Mục màn hình | Cột DB / Tính toán | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Chọn (checkbox) | (trạng thái UI) | Chọn nhiều đối tượng phát hành. Check header để toggle tất cả. 0 cái thì nút phát hành disabled. |
| Hình ảnh | `CONSUMABLE_MASTERS.IMAGE_URL` | Hình thumbnail·nhãn. Giải đường dẫn backend bằng `resolveBackendFileUrl`, fallback placeholder nếu load thất bại. |
| Mã vật tư tiêu hao | `CONSUMABLE_MASTERS.CONSUMABLE_CODE` | Khóa tự nhiên để gom UID đã phát hành (đích FK). |
| Tên vật tư tiêu hao | `CONSUMABLE_MASTERS.NAME` (thuộc tính `consumableName`) | Tìm kiếm·hiển thị trên nhãn. |
| Danh mục | `CONSUMABLE_MASTERS.CATEGORY` | Mã chung `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). Bộ lọc trên cùng. Hiển thị bằng `ComCodeBadge`. |
| Tồn kho hiện tại | `CONSUMABLE_MASTERS.STOCK_QTY` | Số lượng sở hữu, +1 khi xác nhận nhập kho, -1 khi trả lại/xuất kho. |
| Instance | `COUNT(*)` of `CONSUMABLE_STOCKS` (thuộc tính `instanceCount`) | Tổng số đối tượng đã phát hành. Bên cạnh `(Chưa nhập: n)` là `SUM(status='PENDING')`(thuộc tính `pendingCount`). |
| Số lượng phát hành | (trạng thái UI `qtyMap`) | Số lượng đánh số lần này. UI giới hạn 1~99, DTO kiểm tra 1~999(`@Min(1)@Max(999)`). |

## ② Công cụ phát hành nhãn (trên cùng bên phải)

| Mục màn hình | Liên kết | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Thông báo trạng thái | (UI `issueStatus`) | Hiển thị 1 dòng loading/success/error. `aria-live=polite`. |
| Làm mới | `GET /consumables/label/masters` | Tải lại danh sách·tổng hợp. |
| Chọn mẫu nhãn | `GET /master/label-templates?category=jig` | Mẫu danh mục jig trong `LABEL_TEMPLATES`. Ưu tiên `isDefault`, nếu không có thì chọn mục đầu. `__default__` là thiết kế mặc định tích hợp (`createDefaultLabelDesign('jig')`). `designData` là JSON (nếu là chuỗi thì parse). |
| Phát hành UID | `POST /consumables/label/create` | Gửi `{consumableCode, qty}` theo từng master đã chọn → đánh số conUid → in. |

## ③ Panel instance chưa nhập kho — CONSUMABLE_STOCKS

Truy vấn bằng `GET /consumables/stocks?consumableCode=...` rồi chỉ hiển thị `status='PENDING'`.

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| UID vật tư tiêu hao | `CON_UID` | PK. Khóa theo dõi nhãn/mã vạch. |
| Trạng thái | `STATUS` | Mã chung `CON_STOCK_STATUS`. Panel chỉ hiển thị `PENDING`. (Chuyển tiếp: PENDING→ACTIVE→MOUNTED/ISSUED/RETURNED/REPAIR/SCRAPPED) |
| Vị trí lưu trữ | `LOCATION` | Có thể chỉ định khi xác nhận nhập kho. |
| Số lần sử dụng | `CURRENT_COUNT` / Master `EXPECTED_LIFE` | Hiển thị `Số nhát hiện tại / Tuổi thọ dự kiến`. Chưa nhập thường là 0. |
| Ngày nhập kho | `RECV_DATE` | Thời gian xác nhận nhập kho. PENDING là null(`-`). |
| Thiết bị gắn | `MOUNTED_EQUIP_CODE` (thuộc tính `mountedEquipCode`) | Cập nhật trong luồng gắn kết. |
| Nhà cung cấp | `VENDOR_CODE`, `VENDOR_NAME` | Kế thừa từ dto/master khi đánh số. |
| Xem trước | (UI) | Xem trước modal bằng `LabelDesignRenderer` (không in). |
| Tái phát hành | `POST /material/label-print/log` + print agent | Render nhãn thành PNG → gửi đến máy in qua `printAgentPng` + ghi log in. |

## ④ Lịch sử phát hành nhãn — LABEL_PRINT_LOGS

| Mục màn hình (không hiển thị) | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| (Tự động) Thời gian phát hành | `PRINTED_AT` | Khóa phức hợp 1. |
| (Tự động) Số thứ tự | `SEQ` | Khóa phức hợp 2(cố định 1 khi tạo). |
| (Tự động) Phân loại | `CATEGORY` | Cố định `'con_uid'`. |
| (Tự động) Phương thức in | `PRINT_MODE` | `BROWSER`(xuất trình duyệt) / `ZPL`(xuất trực tiếp). create·log là `BROWSER`. |
| (Tự động) Danh sách UID | `UID_LIST` | Mảng JSON conUid đã phát hành (CLOB). |
| (Tự động) Số nhãn | `LABEL_COUNT` | Số lượng phát hành (create là `qty`). |
| (Tự động) Trạng thái | `STATUS` | `SUCCESS`/`FAILED`. |
| (Khóa) Đa khách hàng | `COMPANY`, `PLANT_CD` | `40` / `1000`(thuộc tính `company`, `plant`). |

## Quy tắc đánh số UID (CON_UID)
- Khi phát hành, `NumberingService.nextConUid()` → `PKG_SEQ_GENERATOR`(loại đánh số `CON_UID`) đánh số trong giao dịch (không bỏ số).
- Hàm định dạng `F_GET_CON_UID`: `'C' + TO_CHAR(SYSDATE,'YYMMDD') + LPAD(CON_UID_SEQ.NEXTVAL, 5, '0')`.
  - Ví dụ) Phát hành 2026-06-23 → `C2606230001`, `C2606230002` …
- `CON_UID_SEQ` là Oracle SEQUENCE. Có prefix ngày để phân biệt theo ngày, đảm bảo tính duy nhất bằng giá trị sequence.

## Logic phát hành / in ấn (xuất trình duyệt)
1. **Kiểm tra chọn**: `selectedCodes` 0 cái thì dừng. Nếu `window.open` cửa sổ in mới thất bại (chặn popup) thì báo lỗi và dừng.
2. **Đánh số**(`createConUids`): Với từng master đã chọn, gọi `POST /consumables/label/create`. Server trong giao dịch gọi `nextConUid()` số lần `qty` → lưu `CONSUMABLE_STOCKS`(status=`PENDING`, `LABEL_PRINTED_AT`=now, kế thừa vendor·unitPrice) + ghi 1 bản ghi `LABEL_PRINT_LOGS`. Nếu không có master thì 404.
3. **Cấu hình dữ liệu nhãn**: Gom mỗi conUid với `consumableCode/Name/category/imageUrl/stockQty/expectedLife/location` rồi vẽ bằng `LabelPrintRenderer`.
4. **Chờ render**: Chờ cờ `data-label-barcode-pending` và tải hình ảnh tối đa 2.5 giây. Nếu mã vạch chưa xong thì chặn xuất (khuyến nghị xem trước).
5. **In**: Tạo cửa sổ mới với HTML nhãn + `@page size:{labelWidth}mm {labelHeight}mm` rồi gọi `window.print()`.
6. **Ghi bổ sung log in**: `POST /material/label-print/log`(category=`con_uid`, printMode=`BROWSER`, uidList, SUCCESS). Bỏ qua nếu thất bại (silent).
7. **Kết thúc**: Bỏ chọn·khởi tạo lại trạng thái·làm mới danh sách.

### Logic tái phát hành (xuất trực tiếp agent)
- Panel phải **Tái phát hành**: Chuyển đổi nhãn của 1 conUid thành PNG (tỉ lệ 3x) qua `renderLabelNodeToPngBase64` → gửi `printAgentPng({ jobId: 'CON-REPRINT-{conUid}', widthMm, heightMm, copies:1, contentBase64 })` → ghi `POST /material/label-print/log`. Cần print agent (dịch vụ in cục bộ) đang chạy.
- **Xem trước** chỉ hiển thị modal `LabelDesignRenderer` mà không đánh số·gửi đi (để kiểm tra mã vạch·bố trí trước khi in).

## Thiết lập trước (Master·Mã chung)
- Mã chung: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL), `CON_STOCK_STATUS`(PENDING/ACTIVE/MOUNTED/REPAIR/SCRAPPED...).
- Đánh số: Oracle sequence `CON_UID_SEQ` + hàm `F_GET_CON_UID`, đăng ký loại `CON_UID` trong `PKG_SEQ_GENERATOR`(`seed_seq_rules.sql`).
- Mẫu nhãn: Phải có thiết kế `category='jig'` trong `LABEL_TEMPLATES` mới chọn được (nếu không thì dùng thiết kế mặc định tích hợp). Quản lý thiết kế·mẫu tại màn hình quản lý nhãn.
- Vật tư tiêu hao mục tiêu phải có `CONSUMABLE_MASTERS.USE_YN='Y'` mới hiển thị trong danh sách.

## Quy trình vận hành
1. Tạo **mẫu** nhãn vật tư tiêu hao (jig) tại Quản lý nhãn và chỉ định mặc định (tùy chọn).
2. Tại màn hình này, chọn vật tư tiêu hao + nhập số lượng phát hành → **Phát hành UID** → in nhãn → dán thực tế.
3. Nếu mất·hỏng nhãn, **tái phát hành** UID đó từ panel phải.
4. Sau khi dán, quét mã vạch tại **Nhập kho vật tư tiêu hao** → xác nhận nhập kho(`POST /consumables/label/confirm`): `CONSUMABLE_STOCKS.STATUS` PENDING→ACTIVE, đặt `RECV_DATE`, `CONSUMABLE_MASTERS.STOCK_QTY +1`, ghi lịch sử IN vào `CONSUMABLE_LOGS`(`SEQ_CONSUMABLE_LOGS.NEXTVAL`).

## Phân quyền
Quản trị viên vật tư tiêu hao/vật tư (phát hành·tái phát hành). Người dùng thông thường chỉ tra cứu. In trực tiếp (agent) chỉ hoạt động trên thiết bị đã cài agent in.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Nút phát hành UID bị vô hiệu | Chọn 0 cái hoặc đang phát hành/in | Check ít nhất 1 vật tư tiêu hao, đợi xử lý xong rồi thử lại |
| "Trình duyệt chặn cửa sổ in" | Chặn popup | Cho phép popup trang web rồi phát hành lại |
| "Không có UID nào được phát hành" | Mục chọn·số lượng phát hành = 0 | Kiểm tra số lượng phát hành (1~99) |
| "Tạo mã vạch chưa hoàn tất" | Render mã vạch chưa xong (quá 2.5 giây) | Xem trước nhãn rồi in lại |
| 404 khi phát hành (không có master) | `consumableCode` không tồn tại/khác tenant | Đăng ký master vật tư tiêu hao·kiểm tra tenant |
| "Lỗi xuất agent" khi tái phát hành | Print agent chưa chạy/lỗi | Kiểm tra trạng thái agent in·kết nối máy in |
| Danh sách chưa nhập trống | Không có PENDING cho vật tư tiêu hao đó (đã nhập/không có) | Kiểm tra đã phát hành chưa·trạng thái xác nhận nhập kho |
| Nhãn không hiện ảnh | File `IMAGE_URL` 404 | Tải lại ảnh từ master vật tư tiêu hao |
| Chỉ tăng số instance, tồn kho không đổi | Chưa xác nhận nhập kho (PENDING) | Quét·xác nhận nhập kho tại Nhập kho vật tư tiêu hao |

## Dữ liệu & Liên kết
- Bảng: `CONSUMABLE_STOCKS`(instance phát hành·PK `CON_UID`), `CONSUMABLE_MASTERS`(master·đối tượng phát hành), `LABEL_PRINT_LOGS`(lịch sử phát hành), `CONSUMABLE_LOGS`(lịch sử IN khi xác nhận nhập kho), `LABEL_TEMPLATES`(thiết kế nhãn)
- Đánh số: `CON_UID_SEQ` + `F_GET_CON_UID` + `PKG_SEQ_GENERATOR(CON_UID)`
- Màn hình liên kết: Master vật tư tiêu hao (đối tượng phát hành), Nhập kho vật tư tiêu hao (quét xác nhận nhập kho), Quản lý nhãn (thiết kế mẫu)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
