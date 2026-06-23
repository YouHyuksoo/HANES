---
menuCode: SHIP_PACK
audience: operator
title: Quản lý đóng gói sản phẩm — Hướng dẫn vận hành
summary: Quản lý đóng gói theo thùng (Box) — tạo thùng·thêm/xóa serial·đóng·mở lại·in nhãn, toàn bộ cột BOX_MASTERS, chuyển trạng thái FG_LABELS, tự động tạo OQC
tags: [xuất hàng, đóng gói, thùng, vận hành]
keywords: [BOX_MASTERS, FG_LABELS, BOX_NO, ITEM_CODE, SERIAL_LIST, PALLET_NO, BOX_STATUS, OQC_STATUS, BOX_QTY, OPEN, CLOSED, SHIPPED, VISUAL_PASS, PACKED, OQC_REQUEST, đóng gói thùng, serial, nhãn thùng, sức chứa thùng, pallet, đa khách hàng]
related: [SHIP_PALLET, SHIP_ORDER, SHIP_CONFIRM, SHIP_HISTORY]
---

# Quản lý đóng gói sản phẩm — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình đóng gói thành phẩm (FG) đã qua kiểm tra vào **thùng (Box)** để chuẩn bị xuất hàng. Quy trình gồm 3 bước: tạo thùng → thêm serial → đóng (→ tự động tạo yêu cầu OQC).

| Bước | Thao tác | Kết quả |
|------|----------|---------|
| 1 | Tạo thùng (chọn hạng mục) | Tạo thùng OPEN trong `BOX_MASTERS`, boxNo tự động đánh số |
| 2 | Thêm serial (quét mã vạch) | Thêm FG serial vào thùng, cập nhật JSON serialList, tăng qty |
| 3 | Đóng thùng | status→CLOSED, tự động tạo OQC, FG_LABELS→PACKED |

Thùng đã đóng tiếp tục qua xếp pallet (`/shipping/pallet`) → Kiểm tra xuất (OQC, `/quality/oqc`) → Xác nhận xuất hàng (`/shipping/confirm`).

## Cấu trúc dữ liệu
```
BOX_MASTERS (PK: COMPANY + PLANT_CD + BOX_NO)
   ├─ ITEM_CODE ─▶ ITEM_MASTERS (hạng mục, boxQty=sức chứa thùng)
   ├─ PALLET_NO ─▶ PALLET_MASTERS (pallet)
   └─ SERIAL_LIST (CLOB) ─▶ FG_LABELS (mảng JSON serial, VD: ["SN001","SN002"])

FG_LABELS (PK: FG_BARCODE)
   Chuyển trạng thái: ISSUED → VISUAL_PASS → PACKED → SHIPPED
   Khi đóng thùng: PACKED + gán boxNo

OQC_REQUESTS (tự động tạo khi đóng thùng)
   remark = "AUTO_CREATED_FROM_BOX:{boxNo}"
```

## Giá trị mã Trạng thái thùng (BOX_STATUS)

| Mã | Hiển thị | Mô tả |
|------|---------|-------------|
| `OPEN` | Mở | Có thể thêm/xóa serial |
| `CLOSED` | Đã đóng | Serial đã xác định, chờ OQC, có thể mở lại (nếu chưa gán pallet) |
| `SHIPPED` | Đã xuất | Xuất hàng hoàn tất, không thể thay đổi |

## Định dạng số thùng
- Định dạng: `BX` + `YYMMDD` + `NNNN` (serial 4 chữ số theo ngày, reset hàng ngày)
- Ví dụ: `BX2606230001`
- Sinh số: `NumberingService.nextBoxNo()` → Oracle `SEQ_BOX_NO_DAILY`

## Toàn bộ cột — BOX_MASTERS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số thùng | `BOX_NO` | PK. Tự động sinh BX+ngày+số thứ tự. Định danh nhãn & mã vạch. |
| Mã hạng mục | `ITEM_CODE` | Tham chiếu `ITEM_MASTERS.ITEM_CODE`. Một thùng chỉ chứa một hạng mục duy nhất. |
| Số lượng đóng gói | `QTY` | Số serial (= độ dài mảng JSON serialList). Không thể vượt quá boxQty. |
| Danh sách serial | `SERIAL_LIST` | CLOB. Mảng JSON mã vạch FG. Có thể chứa hàng nghìn nhưng cần xem xét hiệu suất OQC/truy vấn. |
| Số pallet | `PALLET_NO` | Tham chiếu `PALLET_MASTERS.PALLET_NO`. Gán khi xếp lên pallet. Có thể gán sau khi đóng. |
| Trạng thái | `STATUS` | `OPEN`/`CLOSED`/`SHIPPED`. Mặc định OPEN. |
| Trạng thái OQC | `OQC_STATUS` | `PENDING`/`PASS`/`FAIL`/`null`. Đặt thành PENDING khi đóng. |
| Số lệnh xuất | `SHIP_ORDER_NO` | Gán khi kết nối lệnh xuất. Đặt trong bước xác nhận xuất hàng. |
| Ngày xuất | `SHIPPED_AT` | Dấu thời gian xác nhận xuất hàng. |
| Ngày đóng | `CLOSE_TIME` | Dấu thời gian đóng thùng (closeAt). |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Thành phần PK. Phạm vi `40` / `1000`. |

Chỉ mục: `ITEM_CODE`, `PALLET_NO`, `STATUS`, `SHIP_ORDER_NO` — được sử dụng dựa trên điều kiện tìm kiếm.

## Quy trình chi tiết

### ① Tạo thùng
`POST /shipping/boxes { itemCode }`
- Modal chọn hạng mục → chỉ chọn được thành phẩm (`FINISHED`) (`PartSelect partType="FINISHED"`)
- BoxNo tự động sinh, `qty=0`, `serialList=null`
- `BOX_QTY` từ master hạng mục (sức chứa thùng) được dùng làm giới hạn thêm serial

### ② Thêm serial
`POST /shipping/boxes/:boxNo/serials { serials: ["FG_BARCODE"] }`
- Điều kiện: thùng `OPEN`, FG_LABELS `VISUAL_PASS` + `inspectPassYn='Y'`, mã hạng mục khớp, chưa vượt quá boxQty
- **Ngăn trùng lặp qua thùng**: serial đã ở thùng khác → bị từ chối

### ③ Đóng thùng (Thủ công/Tự động)
`POST /shipping/boxes/:boxNo/close`
- **Thủ công**: biểu tượng khóa trên bảng thông tin thùng hoặc nút `Hoàn tất đóng gói · In nhãn` trong modal serial
- **Tự động**: khi số serial đạt `boxQty` → tự động đóng + tự động in nhãn
- Hiệu ứng phụ khi đóng:
  1. `BOX_MASTERS.status` → `CLOSED`, `closeAt` → thời gian hiện tại
  2. `FG_LABELS` serial tương ứng: `status` → `PACKED`, gán `boxNo`
  3. `OQC_REQUESTS` tự động tạo (`status=PENDING`, `remark=AUTO_CREATED_FROM_BOX:{boxNo}`)
  4. `OQC_REQUEST_BOXES` tự động tạo (thông tin thùng)

### ④ Mở lại thùng
`POST /shipping/boxes/:boxNo/reopen`
- Điều kiện: chưa gán pallet (`palletNo IS NULL`)
- Khôi phục: serial → `VISUAL_PASS`, xóa yêu cầu OQC đã tự động tạo

### ⑤ Xóa thùng rỗng
- Điều kiện: trạng thái `OPEN`, chưa gán pallet, `qty=0`, không có serialList, không có lịch sử OQC

## Bố cục màn hình
- **Chính bên trái**(2/3): DataGrid — danh sách thùng (số thùng·mã hạng mục·tên hạng mục·số lượng·trạng thái·ngày đóng)
  - Nhấp hàng → bảng phải hiển thị chi tiết thùng
  - 4 nút thao tác: Xếp hàng(Plus) / Đóng-Mở lại(Lock-LockOpen) / In lại nhãn(Printer) / Xóa thùng rỗng(Trash2)
  - Tìm kiếm: số thùng·mã hạng mục, lọc trạng thái (mã chung BOX_STATUS)
- **Bảng phải**(1/3): Chi tiết thùng đã chọn
  - Hạng mục, sức chứa (hiện tại/tối đa), danh sách serial (BoxItem API), trạng thái, thông tin pallet

### Modal thêm serial
- Nhập mã vạch serial → Enter để thêm (mã vạch FG hoặc serial)
- Tự động đóng + tự động in nhãn khi đạt `boxQty`
- Serial vừa thêm có thể hủy (xóa)
- Cảnh báo khi đạt sức chứa tối đa

## Thiết lập trước (Master·Mã chung)
- Mã chung: `BOX_STATUS`, `OQC_STATUS`
- Master hạng mục (`ITEM_MASTERS`): Cần cấu hình `BOX_QTY` (sức chứa thùng) (không giới hạn nếu chưa đặt)
- FG_LABELS: Cần serial đã qua kiểm tra ngoại quan (`VISUAL_PASS`) mới có thể đóng gói
- Menu liên kết: Quản lý pallet (`/shipping/pallet`), OQC (`/quality/oqc`), Xác nhận xuất hàng (`/shipping/confirm`)

## Phân quyền
Quản trị viên xuất hàng (tạo thùng/thêm serial/đóng/mở lại). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Thêm serial thất bại (không khớp hạng mục) | FG được quét khác hạng mục với thùng | Chỉ FG cùng hạng mục mới được bỏ vào thùng này |
| Thêm serial thất bại (không khớp trạng thái) | FG không ở trạng thái `VISUAL_PASS` | Xử lý kiểm tra ngoại quan đạt trước |
| Thêm serial thất bại (trùng lặp) | Serial đã ở thùng khác | Kiểm tra trong thùng kia |
| Đóng thùng thất bại | Đã là CLOSED hoặc SHIPPED | Kiểm tra trạng thái |
| Không thể mở lại thùng | Đã gán pallet | Hủy gán pallet trước |
| Không thể xóa thùng rỗng | qty>0 hoặc có serialList hoặc có lịch sử OQC | Làm trống thùng trước |
| Không có hạng mục khi tạo thùng | Chưa đăng ký hạng mục loại FINISHED | Đăng ký hạng mục FINISHED trong master |
| OQC không tự động tạo | Lỗi quy trình đóng | Mở lại và đóng lại thùng |

## Dữ liệu & Liên kết
- Bảng: `BOX_MASTERS`, `FG_LABELS`, `OQC_REQUESTS`, `OQC_REQUEST_BOXES`, `PALLET_MASTERS`
- Liên kết: Kiểm tra thành phẩm (`FG_LABELS.status: VISUAL_PASS`), Xếp pallet (`/shipping/pallet`), Kiểm tra xuất (OQC, `/quality/oqc`), Xác nhận xuất hàng (`/shipping/confirm`), Lịch sử xuất hàng (`/shipping/history`)
- Sinh số thùng: `SEQ_BOX_NO_DAILY` (BX + YYMMDD + 4 chữ số)
- Lưu trữ ảnh: Không có (nhãn được render thời gian thực qua bwip-js Code128)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
