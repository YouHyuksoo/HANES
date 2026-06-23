---
menuCode: MAT_ADJUSTMENT
audience: operator
title: Điều chỉnh Tồn kho — Hướng dẫn vận hành
summary: Ý nghĩa toàn bộ cột, DB mapping, quy trình phê duyệt (PDA 2 bước), cấu trúc liên kết tồn kho và xử lý sự cố
tags: [vật tư, tồn kho, điều chỉnh, vận hành, cài đặt, kiểm kê]
keywords: [INV_ADJ_LOGS, MAT_STOCKS, điều chỉnh tồn kho, kiểm kê, ADJ_TYPE, PHYSICAL_INV, MANUAL_ADJ, phê duyệt điều chỉnh, PENDING, APPROVED, InventoryFreezeGuard, STOCK_TRANSACTIONS, MAT_LOTS, tồn kho]
related: [MAT_RECEIVE, MAT_ISSUE]
---

# Điều chỉnh Tồn kho — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Khi có chênh lệch giữa tồn kho thực tế và tồn kho hệ thống, sửa thủ công và ghi lịch sử vào `INV_ADJ_LOGS`. Khi điều chỉnh phát sinh, số lượng trên `MAT_STOCKS` (tồn kho theo mặt hàng·kho) thay đổi và giao dịch `ADJUST_IN`/`ADJUST_OUT` được ghi vào `STOCK_TRANSACTIONS`. Chia làm 2 luồng: Luồng PDA (phê duyệt 2 bước) và luồng PC (phê duyệt ngay).

## Cấu trúc dữ liệu
```
INV_ADJ_LOGS  (PK: ADJ_DATE + SEQ)
    │
    ├── Khi PHÊ DUYỆT (APPROVED) ──▶ Cập nhật MAT_STOCKS.qty
    │                           │
    │                           └── STOCK_TRANSACTIONS (ADJUST_IN / ADJUST_OUT)
    │
    └── Trạng thái PENDING ──▶ Chờ phê duyệt/từ chối (Đăng ký PDA)
                            │
                            ├── Phê duyệt → Phản ánh vào MAT_STOCKS
                            └── Từ chối → Chỉ để lại lịch sử, không biến động tồn kho
```

---

## ① Điều chỉnh Tồn kho — INV_ADJ_LOGS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Ngày điều chỉnh | `ADJ_DATE` | **PK (1/2)**. Ngày đăng ký điều chỉnh. Tự động tạo (`SYSDATE`). |
| Số thứ tự | `SEQ` | **PK (2/2)**. Số thứ tự trong cùng ngày. Tự động đánh số (sequence hoặc `MAX+1`). |
| Kho | `WAREHOUSE_CODE` | Kho điều chỉnh. Kết nối với `MAT_STOCKS.WAREHOUSE_CODE`. |
| Mã mặt hàng | `ITEM_CODE` | Mặt hàng điều chỉnh. Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| UID vật tư | `MAT_UID` | UID LOT khi điều chỉnh theo đơn vị LOT. NULL nếu điều chỉnh toàn bộ mặt hàng. |
| Loại điều chỉnh | `ADJ_TYPE` | Phân loại: `ADJUST`(điều chỉnh thường), `PHYSICAL_INV`(kiểm kê), `MANUAL_ADJ`(hiệu chỉnh thủ công). |
| Số lượng trước điều chỉnh | `BEFORE_QTY` | Số lượng tồn kho hệ thống trước điều chỉnh. Dựa trên `MAT_STOCKS.QTY`. |
| Số lượng sau điều chỉnh | `AFTER_QTY` | Số lượng cuối cùng sau điều chỉnh. |
| Số lượng chênh lệch | `DIFF_QTY` | `AFTER_QTY - BEFORE_QTY`. Dương=tăng, Âm=giảm. |
| Trạng thái phê duyệt | `ADJUST_STATUS` | `PENDING` = chờ phê duyệt (luồng PDA), `APPROVED` = đã phê duyệt (đã phản ánh tồn kho), `REJECTED` = từ chối. Luồng PC mặc định là `APPROVED`. |
| Lý do điều chỉnh | `REASON` | Lý do điều chỉnh. `varchar2(500)`. |
| Người phê duyệt | `APPROVED_BY` | ID người xử lý phê duyệt/từ chối. |
| Ngày phê duyệt | `APPROVED_AT` | Thời điểm xử lý phê duyệt/từ chối. |
| Người tạo | `CREATED_BY` | Người đăng ký điều chỉnh. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi mã công ty(`40`) / mã nhà máy(`1000`). |
| Người sửa | `UPDATED_BY` | Người sửa cuối cùng. |
| Ngày tạo | `CREATED_AT` | Thời điểm đăng ký điều chỉnh. Hiển thị trong danh sách. |
| Ngày sửa cuối | `UPDATED_AT` | Thời điểm sửa cuối cùng (tự động). |

---

## Loại điều chỉnh (`ADJ_TYPE`)

| Mã | Ý nghĩa | Nơi sử dụng |
|------|------|------|
| `ADJUST` | Điều chỉnh thường | Điều chỉnh số lượng trực tiếp từ màn hình PC |
| `PHYSICAL_INV` | Điều chỉnh kiểm kê | Phản ánh kết quả kiểm kê |
| `MANUAL_ADJ` | Hiệu chỉnh thủ công | Trường hợp ngoại lệ như sửa lỗi nhập/xuất |

---

## Quy trình phê duyệt (2 luồng)

| Luồng | Cách đăng ký | Trạng thái ban đầu | Phản ánh tồn kho | Nơi sử dụng |
|------|----------|-----------|----------|--------|
| Màn hình PC | `POST /material/adjustment` | `APPROVED` | **Phản ánh ngay lập tức** | Văn phòng PC |
| PDA | `POST /material/adjustment/pending` | `PENDING` | Phản ánh khi phê duyệt | Hiện trường PDA |

**Luồng PENDING → Phê duyệt/Từ chối:**
1. Đăng ký từ PDA qua `POST /material/adjustment/pending` → `ADJUST_STATUS = 'PENDING'` (chưa phản ánh tồn kho)
2. Quản trị viên `PATCH /material/adjustment/:adjDate/:seq/approve` → Phê duyệt → Cập nhật `MAT_STOCKS.qty` + Ghi `STOCK_TRANSACTIONS`
3. Hoặc `PATCH /material/adjustment/:adjDate/:seq/reject` → Từ chối → Chỉ để lại lịch sử, không biến động tồn kho

> `InventoryFreezeGuard` được áp dụng — khi tồn kho bị đóng băng (Freeze), việc đăng ký/phê duyệt điều chỉnh bị chặn.

---

## Chi tiết liên kết tồn kho

**Thứ tự xử lý khi phê duyệt:**
1. Tra cứu `QTY` hiện tại của kho+mặt hàng+LOT từ `MAT_STOCKS`
2. Tăng/giảm `MAT_STOCKS.QTY` bằng `DIFF_QTY`
3. Ghi giao dịch `ADJUST_IN` (tăng) hoặc `ADJUST_OUT` (giảm) vào `STOCK_TRANSACTIONS`
4. Cập nhật `INV_ADJ_LOGS.ADJUST_STATUS` thành `'APPROVED'` + ghi người·ngày phê duyệt

---

## Quy trình vận hành
1. **Kiểm kê hoặc phát hiện chênh lệch**: Kiểm kê kho sau đó xác nhận chênh lệch giữa hệ thống và thực tế
2. **Đăng ký điều chỉnh**: Nhập kho·mặt hàng·số lượng sau điều chỉnh·lý do trên màn hình PC → phản ánh ngay
3. **Luồng PDA (hiện trường)**: Đăng ký PENDING từ PDA → quản trị viên phê duyệt/từ chối
4. **Kiểm tra kết quả**: Xác nhận lịch sử điều chỉnh và nội dung tăng/giảm trong DataGrid
5. **Điều chỉnh ngược (khi có lỗi)**: Nếu đăng ký sai, khôi phục bằng điều chỉnh ngược chiều

## Phân quyền
Người dùng có quyền điều chỉnh tồn kho (quản trị viên vật tư/sản xuất). Không thể đăng ký·phê duyệt trong thời gian đóng băng tồn kho do `InventoryFreezeGuard`.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Nút lưu bị vô hiệu hóa | Thiếu kho·mặt hàng·số lượng·lý do | Nhập đầy đủ các trường bắt buộc |
| Lỗi "Đang đóng băng tồn kho" | Tồn kho đang bị đóng băng do kiểm kê... | Thử lại sau khi gỡ đóng băng |
| Số lượng sau điều chỉnh bất thường | Phải nhập số lượng cuối cùng, không phải số tăng/giảm | Kiểm tra nhập số lượng cuối cùng (không phải chênh lệch) |
| Đăng ký PDA chưa được phê duyệt | Vẫn ở trạng thái `ADJUST_STATUS = 'PENDING'` | Xử lý phê duyệt (`/approve`) hoặc từ chối (`/reject`) |
| Số lượng hiển thị âm | Điều chỉnh giảm trong khi tồn kho không đủ | Kiểm tra số lượng tồn kho và điều chỉnh lại với giá trị phù hợp |

## Dữ liệu & Liên kết
- **Bảng**: `INV_ADJ_LOGS` (lịch sử điều chỉnh), `MAT_STOCKS` (cập nhật số lượng tồn kho), `STOCK_TRANSACTIONS` (lịch sử giao dịch), `MAT_LOTS` (thông tin LOT)
- **Liên kết**: `ITEM_MASTERS`(mặt hàng), `WAREHOUSES`(kho)
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
- **Bảo vệ**: `InventoryFreezeGuard` — chặn điều chỉnh khi tồn kho bị đóng băng
