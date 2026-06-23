---
menuCode: QC_INSPECT
audience: operator
title: Kiểm tra ngoại quan — Hướng dẫn vận hành
summary: Kiểm tra ngoại quan dựa trên quét mã vạch FG — đánh giá đạt/không đạt, nhập mã lỗi, chuyển trạng thái FG_LABELS (ISSUED→VISUAL_PASS/FAIL), tự động tạo INSPECT_RESULTS
tags: [chất lượng, kiểm tra, ngoại quan, vận hành]
keywords: [INSPECT_RESULTS, FG_LABELS, FG_BARCODE, VISUAL_DEFECT, PASS_YN, ERROR_CODE, VISUAL_PASS, VISUAL_FAIL, INSPECT_TYPE, kiểm tra ngoại quan, mã vạch FG, đạt, không đạt, mã lỗi, kết quả kiểm tra]
related: [INSP_RESULT]
---

# Kiểm tra ngoại quan — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình đăng ký·tra cứu kết quả **kiểm tra ngoại quan** cho thành phẩm (FG). Quét mã vạch FG, đánh giá đạt/không đạt, ghi mã lỗi và chi tiết khi không đạt.

| Kết quả | Chuyển trạng thái FG_LABELS | Mô tả |
|--------|---------------------|-------------|
| Đạt (PASS) | `ISSUED` → `VISUAL_PASS` | Ngoại quan tốt, có thể tiến hành công đoạn tiếp theo (đóng gói) |
| Không đạt (FAIL) | `ISSUED` → `VISUAL_FAIL` | Phát hiện lỗi, cần kiểm tra lại hoặc hủy |

## Cấu trúc dữ liệu
```
FG_LABELS (PK: FG_BARCODE)
   Chuyển trạng thái: ISSUED → VISUAL_PASS/VISUAL_FAIL → PACKED → SHIPPED
   Đạt → VISUAL_PASS, Không đạt → VISUAL_FAIL

INSPECT_RESULTS (PK: RESULT_NO, SeqGenerator INSPECT_RESULT)
   ├─ FG_BARCODE ─▶ FG_LABELS (mã vạch FG đã quét)
   ├─ PASS_YN: Y/N (đạt/không đạt)
   ├─ ERROR_CODE: mã lỗi (mã chung VISUAL_DEFECT)
   └─ INSPECT_TYPE: 'VISUAL'
```

## Bố cục màn hình
- **Khu vực chính bên trái**: DataGrid — lịch sử kiểm tra (mã vạch FG·đánh giá·mã lỗi·thời gian·người kiểm tra)
  - Thống kê tóm tắt: tổng số, đã kiểm tra, chưa kiểm tra, tỷ lệ đạt
  - Tìm kiếm: số lệnh sản xuất·mã hạng mục, bộ lọc trạng thái·đánh giá
  - Modal chọn nhãn FG: `FgLabelSelectModal` — chọn từ danh sách FG trạng thái ISSUED
- **Bảng trượt bên phải**: `InspectFormPanel` — biểu mẫu đăng ký kiểm tra (tự động mở khi quét mã vạch)
  - Thông tin sản phẩm: mã vạch FG·mã hạng mục·lệnh sản xuất·mã thiết bị·trạng thái (chỉ đọc)
  - Nút Đạt/Không đạt (chuyển đổi lớn)
  - Danh sách kiểm tra lỗi: mã chung `VISUAL_DEFECT` hạng mục lỗi với hộp kiểm + số lượng
  - Mã lỗi chính: chọn `VISUAL_DEFECT`
  - Lý do chi tiết: nhập văn bản tự do

## Quy trình kiểm tra

### ① Quét mã vạch FG
`GET /quality/continuity-inspect/fg-label/{barcode}`
- Nhập mã vạch vào ô nhập liệu → Enter
- Tra cứu FG_LABELS → hiển thị thông tin sản phẩm + mở bảng bên phải
- Nhãn đã kiểm tra (`status !== ISSUED`): cảnh báo `Đã kiểm tra` + vô hiệu hóa nút Lưu

### ② Đánh giá Đạt/Không đạt
`POST /quality/continuity-inspect/visual-inspect/{fgBarcode}`
- **Đạt (PASS)**: Nhấp nút xanh lớn → lưu với `passYn: "Y"`
- **Không đạt (FAIL)**: Nhấp nút đỏ lớn → nhập mã lỗi·lý do chi tiết → lưu
- Xử lý giao dịch: tạo `InspectResult` + cập nhật `FgLabel.status` (nguyên tử)

### ③ Xác nhận kết quả
- DataGrid lịch sử kiểm tra tự động làm mới
- Trạng thái FG_LABELS chuyển thành `VISUAL_PASS` hoặc `VISUAL_FAIL`
- `VISUAL_PASS` → có thể đóng gói thùng tại `/shipping/pack`
- `VISUAL_FAIL` → xử lý kiểm tra lại hoặc hủy

## Toàn bộ cột — INSPECT_RESULTS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số kiểm tra | `RESULT_NO` | PK. SeqGenerator tự động đánh số (`INSPECT_RESULT`). |
| Mã vạch FG | `FG_BARCODE` | Tham chiếu `FG_LABELS.FG_BARCODE`. Giá trị nhập từ quét. |
| Loại kiểm tra | `INSPECT_TYPE` | `VISUAL` (kiểm tra ngoại quan). Mọi bản ghi từ màn hình này đều là VISUAL. |
| Phạm vi kiểm tra | `INSPECT_SCOPE` | `FULL` (toàn bộ). Kiểm tra ngoại quan luôn là kiểm tra toàn bộ. |
| Đạt/Không đạt | `PASS_YN` | Y/N. |
| Mã lỗi | `ERROR_CODE` | Mã chung `VISUAL_DEFECT`. Yêu cầu khi không đạt. |
| Chi tiết lỗi | `ERROR_DETAIL` | Văn bản chi tiết không đạt. |
| Dữ liệu kiểm tra | `INSPECT_DATA` | CLOB. JSON danh sách kiểm tra lỗi và dữ liệu bổ sung. |
| Thời gian kiểm tra | `INSPECT_TIME` | Dấu thời gian kiểm tra. Mặc định CURRENT_TIMESTAMP. |
| Người kiểm tra | `INSPECTOR_ID` | ID người kiểm tra. |
| Mã thiết bị | `EQUIP_CODE` | Mã thiết bị kiểm tra (tùy chọn cho kiểm tra ngoại quan). |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000`. |

## Chuyển trạng thái FG_LABELS

| Trạng thái | Ý nghĩa | Trạng thái tiếp theo |
|------|---------|-------------|
| `ISSUED` | Nhãn đã phát hành, chưa kiểm tra | `VISUAL_PASS` hoặc `VISUAL_FAIL` |
| `VISUAL_PASS` | Kiểm tra ngoại quan đạt | `PACKED` (đóng gói) |
| `VISUAL_FAIL` | Kiểm tra ngoại quan không đạt | Kiểm tra lại (quay lại ISSUED) hoặc hủy |
| `PACKED` | Đã đóng gói | `SHIPPED` (xuất hàng) |
| `SHIPPED` | Đã xuất hàng | Trạng thái cuối |
| `VOIDED` | Đã hủy | Trạng thái cuối |

## Thiết lập trước (Master·Mã chung)
- Mã chung: `VISUAL_DEFECT`(mã lỗi ngoại quan) — dùng để chọn mã lỗi và danh sách kiểm tra
- FG_LABELS: Phải được tạo trước ở trạng thái `ISSUED` qua kiểm tra liên tục (`/inspection/result`) hoặc phát hành FG trực tiếp
- INSPECT_RESULTS: SeqGenerator `INSPECT_RESULT` phải được đăng ký trong SEQ_RULES

## Phân quyền
Nhân viên kiểm tra chất lượng (đăng ký/tra cứu kiểm tra ngoại quan). Quản trị viên có thể sửa/xóa (chỉ xóa khi kết quả sản xuất liên kết ở trạng thái CANCELED).

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Quét mã vạch không có kết quả | Mã vạch không có trong FG_LABELS | Xác nhận FG đã phát hành hoặc dùng modal chọn nhãn |
| Lưu kiểm tra bị chặn — đã kiểm tra | `FG_LABELS.status` không phải ISSUED | Không cho phép kiểm tra trùng lặp |
| Không thể chọn mã lỗi khi không đạt | Mã chung `VISUAL_DEFECT` chưa đăng ký | Đăng ký mã lỗi ngoại quan trong mã chung |
| Kiểm tra gần đây không hiển thị trong danh sách | Trước khi tự động làm mới | DataGrid tự động làm mới khi lưu; có thể làm mới thủ công |
| Không có nhãn trong modal chọn FG | Tất cả FG không ở trạng thái ISSUED | Xác nhận FG mục tiêu có trạng thái ISSUED |
| Không thể xóa kết quả kiểm tra | Kết quả sản xuất không ở trạng thái CANCELED | Chỉ xóa được sau khi hủy kết quả sản xuất |

## Dữ liệu & Liên kết
- Bảng: `INSPECT_RESULTS`, `FG_LABELS`
- Liên kết: Kiểm tra liên tục (`/inspection/result`), Đóng gói sản phẩm (`/shipping/pack`), Quản lý mã lỗi (`/quality/defect-code`), Truy xuất nguồn gốc (`/quality/trace`)
- Sinh số kiểm tra: `SEQ_RULES` mã `INSPECT_RESULT`
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
