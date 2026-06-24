---
menuCode: QC_INSPECT
audience: operator
title: Kiểm Tra Ngoại Quan — Hướng Dẫn Vận Hành
summary: Cấu trúc bảng INSPECT_RESULTS(VISUAL), chuyển trạng thái FG_LABELS, luồng giao dịch ĐẠT/KHÔNG ĐẠT và xử lý sự cố
tags: [chất-lượng, kiểm-tra-ngoại-quan, vận-hành, VISUAL, FG_LABELS, INSPECT_RESULTS]
keywords: [QC_INSPECT, INSPECT_RESULTS, VISUAL, FG_LABELS, PASS_YN, VISUAL_DEFECT, FG_BARCODE, kiểm-tra-ngoại-quan, VISUAL_PASS, VISUAL_FAIL, ISSUED]
related: [QC_DEFECT_CODE, QC_DEFECT]
---

# Kiểm Tra Ngoại Quan — Hướng Dẫn Vận Hành

## Mục Đích & Vai Trò Hệ Thống
Kiểm tra trực quan sản phẩm đã được phát hành nhãn FG (`ISSUED`), lưu kết quả vào bảng `INSPECT_RESULTS` với `INSPECT_TYPE='VISUAL'`. Dựa trên kết quả đạt/không đạt, `FG_LABELS.STATUS` chuyển sang `VISUAL_PASS` hoặc `VISUAL_FAIL`.

## Cấu Trúc Dữ Liệu
```
FG_LABELS (FG_BARCODE PK)
    │   STATUS: ISSUED → VISUAL_PASS / VISUAL_FAIL → PACKED → SHIPPED
    │   INSPECT_RESULT_ID → INSPECT_RESULTS.RESULT_NO
    │   ORDER_NO → JOB_ORDERS
    │
    └──▶ INSPECT_RESULTS (RESULT_NO PK)
            │   INSPECT_TYPE = 'VISUAL' (cố định)
            │   INSPECT_SCOPE = 'FULL' (cố định)
            │   PASS_YN = 'Y'(đạt) / 'N'(không đạt)
            │   ERROR_CODE → COM_CODES.VISUAL_DEFECT
            │   ERROR_DETAIL (VARCHAR2 500)
            │   FG_BARCODE → FG_LABELS
            │   INSPECTOR_ID → WORKER_MASTERS
```

---

## ① Kết Quả Kiểm Tra — INSPECT_RESULTS (Cột Liên Quan Kiểm Tra Ngoại Quan)

| Trường màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số kết quả | `RESULT_NO` | **PK**. Tự động đánh số từ sequence. |
| ID KQ SX | `PROD_RESULT_ID` | → `PROD_RESULTS` FK (có thể bỏ qua với kiểm tra ngoại quan). |
| Loại kiểm tra | `INSPECT_TYPE` | Cố định là `'VISUAL'`. |
| Phạm vi kiểm tra | `INSPECT_SCOPE` | Cố định là `'FULL'`. |
| Đạt/Không đạt | `PASS_YN` | `'Y'`(đạt) / `'N'`(không đạt). Mặc định `'Y'`. |
| Mã lỗi | `ERROR_CODE` | Tham chiếu mã nhóm common code `VISUAL_DEFECT`. |
| Lý do chi tiết | `ERROR_DETAIL` | Lý do chi tiết không đạt. Tối đa 500 ký tự. |
| Dữ liệu kiểm tra | `INSPECT_DATA` | CLOB — dữ liệu kiểm tra bổ sung (JSON). |
| Mã vạch FG | `FG_BARCODE` | → `FG_LABELS.FG_BARCODE`. |
| Thời gian kiểm tra | `INSPECT_TIME` | Dấu thời gian thực hiện kiểm tra. |
| ID người kiểm tra | `INSPECTOR_ID` | → `WORKER_MASTERS`. |
| Đa nhiệm | `COMPANY`, `PLANT_CD` | Mã công ty (`40`) / Mã nhà máy (`1000`). |

---

## ② Nhãn FG — FG_LABELS (Chuyển Trạng Thái)

| Cột DB | Vai trò / Ý nghĩa |
|---------|------|
| `FG_BARCODE` | **PK**. Mã vạch FG (serial). |
| `STATUS` | `ISSUED`(phát hành) → `VISUAL_PASS`(đạt ngoại quan) / `VISUAL_FAIL`(không đạt ngoại quan) → `PACKED`(đóng gói) → `SHIPPED`(xuất hàng). |
| `INSPECT_RESULT_ID` | Tham chiếu `INSPECT_RESULTS.RESULT_NO` sau khi kiểm tra. |
| `INSPECT_PASS_YN` | Kết quả đạt/không đạt cuối cùng. |

---

## Chi Tiết Xử Lý Giao Dịch Đạt/Không Đạt

Khi gọi `POST /quality/continuity-inspect/visual-inspect/{fgBarcode}`, `visualInspect()` thực thi:

1. **Giai đoạn xác thực**:
   - Kiểm tra cài đặt hệ thống `VISUAL_INSP_BYPASS` (lỗi 400 nếu đang bật)
   - Xác nhận nhãn FG tồn tại và `STATUS` là `ISSUED`
   - Trạng thái `PACKED`, `SHIPPED`, `VOIDED` không thể kiểm tra

2. **Thực thi trong giao dịch**:
   - Đánh số sequence `RESULT_NO`
   - INSERT vào `INSPECT_RESULTS` (`INSPECT_TYPE='VISUAL'`, `INSPECT_SCOPE='FULL'`, `PASS_YN`, `ERROR_CODE`, `ERROR_DETAIL`)
   - `FG_LABELS.UPDATE`: đặt `STATUS='VISUAL_PASS'` hoặc `STATUS='VISUAL_FAIL'`, đặt `INSPECT_RESULT_ID`

---

## Mã Chung (Common Code)

| Mã nhóm | Mục đích | Ví dụ |
|---------|------|------|
| `VISUAL_DEFECT` | Mã lỗi kiểm tra ngoại quan | Trầy xước, Dị vật, Đổi màu, In lỗi, Khác |

---

## Quy Tắc Xác Thực

| Điều kiện | Xử lý |
|------|------|
| Mã vạch FG không tồn tại | `BadRequestException` |
| Trạng thái nhãn FG không phải `ISSUED` | Thông báo không thể kiểm tra (đã kiểm tra/đóng gói/xuất hàng/hủy) |
| Mã vạch không thuộc lệnh SX đã chọn | Hiển thị cảnh báo |
| `VISUAL_INSP_BYPASS` BẬT | 400 BadRequest |
| FAIL không chọn mã lỗi | Nhập bắt buộc qua `FailModal` |

## Xử Lý Sự Cố

| Triệu chứng | Nguyên nhân | Biện pháp |
|------|------|------|
| Tra cứu mã vạch FG thất bại | Nhập sai mã vạch hoặc không tồn tại | Kiểm tra lại mã vạch |
| Thông báo "Đã kiểm tra xong" | Nhãn FG đã ở trạng thái `VISUAL_PASS`/`VISUAL_FAIL` | Không thể kiểm tra lại; xác nhận tại màn hình Quản lý Lỗi |
| Lỗi "Nhãn lệnh SX khác" | Mã vạch quét không khớp lệnh SX đã chọn | Chọn đúng lệnh SX hoặc kiểm tra lại mã vạch |
| Lưu FAIL thất bại | Chưa chọn mã lỗi hoặc chưa nhập lý do chi tiết | Kiểm tra các trường bắt buộc |
| Lỗi cài đặt hệ thống (400) | `VISUAL_INSP_BYPASS` đang bật | Liên hệ quản trị viên để kiểm tra cài đặt |
| Không thay đổi trạng thái sau kiểm tra | Giao dịch thất bại (lỗi DB) | Kiểm tra log và thử lại |

## Dữ Liệu & Liên Kết
- **Bảng**: `INSPECT_RESULTS` (kết quả kiểm tra), `FG_LABELS` (nhãn/trạng thái), `COM_CODES` (mã lỗi)
- **Liên kết**: Kết quả sản xuất (`PROD_RESULTS`), Công nhân (`WORKER_MASTERS`)
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
