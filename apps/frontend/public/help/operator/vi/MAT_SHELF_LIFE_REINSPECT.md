---
menuCode: MAT_SHELF_LIFE_REINSPECT
audience: operator
title: Kiểm tra lại vật tư có hạn dùng — Hướng dẫn vận hành
summary: Kiểm tra lại LOT sắp hết hạn/quá hạn — đo lường hạng mục IQC·đánh giá PASS/FAIL·thiết lập ngày gia hạn·tự động cách ly/phế liệu khi FAIL
tags: [vật tư, hạn dùng, kiểm tra lại, IQC, LOT, hết hạn]
keywords: [SHELF_LIFE, REINSPECT, MAT_LOTS, IQC_LOGS, RETEST, EXPIRED, NEAR_EXPIRY, VALID, DISCARDED, expireDate, extendDays, vật tư có hạn dùng, kiểm tra lại, hết hạn, gia hạn LOT]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_HISTORY, QC_IQC]
---

# Kiểm tra lại vật tư có hạn dùng — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Kiểm tra lại LOT vật tư sắp hết hạn(`NEAR_EXPIRY`) hoặc quá hạn(`EXPIRED`) để gia hạn hoặc xử lý phế liệu. Đo lường dựa trên hạng mục kiểm tra IQC (IQC_PART_SPEC), đánh giá PASS/FAIL. PASS gia hạn ngày hết hạn; FAIL tự động cách ly LOT đến kho DEFECT và đánh dấu DISCARDED.

```
Danh sách LOT mục tiêu → Đo lường IQC → PASS: gia hạn / FAIL: cách ly DEFECT+DISCARDED
```

## Cấu trúc dữ liệu
```
MAT_LOTS (PK: matUid)
   ├─ itemCode → ITEM_MASTERS (expiryExtDays: gia hạn tối đa)
   ├─ expireDate (ngày hết hạn)
   └─ status: NORMAL / DISCARDED

IQC_LOGS (inspectType='RETEST')
   ├─ matUid / retestRound (tự động tăng)
   ├─ result (PASS/FAIL) / extendDays
   └─ details (JSON hạng mục đo)
```

## Bố cục màn hình

### Khu vực chính
- **Header**: Tiêu đề + liên kết (Tình trạng hạn dùng·Lịch sử kiểm tra lại)
- **DataGrid**: `GET /material/shelf-life?limit=5000`
  - Lọc client: chỉ hiển thị `EXPIRED` + `NEAR_EXPIRY`
  - Cột: thao tác·LOT No.·mã hạng mục·tên·số lượng·hạn dùng·ngày còn lại·trạng thái
  - Tìm kiếm: số LOT·mã hạng mục·tên, bộ lọc trạng thái
  - Nút `Kiểm tra` mỗi hàng → mở ReinspectModal
  - Hỗ trợ tự động mở URL `?matUid=XXX`

### ReinspectModal
| Khu vực | Mô tả |
|------|-------------|
| Thông tin mục tiêu | LOT·hạng mục·số lượng·hạn dùng hiện tại·ngày còn lại |
| Hạng mục IQC | `GET /master/iqc-part-specs/{itemCode}/resolve-items` |
| Nhập giá trị đo | Có LSL/USL → nhập số (tự động PASS/FAIL) |
| | Không LSL/USL → chuyển đổi PASS/FAIL |
| Đánh giá tổng thể | Tất cả PASS→tự động PASS / Bất kỳ FAIL→FAIL |
| Người kiểm tra | Tùy chọn |
| Số lượng mẫu | Tiêu hao do kiểm tra phá hủy |
| Ngày gia hạn | Số ngày gia hạn khi PASS (trống=expiryExtDays tối đa) |
| Ghi chú | |

## Quy trình kiểm tra lại

### ① Chọn LOT mục tiêu
`GET /material/shelf-life?limit=5000`
- Chỉ hiển thị LOT EXPIRED + NEAR_EXPIRY
- Cũng có thể truy cập từ trang Tình trạng hạn dùng (`/material/shelf-life`)

### ② Tải hạng mục IQC
`GET /master/iqc-part-specs/{itemCode}/resolve-items`
- Hạng mục kiểm tra IQC đã đăng ký cho hạng mục
- Tự động đánh giá dựa trên phạm vi LSL/USL

### ③ Nhập giá trị đo
- Số: nhập giá trị thực tế → PASS nếu trong phạm vi
- Chuyển đổi: chọn trực tiếp PASS/FAIL

### ④ Gửi kiểm tra lại
`POST /material/shelf-life/reinspect { matUid, result, inspectorName, extendDays, destructSampleQty, details, remark }`

| Kết quả | Xử lý |
|------|--------|
| **PASS** | `MatLot.expireDate` = ngày kiểm tra + `extendDays` (tối đa `expiryExtDays`) |
| **FAIL** | Chuyển tồn kho tốt → kho DEFECT, `MatLot.status = 'DISCARDED'` |

## Tiêu chí trạng thái hết hạn

| Trạng thái | Điều kiện |
|------|-----------|
| EXPIRED | `expireDate < hôm nay` |
| NEAR_EXPIRY | `expireDate <= hôm nay + nearExpiryDays(mặc định 10)` |
| VALID | Khác |
| DISCARDED | `MatLot.status = 'DISCARDED'` |

## Khóa liên động

| Điều kiện | Mô tả |
|------|-------------|
| Đã DISCARDED | Không thể kiểm tra lại |
| Gia hạn > expiryExtDays | Giới hạn gia hạn tối đa |
| Có số lượng đặt trước khi FAIL | Không thể chuyển DEFECT |

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không có LOT mục tiêu | Không EXPIRED/NEAR_EXPIRY | Kiểm tra tình trạng hạn dùng |
| Không có hạng mục IQC | Chưa đăng ký IQC_PART_SPEC | Đăng ký spec hạng mục |
| Không thể gia hạn | expiryExtDays=0 | Kiểm tra master hạng mục |
| Lỗi khi FAIL | Thiếu kho DEFECT | Đăng ký kho DEFECT trong WAREHOUSES |

## Dữ liệu & Liên kết
- Bảng: `MAT_LOTS`, `IQC_LOGS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `ITEM_MASTERS`
- Liên kết: Tình trạng hạn dùng(`/material/shelf-life`) → **Kiểm tra lại(hiện tại)** → Lịch sử(`/material/shelf-life-history`)
- IQC: Dựa trên hạng mục kiểm tra `IQC_PART_SPEC`
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
