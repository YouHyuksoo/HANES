---
menuCode: EQUIP_INSPECT_ITEM
audience: operator
title: Hạng mục kiểm tra theo thiết bị — Hướng dẫn vận hành
summary: Tất cả các cột của bảng EQUIP_INSPECT_ITEM_POOL, quy trình ánh xạ thiết bị-hạng mục, nhãn QR và khắc phục sự cố
tags: [equipment, inspection, mapping, operator, assignment, QR]
keywords: [EQUIP_INSPECT_ITEM_POOL, EQUIP_INSPECT_ITEM_MASTERS, EQUIP_MASTERS, equipment inspection item mapping, batch registration, SORT_SEQ, QR label, inspection type tabs]
related: [EQUIP_INSPECT_ITEM_MASTER]
---

# Hạng mục kiểm tra theo thiết bị — Hướng dẫn vận hành

## Mục đích & Vai trò hệ thống
Thông qua bảng `EQUIP_INSPECT_ITEM_POOL`, kết nối từng thiết bị (`EQUIP_MASTERS`) với các hạng mục kiểm tra (`EQUIP_INSPECT_ITEM_MASTERS`) theo quan hệ N:M. Cùng một hạng mục kiểm tra có thể được kết nối/ngắt kết nối riêng biệt cho từng thiết bị và được quản lý bằng cách phân loại theo các tab loại kiểm tra. Tại hiện trường, nhãn QR được dán và kết quả kiểm tra được nhập qua PDA.

## Cấu trúc dữ liệu
```
EQUIP_MASTERS (Thiết bị riêng lẻ)
    │
    └──▶ EQUIP_INSPECT_ITEM_POOL (PK: COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE)
              │
              ├── SORT_SEQ (Thứ tự hiển thị)
              └── USE_YN (Kết nối hoạt động/không hoạt động)
                    │
                    └──▶ EQUIP_INSPECT_ITEM_MASTERS (Thông tin tiêu chuẩn hạng mục kiểm tra)
                              ├── ITEM_NAME, CRITERIA, CYCLE
                              ├── ITEM_TYPE(VISUAL/MEASURE), UNIT, LSL_VALUE, USL_VALUE
                              ├── IMAGE_URL
                              └── INSPECT_TYPE (DAILY/PERIODIC/PM/WORKER)
```

---

## ① Ánh xạ thiết bị-hạng mục — EQUIP_INSPECT_ITEM_POOL (Tất cả các cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã thiết bị | `EQUIP_CODE` | **PK (1/5)**. Thiết bị riêng lẻ. Tham chiếu `EQUIP_MASTERS.EQUIP_CODE`. |
| Mã hạng mục | `ITEM_CODE` | **PK (2/5)**. Hạng mục kiểm tra. Tham chiếu `EQUIP_INSPECT_ITEM_MASTERS.ITEM_CODE`. |
| Loại kiểm tra | `INSPECT_TYPE` | **PK (3/5)**. `DAILY` / `PERIODIC` / `PM` / `WORKER`. Phải khớp với INSPECT_TYPE của danh mục. |
| Trạng thái sử dụng | `USE_YN` | `Y` (hoạt động) / `N` (không hoạt động). Giữ kết nối nhưng tạm thời loại trừ. Mặc định là `Y`. |
| Thứ tự hiển thị | `SORT_SEQ` | Thứ tự hiển thị hạng mục kiểm tra trong thiết bị. Số càng nhỏ hiển thị càng trước. |
| Đa đối tượng thuê | `COMPANY`, `PLANT_CD` | **PK (4,5/5)**. Mã công ty (`40`) / Mã nhà máy (`1000`). |
| Người tạo | `CREATED_BY` | Người đăng ký ánh xạ. |
| Người sửa | `UPDATED_BY` | Người sửa đổi lần cuối. |
| Thời gian tạo | `CREATED_AT` | Thời điểm đăng ký ánh xạ. |
| Thời gian sửa | `UPDATED_AT` | Thời điểm sửa đổi ánh xạ. |

---

## Cấu trúc tab theo loại kiểm tra

4 tab ở góc trên bên phải màn hình lọc `EQUIP_INSPECT_ITEM_POOL` theo từng loại kiểm tra:

| Tab | INSPECT_TYPE | Điều kiện lọc Pool |
|-----|-------------|---------------|
| Kiểm tra hàng ngày | DAILY | `POOL.INSPECT_TYPE = 'DAILY'` |
| Kiểm tra định kỳ | PERIODIC | `POOL.INSPECT_TYPE = 'PERIODIC'` |
| Bảo trì phòng ngừa | PM | `POOL.INSPECT_TYPE = 'PM'` |
| Kiểm tra công nhân | WORKER | `POOL.INSPECT_TYPE = 'WORKER'` |

Mỗi lần chuyển tab, API truy vấn lại với thiết bị đã chọn + loại kiểm tra:
`GET /master/equip-inspect-items?equipCode={code}&inspectType={type}`

---

## Quy trình thêm (ánh xạ) hạng mục

1. Trong drawer `InspectItemSelectPanel`, gọi `GET /master/equip-inspect-item-masters?useYn=Y&inspectType={type}`
2. Hiển thị danh sách danh mục với hộp kiểm (các hạng mục đã ánh xạ bị vô hiệu hóa và hiển thị "Đã đăng ký")
3. Gọi tuần tự `POST /master/equip-inspect-items` cho các hạng mục đã chọn
4. Nội dung của mỗi POST: `{ equipCode, itemCode, inspectType }`

---

## Phát hành nhãn QR

Trong `InspectItemLabelModal`, mã hóa `itemCode` thành QR bằng `react-qr-code` và in nhãn:
- Kích thước nhãn: 60mm × 55mm (CSS in ấn)
- Thành phần: Tiêu đề ("Hạng mục kiểm tra thiết bị") + Mã QR (128px) + Mã hạng mục + Tên hạng mục + Loại kiểm tra + Chu kỳ + Tiêu chí
- Gọi `window.print()` để mở hộp thoại in

---

## Phân quyền
Chỉ người dùng có quyền quản lý hạng mục kiểm tra thiết bị (quản lý thiết bị/chất lượng). Người dùng thông thường chỉ có thể xem.

## Khắc phục sự cố

| Triệu chứng | Nguyên nhân | Biện pháp |
|------|------|------|
| Danh sách thiết bị bên trái không hiển thị | Không có dữ liệu trong danh mục thiết bị | Đăng ký thiết bị và truy vấn lại |
| Tab loại kiểm tra cụ thể không có hạng mục | Không có hạng mục được ánh xạ cho loại đó | Thêm hạng mục trong tab loại tương ứng |
| Hạng mục không hiển thị trong drawer thêm | `USE_YN='N'` trong danh mục hoặc INSPECT_TYPE không khớp | Kiểm tra trạng thái sử dụng và loại kiểm tra trong danh mục |
| Hiển thị "Đã đăng ký" | Tổ hợp thiết bị+hạng mục+loại đã tồn tại trong Pool | Không thể ánh xạ trùng lặp |
| Nhãn QR không in được | Trình duyệt chặn cửa sổ popup | Cho phép popup và thử lại |
| Kích thước nhãn QR không đúng | Cài đặt in không khớp với kích thước nhãn | Điều chỉnh kích thước giấy và lề trong cài đặt in |

## Dữ liệu & Liên kết
- **Bảng**: `EQUIP_INSPECT_ITEM_POOL` (ánh xạ), `EQUIP_INSPECT_ITEM_MASTERS` (thông tin tiêu chuẩn hạng mục), `EQUIP_MASTERS` (thiết bị)
- **Liên kết**: Màn hình nhập kết quả Kiểm tra thiết bị (Equip Inspect), phát hành nhãn QR
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
