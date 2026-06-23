---
menuCode: EQUIP_INSPECT_ITEM_MASTER
audience: operator
title: Danh mục hạng mục kiểm tra — Hướng dẫn vận hành
summary: Toàn bộ cột của bảng EQUIP_INSPECT_ITEM_MASTERS, thuộc tính hạng mục kiểm tra, cấu trúc tải lên hình ảnh và xử lý sự cố
tags: [설비, 점검, 항목, 마스터, 운영, 기준정보]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, ITEM_CODE, INSPECT_TYPE, ITEM_TYPE, VISUAL, MEASURE, LSL_VALUE, USL_VALUE, CYCLE, IMAGE_URL, WORKER_QR_CODE, 설비점검, EQUIP_TYPE, COM_CODES]
related: [EQUIP_INSPECT_ITEM]
---

# Danh mục hạng mục kiểm tra — Hướng dẫn vận hành

## Mục đích · Vai trò hệ thống
Lưu trữ và quản lý dữ liệu chuẩn của tất cả hạng mục kiểm tra dùng cho kiểm tra thiết bị trong bảng `EQUIP_INSPECT_ITEM_MASTERS`. Mỗi hạng mục kiểm tra có các thuộc tính như loại kiểm tra (DAILY/PERIODIC/PM/WORKER), loại đánh giá (VISUAL/MEASURE), chu kỳ, tiêu chuẩn đánh giá (LSL/USL). Chúng được liên kết với từng thiết bị theo quan hệ N:M thông qua `EQUIP_INSPECT_ITEM_POOL` trên màn hình [Hạng mục kiểm tra theo thiết bị].

## Cấu trúc dữ liệu
```
EQUIP_INSPECT_ITEM_MASTERS (PK: COMPANY + PLANT_CD + ITEM_CODE)
    │
    ├── Loại kiểm tra (INSPECT_TYPE): DAILY / PERIODIC / PM / WORKER
    ├── Loại đánh giá (ITEM_TYPE): VISUAL (trực quan) / MEASURE (đo lường)
    ├── Chu kỳ (CYCLE): DAILY / WEEKLY / MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL
    ├── Tiêu chuẩn đánh giá: CRITERIA (văn bản) hoặc LSL_VALUE + USL_VALUE + UNIT
    │
    └──▶ EQUIP_INSPECT_ITEM_POOL (ánh xạ N:M)
            └── EQUIP_MASTERS (thiết bị riêng lẻ)
```

---

## ① Hạng mục kiểm tra — EQUIP_INSPECT_ITEM_MASTERS (Toàn bộ cột)

| Trường màn hình | Cột DB | Vai trò / Ý nghĩa · Điểm vận hành |
|------|------|------|
| Mã hạng mục | `ITEM_CODE` | **PK (3/3)**. Định danh hạng mục kiểm tra. Không thể thay đổi sau khi đăng ký (giữ ánh xạ). Khuyến nghị quy tắc đặt tên: `EI-{LOẠI_THIẾT_BỊ}-{NNN}`. |
| Tên hạng mục kiểm tra | `ITEM_NAME` | Tên hiển thị của hạng mục kiểm tra. `varchar2(200)`. |
| Loại kiểm tra | `INSPECT_TYPE` | `DAILY`(kiểm tra hàng ngày) / `PERIODIC`(kiểm tra định kỳ) / `PM`(bảo trì phòng ngừa) / `WORKER`(kiểm tra nhân viên). Khi ánh xạ theo thiết bị, chỉ có thể liên kết các hạng mục cùng loại. |
| Loại thiết bị | `EQUIP_TYPE` | Tham chiếu giá trị mã chung `EQUIP_TYPE`. Xác định phạm vi loại thiết bị mà hạng mục này áp dụng. |
| Loại đánh giá | `ITEM_TYPE` | `VISUAL`(trực quan) = đánh giá định tính OK/NG / `MEASURE`(đo lường) = đo giá trị số rồi đánh giá phạm vi LSL~USL. Giá trị mặc định `VISUAL`. |
| Tiêu chuẩn đánh giá | `CRITERIA` | Loại VISUAL: Văn bản hướng dẫn đánh giá OK/NG. / Loại MEASURE: Mô tả bổ sung (tiêu chuẩn số dùng LSL/USL). |
| Chu kỳ | `CYCLE` | Chu kỳ thực hiện kiểm tra. `DAILY` / `WEEKLY` / `MONTHLY` / `QUARTERLY` / `SEMI_ANNUAL` / `ANNUAL`. |
| Đơn vị | `UNIT` | Đơn vị của giá trị đo khi là loại đo lường (MEASURE). Mã chung hoặc nhập tự do. |
| Giá trị giới hạn dưới | `LSL_VALUE` | Giới hạn dưới cho phép (Lower Spec Limit) của loại đo lường. |
| Giá trị giới hạn trên | `USL_VALUE` | Giới hạn trên cho phép (Upper Spec Limit) của loại đo lường. |
| Mã QR nhân viên | `WORKER_QR_CODE` | Giá trị mã QR cho kiểm tra nhân viên (WORKER). |
| URL hình ảnh | `IMAGE_URL` | Đường dẫn máy chủ hoặc URL của ảnh tham chiếu kiểm tra. `varchar2(500)`. |
| Trạng thái sử dụng | `USE_YN` | `Y`(kích hoạt) / `N`(vô hiệu). Nếu `N` thì không thể chọn khi ánh xạ thiết bị. Mặc định `Y`. |
| Ghi chú | `REMARK` | Ghi chú quản lý. `varchar2(500)`. |
| Đa đối tượng | `COMPANY`, `PLANT_CD` | **PK (1,2/3)**. Phạm vi mã công ty (`40`) / mã nhà máy (`1000`). |
| Người tạo | `CREATED_BY` | Người đăng ký ban đầu. |
| Người sửa | `UPDATED_BY` | Người sửa cuối cùng. |
| Thời gian tạo | `CREATED_AT` | Thời điểm tạo bản ghi. |
| Thời gian sửa | `UPDATED_AT` | Thời điểm sửa bản ghi. |

---

## Cấu trúc tải lên hình ảnh

| Mục | Chi tiết |
|------|------|
| API tải lên | `POST /master/equip-inspect-item-masters/{itemCode}/image` (multipart) |
| API xóa | `DELETE /master/equip-inspect-item-masters/{itemCode}/image` |
| Định dạng cho phép | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Kích thước tối đa | 5MB |
| Vị trí lưu trữ | Thư mục máy chủ `./uploads/equip-inspect-items/` |

---

## Chi tiết loại kiểm tra

| Loại | Mã | Mô tả | Ví dụ chu kỳ |
|------|------|------|---------|
| Kiểm tra hàng ngày | DAILY | Kiểm tra trạng thái cơ bản trước khi bắt đầu làm việc hàng ngày | DAILY |
| Kiểm tra định kỳ | PERIODIC | Kiểm tra định kỳ theo tháng/quý/nửa năm/năm | MONTHLY ~ ANNUAL |
| Bảo trì phòng ngừa | PM | Kiểm tra khi bảo trì phòng ngừa (Prescriptive Maintenance) thiết bị | MONTHLY ~ ANNUAL |
| Kiểm tra nhân viên | WORKER | Kiểm tra do nhân viên tự thực hiện (có thể dựa trên QR) | DAILY ~ MONTHLY |

## Phương thức nhập tiêu chuẩn đánh giá

| Loại đánh giá | Trường nhập | Lưu trữ |
|---------|----------|------|
| VISUAL (trực quan) | Nhập văn bản criteria | Lưu trong cột `CRITERIA` |
| MEASURE (đo lường) | Đơn vị (UNIT) + Giới hạn dưới (LSL) + Giới hạn trên (USL) | Lưu trong `UNIT`, `LSL_VALUE`, `USL_VALUE`; `CRITERIA` là mô tả bổ sung |

## Quyền hạn
Người dùng có quyền quản lý dữ liệu chuẩn (quản trị viên thiết bị/chất lượng). Người dùng thông thường chỉ có thể xem.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Biện pháp |
|------|------|------|
| Lỗi trùng mã hạng mục | PK trùng (COMPANY+PLANT_CD+ITEM_CODE) đã tồn tại | Đăng ký với mã khác |
| Tải lên hình ảnh thất bại | Vượt quá 5MB hoặc định dạng không được hỗ trợ | Kiểm tra kích thước và định dạng tệp |
| Loại đo lường nhưng không thấy giá trị tiêu chuẩn | Chưa nhập LSL/USL | Loại đo lường bắt buộc nhập giới hạn dưới và trên |
| Không thấy hạng mục khi ánh xạ thiết bị | `USE_YN='N'` của hạng mục hoặc EQUIP_TYPE không khớp | Kiểm tra trạng thái sử dụng và loại thiết bị |
| Mã QR kiểm tra nhân viên không hoạt động | WORKER_QR_CODE chưa được thiết lập | Nhập giá trị mã QR và phát hành lại nhãn QR |

## Dữ liệu · Liên kết
- **Bảng**: `EQUIP_INSPECT_ITEM_MASTERS` (dữ liệu chuẩn), `EQUIP_INSPECT_ITEM_POOL` (ánh xạ thiết bị-hạng mục), `EQUIP_INSPECT_LOGS` (kết quả kiểm tra)
- **Liên kết**: Dữ liệu chính thiết bị (`EQUIP_MASTERS`), mã chung (`COM_CODES.EQUIP_TYPE`)
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
