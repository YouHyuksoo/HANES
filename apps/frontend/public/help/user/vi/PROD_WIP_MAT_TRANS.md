---
menuCode: PROD_WIP_MAT_TRANS
audience: user
title: Xuất Nhập Vật Tư Công Đoạn
summary: Tra cứu lịch sử giao dịch (nhập/tiêu hao/hủy) tồn kho WIP nguyên vật liệu theo thiết bị
tags: [sản xuất, WIP, công đoạn, xuất nhập, thiết bị, tra cứu]
keywords: [WIP_MAT_TRANSACTIONS, xuất nhập công đoạn, tồn kho công đoạn, WIP_IN, PROD_CONSUME, tồn kho thiết bị, tiêu hao sản xuất]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# Xuất Nhập Vật Tư Công Đoạn

## Mục Đích Màn Hình
Tra cứu lịch sử giao dịch của **tồn kho WIP nguyên vật liệu** được quản lý theo thiết bị (công đoạn). Theo dõi thời điểm nguyên vật liệu được đưa vào công đoạn (WIP_IN), tiêu hao trong sản xuất (PROD_CONSUME) và các giao dịch hủy tương ứng, theo thiết bị và ngày tháng.

## Cấu Hình Màn Hình
- **Danh sách DataGrid**: 8 cột — thời gian, loại, thiết bị, mặt hàng, LOT, số lượng, tham chiếu, ghi chú
- **Bộ lọc trên cùng**: Chọn thiết bị + chọn loại giao dịch + khoảng thời gian + từ khóa tìm kiếm (mã mặt hàng/tên/LOT/tên thiết bị)

---

## ① Cột Danh Sách DataGrid

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Thời gian(createdAt)** | Thời điểm giao dịch được xử lý. |
| **Loại(transType)** | Loại giao dịch công đoạn. **WIP_IN**(xanh dương) / **WIP_IN_CANCEL**(đỏ) / **PROD_CONSUME**(cam) / **PROD_CONSUME_CANCEL**(đỏ). |
| **Thiết bị(equipName)** | Tên và mã thiết bị nơi giao dịch phát sinh. |
| **Mặt hàng(itemCode)** | Mã và tên nguyên vật liệu giao dịch. |
| **LOT(matUid)** | Số LOT/serial tham gia giao dịch. |
| **Số lượng(qty)** | Số lượng biến động. **Dương(xanh)** = tăng tồn kho, **Âm(đỏ)** = giảm tồn kho. |
| **Tham chiếu(refType)** | Loại và ID tham chiếu của giao dịch gốc (ví dụ: số lệnh sản xuất). |
| **Ghi chú(remark)** | Ghi chú bổ sung về giao dịch. |

## Loại Giao Dịch
| Loại | Mô tả | Số lượng |
|------|-------|----------|
| WIP_IN | Nguyên vật liệu từ kho chuyển vào thiết bị (công đoạn) | + (dương) |
| WIP_IN_CANCEL | Hủy WIP_IN — nguyên vật liệu trả lại kho | - (âm) |
| PROD_CONSUME | Nguyên vật liệu được tiêu hao trong sản xuất tại thiết bị | - (âm) |
| PROD_CONSUME_CANCEL | Hủy tiêu hao — nguyên vật liệu được hoàn lại tồn kho công đoạn | + (dương) |

## Cách Sử Dụng
1. Trên thanh công cụ, chọn **thiết bị** và **loại giao dịch**, tùy chọn đặt **khoảng thời gian** và **từ khóa tìm kiếm**.
2. Xem chi tiết từng giao dịch trong danh sách.
3. Sử dụng chức năng lọc và sắp xếp cột để tìm dữ liệu cụ thể.
4. **Xuất** kết quả ra Excel.

## Màn Hình Liên Quan
- [Quản lý lệnh sản xuất](/production/order) — Theo dõi giao dịch công đoạn theo lệnh sản xuất
- [Nhập kết quả (Kiosk)](/production/input-kiosk) — Nhập kết quả sản xuất phát sinh giao dịch công đoạn
