---
menuCode: EQUIP_INSPECT_ITEM
audience: operator
title: Hạng mục kiểm tra thiết bị — Hướng dẫn vận hành
summary: DB mapping toàn bộ cột của 2 bảng (pool master hạng mục kiểm tra + gán thiết bị-hạng mục), 4 loại kiểm tra (hàng ngày/định kỳ/PM/công nhân), quy trình thêm/xóa hạng mục, in nhãn QR
tags: [thông tin cơ sở, thiết bị, kiểm tra, vận hành]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, EQUIP_INSPECT_ITEM_POOL, EQUIP_CODE, ITEM_CODE, INSPECT_TYPE, DAILY, PERIODIC, PM, WORKER, ITEM_TYPE, VISUAL, MEASURE, CYCLE, kiểm tra thiết bị, hạng mục kiểm tra, loại kiểm tra, loại thiết bị, trực quan, đo lường, nhãn QR, đa khách hàng]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_DAILY]
---

# Hạng mục kiểm tra thiết bị — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình quản lý **2 bảng** xác định tiêu chuẩn kiểm tra theo thiết bị.

| Bảng | Vai trò | PK |
|--------|------|----|
| `EQUIP_INSPECT_ITEM_MASTERS` | Pool hạng mục kiểm tra — mẫu theo loại thiết bị | `COMPANY + PLANT_CD + ITEM_CODE` |
| `EQUIP_INSPECT_ITEM_POOL` | Gán thiết bị-hạng mục — hạng mục thực tế được gán cho thiết bị cụ thể | `COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE` |

Chọn thiết bị bên trái → xem, thêm, xóa hạng mục đã gán theo 4 tab loại kiểm tra bên phải. Các hạng mục đã đăng ký được sử dụng để nhập kiểm tra thực tế trên màn hình kiểm tra hàng ngày (`/equipment/daily-inspect`) và kiểm tra định kỳ (`/equipment/periodic-inspect`).

## Cấu trúc dữ liệu
```
EQUIP_INSPECT_ITEM_MASTERS (Pool: PK = COMPANY + PLANT_CD + ITEM_CODE)
   Lưu mẫu hạng mục kiểm tra theo loại thiết bị (lọc theo EQUIP_TYPE)

EQUIP_INSPECT_ITEM_POOL (Gán: PK = COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE)
   ├─ EQUIP_CODE ─▶ EQUIPMENTS (Thiết bị)
   └─ ITEM_CODE ─▶ EQUIP_INSPECT_ITEM_MASTERS (Master hạng mục kiểm tra)

EQUIP_INSPECT_LOGS (Lịch sử kiểm tra — tham chiếu)
   Liên kết qua EQUIP_CODE + ITEM_CODE + INSPECT_TYPE khi thực hiện kiểm tra
```

## Bố cục màn hình
- **Bảng điều khiển trái**: Danh sách thiết bị (nhóm accordion theo loại thiết bị, bộ lọc tìm kiếm, `GET /equipment/equips`)
- **Bảng điều khiển phải**: 4 tab loại kiểm tra + DataGrid hiển thị hạng mục đã gán
  - `DAILY`(Kiểm tra hàng ngày) / `PERIODIC`(Kiểm tra định kỳ) / `PM`(Bảo dưỡng phòng ngừa) / `WORKER`(Kiểm tra công nhân)
- **Bảng trượt**: Nút `Thêm hạng mục kiểm tra` → mở bảng 480px bên phải → chọn nhiều từ master → đăng ký hàng loạt

### Giá trị mã Loại kiểm tra (INSPECT_TYPE)

| Mã | Hiển thị | Mô tả |
|------|---------|-------------|
| `DAILY` | Kiểm tra hàng ngày | Kiểm tra cơ bản thực hiện mỗi ngày |
| `PERIODIC` | Kiểm tra định kỳ | Kiểm tra thực hiện theo chu kỳ |
| `PM` | Bảo dưỡng phòng ngừa | Kiểm tra theo kế hoạch bảo dưỡng thiết bị |
| `WORKER` | Kiểm tra công nhân | Kiểm tra do công nhân tự thực hiện |

### Giá trị mã Chu kỳ (CYCLE)

| Mã | Hiển thị | Ý nghĩa |
|------|---------|---------|
| `DAILY` | Hàng ngày | Chu kỳ 1 ngày |
| `WEEKLY` | Hàng tuần | Chu kỳ 1 tuần |
| `MONTHLY` | Hàng tháng | Chu kỳ 1 tháng |
| `QUARTERLY` | Hàng quý | Chu kỳ 3 tháng |
| `SEMI_ANNUAL` | Nửa năm | Chu kỳ 6 tháng |
| `ANNUAL` | Hàng năm | Chu kỳ 1 năm |

### Giá trị mã Loại đánh giá (ITEM_TYPE)

| Mã | Hiển thị | Mô tả |
|------|---------|-------------|
| `VISUAL` | Trực quan | Đánh giá đạt/không đạt bằng mắt thường (so sánh chuỗi tiêu chuẩn) |
| `MEASURE` | Đo lường | Ghi giá trị đo (đánh giá phạm vi LSL/USL) |

---

## ① Master hạng mục kiểm tra — EQUIP_INSPECT_ITEM_MASTERS (Toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã hạng mục | `ITEM_CODE` | PK. Nhập trực tiếp, bất biến sau khi đăng ký. |
| Tên hạng mục | `ITEM_NAME` | Tên hiển thị. Hiển thị nguyên bản trên màn hình kiểm tra. |
| Loại kiểm tra | `INSPECT_TYPE` | `DAILY`/`PERIODIC`/`PM`/`WORKER`. Lưu ý: thay đổi sau khi đăng ký cũng phải thay đổi PK của Pool. |
| Loại thiết bị | `EQUIP_TYPE` | Mã chung `EQUIP_TYPE`. Dùng làm bộ lọc trong bảng chọn hạng mục. |
| Loại đánh giá | `ITEM_TYPE` | `VISUAL`(trực quan) / `MEASURE`(đo lường). Mặc định `VISUAL`. |
| Tiêu chuẩn | `CRITERIA` | Chuỗi tiêu chuẩn đánh giá VISUAL (VD: "Không bất thường", "Không nứt"). Loại đo lường dùng LSL/USL. |
| Chu kỳ | `CYCLE` | `DAILY`/`WEEKLY`/`MONTHLY`/`QUARTERLY`/`SEMI_ANNUAL`/`ANNUAL`. |
| Đơn vị | `UNIT` | Đơn vị đo (mm, kgf, ℃, v.v.). Có ý nghĩa với LSL/USL cho loại MEASURE. |
| Giới hạn dưới | `LSL_VALUE` | Giới hạn dưới cho phép. Dùng với USL để đánh giá phạm vi cho loại MEASURE. |
| Giới hạn trên | `USL_VALUE` | Giới hạn trên cho phép. Dùng với LSL để đánh giá phạm vi cho loại MEASURE. |
| Mã QR công nhân | `WORKER_QR_CODE` | Giá trị mã khớp khi quét QR trong kiểm tra công nhân (loại WORKER). |
| Hình ảnh | `IMAGE_URL` | Hình ảnh hạng mục kiểm tra. Lưu tại `/uploads/equip-inspect-items/`. Giới hạn 5MB, jpeg/png/gif/webp. |
| Sử dụng | `USE_YN` | Chỉ `Y` hiển thị trong danh sách chọn Pool. |
| Ghi chú | `REMARK` | Ghi nhớ. |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Thành phần PK. Phạm vi `40` / `1000`. |

## ② Gán thiết bị-hạng mục — EQUIP_INSPECT_ITEM_POOL (Toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã thiết bị | `EQUIP_CODE` | PK. Tham chiếu `EQUIPMENTS.EQUIP_CODE`. Chọn từ danh sách thiết bị bên trái. |
| Mã hạng mục | `ITEM_CODE` | PK. Tham chiếu `EQUIP_INSPECT_ITEM_MASTERS.ITEM_CODE`. |
| Loại kiểm tra | `INSPECT_TYPE` | PK. `DAILY`/`PERIODIC`/`PM`/`WORKER`. Phân loại theo tab. |
| Thứ tự hiển thị | `SORT_SEQ` | Thứ tự sắp xếp (ASC). Số nhỏ hiển thị trước. |
| Sử dụng | `USE_YN` | Chỉ `Y` kích hoạt trên màn hình kiểm tra. |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Thành phần PK. Phạm vi `40` / `1000`. |

> Pool sử dụng PK hỗn hợp 5 phần (COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE). Đăng ký trùng trả về 409 Conflict. Cùng hạng mục có thể được đăng ký với loại kiểm tra khác cho cùng thiết bị (VD: DAILY + PERIODIC đồng thời).

## Quy trình đăng ký hạng mục kiểm tra

1. **Đăng ký Master** (điều kiện tiên quyết): Đăng ký mã·tên·loại·tiêu chuẩn hạng mục trong pool (`POST /master/equip-inspect-item-masters`)
2. **Chọn thiết bị**: Nhấp thiết bị mục tiêu trong danh sách thiết bị bên trái (nhóm theo loại thiết bị, có thể tìm kiếm)
3. **Chuyển tab**: Chọn tab loại kiểm tra mục tiêu (DAILY/PERIODIC/PM/WORKER)
4. **Thêm hạng mục**: Nhấn nút `Thêm hạng mục kiểm tra` → chọn nhiều hạng mục trong bảng phải → `Đăng ký hàng loạt`
5. **Điều chỉnh thứ tự**: Kiểm soát thứ tự hiển thị bằng giá trị `SORT_SEQ` (truyền sortSeq trong DTO khi sửa)
6. **In nhãn QR**: In nhãn QR code cho hạng mục kiểm tra (`InspectItemLabelModal` — 60mm x 55mm)

> Hạng mục đã đăng ký hiển thị huy hiệu `Đã đăng ký` và bị vô hiệu hóa trong bảng thêm để tránh chọn trùng.

## Thiết lập trước (Master·Mã chung)
- Mã chung: `EQUIP_TYPE`(Loại thiết bị)
- Master thiết bị (`EQUIPMENTS`): Nguồn dữ liệu cho danh sách thiết bị bên trái. Thiết bị phải được đăng ký trước để hiển thị trên màn hình.
- Master hạng mục kiểm tra (`EQUIP_INSPECT_ITEM_MASTERS`): Phải được đăng ký trước khi gán Pool.

## Quy trình vận hành
1. Đăng ký hạng mục kiểm tra trong master hạng mục (mã·tên·loại·tiêu chuẩn).
2. Trên màn hình hạng mục kiểm tra thiết bị, chọn thiết bị và thêm hạng mục cần thiết vào Pool theo tab loại.
3. Khi hạng mục kiểm tra thay đổi trong quá trình vận hành, phản ánh bằng cách thêm/xóa khỏi Pool.
4. Hạng mục ngừng sử dụng có thể xóa khỏi Pool hoặc đặt `USE_YN='N'` (khuyến nghị vô hiệu hóa để giữ lịch sử).

## Phân quyền
Quản trị viên thông tin cơ sở (tạo/sửa/xóa master, gán/hủy gán Pool). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Danh sách thiết bị bên trái trống | Chưa đăng ký thiết bị trong `EQUIPMENTS` | Đăng ký thiết bị trong master thiết bị trước |
| Không có hạng mục trong bảng thêm | Chưa đăng ký hạng mục cho loại kiểm tra đó trong master | Đăng ký hạng mục trong màn hình master (`/master/equip-inspect-item`) |
| Dropdown loại thiết bị trống | Mã chung `EQUIP_TYPE` chưa được cấu hình | Đăng ký mã loại thiết bị trong mã chung |
| Lỗi 409 khi lưu Pool | Đã tồn tại tổ hợp (thiết bị+hạng mục+loại) trùng | Đăng ký với loại khác hoặc kích hoạt hạng mục hiện có |
| Hạng mục không hiển thị trên màn hình kiểm tra | Pool `USE_YN='N'` hoặc sai loại kiểm tra | Kiểm tra cờ sử dụng Pool và loại kiểm tra |
| Tải ảnh thất bại | File vượt quá 5MB hoặc định dạng không hợp lệ (chỉ jpeg/png/gif/webp) | Kiểm tra kích thước và định dạng file |
| `SORT_SEQ` không áp dụng | Không truyền `sortSeq` khi đăng ký | Bao gồm sortSeq trong DTO đăng ký hoặc yêu cầu sửa riêng |

## Dữ liệu & Liên kết
- Bảng: `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_INSPECT_LOGS`
- Liên kết: Master thiết bị (`EQUIPMENTS`), Kiểm tra hàng ngày (`/equipment/daily-inspect`), Kiểm tra định kỳ (`/equipment/periodic-inspect`), Lịch kiểm tra (`/equipment/inspect-calendar`), Lịch sử kiểm tra (`/equipment/inspect-history`)
- API liên quan: `GET /master/equip-inspect-items`, `POST /master/equip-inspect-items`, `DELETE /master/equip-inspect-items/:equipCode/:itemCode/:inspectType`
- API liên quan (master): `GET /master/equip-inspect-item-masters`, `POST /master/equip-inspect-item-masters`, `PUT /master/equip-inspect-item-masters/:itemCode`, `DELETE /master/equip-inspect-item-masters/:itemCode`
- Lưu trữ ảnh: `./uploads/equip-inspect-items/` (5MB, jpeg/png/gif/webp)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
