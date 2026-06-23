---
menuCode: MAT_RECEIPT_CANCEL
audience: operator
title: Hủy Nhập Kho Vật Tư — Hướng Dẫn Vận Hành
summary: Cấu trúc DB hủy nhập kho (chuỗi hủy STOCK_TRANSACTIONS), chuỗi xác thực máy chủ, logic khấu trừ tồn kho và xử lý sự cố
tags: [vật tư, nhập kho, hủy, vận hành, giao dịch ngược, xuất nhập]
keywords: [STOCK_TRANSACTIONS, CANCEL_REF_ID, RECEIVE, DONE, CANCELED, MatStock, giao dịch ngược, lý do hủy, ensureNoDownstreamProgress, NotFoundException, BadRequestException, khấu trừ tồn kho]
related: [MAT_RECEIVE, MAT_ARRIVAL]
---

# Hủy Nhập Kho Vật Tư — Hướng Dẫn Vận Hành

## Mục Đích·Vai Trò Hệ Thống
Màn hình hủy giao dịch nhập kho loại `RECEIVE` được ghi trong `STOCK_TRANSACTIONS`. Khi hủy, `STATUS` của giao dịch gốc được chuyển thành `CANCELED` và một giao dịch ngược dấu được tạo ra để khấu trừ tồn kho `MatStock`. Được sử dụng để khôi phục tính chính xác của tồn kho khi nhập kho sai hoặc phát hiện bất thường về chất lượng.

## Cấu Trúc Dữ Liệu
```
STOCK_TRANSACTIONS (RECEIVE, STATUS='DONE')
    │
    ├── Yêu cầu hủy ──▶ Xác thực (tồn tại gốc·trùng hủy·transType·công việc hạ nguồn)
    │                       │
    │                       ├── Thất bại → Trả về ngoại lệ
    │                       │
    │                       └── Thành công → Xử lý kép:
    │                                ├── Gốc STATUS = 'CANCELED'
    │                                │   + CANCEL_REF_ID = tự tham chiếu
    │                                │
    │                                ├── Tạo giao dịch ngược
    │                                │   (QTY = -QTY gốc, REF_TYPE='CANCEL')
    │                                │   + CANCEL_REF_ID = TRANS_NO gốc
    │                                │
    │                                └── Khấu trừ MatStock
    │                                      (giảm số lượng LOT đó)
    │
    └── Lịch sử hủy ──▶ Lưu trong STOCK_TRANSACTIONS dưới dạng giao dịch ngược
```

---

## ① Giao Dịch Nhập Kho Có Thể Hủy — STOCK_TRANSACTIONS (Toàn Bộ Cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Điểm vận hành |
|------|------|------|
| Ngày giao dịch | `TRANS_DATE` | Ngày phát sinh giao dịch nhập kho. Liên kết với bộ lọc khoảng thời gian. |
| Số giao dịch | `TRANS_NO` | **PK**. Số nhận dạng duy nhất của giao dịch nhập kho. Đánh số tự động. |
| Loại giao dịch | `TRANS_TYPE` | Màn hình hủy nhập kho chỉ lọc hiển thị `RECEIVE`. |
| Mã vật tư | `ITEM_CODE` | Mã vật tư đã nhập kho. Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| Tên vật tư | (JOIN màn hình) | Tra cứu từ `ITEM_MASTERS.ITEM_NAME`. |
| Số serial vật tư | `MAT_UID` | UID của LOT vật tư đã nhập. Liên kết với `MAT_LOTS.MAT_UID`. |
| Nhà cung cấp | (JOIN màn hình) | Tên đối tác. Tra cứu từ bảng `PARTNERS`. |
| Kho nhập | `TO_WAREHOUSE_ID` | ID kho chứa vật tư đã nhập. Tham chiếu `WAREHOUSES`. |
| Số lượng | `QTY` | Số lượng đã nhập kho. Khi hủy, tạo giao dịch ngược với dấu ngược của giá trị này. |
| Trạng thái | `STATUS` | `DONE`(bình thường) / `CANCELED`(đã hủy). Chỉ giao dịch `DONE` mới kích hoạt nút hủy. |
| Tham chiếu hủy | `CANCEL_REF_ID` | Lưu `TRANS_NO` gốc khi hủy. NULL nếu chưa hủy. |
| Loại tham chiếu | `REF_TYPE` | Loại tham chiếu của giao dịch gốc. Khi hủy, giao dịch ngược được tạo với `'CANCEL'`. |
| ID tham chiếu | `REF_ID` | ID tham chiếu của giao dịch gốc (ví dụ: số đến hàng, số PO). |
| Ghi chú | `REMARK` | Ghi chú liên quan đến giao dịch (lý do hủy là trường riêng trong modal hủy). |
| Đa khách thuê | `COMPANY`, `PLANT_CD` | Phạm vi mã công ty(`40`) / mã nhà máy(`1000`). |
| Người tạo | `CREATED_BY` | Người đăng ký nhập kho. |
| Thời gian tạo | `CREATED_AT` | Thời gian đăng ký nhập kho. |
| Người sửa | `UPDATED_BY` | Người sửa cuối cùng (cập nhật khi xử lý hủy). |
| Thời gian sửa | `UPDATED_AT` | Thời gian sửa cuối cùng (tự động cập nhật khi xử lý hủy). |

---

## Chi Tiết Xử Lý Hủy

### Chuỗi Xác Thực Máy Chủ (Thực Hiện Theo Thứ Tự)

| Bước | Xác thực | Khi thất bại |
|------|----------|-------------|
| 1 | Kiểm tra giao dịch gốc tồn tại (`findOne` theo `TRANS_NO`) | `NotFoundException` |
| 2 | Kiểm tra đã hủy chưa (`STATUS = 'CANCELED'`) | `BadRequestException` — "already canceled" |
| 3 | Kiểm tra loại giao dịch (`TRANS_TYPE = 'RECEIVE'`) | `BadRequestException` — "not a receive transaction" |
| 4 | Kiểm tra công việc hạ nguồn đã tiến hành chưa (`ensureNoDownstreamProgress`) | `BadRequestException` — "cannot cancel: downstream progress exists" |

### Thứ Tự Xử Lý Thực Hiện Hủy
1. Từ `MatStock`, **khấu trừ** số lượng tồn kho của kho + vật tư + LOT tương ứng bằng `QTY gốc`
2. Cập nhật `STATUS` của `STOCK_TRANSACTIONS` gốc thành `'CANCELED'` + đặt `CANCEL_REF_ID`
3. Tạo dòng giao dịch ngược (`QTY = -QTY gốc`, `TRANS_TYPE = 'RECEIVE'`, `REF_TYPE = 'CANCEL'`, `CANCEL_REF_ID = TRANS_NO gốc`)
4. Cập nhật trường kiểm toán (`UPDATED_BY`, `UPDATED_AT`)

> **Xử lý giao dịch**: Các bước 1~4 trên được thực hiện trong một giao dịch DB duy nhất, đảm bảo tính nguyên tử. Nếu thất bại giữa chừng, toàn bộ sẽ được rollback.

---

## Cấu Trúc Chuỗi Hủy

```
Nhập kho gốc (RECEIVE, DONE)
  TRANS_NO = 'R20250101-001', QTY = 100
     │
     ├── Xử lý hủy ──▶ STATUS → 'CANCELED'
     │                   CANCEL_REF_ID → 'R20250101-001' (tự tham chiếu)
     │
     └── Tạo giao dịch ngược ──▶ RECEIVE, STATUS = 'DONE'
                                  TRANS_NO = 'R20250101-002' (đánh số mới)
                                  QTY = -100
                                  REF_TYPE = 'CANCEL'
                                  CANCEL_REF_ID = 'R20250101-001'
```

> Có thể truy vết giao dịch gốc và giao dịch ngược thông qua `CANCEL_REF_ID`. Giao dịch ngược không phải là đối tượng hủy riêng biệt và không hiển thị trên màn hình này.

---

## Quy Trình Vận Hành
1. **Tiếp nhận yêu cầu hủy**: Hiện trường phát hiện lỗi nhập kho hoặc bất thường chất lượng, đề xuất hủy
2. **Xác nhận khả năng hủy**: Trên màn hình, xác nhận trạng thái giao dịch mục tiêu và tình trạng công việc hạ nguồn
3. **Nhập lý do hủy**: Ghi lại lý do hủy cụ thể (mục đích kiểm toán)
4. **Xác nhận hủy**: Xác nhận việc tạo giao dịch ngược và khấu trừ tồn kho
5. **Xử lý hậu kỳ**: Nếu cần, tiến hành nhập kho lại (MAT_RECEIVE) hoặc xử lý trả hàng

## Phân Quyền
Người dùng có quyền hủy nhập kho (quản lý vật tư/chất lượng). Người dùng thông thường chỉ có thể tra cứu.

## Xử Lý Sự Cố

| Triệu chứng | Nguyên nhân | Biện pháp |
|------|------|------|
| Nút hủy không kích hoạt được | Đã ở trạng thái `CANCELED` hoặc `STATUS` không phải `DONE` | Xác nhận trạng thái giao dịch gốc, giao dịch đã hủy không thể hủy lại |
| "Không tìm thấy giao dịch gốc" | `TRANS_NO` không tồn tại trong DB | Kiểm tra trực tiếp trong DB xem giao dịch có tồn tại không |
| "Giao dịch đã được hủy" | `STATUS` đã là `CANCELED` | Tra cứu lịch sử hủy để đánh giá có cần khôi phục không |
| "Không phải giao dịch nhập kho" | `TRANS_TYPE` không phải `RECEIVE` | Màn hình này chỉ hủy được `RECEIVE`. Các loại khác sử dụng chức năng tương ứng |
| "Có công việc hạ nguồn, không thể hủy" | LOT đã được đưa vào sản xuất v.v. | Xác nhận tiến độ sản xuất. Có thể hủy sau khi hoàn thành công việc hạ nguồn |
| Số lượng tồn kho không khớp sau khi hủy | Tạo giao dịch ngược thất bại hoặc khấu trừ trùng lặp | Đối chiếu số lượng LOT đó trong `STOCK_TRANSACTIONS` và `MatStock` |
| Đã xử lý hủy nhưng màn hình chưa phản ánh | Cache trình duyệt hoặc chưa làm mới | Nhấn nút **Làm mới (Refresh)** |

## Dữ Liệu·Liên Kết
- **Bảng**: `STOCK_TRANSACTIONS` (giao dịch gốc + giao dịch ngược), `MatStock` (khấu trừ tồn kho)
- **Liên kết**: `ITEM_MASTERS`(vật tư), `WAREHOUSES`(kho), `PARTNERS`(đối tác), `MAT_LOTS`(LOT)
- **Tham chiếu xác thực**: `ensureNoDownstreamProgress` — ngăn chặn hủy khi có công việc hạ nguồn như đưa vào sản xuất
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
- **Kiểm toán**: Khi hủy, có thể truy vết liên kết giữa giao dịch gốc và giao dịch ngược qua `CANCEL_REF_ID`
