---
menuCode: INV_MAT_PHYSICAL_INV_APPLY
audience: operator
title: Phản ánh Kiểm kê Vật tư — Hướng dẫn vận hành
summary: Quy trình phản ánh kiểm kê, cấu trúc cập nhật tồn kho, xử lý giao dịch và xử lý sự cố
tags: [tồn kho, kiểm kê, phản ánh, vận hành, số lượng]
keywords: [PHYSICAL_INV_COUNT_DETAILS, MAT_STOCKS, phản ánh kiểm kê, applyCount, STOCK_TRANSACTIONS, INV_ADJ_LOGS, PHYSCOUNT_IN, PHYSCOUNT_OUT]
related: [INV_MAT_PHYSICAL_INV, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Phản ánh Kiểm kê Vật tư — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Bước phản ánh cuối cùng để làm khớp tồn kho hệ thống với thực tế dựa trên số lượng quét PDA (hoặc số lượng nhập trực tiếp từ PC) sau khi hoàn tất phiên kiểm kê. Khi `applyCount()` được thực thi, số lượng trên `MAT_STOCKS` được cập nhật, `PHYSCOUNT_IN/OUT` được ghi vào `STOCK_TRANSACTIONS`, và lịch sử kiểm toán loại `PHYSICAL_COUNT` được tạo trong `INV_ADJ_LOGS`.

## Cấu trúc dữ liệu
```
PHYSICAL_INV_SESSIONS (COMPLETED)
    │
    └── PHYSICAL_INV_COUNT_DETAILS (systemQty, countedQty, diffQty)
            │
            ▼ Khi phản ánh (apply)
    MAT_STOCKS.qty = cập nhật thành countedQty
    MAT_STOCKS.lastCountAt = now
    MAT_STOCKS.availableQty tính lại
            │
            ├── STOCK_TRANSACTIONS (PHYSCOUNT_IN / PHYSCOUNT_OUT)
            │
            └── INV_ADJ_LOGS (adjType = 'PHYSICAL_COUNT')
```

---

## ① Cột Phản ánh Kiểm kê

| Mục màn hình | DB (Nguồn) | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Kho | `PHYSICAL_INV_COUNT_DETAILS.WAREHOUSE_CODE` | Kho kiểm kê. |
| Mã mặt hàng | `PHYSICAL_INV_COUNT_DETAILS.ITEM_CODE` | Mặt hàng kiểm kê. |
| Serial vật tư | `PHYSICAL_INV_COUNT_DETAILS.MAT_UID` | Serial LOT. |
| Số lượng hệ thống | `PHYSICAL_INV_COUNT_DETAILS.SYSTEM_QTY` | Ảnh chụp nhanh tại thời điểm bắt đầu phiên (không thể thay đổi). |
| Số lượng kiểm kê | `PHYSICAL_INV_COUNT_DETAILS.COUNTED_QTY` | Giá trị tích lũy PDA hoặc nhập trực tiếp từ PC. **Có thể sửa trước khi phản ánh**. |
| Chênh lệch | `COUNTED_QTY - SYSTEM_QTY` | Dương = thực tế nhiều hơn, Âm = thực tế ít hơn. |

---

## Chi tiết xử lý Phản ánh (Apply)

`POST /material/physical-inv` → thực thi `PhysicalInvService.applyCount()`:

1. Tra cứu `MatStock` bằng `PhysicalInvItemDto.stockId` (warehouseCode::itemCode::matUid)
2. Thiết lập `MatStock.qty` thành `countedQty`
3. Tính lại `MatStock.availableQty` (`qty - reservedQty`)
4. Cập nhật `MatStock.lastCountAt`
5. Tạo `StockTransaction`:
   - `PHYSCOUNT_IN`: Ghi phần tăng nếu chênh lệch dương
   - `PHYSCOUNT_OUT`: Ghi phần giảm nếu chênh lệch âm
6. Ghi `InvAdjLog`: `adjType = 'PHYSICAL_COUNT'`, lưu `diffQty`

---

## Kiểm tra trước khi phản ánh
- Xác nhận **quét PDA đã hoàn tất** (kiểm tra khả năng bỏ sót).
- Các mục có **số lượng kiểm kê bằng 0** được coi là không có tồn kho thực tế, nhưng cần xem xét khả năng bỏ sót PDA.
- **Các mục chênh lệch lớn** có thể cần kiểm tra lại (mất cắp·thất lạc·lỗi nhập xuất).
- Sau khi phản ánh, `MAT_STOCKS` bị thay đổi trực tiếp, do đó cần thực hiện cẩn thận.

## Phân quyền
Người dùng có quyền phản ánh kiểm kê (quản trị viên vật tư/chất lượng).

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Nút phản ánh kiểm kê bị vô hiệu hóa | Không có mục không khớp trong điều kiện đã chọn (tất cả đều khớp) | Nếu kết quả kiểm kê chính xác thì không cần phản ánh |
| Lỗi "MatStock not found" | Không có bản ghi tồn kho tương ứng với `stockId` | Kiểm tra lịch sử nhập của mặt hàng đó |
| Không sửa được số lượng kiểm kê | Trường nhập ở dạng readonly hoặc giá trị bị xử lý dạng chuỗi | Chỉ nhập số (số nguyên từ 0 trở lên) |
| Số lượng sau phản ánh khác với PDA | Số lượng hệ thống đã thay đổi trước khi phản ánh | Kiểm tra lịch sử nhập/xuất, cần kiểm kê lại |
| Vẫn còn chênh lệch sau phản ánh | Số lượng bị thay đổi từ phiên khác hoặc điều chỉnh | Tra cứu lại trạng thái tồn kho và phân tích nguyên nhân |

## Dữ liệu & Liên kết
- **Bảng**: `PHYSICAL_INV_COUNT_DETAILS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `INV_ADJ_LOGS`
- **Liên kết**: Quản lý Kiểm kê (phiên), Tra cứu Tồn kho Vật tư
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
