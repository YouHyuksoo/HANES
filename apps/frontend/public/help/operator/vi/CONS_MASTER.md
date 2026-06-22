---
menuCode: CONS_MASTER
audience: operator
title: Master vật tư tiêu hao — Hướng dẫn vận hành
summary: DB mapping toàn bộ cột master vật tư tiêu hao (CONSUMABLE_MASTERS), quan hệ mapping nơi sử dụng (CONSUMABLE_USAGE_MAP), logic tuổi thọ/trạng thái, mã chung, phân quyền, xử lý sự cố, phạm vi đa khách hàng
tags: [vật tư tiêu hao, master, thông tin cơ sở, vận hành]
keywords: [CONSUMABLE_MASTERS, CONSUMABLE_USAGE_MAP, CONSUMABLE_STOCKS, CONSUMABLE_LOGS, CONSUMABLE_CATEGORY, MOLD, JIG, TOOL, tuổi thọ dự kiến, ngưỡng cảnh báo, tồn kho an toàn, lượng dùng trên đơn vị, USAGE_PER_UNIT, mapping nơi sử dụng, phụ tùng thiết bị, BOM sản phẩm, đa khách hàng, COMPANY, PLANT_CD]
related: [MST_PART]
---

# Master vật tư tiêu hao — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình quản lý **master thông tin cơ sở `CONSUMABLE_MASTERS`** của **vật tư tiêu hao (khuôn·đồ gá·dụng cụ)** đưa vào sản xuất. Instance tồn kho riêng lẻ (`CONSUMABLE_STOCKS`), lịch sử nhập xuất (`CONSUMABLE_LOGS`), mapping nơi sử dụng cho sản phẩm·thiết bị (`CONSUMABLE_USAGE_MAP`), và đầu vào vật tư tiêu hao của kết quả sản xuất kiosk đều tham chiếu master này qua `CONSUMABLE_CODE`.

> API: Danh sách `GET /consumables`, 1 cái `GET /consumables/:id`, đăng ký `POST /consumables`, sửa `PUT /consumables/:id`, xóa `DELETE /consumables/:id`, ảnh `POST|DELETE /consumables/:id/image`, usage-maps `GET|POST /consumables/:id/usage-maps`·`PUT|DELETE /consumables/:id/usage-maps/:productItemCode/:equipCode`. (`SELECT ... FROM CONSUMABLES` trên lưới màn hình chỉ là nhãn hiển thị, tên bảng thực tế là `CONSUMABLE_MASTERS`.)

## Cấu trúc dữ liệu
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)
   ├─ 1:N ─▶ CONSUMABLE_STOCKS   (instance riêng lẻ CON_UID, theo dõi nhập kho·gắn kết)
   ├─ 1:N ─▶ CONSUMABLE_LOGS     (lịch sử nhập xuất/số nhát/thay thế)
   └─ 1:N ─▶ CONSUMABLE_USAGE_MAP(sản phẩm × thiết bị × nơi sử dụng vật tư tiêu hao)
                 ├─ PRODUCT_ITEM_CODE ─▶ ITEM_MASTERS.ITEM_CODE (sản phẩm/mô hình)
                 └─ EQUIP_CODE        ─▶ EQUIP_MASTERS.EQUIP_CODE (thiết bị)
```

## 2 loại phân biệt vật tư tiêu hao (ý nghĩa vận hành)
Một master nhưng có hai đường dùng.
- **Dùng gắn thiết bị**(khuôn·đồ gá·lưỡi): Gắn vào thiết bị, tích lũy số nhát (`CURRENT_COUNT`), thay thế khi đạt `EXPECTED_LIFE`. Là đối tượng của mục "Phụ tùng thiết bị tiêu hao" góc dưới trái kiosk. Theo mapping thiết bị×vật tư tiêu hao trong `CONSUMABLE_USAGE_MAP`.
- **Dùng đầu vào BOM sản phẩm**: Được đưa vào làm mục `CONSUMABLE` trong BOM sản phẩm, trừ theo số lượng sản xuất. Hiển thị theo BOM sản phẩm ở góc trái kiosk.

---

## ① Thông tin cơ bản — CONSUMABLE_MASTERS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã vật tư tiêu hao | `CONSUMABLE_CODE` | PK (khóa tự nhiên). Khóa kết nối nhập xuất·tồn kho·mapping nơi sử dụng. Không thể thay đổi (khóa khi sửa). |
| Tên vật tư tiêu hao | `NAME` | Tên hiển thị (tên thuộc tính entity là `consumableName`). |
| Phân loại | `CATEGORY` | Mã chung `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). DTO enum là `['MOLD','JIG','TOOL']`. Lưu null nếu không chọn. |
| Hình ảnh | `IMAGE_URL` | Đường dẫn upload (`/uploads/consumables/...`). Chỉ upload được sau khi lưu master (`POST /consumables/:id/image`). |

## ② Tuổi thọ / Quản lý — CONSUMABLE_MASTERS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Tuổi thọ dự kiến | `EXPECTED_LIFE` | Giới hạn trên số nhát tích lũy (INT). `CURRENT_COUNT ≥ EXPECTED_LIFE` → `STATUS='REPLACE'`. null thì không tự động chuyển trạng thái. |
| Ngưỡng cảnh báo | `WARNING_COUNT` | Số nhát thông báo sắp thay thế (INT). `CURRENT_COUNT ≥ WARNING_COUNT` → `STATUS='WARNING'`. Thường `< EXPECTED_LIFE`. |
| Tồn kho an toàn | `SAFETY_STOCK` | Tiêu chí đánh giá thiếu tồn kho (INT, mặc định 0). Thiếu khi tồn kho dưới mức này. |
| (Tự động) Số nhát hiện tại | `CURRENT_COUNT` | Số lần sử dụng tích lũy (INT, mặc định 0). Tích lũy qua kiosk/API số nhát (`POST /consumables/shot-count`), reset về 0 khi thay thế (`/consumables/reset`). Form không có ô nhập trực tiếp. |
| (Tự động) Trạng thái | `STATUS` | NORMAL/WARNING/REPLACE. Tự động chuyển khi tích lũy số nhát. |
| (Tự động) Trạng thái vận hành | `OPER_STATUS` | WAREHOUSE(kho)/MOUNTED(gắn)... Cập nhật trong luồng gắn kết. |
| (Tự động) Thiết bị gắn | `MOUNTED_EQUIP_ID` | Mã thiết bị hiện đang gắn (thuộc tính `mountedEquipCode`). |
| (Tự động) Số lượng tồn kho | `STOCK_QTY` | Số lượng sở hữu thay đổi theo lịch sử nhập xuất (INT, mặc định 0). |
| (Tự động) Ngày thay thế | `LAST_REPLACE`, `NEXT_REPLACE` | Thời gian thay thế gần nhất/dự kiến (TIMESTAMP). |

## ③ Nhà cung cấp / Vị trí — CONSUMABLE_MASTERS

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Vị trí lưu trữ | `LOCATION` | Nơi cất giữ mặc định. |
| Nhà cung cấp | `VENDOR` | Nhà cung cấp/nhà sản xuất. |
| Đơn giá | `UNIT_PRICE` | NUMBER(12,2). Tham khảo đơn giá nhập kho·định giá tài sản. |
| Sử dụng | `USE_YN` | Chỉ `Y` hiển thị trong danh sách/chọn (truy vấn danh sách cố định `useYn='Y'`). |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000` (thuộc tính entity `company`, `plant`). |

## ④ Mapping nơi sử dụng — CONSUMABLE_USAGE_MAP (toàn bộ cột)

Xác định vật tư tiêu hao đã chọn được dùng ở **sản phẩm (mô hình)·thiết bị nào**. Là tiêu chí kiosk truy vấn vật tư tiêu hao cần thiết theo lệnh sản xuất (sản phẩm)+thiết bị.

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Sản phẩm/Mô hình | `PRODUCT_ITEM_CODE` | Thành phần PK. Tham chiếu `ITEM_MASTERS.ITEM_CODE`. Chỉ chọn mục `FINISHED`/`SEMI_PRODUCT`. Kiểm tra tồn tại·`USE_YN='Y'` khi đăng ký. |
| Thiết bị | `EQUIP_CODE` | Thành phần PK. Tham chiếu `EQUIP_MASTERS.EQUIP_CODE`. Kiểm tra tồn tại·`USE_YN='Y'` khi đăng ký. |
| (Khóa) Vật tư tiêu hao | `CONSUMABLE_CODE` | Thành phần PK. Master đã chọn. |
| Lượng dùng trên đơn vị | `USAGE_PER_UNIT` | NUMBER(mặc định 1). Số nhát tiêu hao trên mỗi đơn vị sản xuất. Số nhát tích lũy = số lượng sản xuất × giá trị này. |
| Sử dụng | `USE_YN` | `Y`/`N`. Chuyển đổi toggle badge `Y` trong danh sách. |
| Ghi chú | `REMARK` | Ghi nhớ mapping. |
| (Khóa) Đa khách hàng | `COMPANY`, `PLANT_CD` | Thành phần PK. `40` / `1000`. |

> Khóa phức hợp: `COMPANY + PLANT_CD + PRODUCT_ITEM_CODE + EQUIP_CODE + CONSUMABLE_CODE`. Đăng ký lại cùng tổ hợp là upsert (cập nhật số lượng·sử dụng·ghi chú).

## Logic tuổi thọ / trạng thái
1. Tích lũy số nhát(`POST /consumables/shot-count`, `addCount`): `CURRENT_COUNT += addCount`.
2. Nếu có `EXPECTED_LIFE` và `CURRENT_COUNT ≥ EXPECTED_LIFE` → `STATUS='REPLACE'`.
3. Nếu không, có `WARNING_COUNT` và `CURRENT_COUNT ≥ WARNING_COUNT` → `STATUS='WARNING'`.
4. Thay thế(`POST /consumables/reset`): `CURRENT_COUNT=0`, `STATUS='NORMAL'`, `LAST_REPLACE`=hiện tại, `NEXT_REPLACE`=hiện tại+`EXPECTED_LIFE` ngày.
5. Nhập xuất(`POST /consumables/logs`·`receiving`·`issuing`): Cộng trừ `STOCK_QTY` (chặn âm khi xuất).

## Thiết lập trước (Master·Mã chung)
- Mã chung: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL)
- Mapping nơi sử dụng tiên quyết: Sản phẩm/mô hình phải được đăng ký trong [Master hạng mục](`ITEM_MASTERS`, `FINISHED`/`SEMI_PRODUCT`), thiết bị trong master thiết bị (`EQUIP_MASTERS`) với `USE_YN='Y'` thì mới chọn được.

## Quy trình vận hành
1. Đăng ký `CONSUMABLE_MASTERS`(mã·tên·phân loại) → lưu.
2. Upload ảnh (sau khi lưu) → điền tuổi thọ/quản lý·nhà cung cấp/vị trí.
3. Đăng ký mapping nơi sử dụng (`CONSUMABLE_USAGE_MAP`) với sản phẩm·thiết bị·lượng dùng trên đơn vị.
4. Nhập kho·tích lũy số nhát·thay thế được tự động phản ánh qua API nhập xuất/kiosk/số nhát.

## Phân quyền
Quản trị viên thông tin cơ sở (đăng ký/sửa/xóa/mapping). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Upload ảnh bị vô hiệu khi đăng ký | Master chưa lưu (chế độ mới) | Lưu thông tin cơ bản rồi mở lại để upload |
| Lỗi trùng mã khi lưu (409) | Đã tồn tại `CONSUMABLE_CODE` giống | Kiểm tra mã (khóa bất biến) hoặc sửa bản ghi cũ |
| "Không có sản phẩm/thiết bị"(404) khi lưu mapping | Hạng mục/thiết bị chưa đăng ký hoặc `USE_YN='N'` | Kích hoạt trong master hạng mục·master thiết bị rồi mapping |
| Danh sách sản phẩm mapping trống | Loại hạng mục không phải `FINISHED`/`SEMI_PRODUCT` | Đăng ký hạng mục với loại tương ứng |
| Không thấy trong danh sách | `USE_YN='N'` hoặc bộ lọc phân loại/tìm kiếm | Kiểm tra sử dụng·bộ lọc·từ khóa |
| Lỗi thiếu tồn kho khi xuất (400) | `STOCK_QTY` không đủ | Nhập kho rồi thử lại |
| Tích lũy số nhát nhưng trạng thái không đổi | Chưa đặt `EXPECTED_LIFE`/`WARNING_COUNT` (null) | Nhập tuổi thọ dự kiến·ngưỡng cảnh báo |
| Hình thumbnail/ảnh hỏng | File `IMAGE_URL` không tồn tại (404) | Tải lại (frontend placeholder fallback) |

## Dữ liệu & Liên kết
- Bảng: `CONSUMABLE_MASTERS`(master), `CONSUMABLE_STOCKS`(instance riêng lẻ), `CONSUMABLE_LOGS`(lịch sử nhập xuất/số nhát/thay thế), `CONSUMABLE_USAGE_MAP`(mapping nơi sử dụng)
- Liên kết: Master hạng mục (`ITEM_MASTERS`), Master thiết bị (`EQUIP_MASTERS`), Kết quả sản xuất kiosk (đầu vào vật tư tiêu hao), Luồng tổng hợp vật tư (LOT nhập kho vật tư tiêu hao → chất `MAT_STOCKS`·auto-issue trừ)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
