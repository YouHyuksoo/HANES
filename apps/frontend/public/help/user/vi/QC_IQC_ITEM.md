---
menuCode: QC_IQC_ITEM
audience: user
title: Master Mục Kiểm tra
summary: Màn hình đăng ký và quản lý mục kiểm tra toàn cục sử dụng trong IQC (Kiểm tra Nhập). Định nghĩa mã mục, tên mục kiểm tra, phương pháp đánh giá, đơn vị
tags: [chất lượng, IQC, kiểm tra nhập, mục kiểm tra, thông tin cơ bản]
keywords: [mục kiểm tra, master mục kiểm tra, pool mục, pool mục kiểm tra, mã mục, phương pháp đánh giá, trực quan, đo lường, đo, VISUAL, MEASURE, đơn vị, kiểm tra nhập, IQC]
related: [QC_IQC_PART_SPEC, QC_IQC, QC_AQL]
---

# Master Mục Kiểm tra

## Mục đích màn hình
Màn hình đăng ký và quản lý tập trung **mục kiểm tra toàn cục** sử dụng trong Kiểm tra Nhập (IQC). Mục đã tạo ở đây đóng vai trò **pool mục chung** để chọn theo mặt hàng tại [Quản lý Mục IQC theo Mặt hàng](/master/iqc-part-spec). Tức là, không cần tạo mới cùng một mục kiểm tra (ví dụ: ngoại quan, kích thước) cho mỗi mặt hàng mà đăng ký một lần và tái sử dụng.

## Bố cục màn hình
- **Bên trái — Danh sách Mục Kiểm tra (grid)**: Hiển thị mục kiểm tra đã đăng ký dưới dạng bảng. Có tìm kiếm và bộ lọc phương pháp đánh giá.
- **Bên phải — Bảng Thêm/Sửa**: Mở trượt từ bên phải khi nhấn `Thêm mục kiểm tra` hoặc sửa (✎) trên hàng.

## ① Cột Danh sách Mục Kiểm tra (grid)

| Cột | Vai trò / Ý nghĩa |
|---|---|
| **Sửa / Xóa** | ✎ mở bảng sửa, 🗑 xóa (sau xác nhận). Thận trọng khi xóa mục đang được sử dụng ở màn hình khác. |
| **Mã mục(inspItemCode)** | Mã nhận dạng duy nhất của mục kiểm tra. Tiêu chuẩn theo mặt hàng tham chiếu mục này bằng mã. **Không thể thay đổi** sau khi đăng ký (khóa). |
| **Mục kiểm tra(inspItemName)** | Tên mục kiểm tra. Ví dụ: ngoại quan, kích thước, độ bền kéo, màu sắc. Tên mà người kiểm tra thực tế nhìn thấy. |
| **Phương pháp đánh giá(judgeMethod)** | Cách đánh giá kết quả kiểm tra. **Trực quan (VISUAL)** = đạt/không đạt bằng mắt, **Đo lường (MEASURE)** = so sánh giá trị đo với thông số kỹ thuật. Phân biệt bằng màu badge. |
| **Đơn vị(unit)** | Đơn vị đo của mục đo lường (mm, g, v.v.). Chọn từ mã chung `UNIT_TYPE`. Mục trực quan thường để trống. |

> Thanh công cụ phía trên: **Tìm kiếm** (mã·tên mục), **Bộ lọc phương pháp đánh giá** (trực quan/đo lường), **Làm mới**, **Thêm mục kiểm tra**.

## ② Cột Thêm / Sửa Mục Kiểm tra

Nhấn `Thêm mục kiểm tra` để hiển thị các mục nhập sau trong bảng bên phải.

| Cột | Vai trò / Ý nghĩa |
|---|---|
| **Mã mục** | Bắt buộc. Mã duy nhất của mục. **Khóa khi sửa, không thể thay đổi** (khóa). Chỉ nhập khi đăng ký mới. |
| **Phương pháp đánh giá** | Chọn bắt buộc. **Trực quan** hoặc **Đo lường**. Nếu chọn Đo lường, khuyến nghị chỉ định đơn vị cùng. |
| **Mục kiểm tra** | Bắt buộc. Tên mục kiểm tra. |
| **Đơn vị** | Tùy chọn. Chọn từ danh sách mã chung `UNIT_TYPE` (mm, g, kg, v.v.). Mục trực quan có thể để trống. |

## Trình tự thực hiện
1. Nhấn `Thêm mục kiểm tra`.
2. Nhập **Mã mục**·**Mục kiểm tra** và chọn **Phương pháp đánh giá**.
3. Nếu là mục đo lường, chọn **Đơn vị**.
4. Nhấn `Thêm` để lưu.
5. Mục đã đăng ký có thể kết nối với mặt hàng tại [Quản lý Mục IQC theo Mặt hàng](/master/iqc-part-spec) để thiết lập thông số kỹ thuật (giới hạn trên/dưới, tiêu chí đánh giá).

## Quy tắc nhập / Kiểm tra
- **Mã mục** và **Mục kiểm tra** là bắt buộc. Nếu thiếu dù chỉ một, nút lưu bị vô hiệu.
- **Mã mục không thể thay đổi sau khi đăng ký.** Nếu nhập sai, hãy xóa và đăng ký lại.
- Tìm kiếm theo **mã mục·tên mục kiểm tra** khớp một phần.

## Câu hỏi thường gặp
- **Tôi muốn thay đổi mã mục** — Mã là khóa nên không thể sửa. Xóa và đăng ký với mã mới (nếu đã kết nối với mặt hàng, cũng phải thiết lập lại kết nối).
- **Giới hạn dưới/trên (LSL/USL) và tiêu chí đánh giá nhập ở đâu?** — Màn hình này chỉ định nghĩa **mục chung**. Thông số kỹ thuật khác nhau theo mặt hàng, tiêu chí đánh giá, phương thức lấy mẫu được thiết lập theo mặt hàng tại [Quản lý Mục IQC theo Mặt hàng](/master/iqc-part-spec).
- **Sự khác biệt giữa Trực quan và Đo lường?** — Trực quan đánh giá đạt/không đạt bằng mắt (ví dụ: vết xước ngoại quan), Đo lường đo giá trị bằng thiết bị đo và so sánh với thông số kỹ thuật (ví dụ: kích thước mm).

## Màn hình liên quan
- [Quản lý Mục IQC theo Mặt hàng](/master/iqc-part-spec) — Chọn mục kiểm tra này cho từng mặt hàng và thiết lập thông số kỹ thuật
- [Kiểm tra Nhập (IQC)](/material/iqc) — Thực hiện kiểm tra nhập vật tư thực tế
- [Quản lý Tiêu chuẩn AQL](/quality/aql) — Tiêu chuẩn giới hạn chất lượng chấp nhận lấy mẫu
