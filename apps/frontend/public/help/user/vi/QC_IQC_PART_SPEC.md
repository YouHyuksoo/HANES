---
menuCode: QC_IQC_PART_SPEC
audience: user
title: Quản lý Mục IQC theo Mặt hàng
summary: Màn hình đăng ký và quản lý mục kiểm tra, thông số kỹ thuật (LSL/USL·tiêu chí đánh giá), cấp độ lỗi, phương thức lấy mẫu cho Kiểm tra Nhập (IQC) theo từng mặt hàng vật tư
tags: [chất lượng, IQC, kiểm tra nhập, mục kiểm tra, thông tin cơ bản]
keywords: [kiểm tra theo mặt hàng, mục kiểm tra, phiếu tiêu chuẩn kiểm tra, số lượng mẫu, cỡ mẫu, kiểm tra phá hủy, không phá hủy, LSL, USL, giới hạn dưới, giới hạn trên, tiêu chí đánh giá, cấp độ lỗi, mức kiểm tra, AQL, loại kiểm tra, đo lường, đánh giá, kiểm tra 100%, mẫu cố định, template]
related: [QC_IQC_ITEM, QC_AQL, MST_PART, QC_IQC]
---

# Quản lý Mục IQC theo Mặt hàng

## Mục đích màn hình
Màn hình xác định **sẽ kiểm tra cái gì khi Kiểm tra Nhập (IQC)** cho từng mặt hàng vật tư (nguyên vật liệu).
Sau khi chọn mặt hàng, đăng ký **mục kiểm tra** (ví dụ: ngoại quan, kích thước, độ bền kéo) sẽ áp dụng và **thông số kỹ thuật** (giới hạn trên/dưới, tiêu chí đánh giá), **cấp độ lỗi**, **phương thức lấy mẫu** cho từng mục. Nội dung đã đăng ký sẽ được mở ra nguyên vẹn dưới dạng phiếu kiểm tra trong màn hình kiểm tra nhập thực tế.

> Bản thân mục kiểm tra (tên, phương pháp đánh giá, đơn vị) được đăng ký trước tại [Pool Mục Kiểm tra]. Màn hình này làm nhiệm vụ **gắn các mục đó vào mặt hàng và điền thông số kỹ thuật**.

## Bố cục màn hình
- **Bên trái — Danh sách mặt hàng vật tư**: Danh sách mặt hàng nguyên vật liệu (RAW_MATERIAL). Tìm kiếm theo mã mặt hàng·tên mặt hàng, mặt hàng đã đăng ký mục kiểm tra hiển thị **badge số lượng** ở bên phải.
- **Bên phải trên — Tiêu chuẩn AQL (tóm tắt)**: Thẻ **chỉ đọc** hiển thị trước cỡ mẫu, Ac/Re được tính từ chính sách AQL kết nối với mặt hàng đã chọn (dựa trên chính sách đã kết nối trong Master Mặt hàng).
- **Bên phải dưới — Mục kiểm tra**: Khu vực thêm, sửa, xóa mục kiểm tra của mặt hàng đó dưới dạng bảng và [Lưu]. Thanh công cụ phía trên cũng thiết lập **Số lượng mẫu cơ bản**·**Có kiểm tra phá hủy không**.

## ① Danh sách Mặt hàng Vật tư (Bên trái)

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng / Tên mặt hàng** | Mặt hàng nguyên vật liệu để thiết lập tiêu chuẩn kiểm tra. Click để hiển thị mục kiểm tra của mặt hàng đó ở bên phải. |
| **Badge số lượng** | **Số mục kiểm tra** đã đăng ký cho mặt hàng đó. Nếu là 0 thì không có badge (chưa thiết lập), nếu có số thì là mặt hàng đã có tiêu chuẩn. |
| **Tìm kiếm** | Lọc danh sách theo mã mặt hàng hoặc tên mặt hàng. |

## ② Thẻ Tóm tắt Tiêu chuẩn AQL (Bên phải trên, chỉ đọc)
Thẻ này không phải ô nhập mà là **tóm tắt tham khảo**. Giá trị được tự động tính từ **Chính sách AQL** kết nối với mặt hàng tại [Master Mặt hàng] và cài đặt tại [Quản lý Tiêu chuẩn AQL].

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Xem trước Số lượng LOT** | Nhập giả định số lượng LOT nhập kho để xem trước cỡ mẫu, Ac/Re dưới đây sẽ được xác định thế nào. |
| **Chính sách AQL** | Mã chính sách AQL đã kết nối với mặt hàng này trong Master Mặt hàng. Nếu trống, đánh giá tự động AQL không được áp dụng. |
| **Số lượng mẫu cơ bản** | Số lượng mẫu cơ bản được thiết lập trong header tiêu chuẩn kiểm tra của mặt hàng này (giống giá trị trên thanh công cụ dưới). |
| **Mức kiểm tra** | Mức kiểm tra của chính sách AQL (thường II). Kết hợp với kích thước LOT để xác định cỡ mẫu. |
| **Số lượng mẫu** | Số lượng mẫu được tính dựa trên số lượng LOT ở trên. |
| **Major Ac/Re** | Số chấp nhận (Ac)·không chấp nhận (Re) đánh giá cho lỗi lớn. |
| **Minor Ac/Re** | Số chấp nhận·không chấp nhận đánh giá cho lỗi nhẹ. |
| **Tiêu chuẩn mục kiểm tra** | Số lượng mục kiểm tra đã đăng ký cho mặt hàng này. |
| **Phá hủy/Cố định** | Số lượng mục kiểm tra sử dụng cỡ mẫu riêng như **kiểm tra phá hủy·kiểm tra 100%·mẫu cố định**. |

## ③ Header Mục Kiểm tra (Thanh công cụ bên phải dưới)

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Số lượng mẫu cơ bản** | Số lượng mẫu cơ bản lấy khi kiểm tra mặt hàng này (giá trị mặc định nếu không chỉ định cỡ mẫu cố định trong mục riêng lẻ). |
| **Kiểm tra phá hủy / Không phá hủy** | Có phá hủy mẫu khi kiểm tra mặt hàng này không. Nếu để `Phá hủy`, biểu thị mẫu không thể sử dụng sau kiểm tra. |
| **Tải Template / Quản lý** | Lưu nhóm mục kiểm tra thường dùng dưới dạng template và áp dụng cho mặt hàng mới cùng lúc. |
| **Thêm mục** | Thêm một dòng mục kiểm tra và vào chế độ chỉnh sửa ngay lập tức. |
| **Lưu** | Lưu toàn bộ header và mục kiểm tra đã thay đổi. Vô hiệu nếu không có thay đổi. |

## ④ Cột Mục Kiểm tra

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Thứ tự(seq)** | Thứ tự hiển thị mục trên phiếu kiểm tra. Tự động đánh số lại khi thêm·xóa hàng. |
| **Mục kiểm tra(inspItemCode)** | Chọn một trong các mục đã đăng ký trong [Pool Mục Kiểm tra]. Khi chọn, loại·đơn vị tự động theo. |
| **Loại(judgeMethod)** | Phương pháp đánh giá mục. **Đo lường (MEASURE)** = đo số và so sánh với giới hạn trên/dưới, **Đánh giá (VISUAL)** = xác nhận bằng mắt như tốt/xấu. Chỉ nhập LSL/USL khi là Đo lường. |
| **Loại kiểm tra(inspectionType)** | Phương thức xác định mẫu. `AQL`=tự động tính theo bảng AQL, `DESTRUCTIVE`=kiểm tra phá hủy, `FULL`=kiểm tra 100%. Nếu không phải AQL, nhập trực tiếp **cỡ mẫu**. |
| **Cỡ mẫu(sampleQty)** | **Số lượng mẫu cố định** sẽ kiểm tra cho loại phá hủy/100%/cố định. Nếu là loại AQL, hiển thị `Tự động` và không nhập. |
| **Cấp độ lỗi(defectGrade)** | Mức độ nghiêm trọng của lỗi mục này. `CRITICAL` (nghiêm trọng)·`MAJOR` (lớn)·`MINOR` (nhẹ). Ac/Re được áp dụng khác nhau theo cấp độ trong đánh giá AQL. |
| **Mức kiểm tra(inspectionLevel)** | Mức kiểm tra ISO 2859-1 (II, S4, v.v.) áp dụng cho mục này. Dùng để xác định cỡ mẫu. |
| **AQL** | Giá trị giới hạn chất lượng chấp nhận (0.65/1.0/2.5, v.v.) áp dụng cho mục này. **Càng nhỏ càng nghiêm ngặt.** |
| **Giới hạn dưới (LSL)** | **Giá trị tối thiểu cho phép** của mục đo lường. Nếu giá trị đo nhỏ hơn giá trị này là lỗi. |
| **Giới hạn trên (USL)** | **Giá trị tối đa cho phép** của mục đo lường. Nếu giá trị đo lớn hơn giá trị này là lỗi. |
| **Tiêu chí đánh giá(judgeCriteria)** | Văn bản tiêu chuẩn phân biệt đạt/không đạt cho mục đánh giá, v.v. (ví dụ: "Không có vết xước, dị vật"). |
| **Đơn vị(unit)** | Đơn vị của giá trị đo. Theo từ pool mục kiểm tra, chỉ để hiển thị. |

> Ví dụ: Đặt mục `Kích thước` là đo lường, LSL=9.8, USL=10.2 → nếu giá trị đo ngoài phạm vi 9.8~10.2 (mm) thì đánh giá là lỗi.

## Trình tự thực hiện
1. **Chọn mặt hàng** để thiết lập tiêu chuẩn kiểm tra ở bên trái.
2. Thiết lập **Số lượng mẫu cơ bản** và **Có kiểm tra phá hủy không** trên thanh công cụ.
3. **[Thêm mục]** (hoặc **[Tải Template]**) để đưa mục kiểm tra vào, điền loại, loại kiểm tra, cấp độ lỗi, thông số kỹ thuật cho từng hàng.
4. Với mục đo lường, nhập **Giới hạn dưới (LSL)·Giới hạn trên (USL)**; với mục đánh giá, nhập **Tiêu chí đánh giá**.
5. Chỉnh sửa từng hàng bằng **[Sửa]→[Xác nhận]** và cuối cùng **[Lưu]**.

## Quy tắc nhập / Kiểm tra
- **Hàng có Mục kiểm tra (inspItemCode) trống không được lưu** (hàng trống tự động loại).
- Mục không phải đo lường không thể nhập LSL/USL (quản lý bằng tiêu chí đánh giá).
- Nếu loại kiểm tra là `AQL`, cỡ mẫu được tự động tính và không nhập trực tiếp.
- Chỉ có thể chỉnh sửa một hàng tại một thời điểm, trong khi chỉnh sửa, sửa·xóa hàng khác bị khóa.

## Câu hỏi thường gặp
- **H.** Không thấy mục mong muốn trong danh sách chọn mục kiểm tra.
  **Đ.** Phải đăng ký trước (sử dụng `Y`) tại [Pool Mục Kiểm tra] mới có thể chọn trên màn hình này.
- **H.** Có thể thay đổi giá trị trên thẻ tóm tắt tiêu chuẩn AQL ở đây không?
  **Đ.** Không. Giá trị đó là thông tin tham khảo chỉ đọc được xác định từ kết nối chính sách AQL trong [Master Mặt hàng] và cài đặt tại [Quản lý Tiêu chuẩn AQL].
- **H.** Mỗi lần đều phải nhập cùng mục rất phiền.
  **Đ.** Sử dụng [Tải Template / Quản lý] để lưu nhóm mục và áp dụng cho mặt hàng mới cùng lúc.

## Màn hình liên quan
- [Pool Mục Kiểm tra](/master/iqc-item) — Nơi đăng ký trước mục kiểm tra (tên·phương pháp đánh giá·đơn vị)
- [Quản lý Tiêu chuẩn AQL](/quality/aql) — Nơi định nghĩa chính sách AQL, tiêu chuẩn, tiêu chí đánh giá LOT
- [Master Mặt hàng](/master/part) — Nơi kết nối chính sách AQL với mặt hàng
- [Kiểm tra Nhập (IQC)](/material/iqc) — Nơi kiểm tra thực tế bằng mục kiểm tra đã đăng ký ở đây
