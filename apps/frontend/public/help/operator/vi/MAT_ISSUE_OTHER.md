---
menuCode: MAT_ISSUE_OTHER
audience: operator
title: Xuất kho khác — Hướng dẫn vận hành
summary: Xuất kho vật tư phi sản xuất — quét mã vạch LOT xuất toàn bộ, tra cứu·hủy lịch sử xuất kho, tài khoản lỗi/mẫu/gia công/phế liệu/trả lại/khác
tags: [vật tư, xuất kho, xuất kho khác, LOT, mã vạch]
keywords: [MAT_ISSUES, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, ISSUE_TYPE, DONE, CANCELED, MAT_OUT, WIP_MOVE, xuất kho khác, xuất LOT, quét mã vạch, hủy xuất]
related: [MAT_ISSUE, MAT_RECEIVE]
---

# Xuất kho khác — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Xử lý xuất kho vật tư phi sản xuất (lỗi/mẫu/gia công/phế liệu/trả lại/khác). Quét mã vạch LOT để xuất toàn bộ tồn kho, hoặc tra cứu/hủy lịch sử xuất kho.

```
Tab quét mã vạch: Quét LOT → Xuất toàn bộ
Tab lịch sử: Tra cứu → Hủy (nhập lý do)
```

## Cấu trúc dữ liệu
```
MAT_LOTS (PK: matUid)
   ├─ ITEM_CODE → ITEM_MASTERS
   ├─ currentQty / iqcStatus / status(NORMAL/HOLD/DEPLETED)
   └─ MAT_STOCKS (qty / availableQty / reservedQty)

MAT_ISSUES (PK: issueNo + seq)
   ├─ matUid / issueQty / issueType / status(DONE/CANCELED)
   └─ STOCK_TRANSACTIONS (transType=MAT_OUT/WIP_MOVE)
```

## Bố cục màn hình

### Tab quét mã vạch
- **Chọn tài khoản xuất**: Mã chung `ISSUE_TYPE` (loại trừ PRODUCTION)
- **Nhập mã vạch LOT**: Tự động focus, Enter → `GET /material/lots/by-uid/{matUid}`
- **Thẻ kết quả quét**:
  - Mã hạng mục·tên·LOT·số lượng tồn·đơn vị
  - Trạng thái IQC (cần PASS)
  - Ngày nhập·nhà cung cấp
- **Nút xuất toàn bộ**: `POST /material/issues/scan { matUid, issueType }`
- **Lịch sử xuất hôm nay**: DataGrid cục bộ

### Tab lịch sử xuất
- **Bộ lọc**: trạng thái·tài khoản·khoảng thời gian
- **DataGrid**: `GET /material/issues?limit=200`
  - Cột: số xuất·ngày·mã hạng mục·tên·LOT·số lượng·tài khoản·lệnh·trạng thái
  - Nút hủy (chỉ DONE)
- **Modal hủy**:
  - Hiển thị chi tiết xuất
  - Lý do hủy bắt buộc
  - `POST /material/issues/{issueNo}/{seq}/cancel { reason }`

## Quy trình làm việc

### ① Xuất bằng quét mã vạch
1. Chọn tài khoản xuất (ví dụ: lỗi, mẫu, gia công)
2. Quét mã vạch LOT hoặc nhập thủ công
3. Xác nhận kết quả (IQC PASS bắt buộc)
4. Nhấn `Xuất toàn bộ`
5. Trừ tồn kho + ghi STOCK_TRANSACTIONS

### ② Tra cứu lịch sử xuất
- Lọc theo khoảng thời gian·trạng thái·tài khoản
- Tài khoản xuất hiển thị bằng huy hiệu mã chung `ISSUE_TYPE`
- Phân biệt trạng thái DONE/CANCELED

### ③ Hủy xuất
- Chỉ hủy được trạng thái DONE
- Lý do hủy bắt buộc
- Khôi phục tồn kho + ghi giao dịch đảo ngược
- Không thể hủy nếu sản xuất hạ nguồn đang tiến hành

## Khóa liên động

| Điều kiện | Mô tả |
|------|-------------|
| IQC chưa PASS | Không thể xuất |
| Trạng thái HOLD/DEPLETED | Không thể xuất |
| Thiếu tồn kho | Không thể xuất |
| Sản xuất đang tiến hành | Không thể hủy |
| Đã hủy rồi | Không thể hủy |

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không tìm thấy LOT | Lỗi mã vạch | Kiểm tra mã vạch LOT |
| Không có tài khoản xuất | Đã loại trừ PRODUCTION | Chọn tài khoản khác |
| Xuất thất bại | IQC hoặc tồn kho | Kiểm tra trạng thái vật tư |
| Hủy thất bại | Liên kết sản xuất | Hoàn thành hạ nguồn trước |

## Dữ liệu & Liên kết
- Bảng: `MAT_ISSUES`, `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `WIP_MAT_STOCKS`
- Liên kết: Nhập kho(`/material/receive`) → **Xuất kho khác(hiện tại)** → Đầu vào sản xuất
- Mã chung: `ISSUE_TYPE` (PRODUCTION/SCRAP/SAMPLE/OUTSOURCING/RETURN/DEFECT/OTHER)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
