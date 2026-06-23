---
menuCode: QC_DEFECT
audience: operator
title: Quản lý lỗi — Hướng dẫn vận hành
summary: Tra cứu·đăng ký·thay đổi trạng thái lỗi — quét mã vạch sản phẩm/lệnh sản xuất, tự động hiển thị mã lỗi·cấp độ·phạm vi, chuyển trạng thái WAIT→REPAIR/REWORK/SCRAP/DONE
tags: [chất lượng, lỗi, quản lý lỗi, nhật ký lỗi]
keywords: [DEFECT_LOGS, DEFECT_CODE_MASTERS, DEFECT_CATEGORY_MASTERS, WAIT, REPAIR, REWORK, SCRAP, DONE, CRITICAL, MAJOR, MINOR, quản lý lỗi, nhật ký lỗi, mã lỗi, cấp độ lỗi]
related: [QC_DEFECT_CODE, QC_REWORK_INSPECT]
---

# Quản lý lỗi — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Đăng ký, tra cứu và quản lý trạng thái lỗi phát sinh trong sản xuất. Quét mã vạch sản phẩm (PROD_RESULT) hoặc mã vạch FG để đăng ký lỗi, chuyển trạng thái WAIT→REPAIR/REWORK/SCRAP/DONE. Mã lỗi sử dụng hệ thống phân cấp 3 cấp với cấp độ (CRITICAL/MAJOR/MINOR) và phạm vi tự động hiển thị.

```
Lỗi phát sinh → Đăng ký(WAIT) → Sửa chữa(REPAIR) → Hoàn thành(DONE)
                              → Gia công lại(REWORK) → Hoàn thành(DONE)
                              → Phế liệu(SCRAP)
```

## Cấu trúc dữ liệu
```
DEFECT_LOGS (PK: OCCUR_TIME + SEQ, ID: "occurAtISO|seq")
   ├─ PROD_RESULT_ID → PROD_RESULTS (kết quả sản xuất)
   ├─ DEFECT_CODE → DEFECT_CODE_MASTERS
   ├─ QTY / STATUS / CAUSE
   └─ STATUS: WAIT → REPAIR / REWORK / SCRAP → DONE

DEFECT_CODE_MASTERS (PK: COMPANY + PLANT_CD + DEFECT_CODE)
   Phân cấp 3 cấp + cấp độ(CRITICAL/MAJOR/MINOR) + phạm vi

REPAIR_LOGS (PK: REPAIR_DATE + SEQ)
   Lịch sử sửa chữa (người sửa·hành động·vật tư·thời gian·kết quả)
```

## Bố cục màn hình

### Khu vực chính
- **Header**: Tiêu đề + nút Làm mới·Đăng ký lỗi
- **Bộ lọc thanh công cụ**:
  - Tìm kiếm (mã vạch sản phẩm·số lệnh)
  - Khoảng thời gian (DateRangeFilter)
  - Select loại lỗi (`GET /quality/defect-codes/options?defectScope=PRODUCT`)
  - Select trạng thái (mã chung `DEFECT_LOG_STATUS`)
- **DataGrid**: `GET /quality/defect-logs?limit=5000`
  - Cột: thao tác·thời gian·số lệnh·mã lỗi·tên lỗi·số lượng·trạng thái·công nhân·nguyên nhân
  - Nhấp hàng → mở bảng phải

### Bảng phải (DefectFormPanel, 480px)
`POST /quality/defect-logs`

| Mục | Mô tả |
|------|-------------|
| Mã vạch sản phẩm | Quét PROD_RESULT.prdUid hoặc FG_LABELS.fgBarcode (tự động focus) |
| Số lệnh sản xuất | Nhập thủ công (dự phòng cho mã vạch) |
| Loại lỗi | Chọn mã lỗi (phạm vi PRODUCT) |
| Cấp độ lỗi | Tự động hiển thị: 🔴 CRITICAL / 🟠 MAJOR / 🟡 MINOR |
| Phạm vi lỗi | Tự động hiển thị: RAW_MATERIAL / PRODUCT / PROCESS / COMMON |
| Số lượng | Mặc định 1 |
| Nguyên nhân | Văn bản nguyên nhân lỗi |
- Điều kiện lưu: `prdUid` hoặc `workOrderNo` bắt buộc một trong hai

### Modal thay đổi trạng thái
`PATCH /quality/defect-logs/{id}/status { status }`

| Trạng thái hiện tại | Có thể chuyển sang |
|-----------|---------------|
| WAIT | REPAIR, REWORK, SCRAP |
| REPAIR | DONE, SCRAP, WAIT |
| REWORK | DONE, SCRAP, WAIT |
| SCRAP | (kết thúc) |
| DONE | (kết thúc) |

## Mã trạng thái (DEFECT_LOG_STATUS)

| Mã | Ý nghĩa | Trạng thái tiếp theo |
|------|---------|-----------|
| WAIT | Tiếp nhận lỗi (ban đầu) | REPAIR / REWORK / SCRAP |
| REPAIR | Đang sửa chữa | DONE / SCRAP / WAIT |
| REWORK | Đang gia công lại | DONE / SCRAP / WAIT |
| SCRAP | Phế liệu (kết thúc) | - |
| DONE | Hoàn thành (kết thúc) | - |

## Cấp độ lỗi

| Cấp độ | Màu | Ý nghĩa |
|------|------|---------|
| CRITICAL | 🔴 Đỏ | Lỗi nghiêm trọng |
| MAJOR | 🟠 Cam | Lỗi lớn |
| MINOR | 🟡 Vàng | Lỗi nhẹ |

## Khóa liên động

| Điều kiện | Mô tả |
|------|-------------|
| Mã vạch + số lệnh đều trống | Không thể đăng ký |
| Chưa chọn mã lỗi | Không thể đăng ký |
| SCRAP/DONE không thể thay đổi | Trạng thái kết thúc |
| Liên kết gia công lại không thể sửa/xóa | ReworkOrder hạn chế |

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Mã vạch không nhận dạng | PROD_RESULT hoặc FG_LABELS không tồn tại | Dùng số lệnh thay thế |
| Danh sách mã lỗi trống | Chưa đăng ký mã lỗi phạm vi PRODUCT | Đăng ký trong master mã lỗi |
| Thay đổi trạng thái thất bại | Trạng thái kết thúc (SCRAP/DONE) | Không thể thay đổi |
| Không thể sửa | Đã liên kết gia công lại | Xử lý qua kiểm tra gia công lại |

## Dữ liệu & Liên kết
- Bảng: `DEFECT_LOGS`, `DEFECT_CODE_MASTERS`, `DEFECT_CATEGORY_MASTERS`, `DEFECT_CODE_PRODUCT_TYPES`, `REPAIR_LOGS`, `PROD_RESULTS`, `FG_LABELS`, `REWORK_ORDERS`
- Liên kết: Kết quả sản xuất → **Đăng ký lỗi (hiện tại)** → Sửa chữa/Gia công lại/Phế liệu → Kiểm tra gia công lại
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
