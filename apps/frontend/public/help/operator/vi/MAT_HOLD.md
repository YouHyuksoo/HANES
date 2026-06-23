---
menuCode: MAT_HOLD
audience: operator
title: Quản lý Giữ Tồn kho Vật tư — Hướng dẫn vận hành
summary: Cơ chế giữ dựa trên MAT_LOTS.status, bảng liên quan, ảnh hưởng tồn kho và xử lý sự cố
tags: [vật tư, giữ, vận hành, LOT, chất lượng]
keywords: [MAT_LOTS, STATUS, HOLD, NORMAL, DEPLETED, giữ tồn kho, giữ chất lượng, chặn LOT, chặn xuất, MAT_STOCKS]
related: [INV_MAT_STOCK]
---

# Quản lý Giữ Tồn kho Vật tư — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Thay đổi giá trị `MAT_LOTS.STATUS` từ `NORMAL` → `HOLD` (hoặc `HOLD` → `NORMAL`) để chặn hoặc giải phóng việc sử dụng LOT cụ thể. LOT bị giữ vẫn tồn tại dưới dạng tồn kho trong `MAT_STOCKS`, nhưng không thể xuất·đưa vào sản xuất (hệ thống kiểm tra `status = 'HOLD'` để chặn).

## Cấu trúc dữ liệu
```
MAT_LOTS (PK: MAT_UID)
    │
    ├── STATUS (NORMAL / HOLD / DEPLETED / SPLIT / MERGED)
    ├── ITEM_CODE → ITEM_MASTERS (itemName, unit)
    ├── VENDOR → PARTNER_MASTERS (vendorName)
    │
    └──▶ MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
            └── Số lượng tồn kho được giữ nguyên, nhưng LOT trạng thái HOLD bị loại khỏi tồn kho khả dụng
```

---

## ① LOT — MAT_LOTS (cột liên quan đến giữ)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Serial vật tư | `MAT_UID` | **PK**. Số LOT/serial. |
| Mã mặt hàng | `ITEM_CODE` | Mặt hàng. Tham chiếu `ITEM_MASTERS`. |
| Số lượng còn lại | `CURRENT_QTY` | Số lượng tồn kho hiện tại của LOT. |
| Trạng thái | `STATUS` | `NORMAL`(bình thường) / `HOLD`(giữ) / `DEPLETED`(đã hết) / `SPLIT`(đã chia) / `MERGED`(đã gộp). |
| Mã nhà cung cấp | `VENDOR` | Mã nhà cung ứng. Tham chiếu `PARTNER_MASTERS`. |
| Trạng thái IQC | `IQC_STATUS` | `PENDING` / `PASS` / `FAIL` / `HOLD`. |
| Công ty | `COMPANY` | Đa khách hàng. |
| Nhà máy | `PLANT_CD` | Đa khách hàng. |
| Ngày sản xuất | `MANUFACTURE_DATE` | Ngày sản xuất. |
| Hạn sử dụng | `EXPIRE_DATE` | Ngày hết hạn sử dụng. |

---

## Cơ chế giữ

| Thao tác | Điều kiện tiên quyết | Thay đổi DB | Hiệu ứng tồn kho |
|------|---------|---------|----------|
| **Giữ** | LOT tồn tại, `STATUS ≠ HOLD`, `STATUS ≠ DEPLETED` | `MAT_LOTS.STATUS = 'HOLD'` | Tồn kho giữ nguyên nhưng bị loại khỏi tồn kho khả dụng |
| **Giải giữ** | LOT tồn tại, `STATUS = 'HOLD'` | `MAT_LOTS.STATUS = 'NORMAL'` | Được đưa trở lại tồn kho khả dụng |

> **Lưu ý**: LOT ở trạng thái `DEPLETED` không thể giữ; LOT đang bị giữ bị chặn mọi biến động tồn kho như xuất·đưa vào sản xuất.

---

## Trường hợp cần giữ
| Tình huống | Mô tả |
|------|------|
| Chất lượng kém | Giữ LOT đó khi IQC FAIL hoặc phát hiện lỗi trong sản xuất |
| Hết hạn sử dụng | Giữ LOT đã quá hạn sử dụng và xử lý thanh lý |
| Khiếu nại nhà cung cấp | Giữ phòng ngừa khi nghi ngờ vấn đề với LOT từ nhà cung cấp cụ thể |
| Sửa lỗi hệ thống | Chặn tạm thời LOT có số lượng bất thường do lỗi nhập/xuất |

## Phân quyền
Người dùng có quyền giữ tồn kho (quản trị viên chất lượng·vật tư).

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không thấy nút giữ | LOT đã ở trạng thái HOLD | Chuyển sang nút giải giữ |
| Lỗi "Không thể giữ LOT đã hết" | LOT đã hết (DEPLETED) | LOT đã hết không cần giữ |
| Không giải giữ được | Trạng thái của LOT không phải HOLD | Xác nhận trạng thái hiện tại |
| Đã giữ nhưng vẫn có thể xuất | Quy trình xuất không có logic kiểm tra `MAT_LOTS.STATUS` | Kiểm tra logic kiểm tra HOLD trong dịch vụ xuất |
| Lý do không được lưu | Dịch vụ hiện tại không lưu trường `reason` vào DB | Cần mở rộng nếu cần lịch sử kiểm toán riêng |
| Tồn kho của LOT bị giữ vẫn được tổng hợp | `MAT_STOCKS.qty` không thay đổi (chỉ thay đổi trạng thái) | Cần quản lý riêng LOT HOLD trong tổng tồn kho |

## Dữ liệu & Liên kết
- **Bảng**: `MAT_LOTS` (trạng thái LOT), `MAT_STOCKS` (tồn kho)
- **Tham chiếu**: `ITEM_MASTERS`(tên mặt hàng), `PARTNER_MASTERS`(tên nhà cung cấp)
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
- **Tham khảo**: Sản phẩm (`PRODUCT_STOCKS`) có các cột `HOLD_REASON`, `HOLD_AT`, `HOLD_BY` riêng, khác với cấu trúc của vật tư.
