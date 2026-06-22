---
menuCode: MAT_ARRIVAL
audience: user
title: Quản lý Hàng đến
summary: Màn hình đăng ký hàng đến theo từng dòng PO (Đơn đặt hàng), cấp số sê-ri LOT vật tư và in nhãn
tags: [vật tư, hàng đến, PO, LOT, sê-ri, nhãn]
keywords: [hàng đến, đơn đặt hàng, số PO, số dòng, số dư, số lượng đến, nhà sản xuất, kho, sê-ri, LOT, UID vật tư, matUid, số hàng đến, arrivalNo, hàng đến thủ công, in nhãn, IQC, kiểm tra nhập, giao hàng, khách hàng]
related: [PUR_PO, QC_IQC, MAT_ARRIVAL_RESULT, MAT_ARRIVAL_TRANSACTION, INV_ARRIVAL_STOCK]
---

# Quản lý Hàng đến

## Mục đích màn hình
Màn hình **đăng ký hàng đến** khi mặt hàng đã đặt trong PO thực tế được giao. Ghi nhận số lượng đến theo từng dòng, số sê-ri LOT vật tư được đánh tự động và in nhãn LOT để dán tại hiện trường. Vật tư đến chuyển sang trạng thái chờ kiểm tra nhập (IQC).

> Hàng đến = bước xác nhận giao hàng. Nhập kho (phản ánh tồn kho) được xử lý riêng sau khi IQC đạt.

## Sơ đồ luồng
```
PO xác nhận → Xác nhận giao hàng tại Quản lý Hàng đến (màn hình này)
  → Cấp số sê-ri LOT tự động + In nhãn
  → Chờ IQC (PENDING)
  → IQC đạt → Tồn kho đến → Nhập kho (tồn kho vật tư hiện tại)
```

## Bố cục màn hình
- **Grid chính (danh sách dòng PO)**: Hiển thị tất cả dòng PO có thể đăng ký hàng đến. Phía trên có bộ lọc trạng thái, tìm kiếm mã mặt hàng, số PO.
- **Nút Hàng đến vật tư (click ô hoặc hàng)**: Mở modal đăng ký hàng đến cho dòng đó.
- **Nút Hàng đến thủ công (góc phải trên)**: Đăng ký hàng đến trực tiếp với mặt hàng/số lượng, không cần PO.
- **Chọn template nhãn (góc phải trên)**: Chọn trước template dùng để in nhãn.

---

## ① Cột Grid Dòng PO

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **(Hành động)** | Nút **Hàng đến vật tư**. Vô hiệu nếu số dư bằng 0 hoặc trạng thái CLOSE. |
| **Số PO(poNo)** | Số đơn đặt hàng (PO). Chỉ PO ở trạng thái CONFIRMED từ Quản lý Đặt hàng mới hiển thị trong danh sách. |
| **L/N(lineNo)** | Số dòng của đơn đặt hàng. Phân biệt từng mặt hàng khi một PO có nhiều mặt hàng. |
| **R/N(revNo)** | Số sửa đổi (Revision Number) của dòng. Phân biệt lịch sử sửa đổi cùng dòng. |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng nội bộ MES của vật tư. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng vật tư. |
| **Số lượng đặt(orderQty)** | Tổng số lượng đặt hàng ghi trên PO. |
| **Đã đến tích lũy(receivedQty)** | Tổng số lượng hàng đến đã đăng ký cho dòng này cho đến nay. |
| **Số dư(remainingQty)** | Số lượng chưa đến (số lượng đặt − đã đến tích lũy). Hiển thị bằng chữ xanh đậm. |
| **Ngày đặt(orderDate)** | Ngày lập PO. |
| **Khách hàng(partnerName)** | Tên nhà cung cấp (khách hàng) giao hàng. |
| **Loại sử dụng(useType)** | Phân loại mục đích sử dụng của PO (ví dụ: sản xuất PROD, phi sản xuất, v.v.). Theo mã chung `PO_USE_TYPE`. |
| **Trạng thái(lineStatus)** | Trạng thái tiến trình hàng đến của dòng. `OPEN`(chưa đến) / `PARTIAL`(đến một phần, nền vàng) / `CLOSE`(hoàn thành, nền xám·vô hiệu). |

> Ý nghĩa màu nền hàng: trắng=chưa đến, vàng=đến một phần, xanh=số dư 0 (trước CLOSE), xám=CLOSE (hàng đến hoàn thành).

---

## ② Modal Đăng ký Hàng đến (khi click Hàng đến vật tư)

Nhập thông tin hàng đến cho dòng PO đã chọn.

| Mục nhập | Vai trò / Ý nghĩa |
|------|------|
| **Thông tin PO (tóm tắt phía trên)** | Hiển thị tóm tắt số PO / số L / số R, mã mặt hàng, tên mặt hàng, khách hàng đã chọn (chỉ đọc). |
| **Đã đến tích lũy / Số lượng đặt / Số dư** | Tóm tắt tình trạng hàng đến hiện tại (chỉ đọc). Số dư là giá trị tối đa có thể đến. |
| **Số lượng đến \*** | Số lượng thực tế nhận được lần này. Không thể vượt quá số dư. |
| **Ngày đến \*** | Ngày vật tư thực tế đến. Mặc định là hôm nay, không thể nhập ngày trong tương lai. |
| **Nhà sản xuất \*** | Công ty thực tế sản xuất vật tư. Chọn từ loại nhà sản xuất (MFG) trong `PARTNER_MASTERS`. Được in trên nhãn. |
| **Kho \*** | Kho nguyên vật liệu để đặt vật tư đến. Chỉ có thể chọn kho loại nguyên vật liệu (RAW). |
| **Đơn vị cấu thành sê-ri(lotUnitQty)** | Đơn vị cấu thành LOT đã đăng ký trong master mặt hàng (số lượng trong một sê-ri). Chỉ đọc. Nếu chưa đặt, hiển thị "1 LOT". |
| **Số sê-ri dự kiến** | Số sê-ri sẽ được cấp, tự động tính bằng số lượng đến ÷ đơn vị cấu thành sê-ri. Chỉ để tham khảo, không thể sửa. |
| **Ghi chú** | Nhập ghi chú hàng đến tự do (tùy chọn). |

Sau khi lưu, modal **Xác nhận cuối cùng cấp sê-ri** sẽ xuất hiện. Xác nhận sẽ đăng ký lên server và mở **modal Xem trước nhãn**.

---

## ③ Modal Xem trước Nhãn (sau khi đăng ký hàng đến thành công)

Xem trước nhãn sê-ri LOT vật tư đã được cấp.

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Chọn template nhãn** | Chọn thiết kế nhãn để in. Template đã chọn trước ở góc phải trên được áp dụng mặc định. |
| **Khu vực xem trước nhãn** | Nhãn được hiển thị theo số lượng sê-ri đã cấp. Mỗi nhãn in UID vật tư, mã mặt hàng, tên mặt hàng, số lượng, nhà sản xuất, số hàng đến, ngày đến, v.v. |
| **In nhãn (nút in)** | Gửi đến máy in nhãn qua Print Agent cục bộ. |

---

## ④ Modal Hàng đến Thủ công (hàng đến không có PO)

Sử dụng trong trường hợp ngoại lệ như giao hàng khẩn cấp không có PO, điều chỉnh tồn kho, v.v.

| Mục nhập | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng \*** | Chọn vật tư đến thông qua tìm kiếm mặt hàng. |
| **Kho \*** | Kho để đặt vật tư đến. |
| **Số lượng \*** | Số lượng hàng đến. |
| **UID nhà cung cấp(supUid)** | Số sê-ri vật tư do nhà cung cấp tự gán (tùy chọn). |
| **Ngày sản xuất(manufactureDate)** | Ngày sản xuất (sản xuất) vật tư (tùy chọn). |
| **Khách hàng(vendor)** | Nhà cung cấp giao hàng (tùy chọn). Chọn từ khách hàng loại `SUPPLIER`. |
| **Ghi chú** | Lý do/ghi chú hàng đến (tùy chọn). |

---

## Trình tự thực hiện

**Hàng đến dựa trên PO (thông thường)**
1. Sử dụng tìm kiếm phía trên để tìm dòng mong muốn theo mã mặt hàng hoặc số PO.
2. Kiểm tra bộ lọc trạng thái có `OPEN` / `PARTIAL` được chọn không.
3. Click nút **Hàng đến vật tư** trên dòng đó.
4. Nhập số lượng đến, ngày đến, nhà sản xuất, kho và click **Lưu**.
5. Kiểm tra số sê-ri dự kiến và click **Xác nhận**.
6. Kiểm tra nội dung nhãn trong xem trước và **In nhãn**.
7. Dán nhãn đã in lên thùng vật tư.

**Hàng đến khẩn cấp không có PO**
1. Click nút **Hàng đến thủ công** ở góc phải trên.
2. Nhập mặt hàng, kho, số lượng (bắt buộc) và **Đăng ký**.

---

## Quy tắc nhập / Kiểm tra

- Số lượng đến phải từ 1 trở lên và không được vượt quá số dư.
- Ngày đến chỉ cho phép ngày trước hoặc bằng hôm nay.
- Nhà sản xuất và kho là các mục bắt buộc.
- Dòng ở trạng thái CLOSE hoặc số dư bằng 0 thì nút **Hàng đến vật tư** bị vô hiệu.

---

## Câu hỏi thường gặp

- **H.** Có dòng số dư bằng 0 nhưng chưa CLOSE.
  **Đ.** Đó là trường hợp PO chưa được xử lý CLOSE mặc dù số dư bằng 0. Nút hàng đến vật tư bị vô hiệu nên không thể đến thêm.

- **H.** Đơn vị cấu thành sê-ri trống (1 LOT).
  **Đ.** Đó là trường hợp đơn vị cấu thành LOT (lotUnitQty) chưa được đặt trong master mặt hàng. Trong trường hợp này, toàn bộ số lượng đến được cấp thành 1 sê-ri.

- **H.** Kiểm tra IQC sau khi hàng đến ở đâu?
  **Đ.** Sau khi đăng ký hoàn tất tại Quản lý Hàng đến, tiến hành kiểm tra theo LOT tại màn hình [Kiểm tra Nhập (IQC)].

- **H.** Tôi đã đăng ký hàng đến sai. Có thể hủy không?
  **Đ.** Nếu có quyền quản lý, bạn có thể hủy giao dịch hàng đến ở trạng thái DONE tại màn hình [Lịch sử Hàng đến/Sổ chi tiết]. Hủy được xử lý bằng phương pháp hạch toán đảo ngược, không phải xóa.

- **H.** Nhãn không in được.
  **Đ.** Kiểm tra xem Print Agent có đang chạy trên PC không. Nếu không có Agent, bạn có thể lưu nhãn thủ công từ màn hình xem trước nhãn và in.

---

## Màn hình liên quan
- [Quản lý Đặt hàng](/purchase/po) — Đăng ký PO và xử lý CONFIRMED
- [Kiểm tra Nhập (IQC)](/quality/iqc) — Kiểm tra nhập LOT đã đến
- [Kết quả Hàng đến/Sổ chi tiết](/material/arrival-result) — Lịch sử hàng đến và hủy
- [Tồn kho Hàng đến](/material/arrival-stock) — Tình trạng tồn kho hàng đến đang chờ IQC
