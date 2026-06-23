---
menuCode: QC_REWORK
audience: operator
title: Quản lý lệnh gia công lại — Hướng dẫn vận hành
summary: Quản lý toàn bộ vòng đời lệnh gia công lại theo IATF 16949 — đăng ký·phê duyệt QC·phê duyệt SX·thực hiện công đoạn·hoàn thành, tích hợp DefectLog, cách ly/xử lý tồn kho
tags: [chất lượng, gia công lại, IATF16949, phê duyệt, công đoạn]
keywords: [REWORK_ORDERS, REWORK_PROCESSES, REWORK_RESULTS, DEFECT_LOG, REGISTERED, QC_PENDING, PROD_PENDING, APPROVED, IN_PROGRESS, INSPECT_PENDING, gia công lại, lệnh gia công lại, phê duyệt QC, phê duyệt SX, quản lý công đoạn]
related: [QC_REWORK_INSPECT, QC_DEFECT]
---

# Quản lý lệnh gia công lại — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Quản lý toàn bộ vòng đời **lệnh gia công lại (Rework)** theo IATF 16949. Đăng ký từ DefectLog, phê duyệt QC·SX, thực hiện công đoạn và chuyển sang chờ kiểm tra.

```
DefectLog → REGISTERED → QC_PENDING → PROD_PENDING → APPROVED → IN_PROGRESS → INSPECT_PENDING
               ↑              ↓              ↓
          QC_REJECTED    PROD_REJECTED
```

## Cấu trúc dữ liệu
```
REWORK_ORDERS (PK: REWORK_NO, định dạng: RW-YYYYMMDD-NNN)
   ├─ DEFECT_LOG_ID → DefectLog (occurAt|seq)
   ├─ ITEM_CODE / REWORK_QTY / REWORK_METHOD / STATUS
   ├─ QC_APPROVER / PROD_APPROVER (phê duyệt kép)
   └─ ISOLATION_FLAG (cách ly: 1 / bình thường: 0)

REWORK_PROCESSES (PK: REWORK_NO + PROCESS_CODE)
   └─ STATUS: WAITING → IN_PROGRESS → COMPLETED / SKIPPED

REWORK_RESULTS (PK: REWORK_NO + PROCESS_CODE + SEQ)
   └─ workerId / goodQty / defectQty / workDetail / workTimeMin

REWORK_INSPECTS (PK: REWORK_NO + SEQ)
   └─ Kết quả kiểm tra lại (PASS/FAIL/SCRAP)
```

## Bố cục màn hình

### Khu vực chính
- **Header**: Tiêu đề + nút Làm mới·Đăng ký
- **StatCard (5)**: Tất cả·Chờ duyệt·Đang làm·Hoàn thành·Chờ kiểm tra
- **Thanh công cụ**: Tìm kiếm·kỳ·trạng thái·dây chuyền
- **DataGrid**: `GET /quality/reworks`
  - Cột: thao tác·số lệnh·mã hạng mục·tên·số lượng·loại lỗi·trạng thái·công nhân·ngày tạo

### Bảng phải (3 loại)
| Bảng | Điều kiện | Chức năng |
|------|-----------|----------|
| ReworkFormPanel | Đăng ký/Sửa | Tạo hoặc sửa lệnh |
| ReworkApprovePanel | Phê duyệt | QC hoặc SX duyệt/từ chối |
| ReworkResultPanel | Nhập kết quả | Nhập kết quả theo công đoạn |

## Quy trình làm việc

### ① Đăng ký
`POST /quality/reworks { defectLogId, itemCode, reworkQty, reworkMethod, processItems, ... }`
- Liên kết DefectLog → `DEFECT_LOG.status = 'REWORK'`
- `isolationFlag = 1`

### ② Yêu cầu phê duyệt
`PATCH /quality/reworks/{id}/request-approval`
- REGISTERED → QC_PENDING

### ③ QC phê duyệt
`PATCH /quality/reworks/{id}/qc-approve { action: APPROVE|REJECT, reason }`
- Duyệt: QC_PENDING → PROD_PENDING
- Từ chối: QC_PENDING → QC_REJECTED (cần lý do)

### ④ SX phê duyệt
`PATCH /quality/reworks/{id}/prod-approve { action: APPROVE|REJECT, reason }`
- Duyệt: PROD_PENDING → APPROVED
- Từ chối: PROD_PENDING → PROD_REJECTED (cần lý do)

### ⑤ Bắt đầu
`PATCH /quality/reworks/{id}/start`
- APPROVED → IN_PROGRESS

### ⑥ Thực hiện công đoạn
`PATCH /quality/reworks/processes/{orderId}/{processCode}/start`
`PATCH /quality/reworks/processes/{orderId}/{processCode}/complete { resultQty }`
`PATCH /quality/reworks/processes/{orderId}/{processCode}/skip`
- Nhập công nhân·số lượng·thời gian theo công đoạn

### ⑦ Hoàn thành
`PATCH /quality/reworks/{id}/complete { resultQty }`
- Tự động chuyển INSPECT_PENDING khi tất cả công đoạn xong
- PASS/FAIL/SCRAP cuối tại kiểm tra lại (`/quality/rework-inspect`)

## Mã trạng thái (REWORK_STATUS)

| Mã | Ý nghĩa | Thao tác |
|------|---------|---------|
| REGISTERED | Đã đăng ký | Sửa·Xóa·Yêu cầu duyệt |
| QC_PENDING | Chờ QC duyệt | QC duyệt/từ chối |
| QC_REJECTED | QC từ chối | Sửa·Yêu cầu lại |
| PROD_PENDING | Chờ SX duyệt | SX duyệt/từ chối |
| PROD_REJECTED | SX từ chối | Sửa·Yêu cầu lại |
| APPROVED | Đã duyệt | Bắt đầu |
| IN_PROGRESS | Đang làm | Công đoạn·Hoàn thành |
| INSPECT_PENDING | Chờ kiểm tra | Kiểm tra lại |
| PASS | Đạt | |
| FAIL | Không đạt | |
| SCRAP | Phế liệu | |

## Quy tắc chính

| Quy tắc | Mô tả |
|------|-------------|
| Số lệnh | `RW-YYYYMMDD-NNN` tự động |
| Duyệt | Tuần tự kép: QC → SX |
| DefectLog | Đăng ký→REWORK, PASS→DONE, SCRAP→SCRAP |
| Cách ly | Đăng ký/FAIL→1, PASS→0 |
| Tồn kho | PASS:DEFECT→WIP_MAIN, SCRAP:DEFECT→SCRAP, FAIL:DEFECT |
| Xóa | Chỉ REGISTERED, chặn nếu có công đoạn/kiểm tra |

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không đăng ký được | Thiếu trường bắt buộc | Kiểm tra hạng mục·số lượng·phương pháp |
| Nút duyệt không hiện | Sai trạng thái | Kiểm tra trạng thái hiện tại |
| Không bắt đầu được | Chưa duyệt | Hoàn thành duyệt QC+SX |
| Không có công đoạn | Thiếu processItems | Thêm công đoạn rồi thử lại |

## Dữ liệu & Liên kết
- Bảng: `REWORK_ORDERS`, `REWORK_PROCESSES`, `REWORK_RESULTS`, `REWORK_INSPECTS`, `DEFECT_LOGS`
- Liên kết: Quản lý lỗi(`/quality/defect`) → **Lệnh gia công lại(hiện tại)** → Kiểm tra lại(`/quality/rework-inspect`)
- Tồn kho: `ProductInventoryService` (DEFECT→WIP_MAIN/SCRAP)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
