---
menuCode: SHIP_PALLET_SHIP
audience: user
title: Xuất Hàng Pallet
summary: Quét pallet đã hoàn tất chất xếp để xác nhận xuất hàng. Xem cấu trúc thùng của từng pallet và xử lý xuất hàng.
tags: [xuất-hàng, pallet, xác-nhận-xuất-hàng, quét, SHIPPED]
keywords: [SHIP_PALLET_SHIP, xuất-hàng-pallet, xác-nhận-xuất-hàng, PALLET_NO, SHIPPED, CLOSED, quét-mã-vạch]
related: [SHIP_ORDER, SHIP_PALLET]
---

# Xuất Hàng Pallet

## Mục Đích Màn Hình
Tra cứu pallet đã chất xếp hoàn tất và sẵn sàng xuất hàng (CLOSED) bằng cách quét mã vạch hoặc nhập tay, sau đó xử lý xác nhận xuất hàng cuối cùng (SHIPPED). Có thể xem danh sách thùng của từng pallet.

## Bố Cục Màn Hình
- **Bên trái — Danh sách lệnh xuất hàng**: Hiển thị danh sách lệnh xuất hàng ở trạng thái CONFIRMED.
- **Giữa — Danh sách pallet**: Hiển thị danh sách pallet của lệnh xuất hàng đã chọn dưới dạng DataGrid.
- **Bên phải — Chi tiết thùng**: Hiển thị danh sách và trạng thái các thùng trong pallet đã chọn.

---

## Trình Tự Sử Dụng
1. Chọn lệnh xuất hàng cần xử lý từ danh sách bên trái.
2. Kiểm tra pallet cần xuất trong danh sách pallet ở giữa.
3. Quét hoặc nhập mã vạch pallet vào ô nhập **Quét Pallet**.
4. Nếu pallet hợp lệ, nó sẽ được thêm vào danh sách và kích hoạt nút **Xác nhận xuất hàng**.
5. Nhấp nút Xác nhận xuất hàng để hoàn tất xử lý xuất hàng.

## Giữa — Các Cột DataGrid Pallet

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Số Pallet (PALLET_NO)** | Số định danh duy nhất của pallet. |
| **Số thùng (BOX_COUNT)** | Số lượng thùng đã chất lên pallet. |
| **Tổng số lượng (TOTAL_QTY)** | Tổng số lượng sản phẩm trên pallet. |
| **Trạng thái (STATUS)** | Trạng thái hiện tại của pallet (OPEN / CLOSED / LOADED / SHIPPED). |
| **Thời gian chất xếp xong (CLOSE_TIME)** | Thời điểm hoàn tất chất xếp pallet. |
| **Thời gian xuất hàng (SHIPPED_TIME)** | Thời điểm xác nhận xuất hàng. |

## Bên phải — Các Cột Chi Tiết Thùng

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Số thùng (BOX_NO)** | Số định danh duy nhất của thùng. |
| **Mã hàng** | Mã hàng của sản phẩm trong thùng. |
| **Tên hàng** | Tên sản phẩm. |
| **Số lượng (QTY)** | Số lượng sản phẩm mỗi thùng. |
| **Trạng thái (STATUS)** | Trạng thái thùng. |

## Quy Tắc Nhập
- Số pallet có thể được quét bằng máy quét mã vạch hoặc nhập trực tiếp.
- Chỉ pallet ở trạng thái **CLOSED** (chất xếp xong) mới có thể xuất hàng.
- Khi xác nhận xuất hàng, pallet và tất cả các thùng bên trong chuyển sang trạng thái **SHIPPED** và tồn kho được trừ.

## Luồng Trạng Thái
```
OPEN(tạo pallet) → CLOSED(chất xếp xong, sẵn sàng xuất) → SHIPPED(đã xác nhận xuất hàng)
```

## Màn Hình Liên Quan
- [Đăng ký lệnh xuất hàng](/shipping/order) — Màn hình đăng ký lệnh xuất hàng
- [Chất xếp pallet](/shipping/pallet) — Màn hình chất xếp thùng lên pallet
