---
menuCode: QC_REQUEST_INSPECT
audience: user
title: Nhập Kiểm tra Ủy quyền
summary: Màn hình nhập giá trị đo và đánh giá đạt/không đạt cho các mục kiểm tra ủy quyền (DELEGATE) đang chờ mà công nhân kiosk không tự đánh giá mà chuyển cho nhân viên chất lượng
tags: [chất lượng, kiểm tra tự động, kiểm tra ủy quyền, DELEGATE, kiểm tra công đoạn]
keywords: [kiểm tra ủy quyền, kiểm tra tự động, kiểm tra tự động, kiểm tra ủy thác, DELEGATE, giá trị đo, LSL, USL, thông số kỹ thuật, đầu ca, giữa ca, cuối ca, đạt, không đạt, PASS, FAIL, chờ, PENDING, thời điểm, lệnh sản xuất]
related: [QC_AQL]
---

# Nhập Kiểm tra Ủy quyền

## Mục đích màn hình
Khi công nhân tại kiosk sản xuất hiện trường **không thể tự đánh giá một số mục kiểm tra** (ví dụ: mục cần thiết bị đo·máy thử, kiểm tra phá hủy), họ **ủy quyền (DELEGATE)** cho nhân viên chất lượng thay vì tự nhập kết quả. Các mục kiểm tra này được chuyển đến màn hình này ở trạng thái "Chờ (PENDING)", và nhân viên chất lượng thực tế đo·xác nhận và đánh giá **đạt (PASS)/không đạt (FAIL)**.

> Kiểm tra tự động (tự chủ kiểm tra): Là kiểm tra công đoạn do công nhân hoặc người phụ trách thực hiện trực tiếp tại công đoạn sản xuất. Nếu phương pháp kiểm tra là **Trực tiếp (DIRECT)**, đánh giá ngay tại kiosk; nếu là **Ủy quyền (DELEGATE)**, chuyển đến màn hình này.

> Nếu kiểm tra ủy quyền từ kiosk vẫn ở **trạng thái Chờ (PENDING), việc nhập sản lượng sản xuất của lệnh sản xuất đó bị chặn**. Phải hoàn tất đánh giá trên màn hình này thì công nhân mới có thể tiếp tục nhập sản lượng.

## Bố cục màn hình
- **Bên trái — Danh sách chờ kiểm tra ủy quyền**: Hiển thị các mục kiểm tra ủy quyền chưa được đánh giá (PENDING) theo thứ tự yêu cầu (cũ nhất trước). Click hàng để mở khu vực nhập ở bên phải.
- **Bên phải — Nhập kết quả**: Xác nhận tiêu chuẩn kiểm tra (LSL/USL·đơn vị·tiêu chuẩn) của mục đã chọn, nhập giá trị đo·ghi chú, sau đó nhấn đạt/không đạt. Nếu chưa chọn, chỉ hiển thị hướng dẫn "Vui lòng chọn mục ở bên trái".

## Luồng xử lý
```
Kiosk kiểm tra tự động (mục kiểm tra ủy quyền) ──Ủy quyền──▶ Danh sách Chờ (PENDING) ──Đánh giá của nhân viên chất lượng──▶ Đạt (PASS)/Không đạt (FAIL)
                                                                          │
                                                                  Giải phóng chờ → Có thể nhập sản lượng kiosk
```

---

## ① Cột Danh sách Chờ

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Lệnh sản xuất(orderNo)** | Số lệnh sản xuất mà kiểm tra này phát sinh. Nhận dạng kiểm tra này thuộc lệnh sản xuất nào. |
| **Công đoạn(processCode)** | Mã công đoạn nơi kiểm tra xảy ra. Phân biệt kiểm tra ở bước công đoạn nào. |
| **Tên mục(itemName)** | Tên mục kiểm tra (ví dụ: ngoại quan, kích thước, lực ép, v.v.). Cho biết đang kiểm tra cái gì. |
| **Thời điểm(timing)** | Thời điểm kiểm tra trong sản xuất. **Đầu ca (FIRST)** = sản phẩm đầu tiên sau khi bắt đầu, **Giữa ca (MID)** = giữa công việc, **Cuối ca (LAST)** = khi kết thúc. Cùng công việc có thể có kiểm tra riêng theo từng thời điểm. |
| **Ngày·giờ yêu cầu(createdAt)** | Thời gian kiểm tra này được ủy quyền từ kiosk. Yêu cầu cũ hiển thị trên cùng để xử lý trước. |

---

## ② Khu vực Nhập Kết quả

Chọn hàng để hiển thị và nhập các mục sau cùng với thông tin mục.

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Tiêu chuẩn kiểm tra — LSL** | Giá trị giới hạn dưới của thông số kỹ thuật (Lower Spec Limit). Nếu giá trị đo **nhỏ hơn** giá trị này là không đạt thông số kỹ thuật. Chỉ hiển thị cho mục loại đo lường. |
| **Tiêu chuẩn kiểm tra — USL** | Giá trị giới hạn trên của thông số kỹ thuật (Upper Spec Limit). Nếu giá trị đo **lớn hơn** giá trị này là vượt quá thông số kỹ thuật. Khoảng LSL~USL là phạm vi bình thường. |
| **Đơn vị(unit)** | Đơn vị của giá trị đo (ví dụ: mm, N, kgf). Cho biết đo và nhập bằng đơn vị nào. |
| **Tiêu chuẩn/Thông số kỹ thuật(standard)** | Văn bản mô tả tiêu chuẩn kiểm tra đã thiết lập cho mục (tiêu chí đánh giá khi không có thông số kỹ thuật bằng số, v.v.). |
| **Giá trị đo(measureValue)** | Nhập giá trị thực tế đo được. Nhập tùy chọn, có thể để trống cho mục loại đánh giá (VISUAL). Nếu nhập, được ghi lại cùng kết quả kiểm tra. |
| **Ghi chú(remark)** | Ghi chú về điểm đặc biệt, lý do đánh giá, v.v. Nhập tùy chọn. |
| **Đạt (PASS)** | Xác nhận kết quả kiểm tra là **Đạt**. Được lưu cùng với giá trị đo và ghi chú đã nhập, và biến mất khỏi danh sách chờ. |
| **Không đạt (FAIL)** | Xác nhận kết quả kiểm tra là **Không đạt**. Sau khi xử lý không đạt, các biện pháp chất lượng tiếp theo (xử lý lỗi, v.v.) tuân theo quy trình riêng. |

> Với mục có tiêu chuẩn đánh giá được đặt bằng LSL/USL, thông thường giá trị đo được coi là đạt khi **≥ LSL và ≤ USL**. Tuy nhiên, vì đạt/không đạt trên màn hình này là **đánh giá thủ công** do người phụ trách trực tiếp nhấn, hãy tham khảo thông số kỹ thuật nhưng quyết định cuối cùng do người phụ trách đưa ra.

---

## Trình tự thực hiện
1. Click mục cần xử lý trong **danh sách Chờ** bên trái (yêu cầu cũ ở trên cùng).
2. Xác nhận **Tiêu chuẩn kiểm tra (LSL/USL·đơn vị)** ở bên phải.
3. Sau khi đo·xác nhận thực tế, nhập **giá trị đo** (nếu cần, viết **ghi chú**), nhấn **Đạt (PASS)** hoặc **Không đạt (FAIL)** theo kết quả.
4. Mục đã xử lý biến mất khỏi danh sách chờ và việc chặn nhập sản lượng sản xuất kiosk của lệnh sản xuất đó được giải phóng.
5. Nếu danh sách chưa cập nhật, nhấn **Làm mới** ở góc phải trên.

## Quy tắc nhập / Kiểm tra
- Phải chọn mục để kích hoạt nhập kết quả và nút đánh giá.
- Giá trị đo và ghi chú đều là **nhập tùy chọn**. Mục loại đánh giá (ngoại quan, v.v.) có thể chỉ nhấn đạt/không đạt mà không cần giá trị đo.
- Giá trị đo chỉ nhập số.

## Câu hỏi thường gặp
- **H.** Kiểm tra trực tiếp và kiểm tra ủy quyền khác nhau thế nào?
  **Đ.** Kiểm tra trực tiếp (DIRECT) là công nhân đánh giá ngay tại kiosk. Kiểm tra ủy quyền (DELEGATE) là công nhân không đánh giá mà chuyển cho nhân viên chất lượng, đánh giá trên màn hình này.
- **H.** Nếu không xử lý ở đây thì sao?
  **Đ.** Nếu còn kiểm tra ủy quyền Chờ (PENDING) cho lệnh sản xuất đó, việc nhập sản lượng sản xuất kiosk bị chặn. Cần đánh giá nhanh để sản xuất tiếp tục.
- **H.** Không thấy LSL/USL.
  **Đ.** Đó là trường hợp mục đó là loại đánh giá (VISUAL) hoặc chưa thiết lập thông số kỹ thuật (LSL/USL). Khi đó hiển thị "Mục loại đánh giá (không có thông số kỹ thuật)" hoặc "Chưa thiết lập thông số kỹ thuật", và người phụ trách đánh giá bằng mắt thường và tiêu chuẩn.

## Màn hình liên quan
- [Quản lý Tiêu chuẩn AQL](/quality/aql) — Tiêu chuẩn đạt/không đạt lấy mẫu cho Kiểm tra Nhập (IQC) (riêng với kiểm tra tự động công đoạn của màn hình này)
