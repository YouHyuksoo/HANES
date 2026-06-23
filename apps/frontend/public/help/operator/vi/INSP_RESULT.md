---
menuCode: INSP_RESULT
audience: operator
title: Kiểm tra thông mạch — Hướng dẫn vận hành
summary: Kiểm tra thông mạch (Continuity) thành phẩm — chọn máy kiểm tra·tra cứu lệnh sản xuất·đánh giá PASS/FAIL·phát hành mã vạch FG·quét nhãn mạch·gắn vật tư tiêu hao·in lại/hủy/kiểm tra lại nhãn
tags: [chất lượng, kiểm tra thông mạch, kiểm tra, vận hành]
keywords: [INSPECT_RESULTS, FG_LABELS, CONTINUITY_DEFECT, FG_BARCODE, CIRCUIT_LABEL, PASS_YN, ERROR_CODE, TESTER, CONSUMABLE, JOB_ORDERS, kiểm tra thông mạch, kiểm tra liên tục, mã vạch FG, nhãn mạch, máy kiểm tra, vật tư tiêu hao, in lại, hủy, kiểm tra lại, đạt, không đạt]
related: [QC_INSPECT, SHIP_PACK]
---

# Kiểm tra thông mạch — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình thực hiện **kiểm tra thông mạch (Continuity)** cho thành phẩm (FG). Chọn máy kiểm tra (Tester), tra cứu theo lệnh sản xuất và phát hành/kiểm tra mã vạch FG. Nhãn FG được tạo cùng với đánh giá PASS/FAIL. Cần gắn vật tư tiêu hao trước khi kiểm tra.

```
Phát hành FG → Kết nối máy kiểm tra → Kiểm tra thông mạch(PASS/FAIL) → FG_LABELS (ISSUED) → Kiểm tra ngoại quan
```

## Cấu trúc dữ liệu
```
JOB_ORDERS (PK: ORDER_NO)
   ├─ PROD_RESULTS → FG_LABELS (phát hành mã vạch)
   └─ CONSUMABLES (ánh xạ vật tư tiêu hao)

FG_LABELS (PK: FG_BARCODE)
   Chuyển trạng thái: ISSUED → VISUAL_PASS/FAIL → PACKED → SHIPPED
   PASS thông mạch tạo ISSUED → chuyển VISUAL_PASS qua kiểm tra ngoại quan

INSPECT_RESULTS (PK: RESULT_NO)
   Lưu kết quả kiểm tra thông mạch (INSPECT_TYPE='CONTINUITY')
```

## Bố cục màn hình
Lưới 4 / 8 cột:

### Bảng trái (4/12)
- **Chọn máy kiểm tra**: `GET /equipment/equips/type/TESTER` — lưu trong localStorage
- **Danh sách lệnh sản xuất**: `GET /quality/continuity-inspect/job-orders`
  - Số lệnh·mã hạng mục·tên hạng mục·số lượng kế hoạch/tốt/lỗi
  - Huy hiệu trạng thái (mã chung `JOB_ORDER_STATUS`)
  - Tìm kiếm: số lệnh·mã hạng mục·tên hạng mục (debounce 300ms)
- **Bảng vật tư tiêu hao** (`ConsumablePanel`): Vật tư ánh xạ đến tổ hợp lệnh+máy kiểm tra
  - Quét mã vạch UID vật tư → gắn
  - Kiểm tra bị chặn nếu chưa gắn

### Bảng phải (8/12)
- `InspectPanel` — giao diện thực hiện kiểm tra
- **Lịch sử mã vạch FG** DataGrid: `GET /quality/continuity-inspect/fg-labels/{orderNo}`
  - Mã vạch FG·thời gian phát hành·trạng thái·số lần in lại·inspectPassYn
  - Hành động phục hồi nhãn: kiểm tra lại(chỉ FAIL) / in lại / hủy
- **Nút PASS/FAIL** (chuyển đổi lớn)
- **Chế độ quét** (có thể cấu hình): quét mã vạch sản phẩm + nhãn mạch trước khi PASS

## Quy trình kiểm tra

### ① Chọn máy kiểm tra
`GET /equipment/equips/type/TESTER`
- Mọi kiểm tra bị chặn nếu chưa chọn máy kiểm tra
- Giá trị chọn được lưu trong `localStorage` (`hanes:inspection:equip:CONTINUITY`)

### ② Chọn lệnh sản xuất
`GET /quality/continuity-inspect/job-orders?finishedOnly=true`
- Chỉ hiển thị lệnh thành phẩm (`finishedOnly=true`)
- Kiểm tra trạng thái gắn vật tư tiêu hao khi chọn

### ③ Gắn vật tư tiêu hao
`POST /production/job-orders/{orderNo}/consumables/scan { conUid, equipCode }`
- Quét mã vạch UID vật tư → tự động gắn
- Tháo gỡ: `DELETE /production/job-orders/{orderNo}/consumables/{mountedConUid}`
- Kiểm tra bị chặn nếu vật tư chưa gắn

### ④ Đánh giá PASS/FAIL
`POST /quality/continuity-inspect/inspect { orderNo, itemCode, equipCode, passYn, ... }`
- **PASS**: Tự động phát hành mã vạch FG + tạo FG_LABELS với trạng thái `ISSUED`
- **FAIL**: `FailModal` → mã lỗi(`CONTINUITY_DEFECT`) + lý do chi tiết → ghi vào `INSPECT_RESULTS` (không tạo FG_LABELS)
- Chế độ quét (tùy chọn): cần quét mã vạch sản phẩm + nhãn mạch (`CIRCUIT_LABEL`) trước khi PASS

### ⑤ Hành động với nhãn
- **Kiểm tra lại** (Re-inspect): `POST /quality/continuity-inspect/re-inspect/{barcode}` — chuyển FAIL→PASS
- **In lại** (Reprint): `POST /quality/continuity-inspect/reprint/{barcode}` — tăng số lần in lại
- **Hủy** (Void): `POST /quality/continuity-inspect/void/{barcode}` — FG_LABELS → `VOIDED`

## Khóa liên động (Điều kiện chặn kiểm tra)
Tất cả điều kiện phải được đáp ứng để kích hoạt nút PASS/FAIL:

| Điều kiện | Thông báo | Giải quyết |
|------|--------|-----------|
| Đã chọn máy kiểm tra | Chọn máy kiểm tra trước | Chọn từ dropdown máy kiểm tra |
| Đã gắn vật tư tiêu hao | N vật tư chưa gắn | Quét UID vật tư để gắn |
| Đã quét mã vạch (chế độ quét) | Quét mã vạch trước | Quét mã vạch sản phẩm |
| Đã quét nhãn mạch (chế độ quét PASS) | Quét nhãn mạch để PASS | Quét CIRCUIT_LABEL |

## Toàn bộ cột — INSPECT_RESULTS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số kiểm tra | `RESULT_NO` | PK. SeqGenerator tự động đánh số (`INSPECT_RESULT`). |
| Mã vạch FG | `FG_BARCODE` | Tham chiếu `FG_LABELS.FG_BARCODE`. |
| Loại kiểm tra | `INSPECT_TYPE` | `CONTINUITY` (kiểm tra thông mạch). |
| Phạm vi kiểm tra | `INSPECT_SCOPE` | `FULL` (toàn bộ). Thông mạch luôn kiểm tra toàn bộ. |
| Đạt/Không đạt | `PASS_YN` | Y/N. |
| Mã lỗi | `ERROR_CODE` | Mã chung `CONTINUITY_DEFECT`. Yêu cầu khi không đạt. |
| Chi tiết lỗi | `ERROR_DETAIL` | Văn bản chi tiết không đạt. |
| Nhãn mạch | `CIRCUIT_LABEL` | Mã vạch 2D đầu ra thiết bị (ánh xạ PASS chế độ quét). |
| Dữ liệu kiểm tra | `INSPECT_DATA` | CLOB. JSON dữ liệu kiểm tra bổ sung. |
| Thời gian kiểm tra | `INSPECT_TIME` | Dấu thời gian kiểm tra. Mặc định CURRENT_TIMESTAMP. |
| Người kiểm tra | `INSPECTOR_ID` | ID người kiểm tra. |
| Mã thiết bị | `EQUIP_CODE` | Mã thiết bị máy kiểm tra (TESTER). |
| Kết quả sản xuất | `PROD_RESULT_ID` | Tham chiếu `PROD_RESULTS.RESULT_NO`. |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000`. |

## Trạng thái vật tư tiêu hao

| Hiển thị | Ý nghĩa | Xử lý |
|------|---------|--------|
| Viền xanh + CheckCircle | Đã gắn bình thường | Có thể tiến hành kiểm tra |
| Viền cam + AlertTriangle | Đạt số lần cảnh báo | Xem xét thay thế |
| Viền đỏ + AlertCircle | Vượt quá tuổi thọ dự kiến | Thay thế ngay |
| Viền đỏ + AlertCircle (chưa gắn) | Chưa gắn | Quét UID để gắn |

## Thiết lập trước (Master·Mã chung)
- Mã chung: `CONTINUITY_DEFECT`(mã lỗi thông mạch), `JOB_ORDER_STATUS`, `TESTER`(loại thiết bị)
- Master thiết bị: Cần đăng ký `EQUIPMENTS.equipType='TESTER'`
- Ánh xạ vật tư: Cần ánh xạ trước đến tổ hợp hạng mục lệnh + máy kiểm tra
- FG_LABELS: Cần sequence `SEQ_FG_BARCODE`

## Phân quyền
Nhân viên kiểm tra chất lượng (thực hiện kiểm tra thông mạch/quản lý nhãn). Quản trị viên có thể sửa/xóa lịch sử kiểm tra.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Danh sách máy kiểm tra trống | Không có thiết bị loại TESTER trong `EQUIPMENTS` | Đăng ký thiết bị TESTER trong master |
| Danh sách lệnh sản xuất trống | Không có lệnh thành phẩm | Kiểm tra kế hoạch sản xuất và lệnh |
| Nút PASS bị vô hiệu hóa | Vật tư chưa gắn hoặc chưa chọn thiết bị | Kiểm tra điều kiện khóa liên động |
| Quét vật tư thất bại | UID không hợp lệ hoặc chưa ánh xạ | Xác nhận UID và ánh xạ |
| Mã vạch FG không phát hành | Sự cố sequence `SEQ_FG_BARCODE` | Kiểm tra trạng thái sequence |
| In lại không in được | Kết nối máy in hoặc lỗi bwip-js | Kiểm tra máy in và cài đặt in trình duyệt |
| Nút Hủy bị vô hiệu hóa | Đã ở trạng thái PACKED/SHIPPED/VOIDED | Kiểm tra trạng thái hiện tại |
| Nút Kiểm tra lại bị vô hiệu hóa | FG không ở trạng thái FAIL | Trạng thái PASS không cần kiểm tra lại |

## Dữ liệu & Liên kết
- Bảng: `INSPECT_RESULTS`, `FG_LABELS`, `JOB_ORDERS`, `PROD_RESULTS`, `CONSUMABLES`
- Liên kết: Kiểm tra ngoại quan (`/quality/inspect`), Đóng gói sản phẩm (`/shipping/pack`), Quản lý thiết bị (máy kiểm tra), Quản lý vật tư tiêu hao, Truy xuất nguồn gốc (`/quality/trace`)
- Sinh mã vạch FG: Oracle `SEQ_FG_BARCODE`
- Sinh số kiểm tra: `SEQ_RULES` mã `INSPECT_RESULT`
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
