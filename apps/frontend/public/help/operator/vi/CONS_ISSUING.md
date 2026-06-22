---
menuCode: CONS_ISSUING
audience: operator
title: Xuất kho vật tư tiêu hao — Hướng dẫn vận hành
summary: API·DB mapping (chuyển trạng thái CONSUMABLE_STOCKS, lịch sử CONSUMABLE_LOGS), logic cộng trừ tồn kho, phân quyền, xử lý sự cố, phạm vi đa khách hàng cho xuất kho/hủy xuất kho (UID) vật tư tiêu hao
tags: [vật tư tiêu hao, xuất kho, trả lại, vận hành, trừ tồn kho]
keywords: [xuất kho vật tư tiêu hao, xuất kho, hủy xuất kho, trả lại xuất kho, OUT, OUT_RETURN, ISSUED, ACTIVE, conUid, CONSUMABLE_STOCKS, CONSUMABLE_LOGS, CONSUMABLE_MASTERS, STOCK_QTY, SEQ_CONSUMABLE_LOGS, issueByScan, issueReturnByScan, logTypeGroup, đa khách hàng, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_RECEIVING, CONS_STOCK]
---

# Xuất kho vật tư tiêu hao — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình xử lý **xuất kho/hủy xuất kho** theo từng instance riêng lẻ (`CONSUMABLE_STOCKS`) dựa trên **UID (`CON_UID`)**. Khi xuất kho, trạng thái instance chuyển từ `ACTIVE → ISSUED`, giảm `STOCK_QTY` của master (`CONSUMABLE_MASTERS`) đi 1, và ghi 1 log `OUT` vào lịch sử (`CONSUMABLE_LOGS`). Hủy xuất kho thực hiện ngược lại (`ISSUED → ACTIVE`, tồn kho +1, log `OUT_RETURN`).

> API: xuất kho `POST /consumables/label/issue`(`{ conUid, department?, issueReason?, remark? }`), hủy xuất kho `POST /consumables/label/issue-return`(`{ conUid, returnReason? }`), tra lịch sử `GET /consumables/logs?logTypeGroup=ISSUING&startDate=&endDate=&limit=`. `SELECT * FROM CONSUMABLE_LOGS ...` trên lưới là nhãn hiển thị, truy vấn thực tế qua API logs nêu trên.

## Cấu trúc dữ liệu
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)
   ├─ STOCK_QTY  (giảm -1 khi xuất / tăng +1 khi hủy xuất)
   └─ 1:N ─▶ CONSUMABLE_STOCKS (instance riêng lẻ, PK: CON_UID)
                 └─ STATUS: PENDING → ACTIVE → ISSUED (hủy thì về ACTIVE)

CONSUMABLE_LOGS (PK: TRANS_DATE + SEQ)  ← lịch sử xuất/hủy (đánh số SEQ_CONSUMABLE_LOGS)
   └─ LOG_TYPE: OUT(xuất) / OUT_RETURN(hủy xuất)  · nhóm truy vấn logTypeGroup=ISSUING = In('OUT','OUT_RETURN')
```

## Chuyển trạng thái xuất/hủy (ý nghĩa vận hành)
- **Xuất kho (`issueByScan`)**: Chỉ cho phép UID có `STATUS='ACTIVE'`. Nếu không, 400(`Chỉ có thể xuất kho ở trạng thái ACTIVE`). Không có UID thì 404.
- **Hủy xuất kho (`issueReturnByScan`)**: Chỉ cho phép UID có `STATUS='ISSUED'`. Nếu không, 400(`Chỉ có thể hủy xuất kho ở trạng thái ISSUED`).
- Mỗi giao dịch xử lý 1 UID = số lượng 1. Nhiều UID thì quét tuần tự (giao dịch theo từng cái).

---

## ① Bảng quét (nhập màn hình ↔ DTO)

| Mục màn hình | Trường truyền (DTO) | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Xuất kho / Trả lại xuất kho (chế độ toggle) | (trạng thái FE `mode`) | `issue` → gọi `/consumables/label/issue`, `issue-return` → gọi `/consumables/label/issue-return`. Không lưu DB. |
| Ô nhập UID | `conUid` (IssueConDto / IssueReturnConDto) | `CON_UID` quét/nhập. Bắt buộc. Khóa truy vấn 1 bản ghi `CONSUMABLE_STOCKS`. |
| (Tự động/không hiển thị) Phòng ban xuất | `department` → `CONSUMABLE_LOGS.DEPARTMENT` | Có thể truyền khi xuất. Hiện tại bảng quét không truyền (lưu null). |
| (Tự động/không hiển thị) Lý do xuất | `issueReason` → `CONSUMABLE_LOGS.ISSUE_REASON` | Lý do xuất kho. Hiện tại bảng quét không truyền. |
| (Tự động/không hiển thị) Ghi chú | `remark` → `CONSUMABLE_STOCKS.REMARK` | Cập nhật ghi chú instance khi xuất. Hiện tại không truyền. |
| (Hủy) Lý do hủy | `returnReason` → `CONSUMABLE_LOGS.RETURN_REASON` · `STOCKS.REMARK` | Lý do khi hủy xuất kho. Hiện tại bảng quét không truyền (null). |

> `department`/`issueReason`/`remark`/`returnReason` có trong DTO·DB nhưng UI quét hiện tại không gửi nên lưu null (dự phòng mở rộng nhập liệu sau này).

## ② Lịch sử xuất kho — CONSUMABLE_LOGS (cột màn hình ↔ DB)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Thời gian | `CREATED_AT` | Thời gian tạo log (TIMESTAMP, DEFAULT SYSTIMESTAMP). Bộ lọc khoảng thời gian dựa trên `CREATED_AT` `Between(start,end)`. |
| Mã vật tư tiêu hao | `CONSUMABLE_CODE` | FK master (`CONSUMABLE_MASTERS.CONSUMABLE_CODE`). |
| Tên vật tư tiêu hao | (JOIN) `CONSUMABLE_MASTERS.NAME` | JOIN `relations:['master']` ánh xạ thành `consumableName`. |
| UID | `CON_UID` | UID instance đã xuất. nullable (tương thích log số lượng cũ). |
| Loại | `LOG_TYPE` | `OUT`(xuất)/`OUT_RETURN`(hủy xuất). `logTypeGroup=ISSUING` lọc bằng `In('OUT','OUT_RETURN')`. |
| Số lượng | `QTY` | INT, mặc định 1. Màn hình hiển thị dấu `-` cho OUT, `+` cho OUT_RETURN (giá trị lưu là dương 1). |
| Dây chuyền | `LINE_CODE` | Dây chuyền xuất (nullable). |
| Thiết bị | `EQUIP_CODE` | Thiết bị xuất (nullable). |
| Ghi chú | `REMARK` | Ghi nhớ (nullable). |
| (Khóa) Ngày giao dịch | `TRANS_DATE` | Khóa phức hợp. Lưu cắt giờ về 0h cùng ngày (`setHours(0,0,0,0)`). |
| (Khóa) Số thứ tự | `SEQ` | Khóa phức hợp. Đánh số bằng `SEQ_CONSUMABLE_LOGS.NEXTVAL`. |
| (Có điều kiện) Phòng ban xuất | `DEPARTMENT` | Chỉ log xuất kho. |
| (Có điều kiện) Lý do xuất | `ISSUE_REASON` | Chỉ log xuất kho. |
| (Có điều kiện) Lý do trả lại | `RETURN_REASON` | Chỉ log hủy xuất kho. |
| Đa khách hàng | `COMPANY` / `PLANT_CD` | `40` / `1000` (thuộc tính entity `company`/`plant`). |

## ③ Trạng thái instance — CONSUMABLE_STOCKS (đối tượng xuất)

| Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|
| `CON_UID` | PK (khóa tự nhiên). Khóa quét. |
| `CONSUMABLE_CODE` | FK master. |
| `STATUS` | PENDING/ACTIVE/ISSUED/RETURNED... Xuất=ACTIVE→ISSUED, hủy xuất=ISSUED→ACTIVE. |
| `REMARK` | Cập nhật bằng remark·returnReason truyền vào khi xuất/hủy. |
| `COMPANY` / `PLANT_CD` | Đa khách hàng (`40`/`1000`, thuộc tính `company`/`plantCd`). |

---

## Logic xử lý xuất kho (cộng trừ tồn kho)

### Xuất kho (`issueByScan`)
1. Tra 1 bản ghi `CONSUMABLE_STOCKS` theo `CON_UID` → không có thì 404.
2. Kiểm tra `STATUS='ACTIVE'` → không thì 400.
3. Trong giao dịch:
   - Lưu `STATUS='ISSUED'`, `REMARK=remark`.
   - `CONSUMABLE_MASTERS.STOCK_QTY -= 1`(`decrement`).
   - Đánh số `SEQ_CONSUMABLE_LOGS.NEXTVAL` → ghi `CONSUMABLE_LOGS` với `LOG_TYPE='OUT'`, `QTY=1`, `CON_UID`, `DEPARTMENT`, `ISSUE_REASON`.

### Hủy xuất kho (`issueReturnByScan`)
1~2. Tra tương tự, kiểm tra `STATUS='ISSUED'` (không thì 400).
3. Trong giao dịch:
   - Lưu `STATUS='ACTIVE'`, `REMARK=returnReason`.
   - `CONSUMABLE_MASTERS.STOCK_QTY += 1`(`increment`).
   - Ghi `CONSUMABLE_LOGS` với `LOG_TYPE='OUT_RETURN'`, `QTY=1`, `RETURN_REASON`.

> Nguồn duy nhất của số lượng tồn kho là `CONSUMABLE_MASTERS.STOCK_QTY`, chỉ thay đổi qua xuất/hủy. Theo dõi cấp instance do `CONSUMABLE_STOCKS.STATUS` đảm nhiệm.

## Thiết lập trước (Master·Mã chung)
- UID xuất kho phải được **xác nhận nhập kho (`ACTIVE`)** tại [Nhập kho vật tư tiêu hao](/consumables/receiving) (PENDING chưa nhập thì không thể xuất).
- UID được đánh số (`SEQ_CON_UID`/`F_GET_CON_UID`) tại [Nhập kho vật tư tiêu hao] theo [Master vật tư tiêu hao](/consumables/master).
- Nhãn loại (xuất/trả lại xuất) hiển thị qua i18n (`consumables.issuing.typeOut`/`typeOutReturn`). Giá trị mã `LOG_TYPE` cố định (OUT/OUT_RETURN).

## Quy trình vận hành
1. Tạo UID ở trạng thái `ACTIVE` bằng xác nhận nhập kho (màn hình Nhập kho vật tư tiêu hao).
2. Quét UID ở chế độ **Xuất kho** → xác nhận xuất (`ACTIVE→ISSUED`, tồn kho -1).
3. Nếu xuất sai, quét cùng UID ở chế độ **Trả lại xuất kho** → xác nhận hủy (`ISSUED→ACTIVE`, tồn kho +1).
4. Kiểm tra và xuất lịch sử xử lý qua bảng lịch sử với bộ lọc khoảng thời gian·loại.

## Phân quyền
| Vai trò | Thao tác được phép |
|------|------|
| Nhân viên kho/hiện trường | Quét UID xuất·hủy xuất, tra lịch sử |
| Người dùng thông thường | Chỉ tra lịch sử |

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Khi quét "Không tìm thấy UID"(404) | `CON_UID` không tồn tại hoặc ngoài phạm vi công ty/khác nhà máy | Kiểm tra UID·mã vạch, xác nhận cùng COMPANY/PLANT_CD |
| Khi xuất "Chỉ có thể xuất ở trạng thái ACTIVE"(400) | UID ở trạng thái PENDING(chưa nhập)·ISSUED(đã xuất)·RETURNED | Xác nhận nhập kho tại Nhập kho vật tư tiêu hao hoặc kiểm tra trạng thái hiện tại |
| Khi hủy xuất "Chỉ có thể hủy ở trạng thái ISSUED"(400) | UID không ở trạng thái đã xuất | Nếu đã ACTIVE thì không cần hủy. Kiểm tra lại trạng thái |
| Lịch sử không thấy giao dịch vừa thực hiện | Mặc định tra theo ngày hôm nay / bộ lọc loại | Điều chỉnh khoảng ngày·bộ lọc loại rồi làm mới |
| Số lượng tồn kho không khớp | Thay đổi ngoài luồng bình thường như INSERT thủ công | Xuất/hủy chỉ thực hiện `STOCK_QTY` ±1. Đối chiếu STATUS instance và log |
| Phòng ban/lý do xuất bị lưu trống | Bảng quét hiện tại không truyền các trường này | Bình thường (hạng mục mở rộng nhập liệu sau này). Nếu cần ghi lý do, dùng API đăng ký lịch sử nhập xuất |

## Dữ liệu & Liên kết
- Bảng: `CONSUMABLE_STOCKS`(đối tượng chuyển trạng thái), `CONSUMABLE_LOGS`(lịch sử xuất/hủy), `CONSUMABLE_MASTERS`(số lượng tồn kho `STOCK_QTY`)
- Màn hình liên kết: [Master vật tư tiêu hao](/consumables/master), [Nhập kho vật tư tiêu hao](/consumables/receiving), [Tồn kho vật tư tiêu hao](/consumables/stock)
- API: `POST /consumables/label/issue`, `POST /consumables/label/issue-return`, `GET /consumables/logs?logTypeGroup=ISSUING`
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'` — tự động áp dụng cho truy vấn·xuất·hủy
