---
menuCode: CONS_MOUNT
audience: operator
title: Quản lý lắp đặt vật tư tiêu hao — Hướng dẫn vận hành
summary: Chuyển đổi trạng thái lắp đặt/tháo gỡ/sửa chữa vật tư tiêu hao trên thiết bị, luồng dữ liệu CONSUMABLE_MASTERS, CONSUMABLE_MOUNT_LOGS và xử lý sự cố
tags: [vật tư tiêu hao, lắp đặt, tháo gỡ, sửa chữa, vận hành, cấu hình]
keywords: [CONSUMABLE_MASTERS, CONSUMABLE_MOUNT_LOGS, EQUIP_MASTERS, OPER_STATUS, MOUNTED, WAREHOUSE, REPAIR, MOUNT, UNMOUNT, SEQ_CONSUMABLE_MOUNT_LOGS]
related: [CONS_MASTER, CONS_STOCK, CONS_LIFE]
---

# Quản lý lắp đặt vật tư tiêu hao — Hướng dẫn vận hành

## Mục đích·vai trò hệ thống
Quản lý **trạng thái vật lý** của vật tư tiêu hao (khuôn mẫu·jig·dụng cụ) dùng cho thiết bị sản xuất. Cập nhật `OPER_STATUS` và `MOUNTED_EQUIP_ID` trong `CONSUMABLE_MASTERS`, mọi chuyển đổi trạng thái đều được lưu lại làm lịch sử kiểm toán trong `CONSUMABLE_MOUNT_LOGS`. Màn hình này là luồng quản lý trạng thái riêng biệt với xuất/nhập kho hay quản lý tuổi thọ.

## Cấu trúc dữ liệu
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE, COMPANY, PLANT_CD)
   ├─ OPER_STATUS        : WAREHOUSE / MOUNTED / REPAIR
   ├─ MOUNTED_EQUIP_ID   : Thiết bị đang lắp (khi ở trạng thái MOUNTED)
   └─ 1:N ─▶ CONSUMABLE_MOUNT_LOGS (PK: MOUNT_DATE, SEQ)
              ├─ ACTION: MOUNT / UNMOUNT
              ├─ EQUIP_CODE
              ├─ WORKER_NO
              └─ REMARK

EQUIP_MASTERS (PK: EQUIP_CODE, COMPANY, PLANT_CD)
   └─ Tham chiếu: MOUNTED_EQUIP_ID
```

## ① Lưới chính — CONSUMABLE_MASTERS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / ý nghĩa · điểm vận hành |
|------|------|------|
| Mã vật tư tiêu hao | `CONSUMABLE_CODE` | PK. Khóa tham chiếu cho các luồng vật tư tiêu hao khác. |
| Tên vật tư tiêu hao | `NAME` | Tên hiển thị (tên thuộc tính entity là `consumableName`). |
| Phân loại | `CATEGORY` | Mã chung `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). |
| Trạng thái vận hành | `OPER_STATUS` | `WAREHOUSE`(kho) / `MOUNTED`(lắp đặt) / `REPAIR`(sửa chữa). Là tiêu chí hiển thị nút hành động trên màn hình. |
| Thiết bị lắp đặt | `MOUNTED_EQUIP_ID` | Chỉ có giá trị khi `MOUNTED`. `WAREHOUSE`/`REPAIR` thì null. |
| Trạng thái tuổi thọ | `STATUS` | `NORMAL`/`WARNING`/`REPLACE`. Được cập nhật từ module quản lý tuổi thọ. |
| Số lần sử dụng hiện tại | `CURRENT_COUNT` | Tích lũy qua kiosk/API số lần. |
| Tuổi thọ dự kiến | `EXPECTED_LIFE` | Tiêu chí ngưỡng `REPLACE`. |
| Vị trí lưu trữ | `LOCATION` | Nơi lưu trữ mặc định. |
| Sử dụng hay không | `USE_YN` | Chỉ hiển thị những bản ghi `Y` trong danh sách. |
| Multi-tenant | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000`. |

## ② Lịch sử lắp đặt/tháo gỡ — CONSUMABLE_MOUNT_LOGS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / ý nghĩa · điểm vận hành |
|------|------|------|
| Ngày | `MOUNT_DATE` | PK(1). Ngày xảy ra lắp đặt/tháo gỡ. |
| Số thứ tự | `SEQ` | PK(2). Cấp số bằng `SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL`. |
| Mã vật tư tiêu hao | `CONSUMABLE_CODE` | Tính chất FK. Tham chiếu `CONSUMABLE_MASTERS`. |
| Mã thiết bị | `EQUIP_CODE` | Thiết bị được lắp/tháo tại thời điểm đó. |
| Hành động | `ACTION` | `MOUNT` hoặc `UNMOUNT`. |
| Người làm việc | `WORKER_NO` | Người gọi API hoặc dto.workerId. |
| Ghi chú | `REMARK` | Tối đa 500 ký tự. |
| CON_UID | `CON_UID` | Dùng để truy vết từng instance (tùy chọn). |
| Multi-tenant | `COMPANY`, `PLANT_CD` | `40` / `1000`. |

## Logic chuyển đổi trạng thái
1. **Lắp đặt** (`POST /equipment/consumables/:id/mount`)
   - Phải có `OPER_STATUS='WAREHOUSE'` và `MOUNTED_EQUIP_ID` là null
   - `OPER_STATUS` → `MOUNTED`, `MOUNTED_EQUIP_ID` → thiết bị yêu cầu
   - Ghi lại `MOUNT` vào `CONSUMABLE_MOUNT_LOGS`
2. **Tháo gỡ** (`POST /equipment/consumables/:id/unmount`)
   - Phải có `OPER_STATUS='MOUNTED'`
   - `OPER_STATUS` → `WAREHOUSE`, `MOUNTED_EQUIP_ID` → null
   - Ghi lại `UNMOUNT` với mã thiết bị đã lắp trước đó
3. **Chuyển sửa chữa** (`POST /equipment/consumables/:id/repair`)
   - Nếu đang lắp đặt thì trước tiên ghi lại `UNMOUNT`
   - `OPER_STATUS` → `REPAIR`, `MOUNTED_EQUIP_ID` → null
4. **Hoàn tất sửa chữa** (`POST /equipment/consumables/:id/complete-repair`)
   - Phải có `OPER_STATUS='REPAIR'`
   - `OPER_STATUS` → `WAREHOUSE`
   - Không ghi lại lịch sử (chỉ khôi phục trạng thái)

> Thiết bị bị interlock do vượt tuổi thọ (`STATUS='REPLACE'`) nên được tháo gỡ trên màn hình này trước khi thay thế.

## Cấu hình trước (master·mã chung)
- Mã chung: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL), `CONSUMABLE_STATUS`(NORMAL/WARNING/REPLACE), `CONSUMABLE_OPER_STATUS`(WAREHOUSE/MOUNTED/REPAIR)
- Vật tư tiêu hao quản lý trong `CONSUMABLE_MASTERS` phải được đăng ký với `USE_YN='Y'`
- Thiết bị lắp đặt phải được đăng ký trong `EQUIP_MASTERS`
- Oracle SEQUENCE: `SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL`

## Quy trình vận hành
1. Đăng ký master vật tư tiêu hao ([Vật tư tiêu hao master]) và nhập kho ([Nhập kho vật tư tiêu hao]) để đảm bảo `OPER_STATUS='WAREHOUSE'`
2. Trên màn hình này, lọc vật tư tiêu hao cần thiết rồi thực hiện lắp đặt/tháo gỡ/sửa chữa
3. Khi cần, theo dõi thời điểm thay thế tại [Tình trạng tuổi thọ]
4. Sau khi sửa chữa xong, trên màn hình này chọn `Hoàn tất sửa chữa` để đưa về kho

## Quyền hạn
Quản lý sản xuất/thiết bị (xử lý lắp đặt·tháo gỡ·sửa chữa). Người dùng thông thường chỉ xem và kiểm tra lịch sử.

## Xử lý sự cố (troubleshooting)
| Triệu chứng | Nguyên nhân | Hành động |
|------|------|------|
| Khi lắp đặt hiển thị "Khuôn đã được lắp trên thiết bị"(409) | `OPER_STATUS='MOUNTED'` | Tháo gỡ trước rồi lắp lại |
| Khi tháo gỡ hiển thị "Không ở trạng thái lắp đặt"(400) | `OPER_STATUS` là WAREHOUSE/REPAIR | Kiểm tra trạng thái |
| Khi hoàn tất sửa chữa hiển thị "Không ở trạng thái sửa chữa"(400) | `OPER_STATUS != 'REPAIR'` | Thực hiện chuyển sửa chữa trước |
| Modal lịch sử không có bản ghi | `CONSUMABLE_MOUNT_LOGS` chưa được tạo | Kiểm tra API lắp đặt/tháo gỡ/sửa chữa được gọi thành công |
| Không thấy vật tư tiêu hao trong danh sách | `USE_YN='N'` hoặc bộ lọc không khớp | Kiểm tra trạng thái sử dụng master và bộ lọc |
| Không chọn được thiết bị đích | `EQUIP_MASTERS` chưa đăng ký hoặc `USE_YN='N'` | Kích hoạt master thiết bị |

## Dữ liệu·liên kết
- Bảng: `CONSUMABLE_MASTERS`, `CONSUMABLE_MOUNT_LOGS`, `EQUIP_MASTERS`
- Liên kết: [Vật tư tiêu hao master](`CONSUMABLE_MASTERS`), [Nhập kho vật tư tiêu hao](`CONSUMABLE_LOGS`), [Tình trạng tuổi thọ](`CURRENT_COUNT`/`EXPECTED_LIFE`), Master thiết bị(`EQUIP_MASTERS`)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
