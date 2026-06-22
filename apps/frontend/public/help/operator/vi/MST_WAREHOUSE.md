---
menuCode: MST_WAREHOUSE
audience: operator
title: Quản lý kho/vị trí — Hướng dẫn vận hành
summary: DB mapping toàn bộ cột 3 bảng kho·vị trí·quy tắc di chuyển, giá trị mã loại kho, kho tự động tạo, phân quyền, xử lý sự cố, phạm vi đa khách hàng
tags: [thông tin cơ sở, kho, vị trí, quy tắc di chuyển, vận hành]
keywords: [WAREHOUSES, WAREHOUSE_LOCATIONS, WAREHOUSE_TRANSFER_RULES, WAREHOUSE_TYPE, WAREHOUSE_GROUP, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID, ALLOW_YN, IS_DEFAULT, loại kho, FLOOR, SUBCON, khóa tự nhiên, khóa phức hợp, đa khách hàng, COMPANY, PLANT_CD]
related: [MST_PART]
---

# Quản lý kho/vị trí — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình master chứa **kho** (đơn vị vật lý/logic nơi tồn kho được lưu trữ·di chuyển), **vị trí** trong kho, và **quy tắc di chuyển** giữa các kho. Nhập kho·cấp phát·tồn kho (`MAT_STOCK`/`PRODUCT_STOCKS`)·kết quả sản xuất·di chuyển tồn kho đều tham chiếu master này qua `WAREHOUSE_CODE`.

## Cấu trúc dữ liệu
```
WAREHOUSES (PK: COMPANY, PLANT_CD, WAREHOUSE_CODE)
   ├─ WAREHOUSE_LOCATIONS (PK: COMPANY, PLANT_CD, WAREHOUSE_CODE, LOCATION_CODE)
   │       Kho 1 : N Vị trí (kết nối qua WAREHOUSE_CODE)
   └─ WAREHOUSE_TRANSFER_RULES (PK: COMPANY, PLANT_CD, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID)
            Giá trị FROM/TO_WAREHOUSE_ID = WAREHOUSES.WAREHOUSE_CODE (lưu mã, chỉ tên cột là _ID)
```
> **Lưu ý**: `FROM_WAREHOUSE_ID`/`TO_WAREHOUSE_ID` trong `WAREHOUSE_TRANSFER_RULES` chỉ tên là `_ID`, giá trị lưu thực tế là **mã kho (WAREHOUSE_CODE)**. Service JOIN bằng `fw.WAREHOUSE_CODE = rule.FROM_WAREHOUSE_ID` để lấy tên kho đi/đến. Đây là cột JOIN khóa tự nhiên, không phải cột FK ràng buộc.

API CRUD từng khu vực:
- Kho: `GET/POST/PUT/DELETE /inventory/warehouses[/{code}]`
- Vị trí: `GET/POST/PUT/DELETE /inventory/warehouse-locations[/{warehouseCode}::{locationCode}]`
- Quy tắc di chuyển: `GET/POST/PUT/DELETE /master/transfer-rules[/{fromId}/{toId}]`

---

## ① Quản lý kho — WAREHOUSES (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã kho | `WAREHOUSE_CODE` | Thành phần PK. Khóa tự nhiên, bất biến (toàn vẹn kết nối). |
| Tên kho | `WAREHOUSE_NAME` | Tên hiển thị. |
| Loại kho | `WAREHOUSE_TYPE` | Phân loại mục đích. Giá trị kiểm tra DTO `@IsIn`: `RAW`(nguyên vật liệu)/`WIP`(bán thành phẩm)/`FG`(thành phẩm)/`FLOOR`(công đoạn)/`DEFECT`(phế phẩm)/`SCRAP`(loại bỏ)/`SUBCON`(gia công ngoài). Mã chung `WAREHOUSE_TYPE`. |
| (Không hiển thị màn hình) Nhóm kho | `WAREHOUSE_GROUP` | Cột thiết kế với mục đích: di chuyển trong cùng nhóm là ngay lập tức, di chuyển khác nhóm cần quản trị viên phê duyệt. Hiện tại không có UI nhập trên màn hình (nullable). |
| Dây chuyền | `LINE_CODE` | Dây chuyền sản xuất trực thuộc của kho FLOOR. Chỉ hiển thị trên form khi loại là FLOOR. |
| Công đoạn | `PROCESS_CODE` | Công đoạn trực thuộc của kho FLOOR. Chỉ hiển thị trên form khi loại là FLOOR. |
| (Không hiển thị màn hình) Mã nhà máy | `PLANT_CODE` | Cột phụ trợ mã plant riêng (riêng với `PLANT_CD` đa khách hàng, nullable). |
| (Không hiển thị màn hình) Mã thiết bị | `EQUIP_CODE` | Cột dùng cho kho WIP liên kết thiết bị (nullable). |
| (Không hiển thị màn hình) ID nhà cung cấp | `VENDOR_ID` | Được điền làm giá trị nhận dạng nhà cung cấp khi tự động tạo kho gia công ngoài (SUBCON) (nullable). |
| Mặc định | `IS_DEFAULT` | `'Y'`/`'N'`. Kho mặc định cùng loại. `getDefaultWarehouse(type)` chọn đối tượng tự động chất kho bằng `IS_DEFAULT='Y' AND USE_YN='Y'`. |
| Sử dụng | `USE_YN` | Chỉ `Y` hoạt động. Khuyến nghị vận hành soft-deactive thay vì xóa. |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. CREATED_AT/UPDATED_AT mặc định SYSTIMESTAMP. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Một phần PK. Phạm vi `40` / `1000`. |

## ② Vị trí — WAREHOUSE_LOCATIONS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Kho | `WAREHOUSE_CODE` | Thành phần PK + tham chiếu kho cấp trên. Bất biến sau đăng ký. |
| Mã vị trí | `LOCATION_CODE` | Thành phần PK. Tổ hợp (kho+vị trí) là duy nhất. Bất biến. |
| Tên vị trí | `LOCATION_NAME` | Tên hiển thị. |
| Khu vực | `ZONE` | Phân khu trong kho (nullable). |
| Hàng | `ROW_NO` | Số hàng kệ/giá (nullable, varchar). |
| Cột | `COL_NO` | Số cột kệ/giá (nullable, varchar). |
| Tầng | `LEVEL_NO` | Số tầng kệ/giá (nullable, varchar). |
| Sử dụng | `USE_YN` | Chỉ `Y` hoạt động. Hiển thị bằng dấu ● trên danh sách. |
| Ghi chú | `REMARK` | Ghi nhớ (nullable). |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Một phần PK. Phạm vi `40` / `1000`. |

> API sửa/xóa truyền khóa phức hợp dạng `{WAREHOUSE_CODE}::{LOCATION_CODE}` (phân cách `::`).

## ③ Quy tắc di chuyển kho — WAREHOUSE_TRANSFER_RULES (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Kho đi (mã/tên) | `FROM_WAREHOUSE_ID` | Thành phần PK. **Giá trị=mã kho đi**. JOIN với `WAREHOUSES.WAREHOUSE_CODE` để hiển thị mã·tên. |
| Kho đến (mã/tên) | `TO_WAREHOUSE_ID` | Thành phần PK. **Giá trị=mã kho đến**. JOIN cùng cách. |
| Cho phép | `ALLOW_YN` | `'Y'`=cho phép di chuyển, `'N'`=cấm. Mặc định `'Y'`. |
| Ghi chú | `REMARK` | Ghi nhớ (nullable). |
| Kiểm toán | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Một phần PK. Phạm vi `40` / `1000`. |

> Cặp (đi→đến) là duy nhất. Đăng ký trùng thì 409 Conflict. API sửa/xóa truyền khóa phức hợp qua đường dẫn `/{fromWarehouseId}/{toWarehouseId}`.

---

## Kho tự động tạo (hoạt động dựa trên code)
Một số kho được hệ thống tự động tạo trong quá trình vận hành (riêng với đăng ký màn hình).
- **Công đoạn (FLOOR/WIP)**: `getOrCreateFloorWarehouse(lineCode, processCode)` → mã `FLOOR_{dây chuyền}_{công đoạn}`, loại `WIP`, điền dây chuyền·công đoạn.
- **Gia công ngoài (SUBCON)**: `getOrCreateSubconWarehouse(vendorId, vendorName)` → mã `SUBCON_{ID nhà cung cấp}`, loại `SUBCON`, điền `VENDOR_ID`.
- **Khởi tạo kho mặc định**: `initDefaultWarehouses()` tạo `RM_MAIN/RM_SUB/WIP_MAIN/FG_MAIN/FG_SHIP/DEFECT/SCRAP/SUBCON_MAIN` v.v. (Một số giá trị loại của seed này có thể là `RM`, khác với giá trị code bộ lọc màn hình `RAW`, cần lưu ý khi kiểm tra dữ liệu.)

## Thiết lập trước (Master·Mã chung)
- Mã chung: `WAREHOUSE_TYPE`(loại kho), `USE_YN`
- Mã dây chuyền·công đoạn (kho FLOOR): Master dây chuyền/công đoạn phải có trước mới chọn được.

## Quy trình vận hành
1. Đăng ký kho vận hành tại Quản lý kho (xác định loại·kho mặc định).
2. Đăng ký vị trí (khu vực/hàng/cột/tầng) cho kho cần thiết.
3. Đăng ký quy tắc di chuyển (cho phép/cấm) cho các cặp kho cần kiểm soát.
4. Kho ngừng sử dụng: không xóa mà đặt `USE_YN='N'` (bảo tồn tồn kho/lịch sử).

## Phân quyền
Quản trị viên thông tin cơ sở (đăng ký/sửa/xóa). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Xóa kho thất bại | Kho còn tồn kho (`Không thể xóa kho còn tồn kho`) | Di chuyển/làm trống tồn kho rồi xóa, hoặc đặt `USE_YN='N'` |
| Form không hiện ô dây chuyền·công đoạn | Loại kho không phải FLOOR | Đổi loại thành `FLOOR`(công đoạn) |
| Tự động chất kho sai kho | Thiếu/trùng `IS_DEFAULT='Y'` theo loại | Chỉnh 1 kho mặc định cho mỗi loại thành `IS_DEFAULT='Y'` |
| Lưu quy tắc di chuyển bị 409 | Đã tồn tại cặp (đi→đến) giống | Xử lý bằng sửa quy tắc cũ |
| Tên kho đi/đến trong quy tắc di chuyển bị trống | Mã kho mà `FROM/TO_WAREHOUSE_ID` trỏ đến không có trong WAREHOUSES | Kiểm tra tính hợp lệ mã kho (sửa thành mã kho hợp lệ) |
| Kho/vị trí không có trong danh sách chọn | `USE_YN='N'` | Kích hoạt USE_YN thành Y |

## Dữ liệu & Liên kết
- Bảng: `WAREHOUSES`, `WAREHOUSE_LOCATIONS`, `WAREHOUSE_TRANSFER_RULES`
- Liên kết: Nhập kho/cấp phát, Tồn kho (`MAT_STOCK`, `PRODUCT_STOCKS`), Kết quả sản xuất, Di chuyển tồn kho, Master hạng mục (vị trí lưu mặc định)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
