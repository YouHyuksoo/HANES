---
menuCode: MAT_ISSUE
audience: operator
title: Quản lý xuất kho vật tư (sản xuất hàng loạt) — Hướng dẫn vận hành
summary: Phê duyệt·xử lý yêu cầu xuất kho vật tư sản xuất hàng loạt và xuất kho quét mã vạch, cấu trúc DB, logic trừ tồn kho, chuyển trạng thái, cơ chế hủy·bút toán đảo và xử lý sự cố
tags: [vật tư, xuất kho, sản xuất hàng loạt, vận hành, trừ tồn kho]
keywords: [xuất kho vật tư, xuất sản xuất hàng loạt, MAT_ISSUES, MAT_ISSUE_REQUESTS, MAT_ISSUE_REQUEST_ITEMS, MAT_STOCKS, STOCK_TRANSACTIONS, tài khoản xuất, ISSUE_TYPE, PRODUCTION, trừ tồn kho, bút toán đảo, hủy xuất kho, WIP_MAT_STOCKS, di chuyển công đoạn, WIP_MOVE, MAT_OUT, số xuất kho, số yêu cầu, matUid, serial vật tư, IQC đạt, HOLD, DEPLETED, đa khách hàng, COMPANY, PLANT_CD]
related: [MAT_REQUEST, MAT_ISSUE_OTHER, MST_PART]
---

# Quản lý xuất kho vật tư (sản xuất hàng loạt) — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình cấp phát vật tư từ kho ra hiện trường sản xuất theo tài khoản sản xuất hàng loạt (PRODUCTION). Khi xác nhận xuất kho, hệ thống **trừ MAT_STOCKS (tồn kho nguyên vật liệu)** và tạo bản ghi **MAT_ISSUES (lịch sử xuất kho)** cùng **STOCK_TRANSACTIONS (giao dịch tồn kho)**. Nếu lệnh sản xuất đã được phân bổ thiết bị, hệ thống đồng thời trừ kho nguyên vật liệu và **cộng vào WIP_MAT_STOCKS (tồn kho công đoạn)**.

## Luồng xử lý
```
Tạo yêu cầu xuất kho(MAT_ISSUE_REQUESTS: REQUESTED)
  → Phê duyệt(APPROVED)
  → Xử lý xuất kho(MatIssueService.createInTx)
      → Tạo MAT_ISSUES(DONE)
      → Trừ MAT_STOCKS (giảm availableQty/qty)
      → Ghi STOCK_TRANSACTIONS (MAT_OUT hoặc WIP_MOVE)
      → [Khi có phân bổ thiết bị] Cộng WIP_MAT_STOCKS
      → Nếu tồn kho còn lại = 0 thì MAT_LOTS.status → DEPLETED
  → Khi tất cả hạng mục xuất hết thì trạng thái yêu cầu → COMPLETED
```

---

## Cấu trúc dữ liệu
```
MAT_ISSUE_REQUESTS (Header yêu cầu xuất kho)
  └─ MAT_ISSUE_REQUEST_ITEMS (Chi tiết hạng mục yêu cầu, PK: REQUEST_ID + SEQ)

MAT_ISSUES (Kết quả xuất kho, PK: ISSUE_NO + SEQ)
  ├─ MAT_LOTS (LOT vật tư, tham chiếu matUid)
  ├─ MAT_STOCKS (Tồn kho theo kho — đối tượng trừ)
  └─ STOCK_TRANSACTIONS (Lịch sử giao dịch tồn kho)

MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
  └─ WIP_MAT_STOCKS (Tồn kho công đoạn, theo thiết bị — cộng khi di chuyển công đoạn)
```

---

## ① Yêu cầu xuất kho — MAT_ISSUE_REQUESTS / MAT_ISSUE_REQUEST_ITEMS (toàn bộ cột)

### MAT_ISSUE_REQUESTS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|---|---|---|
| **Số yêu cầu(requestNo)** | `REQUEST_NO` VARCHAR2(50) PK | Khóa tự nhiên. Tự động tạo từ sequence `MAT_REQ` (dạng `REQ-YYYYMMDD-NNN`). |
| **Lệnh sản xuất(workOrderNo / orderNo)** | `ORDER_NO` VARCHAR2(50) | Lệnh sản xuất kết nối. Nếu có, hạng mục dựa trên BOM tự động tính và điền vào hạng mục yêu cầu. |
| **Ngày yêu cầu(requestDate)** | `REQUEST_DATE` TIMESTAMP | Thời gian đăng ký yêu cầu. DEFAULT CURRENT_TIMESTAMP. |
| **Trạng thái(status)** | `STATUS` VARCHAR2(20) | REQUESTED → APPROVED → COMPLETED (hoặc REJECTED). DEFAULT 'REQUESTED'. |
| **Người yêu cầu(requester)** | `REQUESTER` VARCHAR2(100) | Người phụ trách yêu cầu xuất kho. Hiện cố định SYSTEM. |
| **Người phê duyệt(approver)** | `APPROVER` VARCHAR2(100) | Người phụ trách xử lý phê duyệt. |
| **Ngày phê duyệt(approvedAt)** | `APPROVED_AT` TIMESTAMP | Thời gian xử lý phê duyệt. |
| **Lý do từ chối(rejectReason)** | `REJECT_REASON` VARCHAR2(500) | Lý do nhập khi từ chối. |
| **Tài khoản xuất(issueType)** | `ISSUE_TYPE` VARCHAR2(20) | Theo mã chung `ISSUE_TYPE`. Trên màn hình này là PRODUCTION. |
| **Ghi chú(remark)** | `REMARK` VARCHAR2(500) | Ghi chú tự do. |
| **Phạm vi đa khách hàng** | `COMPANY` / `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'`. Tự động áp dụng cho mọi truy vấn·xử lý. |

### MAT_ISSUE_REQUEST_ITEMS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|---|---|---|
| **Số yêu cầu(requestId)** | `REQUEST_ID` VARCHAR2(50) PK | Vai trò FK tham chiếu header `REQUEST_NO`. |
| **Số thứ tự(seq)** | `SEQ` INT PK | Số thứ tự hạng mục trong yêu cầu. Một phần của khóa phức hợp. |
| **Mã hạng mục(itemCode)** | `ITEM_CODE` VARCHAR2(50) | Hạng mục yêu cầu xuất kho. Chỉ bao gồm nguyên vật liệu (RAW), không bao gồm sản phẩm·vật tư tiêu hao (MRO). |
| **Số lượng yêu cầu(requestQty)** | `REQUEST_QTY` INT | Số lượng hiện trường yêu cầu. |
| **Số lượng đã xuất(issuedQty)** | `ISSUED_QTY` INT | Tổng số lượng thực tế đã xuất. DEFAULT 0. Tăng dần khi xuất một phần. |
| **Đơn vị(unit)** | `UNIT` VARCHAR2(20) | Đơn vị số lượng. |
| **Nhu cầu BOM(bomReqQty)** | `BOM_REQ_QTY` NUMBER(12,3) | qtyPer BOM × số lượng sản xuất. Tự động tính khi yêu cầu dựa trên lệnh sản xuất. |
| **Số lượng đã cấp trước(prevIssueQty)** | `PREV_ISSUE_QTY` NUMBER(12,3) | Số lượng đã xuất kho cho lệnh sản xuất đó trước đây. |
| **Tồn kho hiện trường(floorStockQty)** | `FLOOR_STOCK_QTY` NUMBER(12,3) | Tồn kho khả dụng theo kho FLOOR. |
| **Ghi chú** | `REMARK` VARCHAR2(500) | Ghi chú theo hạng mục. |
| **Đa khách hàng** | `COMPANY` / `PLANT_CD` | Cùng phạm vi header. |

---

## ② Kết quả xuất kho — MAT_ISSUES (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|---|---|---|
| **Số xuất kho(issueNo)** | `ISSUE_NO` VARCHAR2(50) PK | Sequence `MAT_ISSUE`. Một giao dịch xuất kho có thể có nhiều SEQ được gom. |
| **Số thứ tự(seq)** | `SEQ` INT PK | Số thứ tự dòng hạng mục. DEFAULT 1. |
| **Lệnh sản xuất(orderNo)** | `ORDER_NO` VARCHAR2(50) | Lệnh sản xuất kết nối. NULL nếu không có. |
| **Số kết quả sản xuất(prodResultNo)** | `PROD_RESULT_ID` VARCHAR2(50) | Kết nối với kết quả sản xuất. Dùng để kiểm tra tiến độ công đoạn sau khi hủy. |
| **Serial vật tư(matUid)** | `MAT_UID` VARCHAR2(50) | Serial LOT đã xuất. Tham chiếu `MAT_LOTS.MAT_UID`. |
| **Số lượng xuất(issueQty)** | `ISSUE_QTY` INT | Số lượng thực tế đã xuất. |
| **Ngày xuất(issueDate)** | `ISSUE_DATE` TIMESTAMP | Thời gian xử lý xuất kho. DEFAULT CURRENT_TIMESTAMP. |
| **Tài khoản xuất(issueType)** | `ISSUE_TYPE` VARCHAR2(20) | Mã chung `ISSUE_TYPE`. DEFAULT 'PROD'. Trên màn hình này tạo với PRODUCTION. |
| **Nhân viên(workerId)** | `WORKER_ID` VARCHAR2(50) | ID nhân viên xử lý. |
| **Người cấp phát(issuerId / issuerName)** | `ISSUER_ID` / `ISSUER_NAME` | Mã số·tên người phụ trách thực tế cấp phát vật tư (dự kiến hỗ trợ quét mã vạch). |
| **Người nhận(receiverId / receiverName)** | `RECEIVER_ID` / `RECEIVER_NAME` | Mã số·tên người phụ trách nhận vật tư (dự kiến hỗ trợ quét mã vạch). |
| **Ghi chú(remark)** | `REMARK` VARCHAR2(500) | Lý do xuất kho hoặc thông báo tự động tạo. |
| **Trạng thái(status)** | `STATUS` VARCHAR2(20) | DONE(hoàn tất) / CANCELED(hủy). DEFAULT 'DONE'. |
| **Đa khách hàng** | `COMPANY` / `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'`. |

---

## ③ Tồn kho — MAT_STOCKS (đối tượng trừ khi xuất kho)

| Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|---|---|
| `COMPANY` + `PLANT_CD` + `WAREHOUSE_CODE` + `ITEM_CODE` + `MAT_UID` | Khóa phức hợp. Quản lý tồn kho theo kho·hạng mục·LOT. |
| `QTY` | Tổng số lượng. Giảm khi xuất kho. |
| `RESERVED_QTY` | Số lượng đặt trước (chiếm chỗ). |
| `AVAILABLE_QTY` | Số lượng khả dụng (= QTY − RESERVED_QTY). Tiêu chuẩn giảm thực tế khi xuất kho. |
| `LOCATION_CODE` | Mã vị trí trong kho. |

> Khi xử lý xuất kho, `QTY` và `AVAILABLE_QTY` cùng giảm. Nếu tồn kho phân tán ở nhiều kho, ưu tiên kho đã chỉ định, phần còn lại trừ tuần tự theo mã kho tăng dần.

---

## Logic xử lý xuất kho (trừ tồn kho)

### Xuất kho thông thường (MAT_OUT đơn thuần)
1. Tra LOT(`matUid`) → Kiểm tra IQC đạt(PASS) · không tạm giữ(not HOLD).
2. Tra số lượng khả dụng trong `MAT_STOCKS` → Kiểm tra đáp ứng số lượng yêu cầu xuất.
3. Tạo dòng `MAT_ISSUES`(status=DONE).
4. Trừ `MAT_STOCKS.QTY` và `AVAILABLE_QTY`.
5. Ghi `STOCK_TRANSACTIONS` (`transType='MAT_OUT'`, `qty=−số lượng xuất`).
6. Nếu tồn kho LOT còn lại = 0 thì `MAT_LOTS.status → 'DEPLETED'`.

### Xuất kho di chuyển công đoạn (khi có lệnh sản xuất + phân bổ thiết bị, WIP_MOVE)
- Quá trình 1~5 giống như trên, trừ MAT_STOCKS.
- Thêm: **cộng** cùng số lượng vào `WIP_MAT_STOCKS`(tồn kho công đoạn) (`transType='WIP_MOVE'`, `transType='WIP_IN'`).
- Tiêu thụ từ tồn kho công đoạn khi nhập kết quả sản xuất.

### Xuất kho quét mã vạch (scan)
- Gọi `POST /material/issues/scan`. Truyền `{ matUid, issueType }`.
- Xuất kho **toàn bộ** số lượng tồn kho khả dụng của LOT. Không điều chỉnh được số lượng.
- Nội bộ tái sử dụng logic xuất kho thông thường trên.

---

## Logic hủy xuất kho (bút toán đảo)

1. Cập nhật `MAT_ISSUES.status → 'CANCELED'`.
2. Tra `STOCK_TRANSACTIONS` gốc (refType='MAT_ISSUE', refId='issueNo-seq').
3. Với mỗi giao dịch gốc, tạo **giao dịch bút toán đảo**:
   - Xuất đơn thuần(MAT_OUT) → giao dịch `MAT_OUT_CANCEL` + khôi phục `MAT_STOCKS` (cộng).
   - Di chuyển công đoạn(WIP_MOVE) → giao dịch `WIP_MOVE_CANCEL` + khôi phục `MAT_STOCKS` + trừ khôi phục `WIP_MAT_STOCKS`(`WIP_IN_CANCEL`).
4. Khôi phục `MAT_LOTS.status → 'NORMAL'` (nếu là DEPLETED thì bỏ).

> **Điều kiện không thể hủy**: Nếu công đoạn sau của lần xuất đó (kết quả sản xuất RUNNING/DONE, nhãn FG) tồn tại thì chặn hủy. Hãy xử lý ngược theo thứ tự Xuất hàng → Pallet → Hộp/OQC → Nhãn FG → Kết quả sản xuất rồi thử lại.

---

## Chuyển trạng thái yêu cầu xuất kho

```
REQUESTED  → (Phê duyệt) →  APPROVED
           → (Từ chối)   →  REJECTED

APPROVED   → (Xuất hết tất cả hạng mục) →  COMPLETED
           → (Xuất một phần)            →  APPROVED (giữ nguyên)
```

- Chỉ phê duyệt·từ chối được ở trạng thái `REQUESTED`.
- Chỉ xử lý xuất kho được ở trạng thái `APPROVED`.
- Nếu còn số lượng, giữ trạng thái `APPROVED` sau khi xuất một phần.

---

## Điều kiện xuất kho (điểm kiểm tra của người vận hành)

Để xuất LOT, cần **đáp ứng tất cả**:

- `MAT_LOTS.iqcStatus = 'PASS'` (IQC đạt)
- `MAT_LOTS.status != 'HOLD'` (không tạm giữ)
- `MAT_STOCKS.availableQty >= số lượng yêu cầu xuất` (tồn kho đủ)
- `MAT_LOTS.status != 'DEPLETED'` (chưa cạn, khi xuất quét)
- Khi xuất dựa trên yêu cầu: `MAT_ISSUE_REQUESTS.status = 'APPROVED'`
- Khi xuất dựa trên yêu cầu: Mã hạng mục LOT = mã hạng mục yêu cầu

---

## Thiết lập trước (Master·Mã chung)

| Mục thiết lập | Vị trí | Nội dung |
|---|---|---|
| Master hạng mục | `MST_PART` | itemType phải là nguyên vật liệu mới được đưa vào hạng mục yêu cầu xuất |
| Mã chung ISSUE_TYPE | Quản lý mã chung | Định nghĩa loại xuất PRODUCTION, MANUAL, SCRAP... |
| Master kho | Quản lý kho | Đăng ký kho nguyên vật liệu · kho loại FLOOR |
| Master BOM | `MST_BOM` | Dùng để tự động tính hạng mục dựa trên lệnh sản xuất |
| Lệnh sản xuất · Phân bổ thiết bị | `PRD_JOB_ORDERS` | Việc có phân bổ thiết bị hay không quyết định rẽ nhánh MAT_OUT vs WIP_MOVE |

---

## Quy trình vận hành

1. Hiện trường đăng ký yêu cầu xuất kho → tạo `MAT_ISSUE_REQUESTS`(REQUESTED).
2. Kho/quản trị viên xem xét yêu cầu tại tab **Xử lý yêu cầu xuất kho**, phê duyệt hoặc từ chối.
3. Sau phê duyệt, dùng nút **Xử lý xuất kho** để chọn LOT · xác nhận số lượng · thực hiện xuất.
4. Có thể xuất một phần — nếu còn số lượng, giữ APPROVED, có thể xuất thêm.
5. Xuất khẩn cấp: tab **Quét mã vạch** quét mã vạch LOT → xuất toàn bộ ngay lập tức.
6. Nếu xuất sai, tìm giao dịch đó tại tab **Lịch sử xuất kho** và xử lý hủy (bắt buộc nhập lý do).

---

## Phân quyền

| Vai trò | Thao tác được phép |
|---|---|
| Nhân viên kho | Xử lý xuất kho (quét mã vạch), tra lịch sử |
| Quản trị viên / Nhân viên vật tư | Phê duyệt·từ chối yêu cầu xuất kho, xử lý xuất, hủy, tra lịch sử |
| Người dùng thông thường | Chỉ tra lịch sử |

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Modal xử lý xuất kho không có LOT | Hạng mục đó không có IQC đạt + tồn kho khả dụng > 0 | Kiểm tra tình trạng nhập kho vật tư và kết quả IQC |
| Khi quét mã vạch "IQC không đạt" | `MAT_LOTS.iqcStatus != 'PASS'` | Yêu cầu nhân viên IQC hoàn tất kiểm tra |
| Khi quét mã vạch "LOT tạm giữ" | `MAT_LOTS.status = 'HOLD'` | Bỏ tạm giữ rồi xuất kho |
| Khi quét mã vạch "LOT đã cạn" | `MAT_LOTS.status = 'DEPLETED'` hoặc availableQty = 0 | Dùng LOT khác hoặc kiểm tra điều chỉnh tồn kho |
| "Tồn kho LOT không đủ" | `MAT_STOCKS.availableQty < issueQty` | Tra tình trạng tồn kho rồi xác nhận lại số lượng |
| Hủy xuất kho bị chặn | Có công đoạn sau (kết quả sản xuất RUNNING/DONE, nhãn FG) | Xử lý ngược: Xuất hàng → Pallet → Hộp/OQC → Nhãn FG → Kết quả sản xuất rồi thử lại |
| "Đã hủy xuất kho" | `MAT_ISSUES.status = 'CANCELED'` | Đã xử lý hủy. Tránh yêu cầu trùng |
| Mã hạng mục không khớp | Mã hạng mục của LOT chọn khác mã hạng mục yêu cầu | Chọn LOT đúng hoặc xác nhận lại hạng mục yêu cầu |
| Sau phê duyệt không thể xuất | `MAT_ISSUE_REQUESTS.status != 'APPROVED'` | Kiểm tra trạng thái; nếu REQUESTED thì phê duyệt trước |

---

## Dữ liệu & Liên kết

| Mục | Nội dung |
|---|---|
| **Bảng cốt lõi** | `MAT_ISSUES`, `MAT_ISSUE_REQUESTS`, `MAT_ISSUE_REQUEST_ITEMS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| **Bảng liên kết** | `MAT_LOTS`(thông tin LOT), `PART_MASTERS`(tên hạng mục·đơn vị), `JOB_ORDERS`(lệnh sản xuất·thiết bị), `WIP_MAT_STOCKS`(tồn kho công đoạn), `MAT_LOTS.status`(tự động đặt DEPLETED) |
| **Màn hình liên kết** | Quản lý yêu cầu xuất kho(MAT_REQUEST), Quản lý xuất kho khác(MAT_ISSUE_OTHER), Tình trạng tồn kho vật tư(MAT_STOCK), Kết quả sản xuất |
| **API** | `GET /material/issue-requests`, `PATCH /material/issue-requests/:id/approve·reject`, `POST /material/issue-requests/:id/issue`, `POST /material/issues/scan`, `GET /material/issues`, `POST /material/issues/:no/:seq/cancel` |
| **Phạm vi đa khách hàng** | `COMPANY='40'`, `PLANT_CD='1000'` — tự động áp dụng cho mọi truy vấn·tạo·hủy |
