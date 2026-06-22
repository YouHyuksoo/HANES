---
menuCode: PUR_PO
audience: operator
title: Quản lý PO — Hướng dẫn vận hành
summary: Cấu trúc bảng PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS, logic chuyển trạng thái, quy tắc đánh số, phạm vi đa khách hàng, xử lý sự cố
tags: [quản lý vật tư, đơn đặt hàng, PO, vận hành, master]
keywords: [PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, PO_NO, PARTNER_ID, PARTNER_NAME, ORDER_DATE, DUE_DATE, STATUS, USE_TYPE, TOTAL_AMOUNT, LINE_NO, REV_NO, SEQ, ORDER_QTY, RECEIVED_QTY, LINE_STATUS, REL_NO, UNIT_PRICE, DRAFT, CONFIRMED, PARTIAL, RECEIVED, CLOSED, đánh số, đa khách hàng, COMPANY, PLANT_CD, nhập hàng, kiểm tra nhập]
related: [PUR_PO_STATUS, MAT_RECEIVE, MST_PART]
---

# Quản lý PO — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình cốt lõi của module quản lý vật tư, quản lý toàn bộ vòng đời của đơn đặt hàng (PO). PO đã đăng ký được tham chiếu khi xử lý nhập hàng tại Quản lý nhập hàng (MAT_RECEIVE), trạng thái tự động cập nhật thành PARTIAL/RECEIVED. Không có PO thì không thể xử lý nhập hàng.

## Cấu trúc dữ liệu

```
PURCHASE_ORDERS (PK: PO_NO)
  ├─ PARTNER_ID ──▶ PARTNER_MASTERS (Nhà cung cấp)
  └─ PURCHASE_ORDER_ITEMS (PK: PO_ID + SEQ)
       └─ ITEM_CODE ──▶ ITEM_MASTERS (Master hạng mục)
       └─ Tham chiếu: MAT_ARRIVALS (liên kết nhập hàng)
```

## ① Header PO — PURCHASE_ORDERS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| PO No. | `PO_NO` | PK (khóa tự nhiên). Quy tắc đánh số: `PO-YYYYMMDD-NNN` (NumberingService). Bất biến — không thể thay đổi sau tạo. |
| Nhà cung cấp(ID) | `PARTNER_ID` | Tham chiếu `PARTNER_MASTERS.PARTNER_CODE`. Màn hình hiển thị tên (`partnerName`). |
| Tên nhà cung cấp | `PARTNER_NAME` | Tự động tra master theo `PARTNER_ID` và điền khi đăng ký. Dù tên nhà cung cấp đổi sau, bản ghi PO giữ tên tại thời điểm đăng ký. |
| Ngày đặt hàng | `ORDER_DATE` | Kiểu date. Mặc định hôm nay khi đăng ký. Cột tiêu chuẩn bộ lọc danh sách (`@Index`). |
| Ngày giao hàng | `DUE_DATE` | Kiểu date. nullable. Dùng phân tích tỷ lệ giao hàng đúng hạn. |
| Trạng thái | `STATUS` | Luồng trạng thái (xem dưới). Mặc định `DRAFT`. Mã chung `PO_STATUS`. `@Index` tồn tại. |
| Loại sử dụng | `USE_TYPE` | Phân biệt mục đích đặt hàng. Hiện mặc định `PROD`(sản xuất). Không hiển thị trên UI. |
| Tổng tiền | `TOTAL_AMOUNT` | decimal(14,2). Tính tổng hạng mục `ORDER_QTY × UNIT_PRICE`. Nếu chưa nhập đơn giá thì 0. Service layer tính tại thời điểm lưu. |
| Ghi chú | `REMARK` | varchar2(500). |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi: `'40'` / `'1000'`. Áp dụng mọi truy vấn/lưu. |
| Người đăng | `CREATED_BY` | ID người dùng session. |
| Người sửa | `UPDATED_BY` | ID người dùng session khi sửa. |
| Kiểm toán | `CREATED_AT`, `UPDATED_AT` | timestamp. TypeORM `@CreateDateColumn` / `@UpdateDateColumn`. |

## ② Hạng mục PO — PURCHASE_ORDER_ITEMS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| (Không có) | `PO_ID` | Thành phần PK (phức hợp). Tham chiếu `PURCHASE_ORDERS.PO_NO`. Tên trường entity là `poNo`. |
| (Không có) | `SEQ` | Thành phần PK (phức hợp). Thứ tự lưu hạng mục (0-based index + 1). |
| Mã hạng mục | `ITEM_CODE` | Tham chiếu `ITEM_MASTERS.ITEM_CODE`. `@Index` tồn tại. |
| Số lượng đặt | `ORDER_QTY` | int. Bắt buộc số nguyên từ 1 trở lên. |
| Số lượng nhập | `RECEIVED_QTY` | int. Mặc định 0. Tự động tích lũy khi xử lý nhập hàng. Màn hình (đăng ký PO) không thể sửa — chỉ thay đổi tại Quản lý nhập hàng. |
| Số dòng | `LINE_NO` | Số nhận dạng dòng PO do người dùng chỉ định. Mặc định là thứ tự thêm. |
| Số lần phát hành | `REV_NO` | Số lần đặt hàng của cùng hạng mục. Mặc định 1. Nhãn màn hình: "Số lần phát hành". |
| Trạng thái dòng | `LINE_STATUS` | Mặc định `OPEN`. Thay đổi theo tiến trình nhập (tham khảo vận hành). Không hiển thị màn hình. |
| Release No. | `REL_NO` | nullable int. Tham khảo release hệ thống ngoài như ERP. Hiện không hiển thị màn hình. |
| Đơn giá | `UNIT_PRICE` | decimal(12,4). nullable. Không có UI nhập màn hình (API trực tiếp hoặc mở rộng sau). Dùng tính tổng tiền. |
| Ghi chú | `REMARK` | varchar2(500). Ghi nhớ theo dòng hạng mục. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Tự động áp dụng cùng phạm vi header. |
| Kiểm toán | `CREATED_AT`, `UPDATED_AT` | timestamp. |

## Logic chuyển trạng thái

| Chuyển | API | Điều kiện | Ghi chú |
|------|------|------|------|
| DRAFT → CONFIRMED | `PATCH /material/purchase-orders/:id/confirm` | Chỉ `DRAFT` hiện tại | Xác nhận đơn hàng. Sau đó có thể nhập hàng. |
| CONFIRMED → PARTIAL | (Tự động khi xử lý nhập) | Một phần hạng mục nhập hoàn tất | Tự động thay đổi khi xử lý MAT_ARRIVALS |
| PARTIAL → RECEIVED | (Tự động khi xử lý nhập) | Tất cả hạng mục nhập hoàn tất | Tự động thay đổi khi xử lý MAT_ARRIVALS |
| RECEIVED/PARTIAL → CLOSED | `PATCH /material/purchase-orders/:id/close` | Hiện tại `RECEIVED` hoặc `PARTIAL` | Kết thúc thủ công |
| DRAFT → (Xóa) | `DELETE /material/purchase-orders/:id` | DRAFT + không có lịch sử nhập | Nếu có nhập thì 400 |

> Không thể đưa trạng thái về sau CONFIRMED trực tiếp từ UI màn hình. Cần sửa DB trực tiếp hoặc gọi API nếu cần khôi phục trạng thái.

## Quy tắc đánh số PO

- Service: `NumberingService.nextPoNo()`
- Định dạng: `PO-YYYYMMDD-NNN` (VD: `PO-20260621-001`)
- API: `GET /material/purchase-orders/next-no` — tự động gọi khi mở panel đăng ký.
- PO No. là PK của bảng `PURCHASE_ORDERS` (`PO_NO`), nếu đăng ký trùng thì trả về 409 ConflictException.

## Hành vi sửa hạng mục (khi lưu sửa)

Khi lưu sửa, hạng mục (PURCHASE_ORDER_ITEMS) được xử lý theo cách **xóa toàn bộ cũ → chèn lại** (bảo vệ giao dịch). `SEQ` được cấp lại (0-based index + 1). `RECEIVED_QTY` có thể bị khởi tạo lại trong quá trình này, vì vậy tránh sửa hạng mục của PO đã nhập một phần.

## Tính tổng tiền

Tổng tiền (`TOTAL_AMOUNT`) được service layer tính như sau tại thời điểm lưu:

```
TOTAL_AMOUNT = Σ (ORDER_QTY × UNIT_PRICE)
```

`UNIT_PRICE` null thì xử lý là 0. Tổng tiền ghi vào `PURCHASE_ORDERS.TOTAL_AMOUNT` sau lưu, không tính lại thời gian thực.

## Thiết lập trước (Master·Mã chung)

- Mã chung `PO_STATUS`: DRAFT / CONFIRMED / PARTIAL / RECEIVED / CLOSED — `attr1`(CSS class) của mỗi code kiểm soát màu badge danh sách
- Master nhà cung cấp (`PARTNER_MASTERS`): Chỉ chọn được loại `partnerType='SUPPLIER'`
- Master hạng mục (`ITEM_MASTERS`): Modal thêm hạng mục chỉ tìm kiếm được loại `itemType='RAW_MATERIAL'`

## Quy trình vận hành

1. **Đăng ký PO**: Chọn nhà cung cấp → đặt ngày đặt hàng/ngày giao → thêm hạng mục (có thể chọn nhiều) → nhập số lượng đặt → lưu (DRAFT)
2. **Xác nhận đơn hàng**: Từ DRAFT PO, thao tác xác nhận → CONFIRMED (trạng thái có thể nhập hàng)
3. **Liên kết nhập hàng**: Tại màn hình Quản lý nhập hàng, xử lý nhập theo số PO → cập nhật RECEIVED_QTY → tự động chuyển trạng thái
4. **Kết thúc**: Sau khi tất cả nhập hoàn tất, kết thúc thủ công (CLOSED)

## Phân quyền

- **Đăng ký·sửa·xóa**: Nhân viên quản lý vật tư (chỉ DRAFT)
- **Xác nhận·kết thúc**: Nhân viên quản lý vật tư hoặc người phê duyệt mua hàng
- **Tra cứu**: Tất cả người dùng

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Lưu PO "Số PO đã tồn tại"(409) | `PO_NO` trùng | Dùng số đã tự động đánh số hoặc đổi số khác |
| Nhập số lượng đặt 0 hoặc số thập phân bị chặn | Kiểm tra `ORDER_QTY` (số nguyên từ 1) | Sửa thành số nguyên từ 1 trở lên rồi lưu |
| Không xóa được PO "PO đã có nhập hàng" | Có lịch sử nhập `MAT_ARRIVALS` với `PO_NO` đó | Hủy/xóa lịch sử nhập trước rồi xóa PO |
| Không xóa được PO "Chỉ xóa được DRAFT" | `STATUS != 'DRAFT'` | Can thiệp DB trực tiếp hoặc khôi phục trạng thái theo quy trình |
| Tổng tiền hiển thị 0 | Chưa nhập `UNIT_PRICE` | Đăng ký đơn giá hạng mục (API hoặc DB trực tiếp) |
| Không thấy tên·quy cách hạng mục trong danh sách | `ITEM_MASTERS` không có `ITEM_CODE` đó | Kiểm tra đăng ký hạng mục đó trong master hạng mục |
| Sau sửa, số lượng nhập (RECEIVED_QTY) bị khởi tạo lại 0 | Hành vi xóa toàn bộ·chèn lại hạng mục khi lưu sửa | Không sửa hạng mục PO đã có nhập hàng; nếu cần, hiệu chỉnh DB trực tiếp |

## Dữ liệu & Liên kết

- Bảng: `PURCHASE_ORDERS`, `PURCHASE_ORDER_ITEMS`
- Liên kết: `PARTNER_MASTERS`(nhà cung cấp), `ITEM_MASTERS`(hạng mục), `MAT_ARRIVALS`(xử lý nhập)
- API: `GET|POST /material/purchase-orders`, `GET|PUT|DELETE /material/purchase-orders/:id`, `PATCH /material/purchase-orders/:id/confirm`, `PATCH /material/purchase-orders/:id/close`
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'` (tự động áp dụng mọi truy vấn·lưu)
