---
menuCode: QC_REQUEST_INSPECT
audience: operator
title: Nhập kiểm tra ủy quyền — Hướng dẫn vận hành
summary: Màn hình nhập giá trị đo·đánh giá cho các lô chờ kiểm tra ủy quyền (DELEGATE) của tự kiểm tra quy trình. Mapping cột·DB của SELF_INSPECT_RESULTS/SELF_INSPECT_ITEMS, chuyển trạng thái, liên kết chặn kiosk, xử lý sự cố
tags: [chất lượng, tự kiểm tra, kiểm tra ủy quyền, DELEGATE, vận hành]
keywords: [SELF_INSPECT_RESULTS, SELF_INSPECT_ITEMS, DELEGATE, DIRECT, PENDING, PASS, FAIL, INSPECT_METHOD, STATUS, MEASURE_VALUE, LSL_VALUE, USL_VALUE, ITEM_TYPE, MEASURE, VISUAL, TIMING, INSPECTED_AT, chặn kiosk, tự kiểm tra]
related: [QC_AQL]
---

# Nhập kiểm tra ủy quyền — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Trong **tự kiểm tra quy trình** (SELF_INSPECT), các hạng mục có phương pháp kiểm tra là **ủy quyền (DELEGATE)** không được công nhân đánh giá trực tiếp tại kiosk mà tải bản ghi kết quả với `STATUS='PENDING'`. Màn hình này là màn hình quản lý để nhân viên chất lượng tra cứu các lô chờ đó, **nhập giá trị đo và xác nhận PASS/FAIL**. Kiểm tra trực tiếp (DIRECT) được xác nhận PASS/FAIL ngay tại kiosk nên không xuất hiện trên màn hình này.

> Liên kết cốt lõi: Nếu một lệnh sản xuất cụ thể có dù chỉ 1 kết quả với `INSPECT_METHOD='DELEGATE' AND STATUS='PENDING'`, thì **kiosk nhập sản lượng sản xuất bị chặn** (theo chú thích entity). Việc chặn chỉ được giải quyết khi kết thúc đánh giá trên màn hình này.

## Cấu trúc dữ liệu
Kết quả kiểm tra ủy quyền được tải vào bảng kết quả, và tiêu chuẩn kiểm tra (tiêu chuẩn·loại·đơn vị) được JOIN từ master hạng mục.

```
SELF_INSPECT_ITEMS (Master hạng mục kiểm tra)   SELF_INSPECT_RESULTS (Kết quả kiểm tra)
  ID (PK) ─────────────────┐                     ID (PK)
  INSPECT_METHOD=DELEGATE   │  INSPECT_ITEM_ID    INSPECT_ITEM_ID ──(LEFT JOIN i.id)
  ITEM_TYPE / LSL / USL /   └─────────────────────  INSPECT_METHOD = 'DELEGATE'
  UNIT / STANDARD                                   STATUS = 'PENDING' → Đối tượng màn hình này
```

- Truy vấn danh sách chờ: `SELF_INSPECT_RESULTS r LEFT JOIN SELF_INSPECT_ITEMS i ON i.ID = r.INSPECT_ITEM_ID`, điều kiện `r.INSPECT_METHOD='DELEGATE' AND r.STATUS='PENDING' AND r.COMPANY/PLANT_CD scope`, sắp xếp `r.CREATED_AT ASC`.
- API: Danh sách `GET /production/self-inspect/delegates`, Đánh giá `PATCH /production/self-inspect/results/:id/status`.
- (Tham khảo) Dòng chữ `sqlQuery` hiển thị ở lưới bên trái màn hình chỉ đến `INSPECT_REQUESTS`, nhưng nguồn dữ liệu thực tế là `SELF_INSPECT_RESULTS` ở trên (chỉ là nhãn SQL hiển thị, không phải đường dẫn tra cứu).

---

## ① Danh sách chờ / Kết quả — SELF_INSPECT_RESULTS (cột liên quan)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| (Định danh dòng) | `ID` | PK (UUID, `PrimaryGeneratedColumn('uuid')`). `:id` của PATCH đánh giá. |
| Lệnh sản xuất | `ORDER_NO` | Số lệnh sản xuất nơi kiểm tra xảy ra. Có index. Khóa quyết định chặn kiosk. |
| Quy trình | `PROCESS_CODE` | Mã quy trình nơi kiểm tra xảy ra (nullable). |
| (Khóa hạng mục kiểm tra) | `INSPECT_ITEM_ID` | Tham chiếu `SELF_INSPECT_ITEMS.ID` (nullable). Khóa JOIN tiêu chuẩn/loại/đơn vị. |
| Tên hạng mục | `ITEM_NAME` | Tên hạng mục kiểm tra (snapshot thời điểm kết quả, độ dài 200). |
| Thời điểm | `TIMING` | `FIRST`(đầu ca) / `MID`(giữa ca) / `LAST`(cuối ca). Kết quả là giá trị thời điểm đơn. |
| (Phương pháp kiểm tra) | `INSPECT_METHOD` | `DIRECT`(trực tiếp) / `DELEGATE`(ủy quyền). Màn hình này chỉ xử lý `DELEGATE`. Mặc định `DIRECT`. |
| (Trạng thái) | `STATUS` | `PENDING`(chờ) / `PASS`(đạt) / `FAIL`(không đạt). Mặc định `PENDING`. Có index. Chỉ hiển thị PENDING trong danh sách. |
| Giá trị đo | `MEASURE_VALUE` | NUMBER, nullable. Chỉ dùng cho hạng mục MEASURE, VISUAL là null. Lưu cùng lúc đánh giá. |
| Ghi chú | `REMARK` | varchar2(500), nullable. Điểm đặc biệt/lý do đánh giá. |
| Số mẫu | `SAMPLE_NO` | NUMBER, mặc định 1. FIRST đầu ca N mẫu là 1..N, MID/LAST là 1. (Bao gồm trong tra cứu danh sách nhưng không hiển thị trên lưới) |
| Thời gian yêu cầu | `CREATED_AT` | `CreateDateColumn`. Thời gian ủy quyền. Tiêu chuẩn sắp xếp danh sách (ASC). |
| (Thời gian hoàn thành kiểm tra) | `INSPECTED_AT` | timestamp, nullable. **Được đặt thành `new Date()` khi chuyển sang trạng thái không phải PENDING (`status !== 'PENDING'`)**. Null nếu chưa đánh giá. |
| (Số lượng sản xuất) | `PROD_QTY_AT_INSPECT` | NUMBER, nullable. Số lượng sản xuất tại thời điểm kiểm tra (giá trị tải từ kiosk). Không hiển thị trên màn hình này. |
| (Thiết bị) | `EQUIP_CODE` | varchar2(50), nullable. Mã thiết bị kiểm tra. Không hiển thị trên màn hình này. |
| (Người kiểm tra) | `INSPECTOR_ID` | varchar2(50), nullable. Không hiển thị trên màn hình này. |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `UPDATED_AT` | Người tạo/sửa·thời gian sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `COMPANY='40'`, `PLANT_CD='1000'`. Cả danh sách và đánh giá đều lọc theo phạm vi. |

---

## ② Tiêu chuẩn kiểm tra (JOIN hiển thị) — SELF_INSPECT_ITEMS (cột lấy từ danh sách chờ)

Danh sách chờ LEFT JOIN master hạng mục để cấu thành "Tiêu chuẩn kiểm tra" ở khu vực nhập bên phải.

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| (Loại hạng mục) | `ITEM_TYPE` | `MEASURE`(đo lường) / `VISUAL`(đánh giá). Nếu là MEASURE mà không có tiêu chuẩn thì hiển thị "Không có tiêu chuẩn (LSL/USL) đã đặt", nếu VISUAL thì hiển thị "Hạng mục đánh giá (không có tiêu chuẩn)". Mặc định `VISUAL`. |
| LSL | `LSL_VALUE` | NUMBER, nullable. Cận dưới tiêu chuẩn. Hiển thị số trong hộp tiêu chuẩn kiểm tra nếu có LSL hoặc USL. |
| USL | `USL_VALUE` | NUMBER, nullable. Cận trên tiêu chuẩn. |
| Đơn vị | `UNIT` | varchar2(20), nullable. Đơn vị đo (mm, N v.v.). Chỉ hiển thị khi có. |
| Tiêu chuẩn/quy cách | `STANDARD` | varchar2(500), nullable. Tiêu chuẩn văn bản. Chỉ hiển thị khi có. |

> Nếu `INSPECT_ITEM_ID` là null hoặc không có master hạng mục phù hợp (LEFT JOIN miss) thì LSL/USL/đơn vị/tiêu chuẩn trống và hiển thị "Không có tiêu chuẩn". Nếu hạng mục đo lường mà tiêu chuẩn trống thì cần điền LSL/USL trong master hạng mục.

---

## Logic đánh giá (PATCH /results/:id/status)
1. Tra cứu bản ghi kết quả theo `id` + COMPANY/PLANT_CD scope. Nếu không có thì 404 (`SelfInspectResult {id} not found`).
2. Đổi `STATUS` thành giá trị yêu cầu (`PASS`/`FAIL`).
3. Nếu có `remark` thì cập nhật `REMARK`, nếu có `measureValue` thì cập nhật `MEASURE_VALUE` (undefined thì giữ nguyên).
4. Nếu `status !== 'PENDING'` thì đặt `INSPECTED_AT = thời gian hiện tại` (= ghi lại thời gian hoàn thành kiểm tra).
5. Lưu. Thông báo phản hồi `Trạng thái đã được thay đổi thành {status}`.

> Đánh giá đạt/không đạt là **đánh giá thủ công của nhân viên**, không phải so sánh tự động với LSL/USL. Màn hình phản ánh trực tiếp giá trị nhấn nút PASS/FAIL vào STATUS (tiêu chuẩn chỉ để tham khảo hiển thị).

## Thiết lập trước (Master)
- Trong master hạng mục tự kiểm tra quy trình (`SELF_INSPECT_ITEMS`), đặt `INSPECT_METHOD='DELEGATE'` cho hạng mục đó → kiosk tạo kết quả PENDING thay vì đánh giá trực tiếp.
- Hạng mục đo lường nên điền `ITEM_TYPE='MEASURE'` + `LSL_VALUE`/`USL_VALUE`/`UNIT` để hiển thị tiêu chuẩn trên màn hình này.
- Đăng ký·sửa master hạng mục bằng API quản lý hạng mục tự kiểm tra (`/production/self-inspect/items`).

## Quy trình vận hành
1. Khi vào màn hình, tự động gọi `GET /delegates` → tải danh sách chờ (cũ nhất trước).
2. Chọn hạng mục → đo → nhập giá trị đo/ghi chú → PASS/FAIL.
3. Sau đánh giá, danh sách tự động tra cứu lại, loại bỏ lô đã xử lý.
4. Khi tồn đọng nhiều, ưu tiên xử lý theo lệnh sản xuất để giải phóng chặn kiosk cho lệnh đó.

## Phân quyền
Cần xác thực JWT (`JwtAuthGuard`). Nhân viên chất lượng thực hiện đánh giá. Phạm vi đa khách hàng (COMPANY/PLANT_CD) được tiêm từ context token.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Kiosk bị chặn nhập sản lượng | Lệnh sản xuất đó còn kết quả `DELEGATE`+`PENDING` | Đánh giá PASS/FAIL hạng mục đó trên màn hình này → giải phóng chặn |
| Hạng mục không hiển thị trong danh sách chờ | Là DIRECT hoặc đã PASS/FAIL hoặc khác COMPANY/PLANT scope | Kiểm tra có phải hạng mục ủy quyền không, có đúng phạm vi site không |
| LSL/USL·đơn vị trống | Hạng mục là VISUAL hoặc hạng mục matching `INSPECT_ITEM_ID` chưa đặt tiêu chuẩn/JOIN miss | Nếu là đo lường thì nhập LSL/USL/UNIT trong master hạng mục |
| 404 khi đánh giá | ID ở scope khác hoặc đã bị xóa | Kiểm tra có phải dữ liệu site hiện tại (COMPANY=40/PLANT=1000) không, tra cứu lại |
| Giá trị đo không lưu được | Chuỗi rỗng không được gửi (undefined) | Nhập số rồi nhấn nút đánh giá |

## Dữ liệu & Liên kết
- Bảng: `SELF_INSPECT_RESULTS` (kết quả·trạng thái), `SELF_INSPECT_ITEMS` (JOIN tiêu chuẩn kiểm tra).
- API: `GET /production/self-inspect/delegates`, `PATCH /production/self-inspect/results/:id/status`. Liên quan: `GET /pending/:orderNo` (quyết định chặn kiosk), `POST /results` (tải ủy quyền kiosk).
- Màn hình liên kết: Kiosk sản xuất (ủy quyền tự kiểm tra·chặn sản lượng), Quản lý hạng mục tự kiểm tra (`SELF_INSPECT_ITEMS`).
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`.
