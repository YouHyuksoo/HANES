---
menuCode: MAT_REQUEST
audience: operator
title: Quản lý yêu cầu xuất kho — Hướng dẫn vận hành
summary: Logic tạo·phê duyệt·từ chối·liên kết xuất thực tế của yêu cầu xuất kho vật tư (MAT_ISSUE_REQUESTS), cấu trúc DB, chuyển trạng thái, phân quyền·xử lý sự cố
tags: [vật tư, yêu cầu xuất kho, vận hành, BOM]
keywords: [MAT_ISSUE_REQUESTS, MAT_ISSUE_REQUEST_ITEMS, REQUEST_NO, ORDER_NO, ISSUE_TYPE, REQUESTED, APPROVED, REJECTED, COMPLETED, bomReqQty, BOM_REQ_QTY, prevIssueQty, PREV_ISSUE_QTY, floorStockQty, FLOOR_STOCK_QTY, RAW_MATERIAL, yêu cầu xuất kho, phê duyệt, từ chối, xuất thực tế, đầu vào sản xuất, mẫu thử, mẫu]
related: [MAT_ISSUE, MST_PART]
---

# Quản lý yêu cầu xuất kho — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống

Màn hình quy trình phê duyệt nơi hiện trường sản xuất **yêu cầu** nguyên vật liệu với kho, và nhân viên kho **phê duyệt·từ chối** sau đó liên kết xuất thực tế (`MAT_ISSUES`). Luồng 3 bước yêu cầu-phê duyệt-xuất kho được DB theo dõi để đảm bảo độ chính xác tồn kho và trách nhiệm cấp phát.

```
Đăng ký yêu cầu xuất kho(REQUESTED)
  ↓ Phê duyệt(PATCH /approve)          → APPROVED
  ↓ Từ chối(PATCH /reject)             → REJECTED
      ↓ Xuất thực tế(POST /:requestNo/issue) → COMPLETED
```

Phạm vi đa khách hàng: `COMPANY='40'`, `PLANT_CD='1000'` áp dụng cho mọi truy vấn.

---

## Cấu trúc dữ liệu

```
MAT_ISSUE_REQUESTS (Header, 1 cái = 1 yêu cầu xuất kho)
  └─ MAT_ISSUE_REQUEST_ITEMS (Hạng mục, N cái)
         ↓ Khi xử lý xuất thực tế
     MAT_ISSUES / MAT_ISSUE_ITEMS (Ghi nhận xuất thực tế)
```

- **MAT_ISSUE_REQUESTS** — Header yêu cầu xuất kho. Khóa tự nhiên `REQUEST_NO` PK.
- **MAT_ISSUE_REQUEST_ITEMS** — Chi tiết hạng mục yêu cầu xuất kho. `REQUEST_ID + SEQ` khóa phức hợp.
- Xuất thực tế được ghi vào bảng riêng `MAT_ISSUES` và phản ánh vào tồn kho `MatStock`.

---

## ① Header yêu cầu xuất kho — MAT_ISSUE_REQUESTS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| **Số yêu cầu(requestNo)** | `REQUEST_NO VARCHAR2(50) PK` | Khóa tự nhiên yêu cầu xuất kho. Cách đánh số do service layer quyết định. |
| **Số lệnh sản xuất(orderNo)** | `ORDER_NO VARCHAR2(50)` | Số lệnh sản xuất đã kết nối. NULL cho phép (yêu cầu xuất thủ công). Liên kết logic với `PRODUCTION_JOB_ORDERS`. |
| **Ngày yêu cầu(requestDate)** | `REQUEST_DATE TIMESTAMP` | Thời gian đăng ký yêu cầu. Mặc định `CURRENT_TIMESTAMP`. |
| **Trạng thái(status)** | `STATUS VARCHAR2(20)` | Mặc định `REQUESTED`. Giá trị cho phép: `REQUESTED / APPROVED / REJECTED / COMPLETED`. |
| **Người yêu cầu(requester)** | `REQUESTER VARCHAR2(100)` | Định danh người dùng yêu cầu xuất kho. NOT NULL. |
| **Người phê duyệt(approver)** | `APPROVER VARCHAR2(100)` | Người dùng xử lý phê duyệt. Ghi tại thời điểm phê duyệt. NULL cho phép. |
| **Ngày phê duyệt(approvedAt)** | `APPROVED_AT TIMESTAMP` | Thời gian xử lý phê duyệt. NULL cho phép. |
| **Lý do từ chối(rejectReason)** | `REJECT_REASON VARCHAR2(500)` | Lý do nhập khi từ chối. NULL cho phép. |
| **Tài khoản xuất(issueType)** | `ISSUE_TYPE VARCHAR2(20)` | Phân loại tài khoản xuất theo mã chung `ISSUE_TYPE`. NULL cho phép. Truyền sang `MAT_ISSUES.ISSUE_TYPE` khi xuất thực tế. |
| **Ghi chú(remark)** | `REMARK VARCHAR2(500)` | Lý do yêu cầu/ghi nhớ (đầu vào sản xuất·mẫu thử·mẫu·khác). NULL cho phép. |
| Đa khách hàng | `COMPANY VARCHAR2(50)` | Định danh công ty. Mặc định `'40'`. Áp dụng bắt buộc cho mọi truy vấn·đăng ký. |
| Đa khách hàng | `PLANT_CD VARCHAR2(50)` | Định danh nhà máy. Mặc định `'1000'`. Áp dụng bắt buộc cho mọi truy vấn·đăng ký. |
| Kiểm toán | `CREATED_BY VARCHAR2(50)` | ID người dùng tạo. NULL cho phép. |
| Kiểm toán | `UPDATED_BY VARCHAR2(50)` | ID người dùng sửa cuối. NULL cho phép. |
| Kiểm toán | `CREATED_AT TIMESTAMP` | TypeORM `@CreateDateColumn`. Tự động ghi. |
| Kiểm toán | `UPDATED_AT TIMESTAMP` | TypeORM `@UpdateDateColumn`. Tự động ghi. |

Index: `ORDER_NO`, `STATUS`, `REQUEST_DATE` mỗi cái là index đơn.

---

## ② Hạng mục yêu cầu xuất kho — MAT_ISSUE_REQUEST_ITEMS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| — | `REQUEST_ID VARCHAR2(50) PK` | Giá trị tham chiếu header `REQUEST_NO` (khóa phức hợp 1/2). Cùng giá trị với header. |
| — | `SEQ INT PK` | Số thứ tự hạng mục (khóa phức hợp 2/2). Cấp tuần tự từ 1. |
| **Mã hạng mục(itemCode)** | `ITEM_CODE VARCHAR2(50)` | Hạng mục yêu cầu xuất. FK `ITEM_MASTERS`. Có index. |
| **Số lượng yêu cầu(requestQty)** | `REQUEST_QTY INT` | Số lượng yêu cầu kho. Số nguyên từ 1 trở lên. NOT NULL. |
| **Số lượng xuất(issuedQty)** | `ISSUED_QTY INT DEFAULT 0` | Giá trị tích lũy khi xử lý xuất thực tế. Khi xuất thực tế hoàn tất, bằng requestQty. |
| **Đơn vị(unit)** | `UNIT VARCHAR2(20)` | Đơn vị số lượng (EA, M, KG...). NOT NULL. |
| **Nhu cầu BOM(bomReqQty)** | `BOM_REQ_QTY NUMBER(12,3)` | Tính bằng số lượng kế hoạch lệnh sản xuất × định mức BOM đơn vị. NULL cho phép (hạng mục thêm thủ công có thể NULL). |
| **Đã cấp trước(prevIssueQty)** | `PREV_ISSUE_QTY NUMBER(12,3)` | Tổng số lượng đã cấp qua yêu cầu xuất trước đó cho cùng lệnh sản xuất. NULL cho phép. |
| **Tồn kho hiện trường(floorStockQty)** | `FLOOR_STOCK_QTY NUMBER(12,3)` | Số lượng sở hữu tại hiện trường (dây chuyền công đoạn). Snapshot thời điểm yêu cầu. NULL cho phép. |
| **Ghi chú(remark)** | `REMARK VARCHAR2(500)` | Ghi nhớ theo hạng mục. NULL cho phép. |
| Đa khách hàng | `COMPANY VARCHAR2(50)` | Áp dụng cùng phạm vi header. |
| Đa khách hàng | `PLANT_CD VARCHAR2(50)` | Áp dụng cùng phạm vi header. |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY` | Theo dõi thay đổi. NULL cho phép. |
| Kiểm toán | `CREATED_AT`, `UPDATED_AT` | TypeORM tự động quản lý. |

---

## Logic chuyển trạng thái

### Ý nghĩa theo trạng thái

| Trạng thái | API chuyển | Mô tả |
|------|------|------|
| `REQUESTED` | (Giá trị ban đầu) | Ngay sau khi đăng ký yêu cầu. Chờ nhân viên kho xem xét. |
| `APPROVED` | `PATCH /:requestNo/approve` | Nhân viên phê duyệt hoàn tất. Có thể xử lý xuất thực tế. |
| `REJECTED` | `PATCH /:requestNo/reject` | Yêu cầu bị từ chối. Ghi `REJECT_REASON`. Có thể yêu cầu lại. |
| `COMPLETED` | `POST /:requestNo/issue` | Xử lý xuất thực tế hoàn tất. Đã tạo bản ghi `MAT_ISSUES`. |

### Đường chuyển có thể

```
REQUESTED → APPROVED  (Phê duyệt)
REQUESTED → REJECTED  (Từ chối)
APPROVED  → COMPLETED (Xuất thực tế hoàn tất)
```

> Không thể chuyển trạng thái thêm từ `COMPLETED` và `REJECTED`. Yêu cầu bị từ chối không tái sử dụng mà đăng ký mới.

---

## Logic tính nhu cầu theo BOM

API: `GET /material/issue-requests/job-orders/:orderNo/bom-items`

Backend `IssueRequestService.buildBomRequestItems(orderNo, company, plant)` thực hiện tính:

1. Tra lệnh sản xuất(`orderNo`) → xác nhận số lượng kế hoạch(`planQty`).
2. Tra BOM của hạng mục lệnh sản xuất → định mức đơn vị (BOM quantity).
3. Tính `bomReqQty = planQty × định mức đơn vị`.
4. Cộng `ISSUED_QTY` của yêu cầu xuất cũ cho cùng lệnh sản xuất → `prevIssueQty`.
5. Tra tồn kho hiện trường(`floorStockQty`).
6. Tra tồn kho hiện tại(`currentStock`) (dựa trên `MatStock`).
7. Trả kết quả theo đơn vị hạng mục nguyên vật liệu (RAW_MATERIAL).

> Tìm kiếm hạng mục(`/master/parts?itemType=RAW_MATERIAL`) cũng chỉ giới hạn ở nguyên vật liệu.

---

## API

| Phương thức | Đường dẫn | Mô tả |
|------|------|------|
| `POST` | `/material/issue-requests` | Tạo yêu cầu xuất kho (trạng thái: cố định REQUESTED) |
| `GET` | `/material/issue-requests` | Tra danh sách (phân trang, bộ lọc trạng thái·từ khóa·orderNo) |
| `GET` | `/material/issue-requests/:requestNo` | Tra chi tiết (bao gồm hạng mục) |
| `GET` | `/material/issue-requests/job-orders/:orderNo/bom-items` | Tính nhu cầu theo BOM lệnh sản xuất |
| `PATCH` | `/material/issue-requests/:requestNo/approve` | Phê duyệt |
| `PATCH` | `/material/issue-requests/:requestNo/reject` | Từ chối (body: `reason`) |
| `POST` | `/material/issue-requests/:requestNo/issue` | Xử lý xuất thực tế (APPROVED → COMPLETED) |

---

## Thiết lập trước (Master·Mã chung)

| Mục thiết lập | Vị trí | Ảnh hưởng |
|------|------|------|
| Master hạng mục(itemType=RAW_MATERIAL) | `ITEM_MASTERS` | Đối tượng tìm kiếm hạng mục yêu cầu xuất |
| Đăng ký BOM | `MAT_BOM` (hoặc bảng tương đương) | Cơ sở tính nhu cầu theo BOM |
| Mã chung `JOB_ORDER_STATUS` | `COM_CODES` | Select bộ lọc trạng thái lệnh sản xuất bên trái |
| Mã chung `ISSUE_TYPE` | `COM_CODES` | Giải mã mã trường tài khoản xuất |
| Master kho | `WAREHOUSE_MASTERS` | Tiêu chuẩn chọn kho khi xuất thực tế |

---

## Quy trình vận hành

### Đăng ký yêu cầu xuất kho mới
1. Chọn lệnh sản xuất hoặc dùng modal yêu cầu xuất thủ công để nhập hạng mục·số lượng.
2. Gọi `POST /material/issue-requests` → đánh số `REQUEST_NO`, lưu `STATUS='REQUESTED'`.

### Phê duyệt yêu cầu xuất kho
1. Xác nhận yêu cầu REQUESTED tại màn hình Quản lý xuất kho vật tư (MAT_ISSUE).
2. Sau xem xét, gọi `PATCH /material/issue-requests/:requestNo/approve`.
3. Ghi `STATUS='APPROVED'`, `APPROVER`, `APPROVED_AT`.

### Xử lý từ chối
1. Xác nhận lý do, gọi `PATCH /material/issue-requests/:requestNo/reject` (body: `reason`).
2. Lưu `STATUS='REJECTED'`, `REJECT_REASON`. Người yêu cầu cần yêu cầu lại.

### Xử lý xuất thực tế
1. Với yêu cầu APPROVED, gọi `POST /material/issue-requests/:requestNo/issue`.
2. Tạo bản ghi `MAT_ISSUES`, `MAT_ISSUE_ITEMS` → trừ tồn kho `MatStock`.
3. Cập nhật `STATUS='COMPLETED'`, `ISSUED_QTY` theo hạng mục.

---

## Phân quyền

| Vai trò | Thao tác được phép |
|------|------|
| Nhân viên sản xuất/hiện trường | Đăng ký yêu cầu xuất kho, tra yêu cầu của mình |
| Nhân viên kho | Tra yêu cầu xuất kho, phê duyệt, từ chối, xử lý xuất thực tế |
| Quản trị viên | Mọi thao tác |

> API hiện tại không kiểm tra vai trò riêng, chỉ áp dụng bắt buộc phạm vi tenant (`COMPANY`, `PLANT_CD`). Nếu cần phân quyền vai trò, phải thêm cài đặt `@Guard`.

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Hạng mục theo BOM ra 0 cái | BOM lệnh sản xuất chưa đăng ký hoặc số lượng kế hoạch = 0 | Kiểm tra đăng ký BOM và số lượng kế hoạch lệnh sản xuất |
| Không có kết quả tìm kiếm hạng mục | Loại hạng mục không phải RAW_MATERIAL | Kiểm tra itemType trong master hạng mục |
| Trạng thái không đổi sau đăng ký | Chưa xử lý phê duyệt (REQUESTED bình thường) | Xử lý phê duyệt tại màn hình Quản lý xuất kho vật tư |
| Phê duyệt rồi mà tồn kho không giảm | Phê duyệt là trạng thái cho phép. Chưa xử lý xuất thực tế | Cần gọi API `POST /:requestNo/issue` xuất thực tế |
| Muốn từ chối lại từ APPROVED | Chuyển APPROVED → REJECTED không được định nghĩa trong code | Không xử lý COMPLETED, thay bằng yêu cầu mới hoặc can thiệp DB (quyết định người vận hành) |
| `ISSUED_QTY` nhỏ hơn `REQUEST_QTY` | Trạng thái xuất một phần. Có thể chưa COMPLETED | Kiểm tra số lượng còn lại rồi xử lý xuất thêm |
| Tra danh sách yêu cầu xuất kho chậm | Có index STATUS / ORDER_NO / REQUEST_DATE. Khi dữ liệu tích lũy, kiểm tra phân trang | Kiểm tra tham số page/limit, khuyến nghị dùng bộ lọc |

---

## Dữ liệu & Liên kết

- **Bảng header**: `MAT_ISSUE_REQUESTS` — `COMPANY='40'`, `PLANT_CD='1000'` phạm vi cố định.
- **Bảng hạng mục**: `MAT_ISSUE_REQUEST_ITEMS` — cùng phạm vi.
- **Liên kết xuất thực tế**: Khi xử lý xuất thực tế, tạo `MAT_ISSUES` + `MAT_ISSUE_ITEMS`, trừ `MatStock`.
- **Liên kết lệnh sản xuất**: Liên kết logic `PRODUCTION_JOB_ORDERS.ORDER_NO` (không ràng buộc FK, service layer kiểm tra).
- **Liên kết master hạng mục**: `ITEM_MASTERS.ITEM_CODE` liên kết logic.
- **Màn hình liên kết**: Quản lý xuất kho vật tư (MAT_ISSUE) — tiến hành phê duyệt·xử lý xuất thực tế.
