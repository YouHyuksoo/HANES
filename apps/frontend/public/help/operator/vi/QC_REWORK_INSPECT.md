---
menuCode: QC_REWORK_INSPECT
audience: operator
title: Kiểm tra gia công lại — Hướng dẫn vận hành
summary: Kiểm tra xác nhận lại gia công theo IATF 16949 — tra cứu danh sách chờ kiểm tra·đánh giá PASS/FAIL/SCRAP·nhập số lượng·chuyển đổi tồn kho tự động
tags: [chất lượng, gia công lại, kiểm tra lại, IATF16949]
keywords: [REWORK_ORDERS, REWORK_INSPECTS, INSPECT_PENDING, INSPECT_METHOD, PASS, FAIL, SCRAP, DEFECT_LOG, kiểm tra gia công lại, kiểm tra lại, gia công lại, xử lý lỗi]
related: [QC_INSPECT, INSP_RESULT]
---

# Kiểm tra gia công lại — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Thực hiện **kiểm tra xác nhận lại (Rework Verification)** theo yêu cầu IATF 16949. Tra cứu lệnh ở trạng thái `INSPECT_PENDING` sau khi hoàn thành gia công lại, đánh giá PASS/FAIL/SCRAP và đăng ký kết quả kiểm tra. **Tồn kho tự động chuyển đổi** dựa trên kết quả và trạng thái DefectLog liên kết được đồng bộ.

```
Lỗi phát sinh → DefectLog → ReworkOrder(REGISTERED) → Phê duyệt → Gia công lại → INSPECT_PENDING
    → Kiểm tra(PASS/FAIL/SCRAP) → Chuyển đổi tồn kho + Đồng bộ DefectLog
```

## Luồng trạng thái (REWORK_ORDERS)
```
REGISTERED → QC_PENDING → PROD_PENDING → APPROVED
    → IN_PROGRESS → INSPECT_PENDING → PASS / FAIL / SCRAP
```

## Cấu trúc dữ liệu
```
REWORK_ORDERS (PK: REWORK_NO, định dạng: RW-YYYYMMDD-NNN)
   ├─ DEFECT_LOG_ID → DefectLog
   ├─ ITEM_CODE → PartMaster
   ├─ REWORK_QTY / RESULT_QTY / PASS_QTY / FAIL_QTY
   └─ STATUS: INSPECT_PENDING

REWORK_INSPECTS (PK: REWORK_ORDER_ID + SEQ)
   Kết quả kiểm tra (SEQ tự động tăng trong lệnh)
```

## Bố cục màn hình

### Khu vực chính
- **Header**: Tiêu đề + Nút làm mới
- **StatCard (3)**:
  - 🔵 Số lượng chờ kiểm tra (số lượng danh sách)
  - 🟢 Số lượng PASS (thống kê)
  - 🔴 Số lượng FAIL (thống kê)
- **DataGrid**: `GET /quality/reworks?status=INSPECT_PENDING&limit=5000`
  - Cột: Số gia công lại·mã hạng mục·tên hạng mục·số lượng·số lượng thực tế·công nhân·thời gian hoàn thành·trạng thái
  - Trạng thái hiển thị bằng huy hiệu mã chung `REWORK_STATUS`
  - Tìm kiếm: số gia công lại·mã hạng mục·tên hạng mục (debounce 300ms)
  - Nhấp biểu tượng `FileSearch` → mở bảng phải

### Bảng phải (480px, InspectFormPanel)
`POST /quality/reworks/inspects`

| Mục | Thành phần | Mô tả |
|------|----------|-------------|
| Tóm tắt đối tượng | Thẻ | Hiển thị số gia công lại·mã hạng mục·số lượng·số lượng thực tế |
| Người kiểm tra | `WorkerSelect` | Bắt buộc. Nút đăng ký bị vô hiệu nếu trống |
| Phương pháp kiểm tra | `ComCodeSelect` | Mã chung `INSPECT_METHOD` |
| Kết quả kiểm tra | Nút radio (3) | PASS / FAIL / SCRAP (mặc định: PASS) |
| Số lượng đạt | `QtyInput` | Số lượng tốt khi PASS (mặc định: resultQty) |
| Số lượng không đạt | `QtyInput` | Số lượng lỗi khi FAIL/SCRAP |
| Chi tiết lỗi | textarea | Lý do FAIL/SCRAP |
| Ghi chú | `Input` | |

## Quy trình kiểm tra

### ① Xem danh sách chờ kiểm tra
`GET /quality/reworks?status=INSPECT_PENDING`
- Tự động chuyển sang `INSPECT_PENDING` khi tất cả công đoạn gia công lại hoàn thành
- Sử dụng tìm kiếm để lọc lệnh

### ② Nhập thông tin kiểm tra
- Chọn người kiểm tra (bắt buộc)
- Chọn phương pháp kiểm tra (ví dụ: kiểm tra 100%, lấy mẫu)
- Chọn kết quả: **PASS** / **FAIL** / **SCRAP**
  - **PASS**: Tốt → chuyển tồn kho từ `DEFECT` sang `WIP_MAIN`
  - **FAIL**: Lỗi gia công lại → giữ lại trong kho `DEFECT` (có thể gia công lại)
  - **SCRAP**: Phế phẩm → chuyển từ `DEFECT` sang `SCRAP`

### ③ Đăng ký kiểm tra (POST /quality/reworks/inspects)
Xử lý phía máy chủ:
1. Xác thực trạng thái: Nếu không phải `INSPECT_PENDING` → `BadRequestException`
2. Tự động đánh SEQ: số kiểm tra hiện có trong lệnh + 1
3. Cập nhật REWORK_ORDERS:
   - `status` = kết quả (PASS/FAIL/SCRAP)
   - `passQty`, `failQty` cập nhật
   - `isolationFlag`: PASS=0(hủy cách ly), FAIL/SCRAP=1(giữ cách ly)
4. Đồng bộ DefectLog (nếu có liên kết):
   - PASS → `DONE`, SCRAP → `SCRAP`, FAIL → `REWORK` (giữ nguyên)
5. Xử lý tồn kho (trừ FAIL):
   - PASS: passQty → DEFECT→WIP_MAIN (tự động tạo nhập bổ sung nếu thiếu)
   - SCRAP: failQty → DEFECT→SCRAP
   - FAIL: không di chuyển, giữ trong DEFECT

## Khóa liên động (Điều kiện chặn)

| Điều kiện | Thông báo | Giải quyết |
|------|--------|-----------|
| Chưa chọn người kiểm tra | Chọn người kiểm tra | Chọn từ WorkerSelect |
| Trạng thái không phải INSPECT_PENDING | Không phải trạng thái chờ kiểm tra | Làm mới và thử lại |

## Mã trạng thái gia công lại (REWORK_STATUS)

| Mã | Ý nghĩa | Ghi chú |
|------|---------|------|
| REGISTERED | Đã đăng ký | Tạo từ DefectLog |
| QC_PENDING | Chờ QC phê duyệt | |
| PROD_PENDING | Chờ sản xuất phê duyệt | |
| APPROVED | Đã phê duyệt | QC + Sản xuất phê duyệt |
| IN_PROGRESS | Đang gia công lại | Làm việc theo công đoạn |
| INSPECT_PENDING | **Chờ kiểm tra** | **Trạng thái lọc trên màn hình này** |
| PASS | Đạt | Tồn kho được phục hồi |
| FAIL | Không đạt | Cần gia công lại lần nữa |
| SCRAP | Phế liệu | Đã xử lý phế liệu |

## Toàn bộ cột — REWORK_ORDERS

| Mục | Cột DB | Vai trò |
|------|---------|------|
| Số gia công lại | `REWORK_NO` | PK. Định dạng `RW-YYYYMMDD-NNN` |
| ID DefectLog | `DEFECT_LOG_ID` | DefectLog liên kết |
| Mã hạng mục | `ITEM_CODE` | FK → PartMaster |
| Tên hạng mục | `ITEM_NAME` | |
| Số lượng gia công lại | `REWORK_QTY` | Tổng số lượng mục tiêu |
| Số lượng thực tế | `RESULT_QTY` | Số lượng hoàn thành thực tế |
| Trạng thái | `STATUS` | Mã chung `REWORK_STATUS` |
| Phương pháp gia công lại | `REWORK_METHOD` | IATF: phương pháp được phê duyệt |
| Cờ cách ly | `ISOLATION_FLAG` | 1=cách ly, 0=hủy |
| Số lượng đạt | `PASS_QTY` | Đặt khi kiểm tra |
| Số lượng không đạt | `FAIL_QTY` | Đặt khi kiểm tra |
| Công nhân | `WORKER_CODE` | |
| Dây chuyền | `LINE_CODE` | FK → ProdLineMaster |
| Thiết bị | `EQUIP_CODE` | FK → EquipMaster |
| Bắt đầu | `START_AT` | |
| Kết thúc | `END_AT` | |
| Ghi chú | `REMARK` | |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | `40` / `1000` |

## Toàn bộ cột — REWORK_INSPECTS

| Mục | Cột DB | Vai trò |
|------|---------|------|
| ID lệnh gia công lại | `REWORK_ORDER_ID` | PK (FK → REWORK_ORDERS) |
| Số thứ tự | `SEQ` | PK (tự động tăng trong lệnh) |
| Người kiểm tra | `INSPECTOR_CODE` | |
| Thời gian kiểm tra | `INSPECT_AT` | |
| Phương pháp kiểm tra | `INSPECT_METHOD` | Mã chung `INSPECT_METHOD` |
| Kết quả kiểm tra | `INSPECT_RESULT` | PASS / FAIL / SCRAP |
| Số lượng đạt | `PASS_QTY` | |
| Số lượng không đạt | `FAIL_QTY` | |
| Chi tiết lỗi | `DEFECT_DETAIL` | Tối đa 1000 ký tự |
| Ghi chú | `REMARK` | |

## Thiết lập trước
- Mã chung: `REWORK_STATUS`, `INSPECT_METHOD`
- Lệnh gia công lại phải ở trạng thái `INSPECT_PENDING`
- Tồn kho: Cần đăng ký kho DEFECT/WIP_MAIN/SCRAP
- Phân quyền: Kiểm tra viên chất lượng (đăng ký kiểm tra), Quản trị viên (sửa lịch sử)

## Quy tắc liên kết DefectLog
- DefectLog liên kết với gia công lại không thể xóa/sửa trực tiếp
- Tự động đồng bộ khi đăng ký kiểm tra, không cần xử lý riêng DefectLog
- Xóa DefectLog liên kết báo lỗi `Không thể xử lý trực tiếp lỗi đã liên kết với gia công lại`

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Danh sách trống | Không có lệnh `INSPECT_PENDING` | Kiểm tra hoàn thành công đoạn |
| Nút đăng ký bị vô hiệu | Chưa chọn người kiểm tra | Chọn từ WorkerSelect |
| Lỗi "Không phải trạng thái chờ" | Sai trạng thái | Làm mới và thử lại |
| Thiếu tồn kho khi SCRAP | Kho DEFECT thiếu | Kiểm tra tồn kho, điều chỉnh số lượng |
| Không thể sửa DefectLog | Liên kết với ReworkOrder | Xử lý gián tiếp qua kiểm tra |

## Dữ liệu & Liên kết
- Bảng: `REWORK_ORDERS`, `REWORK_INSPECTS`, `REWORK_PROCESSES`, `REWORK_RESULTS`, `DEFECT_LOGS`, `PartMaster`
- Liên kết: DefectLog → Đăng ký gia công lại → Công đoạn gia công lại → **Kiểm tra gia công lại (màn hình hiện tại)** → Chuyển đổi tồn kho
- Định dạng số gia công lại: `RW-YYYYMMDD-NNN` (máy chủ tự động tạo)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
