---
menuCode: PUR_PO
audience: user
title: Quản lý PO
summary: Màn hình đăng ký và quản lý đơn đặt hàng (PO) gửi đến nhà cung cấp. Nhập số PO, khách hàng, ngày đặt, ngày giao và số lượng theo mặt hàng, quản lý trạng thái từ xác nhận đến kết thúc
tags: [quản lý vật tư, đơn đặt hàng, PO, đặt hàng]
keywords: [số PO, số đặt hàng, khách hàng, nhà cung cấp, ngày đặt, ngày giao, số lượng đặt, số lượng nhập, đơn giá, tổng tiền, số mặt hàng, số dòng, số phát hành, DRAFT, CONFIRMED, PARTIAL, RECEIVED, CLOSED, xác nhận, kết thúc, nhập một phần, nhập hoàn thành]
related: [PUR_PO_STATUS, MAT_RECEIVE, MST_PART]
---

# Quản lý PO

## Mục đích màn hình
Màn hình đăng ký, tra cứu, sửa, xóa **Đơn đặt hàng (PO)** gửi đến nhà cung cấp (SUPPLIER) để đặt nguyên vật liệu, v.v. Chỉ khi PO được xác nhận (CONFIRMED) mới tiến triển sang bước hàng đến và kiểm tra nhập, và kết thúc (CLOSED) khi tất cả mặt hàng đã nhập kho hoàn thành.

## Bố cục màn hình
- **Bên trái (Grid danh sách PO)**: Tra cứu PO đã đăng ký dưới dạng bảng. Phía trên có thể tìm kiếm tổng hợp theo số PO, khách hàng, mặt hàng, hoặc lọc theo khoảng ngày đặt, trạng thái.
- **Bên phải (Bảng đăng ký/sửa)**: Mở trượt từ bên phải khi click nút **Đăng ký** hoặc ✏️ trên hàng. Nhập thông tin header PO và danh sách mặt hàng cùng nhau.

---

## ① Cột Danh sách PO

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **PO No.(poNo)** | Số duy nhất nhận dạng đơn đặt hàng. Tự động đánh số khi đăng ký (định dạng `PO-YYYYMMDD-NNN`), không thể thay đổi sau khi tạo. |
| **Khách hàng(partnerName)** | Tên nhà cung cấp đối tượng đặt hàng. Chọn từ loại SUPPLIER trong master khách hàng. |
| **Ngày đặt(orderDate)** | Ngày phát hành PO. Mặc định là hôm nay (khi đăng ký). |
| **Ngày giao(dueDate)** | Hạn yêu cầu giao hàng. Là tiêu chí đánh giá tỷ lệ tuân thủ giao hàng trong quản lý hàng đến. |
| **Số mặt hàng(itemCount)** | Số dòng mặt hàng đặt trong PO này. |
| **Tổng tiền(totalAmount)** | Tổng (số lượng đặt × đơn giá) theo mặt hàng. Nếu không nhập đơn giá, tính là 0. |
| **Trạng thái(status)** | Trạng thái tiến triển hiện tại của PO (tham khảo luồng trạng thái bên dưới). |

### Luồng trạng thái

```
DRAFT(Đăng ký tạm thời)
    ↓ Xác nhận
CONFIRMED(Đặt hàng xác nhận)
    ↓ Nhập một phần
PARTIAL(Nhập một phần)
    ↓ Nhập toàn bộ
RECEIVED(Nhập hoàn thành)
    ↓ Kết thúc
CLOSED(Kết thúc)
```

> **Chỉ có thể sửa·xóa khi DRAFT.** Sau CONFIRMED, trạng thái tự động thay đổi trong quá trình hàng đến.

---

## ② Trường nhập Header PO

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **PO No.(poNo)** | Tự động đánh số khi đăng ký (`PO-YYYYMMDD-NNN`). Có thể sửa trực tiếp nhưng không được trùng lặp. Không thể thay đổi khi sửa (khóa). |
| **Khách hàng(partnerName)** | Chọn nhà cung cấp sẽ đặt hàng. Chỉ hiển thị khách hàng loại SUPPLIER trong danh sách chọn. |
| **Ngày đặt(orderDate)** | Ngày phát hành PO. Mặc định là hôm nay. |
| **Ngày giao(dueDate)** | Ngày yêu cầu giao hàng. Có thể để trống, nhưng khuyến nghị nhập để quản lý lịch hàng đến. |
| **Ghi chú(remark)** | Ghi chú cho toàn bộ PO (điểm đặc biệt, số hợp đồng tham chiếu, v.v.). |

---

## ③ Trường nhập Mặt hàng Đặt hàng

Nhấn nút thêm mặt hàng để mở modal tìm kiếm mặt hàng. Có thể chọn nhiều mặt hàng cùng lúc (hỗ trợ chọn nhiều). Mã mặt hàng đã thêm không được thêm trùng lặp.

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng(itemCode)** | Mã MES của mặt hàng sẽ đặt. Tự động điền khi chọn từ modal tìm kiếm mặt hàng. |
| **Tên mặt hàng(itemName)** | Tên của mặt hàng đã chọn (tự động hiển thị). |
| **Số dòng(lineNo)** | Số thứ tự hàng mặt hàng trong PO này. Mặc định tự động gán theo thứ tự thêm. |
| **Số phát hành(revNo)** | Số lần đặt của cùng mặt hàng. Phân biệt khi chia cùng mặt hàng với ngày giao khác nhau trong cùng PO. Mặc định là 1. |
| **Số lượng đặt(orderQty)** | Số lượng đặt trên dòng này. **Chỉ có thể nhập số nguyên từ 1 trở lên.** |
| **Ghi chú(remark)** | Ghi chú cho dòng mặt hàng đó. |

> Đơn giá (unitPrice) không hiển thị UI nhập trực tiếp trên màn hình hiện tại. Nếu cần, hãy liên hệ quản lý viên. Tổng tiền được tự động tính khi có thông tin đơn giá.

---

## Tìm kiếm·Bộ lọc

| Bộ lọc | Hành động |
|------|------|
| **Tìm kiếm tổng hợp** | Nhập số PO hoặc tên khách hàng, tìm kiếm khớp một phần không phân biệt chữ hoa/thường. |
| **Khoảng ngày đặt** | Đặt khoảng thời gian tra cứu theo ngày đặt. Mặc định là hôm nay (trong ngày). |
| **Trạng thái** | Chỉ hiển thị PO ở trạng thái đã chọn. Nếu bỏ trống, tra cứu tất cả. |

---

## Trình tự thực hiện

1. Click nút **Đăng ký** ở góc phải trên để mở bảng đăng ký PO.
2. Chọn **Khách hàng** (loại SUPPLIER).
3. Nhập **Ngày đặt** và **Ngày giao**.
4. Nhấn nút **Thêm mặt hàng** để tìm kiếm và chọn mặt hàng sẽ đặt (có thể chọn nhiều).
5. Nhập **Số lượng đặt** cho từng mặt hàng (bắt buộc số nguyên từ 1 trở lên).
6. Nhấn nút **Đăng ký** để lưu. Số PO được tự động đánh số và tạo với trạng thái DRAFT.
7. Khi nội dung đặt hàng đã xác nhận, mở PO đó trong grid và chuyển trạng thái sang **Xác nhận (CONFIRMED)**.
8. Xử lý nhập kho tại màn hình **Quản lý Hàng đến**.

---

## Quy tắc nhập / Kiểm tra

- **PO No.**: Bắt buộc. Không được trùng lặp.
- **Khách hàng**: Bắt buộc.
- **Mặt hàng đặt**: Bắt buộc từ 1 mặt hàng trở lên.
- **Số lượng đặt**: Bắt buộc là số nguyên từ 1 trở lên. Chặn lưu nếu nhập số thập phân, 0, số âm.
- **Điều kiện xóa**: Phải ở trạng thái DRAFT và chưa có lịch sử hàng đến.

---

## Câu hỏi thường gặp

- **H.** Tôi muốn tự chỉ định số PO.
  **Đ.** Có thể sửa trực tiếp số đã tự động đánh số. Tuy nhiên, nếu trùng lặp, việc lưu sẽ bị chặn.

- **H.** Tôi muốn sửa lại PO đã xác nhận.
  **Đ.** Không thể sửa trực tiếp trên màn hình sau CONFIRMED. Hãy liên hệ quản lý viên về quy trình quay lại DRAFT.

- **H.** Không thể xóa PO.
  **Đ.** Chỉ có thể xóa khi ở trạng thái DRAFT và chưa có lịch sử hàng đến. Nếu sau CONFIRMED hoặc đã có hàng đến dù một phần, việc xóa bị chặn.

- **H.** Tổng tiền hiển thị là 0.
  **Đ.** Nếu đơn giá chưa được nhập, tổng tiền tính là 0. Việc đăng ký đơn giá cần cài đặt của quản lý viên.

- **H.** Có thể thêm cùng mặt hàng hai lần trong cùng PO không?
  **Đ.** Cùng mã mặt hàng chỉ được thêm một lần. Nếu cần khác ngày giao hoặc số lần, hãy phân biệt số phát hành hoặc tạo PO riêng.

---

## Màn hình liên quan
- [Tình trạng PO](/material/po-status) — Tra cứu tiến trình nhập kho theo PO
- [Quản lý Hàng đến](/material/receive) — Xử lý nhập kho và liên kết kiểm tra nhập
- [Master Mặt hàng](/master/part) — Đăng ký mặt hàng có thể đặt hàng
