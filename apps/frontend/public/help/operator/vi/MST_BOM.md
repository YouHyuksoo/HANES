---
menuCode: MST_BOM
audience: operator
title: Quản lý BOM — Hướng dẫn vận hành
summary: Toàn bộ cột·khóa phức hợp BOM_MASTERS, khai triển đệ quy, upload Excel, liên kết hạng mục/routing, xử lý sự cố
tags: [thông tin cơ sở, BOM, định mức nguyên vật liệu, vận hành]
keywords: [BOM_MASTERS, PARENT_ITEM_CODE, CHILD_ITEM_CODE, REVISION, QTY_PER, OPER, khai triển đệ quy, upload Excel, ECO_NO, đa khách hàng]
related: [MST_PART]
---

# Quản lý BOM — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình quản lý **`BOM_MASTERS** xác định cấu thành cha-con hạng mục. Là tiêu chuẩn cho việc khai triển nhu cầu vật tư (tính lượng cần)·đầu vào trong sản xuất, biểu diễn BOM đa cấp bằng cấu trúc tự tham chiếu (hạng mục con lại làm cha).

## Cấu trúc dữ liệu
```
BOM_MASTERS (Khóa phức hợp: PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION)
   ├─ PARENT_ITEM_CODE ─▶ ITEM_MASTERS (Hạng mục cha)
   └─ CHILD_ITEM_CODE  ─▶ ITEM_MASTERS (Hạng mục con) ─▶ (Hạng mục con làm cha đệ quy) BOM_MASTERS
```
- **Khóa phức hợp**: `PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION` (không có UUID id).
- API tra cây: `GET /master/boms/hierarchy/:parentPartId` (khai triển đệ quy).

## Toàn bộ cột — BOM_MASTERS

| Mục màn hình | Cột DB | Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Hạng mục cha | `PARENT_ITEM_CODE` | PK. Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| Mã hạng mục con | `CHILD_ITEM_CODE` | PK. Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| Phiên bản | `REVISION` | PK. Mặc định `A`. Phân biệt phiên bản cấu thành. |
| Định mức | `QTY_PER` | NUMBER(10,4). Số lượng hạng mục con cho 1 cha. |
| Số thứ tự | `SEQ` | Thứ tự hiển thị/xử lý (mặc định 0). |
| Nhóm BOM | `BOM_GRP` | Phân loại nhóm (có index). |
| Công đoạn | `OPER` | Mã công đoạn đầu vào (tên trường entity là processCode). |
| Mặt | `SIDE` | Mặt áp dụng (TOP/BOT...). |
| Số ECO | `ECO_NO` | Số theo dõi thay đổi thiết kế. |
| Hiệu lực từ | `VALID_FROM` | DATE. Ngày bắt đầu áp dụng. |
| Hiệu lực đến | `VALID_TO` | DATE. Ngày kết thúc áp dụng (không áp dụng ngoài kỳ hạn). |
| Ghi chú | `REMARK` | Ghi nhớ. |
| Sử dụng | `USE_YN` | Chỉ Y là cấu thành hiệu lực. |
| Tên/loại hạng mục con | (JOIN) | `ITEM_MASTERS.ITEM_NAME / ITEM_TYPE` — hiển thị·xác định khai triển (không có trong BOM_MASTERS). |
| Cấp (Lv) | (Tính toán) | Độ sâu cây. Không phải giá trị lưu. |
| Kiểm toán | `CREATED_BY/UPDATED_BY/CREATED_AT/UPDATED_AT` | Lịch sử. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000`. |

## Upload Excel
- Đăng ký hàng loạt nhiều BOM bằng mẫu Excel (modal upload). Mã hạng mục cha/con phải tồn tại trong `ITEM_MASTERS`, trùng khóa (cha+con+phiên bản) thì xử lý theo chính sách từ chối/cập nhật.

## Khai triển đệ quy / Liên kết Routing
- Nếu hạng mục con là bán thành phẩm, BOM cấp dưới được khai triển lại với hạng mục con đó làm cha (đa cấp). Khai triển nhu cầu sản xuất tính tích lũy theo đệ quy này.
- Mỗi dòng BOM được kết nối với `OPER`(công đoạn) để xác định vật tư đầu vào tại công đoạn nào, xem cùng với routing.

## Thiết lập trước
- Hạng mục cha/con phải được đăng ký trong `ITEM_MASTERS` trước.
- Mã công đoạn (OPER) theo master công đoạn.

## Phân quyền
Quản trị viên thông tin cơ sở (đăng ký/sửa/upload). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Lỗi mã khi thêm hạng mục con | Hạng mục con không có trong ITEM_MASTERS | Đăng ký vào master hạng mục trước |
| Thêm cùng hạng mục con bị từ chối | Trùng khóa cha+hạng mục con+phiên bản | Đổi phiên bản hoặc sửa dòng cũ |
| Hạng mục con không xổ trên cây | BOM của hạng mục con chưa đăng ký | Đăng ký BOM cấp dưới với hạng mục con làm cha |
| Số lượng khai triển sản xuất không đúng | QTY_PER nhập sai / ngoài kỳ hạn hiệu lực | Kiểm tra định mức·VALID_FROM/TO |
| Cấu thành không được áp dụng | USE_YN='N' hoặc hết hiệu lực | Kiểm tra USE_YN·kỳ hạn hiệu lực |

## Dữ liệu & Liên kết
- Bảng: `BOM_MASTERS`
- Liên kết: Master hạng mục (`ITEM_MASTERS`), Công đoạn/Routing (OPER), Khai triển nhu cầu sản xuất
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
