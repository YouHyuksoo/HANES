---
menuCode: QC_IQC
audience: user
title: Kiểm tra Nhập (IQC)
summary: Màn hình Kiểm tra Nhập (IQC) kiểm tra chất lượng vật tư đến và đánh giá đạt/không đạt. Tra cứu danh sách chờ kiểm tra theo đơn vị số hàng đến + mặt hàng và đánh giá mục kiểm tra theo sê-ri
tags: [chất lượng, IQC, kiểm tra nhập, vật tư]
keywords: [kiểm tra nhập, chờ kiểm tra, kết quả kiểm tra, đạt, không đạt, PASS, FAIL, PENDING, IQC_IN_PROGRESS, PASSED, FAILED, số hàng đến, sê-ri, quét, mục kiểm tra, giá trị đo, LSL, USL, AQL, số lượng mẫu cơ bản, chứng chỉ kiểm tra, mã lỗi, kiểm tra phá hủy, kiểm tra 100%, đánh giá, Major, Minor, Critical, loại kiểm tra, FULL, SKIP]
related: [QC_AQL, MST_PART]
---

# Kiểm tra Nhập (IQC)

## Mục đích màn hình
Màn hình kiểm tra chất lượng LOT vật tư đến và đánh giá **đạt (PASS) / không đạt (FAIL)**.
Mặt hàng được đặt `IQC = Y` trong Master Mặt hàng sẽ ở trạng thái chờ kiểm tra (PENDING) sau khi đến, phải thực hiện kiểm tra trên màn hình này mới tiến hành được nhập kho.

> Đối tượng kiểm tra được nhóm theo đơn vị số hàng đến + mặt hàng. Nếu một lô hàng đến có cùng mặt hàng với nhiều sê-ri, được tổng hợp thành 1 hàng.

## Bố cục màn hình
- **Thanh lọc phía trên**: Từ khóa (số hàng đến·mã mặt hàng·tên mặt hàng), bộ lọc loại kiểm tra (FULL/SKIP), bộ lọc trạng thái kiểm tra
- **Grid danh sách**: Hiển thị các mục chờ kiểm tra, đang kiểm tra, đã hoàn thành dưới dạng bảng. Nút **Kiểm tra** trên mỗi hàng
- **Modal Kiểm tra**: Mở khi click nút Kiểm tra trên hàng. Quét sê-ri → Đo/Đánh giá theo mục → Đăng ký kết quả

---

## ① Cột Grid Danh sách

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Kiểm tra (nút)** | Mở modal kiểm tra cho lô hàng đến đã chọn. Chỉ kích hoạt cho mục có trạng thái `Chờ kiểm tra` hoặc `Đang kiểm tra`. |
| **Số hàng đến(arrivalNo)** | Số nhận dạng hàng đến. Theo dõi lô hàng đến nào qua số này. |
| **Ngày hàng đến(arrivalDate)** | Ngày vật tư đến. |
| **Nhà cung cấp(supplierName)** | Tên đối tác (nhà cung cấp) giao vật tư. |
| **Mã mặt hàng(itemCode)** | Mã nội bộ MES của mặt hàng kiểm tra. |
| **Tên mặt hàng(itemName)** | Tên của mặt hàng kiểm tra. |
| **Loại kiểm tra(inspectMethod)** | Phương thức kiểm tra được thiết lập trong Master Mặt hàng. `Kiểm tra (FULL)` = thực hiện kiểm tra nhập chính thức, `Không kiểm tra (SKIP)` = bỏ qua kiểm tra. |
| **Số sê-ri(serialCount)** | Số lượng sê-ri (LOT) vật tư trong lô hàng đến này. Biểu thị số đối tượng cần quét. |
| **Tổng số lượng(totalQty)** | Tổng số lượng của tất cả sê-ri (kèm đơn vị). |
| **Trạng thái(status)** | Trạng thái tiến triển kiểm tra. Tham khảo giá trị trạng thái bên dưới. |
| **Người kiểm tra(inspector)** | Tên người thực hiện kiểm tra. Hiển thị sau khi kiểm tra hoàn thành. |

### Giá trị trạng thái kiểm tra

| Mã trạng thái | Hiển thị | Ý nghĩa |
|------|------|------|
| `PENDING` | Chờ kiểm tra | Trạng thái sau khi hàng đến xong, trước khi kiểm tra. Có thể bắt đầu kiểm tra ở trạng thái này. |
| `IQC_IN_PROGRESS` | Đang kiểm tra | Đã bắt đầu kiểm tra nhưng chưa hoàn thành. Nút Kiểm tra được kích hoạt. |
| `PASSED` | Đạt | Kết quả đánh giá kiểm tra là đạt. Tiến hành nhập kho. |
| `FAILED` | Không đạt | Kết quả đánh giá kiểm tra là không đạt. Sê-ri tự động di chuyển đến kho không sử dụng. |

---

## ② Modal Kiểm tra — Hiển thị thông tin hàng đến

Thông tin cơ bản của lô hàng đến được hiển thị cố định ở đầu modal.

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Số hàng đến** | Số lô hàng đến đang kiểm tra. |
| **Nhà cung cấp** | Tên đối tác giao hàng. |
| **Số sê-ri** | Tổng số sê-ri thuộc lô hàng đến này. |
| **Tổng số lượng** | Tổng số lượng của tất cả sê-ri. |
| **Mặt hàng** | Tên mặt hàng và mã mặt hàng kiểm tra. |

---

## ③ Modal Kiểm tra — Bảng nhập bên trái

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Quét sê-ri (nhập)** | Quét mã vạch sê-ri cần kiểm tra hoặc nhập trực tiếp và Enter. Sê-ri không có trong danh sách chờ kiểm tra sẽ hiển thị thông báo lỗi. Có thể kiểm tra danh sách chờ bằng nút **Tra cứu sê-ri chờ kiểm tra** và đăng ký hàng loạt bằng click riêng lẻ hoặc **Thêm tất cả**. |
| **Bộ đếm tiến trình quét** | Hiển thị tiến trình dưới dạng `Số quét / Tổng số chờ`. |
| **Người kiểm tra** | Nhập tên người thực hiện kiểm tra. |
| **Ghi chú** | Nhập ghi chú liên quan kiểm tra. |
| **Số lượng mẫu cơ bản** | Số lượng mẫu cơ bản đã đăng ký trong Master Mặt hàng. Người kiểm tra có thể sửa. |
| **Số lượng mẫu AQL** | Số lượng mẫu khuyến nghị được tự động tính dựa trên chính sách AQL kết nối với mặt hàng. Mức kiểm tra và chế độ kiểm tra (ví dụ: `Normal II`) cũng được hiển thị cùng. Có thể xem trước Ac/Re (số chấp nhận/không chấp nhận) theo mục. |
| **Chứng chỉ kiểm tra** | Đính kèm file PDF·hình ảnh·Excel. Được lưu trên server sau khi đăng ký kết quả. |
| **Mã lỗi** | Khi có đánh giá FAIL, nhập loại lỗi (mã chung `DEFECT_TYPE`) và số lượng. Có thể đăng ký nhiều loại lỗi cùng lúc bằng nút thêm hàng. Không thể nhập nếu không có FAIL. |
| **Kiểm tra phá hủy/100%** | Hiển thị nếu mặt hàng có mục kiểm tra loại kiểm tra phá hủy (DESTRUCTIVE) hoặc 100% (FULL). Nhập trực tiếp **Số lượng kiểm tra** và **Số lỗi** cho từng mục. Nếu số lỗi từ 1 trở lên, mục đó được xử lý FAIL. |

---

## ④ Modal Kiểm tra — Bảng giữa (Danh sách sê-ri đã quét)

Các sê-ri đã quét hoặc thêm được liệt kê theo thứ tự.

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Số thứ tự** | Số thứ tự quét. |
| **Sê-ri(matUid)** | Định danh duy nhất (sê-ri) của LOT vật tư đó. |
| **Trạng thái đánh giá** | Kết quả đánh giá hiện tại của sê-ri đó. Khi tất cả mục kiểm tra đã đánh giá xong, hiển thị PASS/FAIL; nếu chưa xong, hiển thị `Chờ`. |
| **Nút Xóa** | Xóa sê-ri đã quét sai khỏi danh sách. |

---

## ⑤ Modal Kiểm tra — Bảng đo bên phải

Chọn sê-ri trong danh sách sê-ri, bảng mục kiểm tra của sê-ri đó sẽ hiển thị ở bên phải.

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **#** | Số thứ tự mục kiểm tra. |
| **Mục kiểm tra** | Tên mục cần kiểm tra. Có thể hiển thị badge cấp độ lỗi (Critical/Major/Minor) và giá trị AQL. |
| **Thông số kỹ thuật(spec)** | Mô tả thông số kỹ thuật của mục đó. |
| **Giới hạn dưới (LSL)** | Tiêu chuẩn đạt giới hạn dưới của giá trị đo. Nếu giá trị nhập nhỏ hơn giá trị này, tự động xử lý FAIL. |
| **Giới hạn trên (USL)** | Tiêu chuẩn đạt giới hạn trên của giá trị đo. Nếu giá trị nhập lớn hơn giá trị này, tự động xử lý FAIL. |
| **Tiêu chí đánh giá** | Mô tả bằng văn bản tiêu chuẩn đạt không phải số, như kiểm tra trực quan. |
| **Giá trị đo** | Mục có LSL/USL thì nhập trực tiếp số. Nếu trong phạm vi, tự động đánh giá PASS. Mục kiểm tra trực quan không có LSL/USL thì chọn trực tiếp nút PASS/FAIL. |
| **Đánh giá** | Biểu tượng đạt (✓)/không đạt (✗) theo kết quả đo/nhập. |

> **Mặt hàng không có mục kiểm tra**: Nếu mặt hàng đó chưa đăng ký mục kiểm tra IQC, chọn thủ công PASS/FAIL cho từng sê-ri.

---

## Trình tự thực hiện

1. Tìm hàng lô hàng đến cần kiểm tra trong danh sách và click nút **Kiểm tra**.
2. Khi modal mở, quét mã vạch sê-ri vật tư hoặc nhập trực tiếp vào ô quét bên trái và Enter (hoặc **Tra cứu sê-ri chờ kiểm tra → Thêm tất cả**).
3. Chọn sê-ri trong bảng giữa, bảng mục kiểm tra hiển thị ở bên phải.
4. Nhập giá trị đo hoặc chọn PASS/FAIL cho từng mục. Nếu có LSL/USL, tự động đánh giá.
5. Nếu có mục kiểm tra phá hủy/100%, nhập số lượng kiểm tra và số lỗi ở phần dưới bảng bên trái.
6. Nếu có đánh giá FAIL, chọn **mã lỗi** và nhập số lượng (bắt buộc).
7. Nếu cần, đính kèm file **Chứng chỉ kiểm tra**.
8. Click nút **Đăng ký kết quả kiểm tra** ở cuối modal để lưu kết quả.

---

## Quy tắc nhập / Kiểm tra

- Không thể đăng ký sê-ri chưa quét (chưa kiểm tra) mà không có đánh giá.
- Nếu có sê-ri đã quét chưa đánh giá xong, nút đăng ký bị vô hiệu.
- Nếu có đánh giá FAIL (sê-ri hoặc kiểm tra phá hủy), phải nhập **ít nhất 1 mã lỗi**.
- Nếu không có FAIL mà nhập mã lỗi, việc đăng ký bị chặn.
- Nếu sê-ri đã quét không có trong danh sách chờ kiểm tra, hiển thị thông báo lỗi và không đăng ký.

---

## Câu hỏi thường gặp

- **H.** Nút Kiểm tra bị vô hiệu.
  **Đ.** Đó là trường hợp trạng thái của lô hàng đến đó đã được đánh giá là `PASSED` hoặc `FAILED`. Nếu cần hủy đánh giá, hãy liên hệ quản lý viên.
- **H.** Số lượng mẫu AQL không hiển thị.
  **Đ.** Mặt hàng đó chưa được kết nối chính sách AQL. Vui lòng thiết lập chính sách AQL trong Master Mặt hàng.
- **H.** Khi quét sê-ri, báo lỗi "Không phải sê-ri chờ kiểm tra".
  **Đ.** Sê-ri đã quét không ở trạng thái PENDING hiện tại hoặc thuộc lô hàng đến khác. Hãy kiểm tra danh sách sê-ri đúng bằng **Tra cứu sê-ri chờ kiểm tra**.
- **H.** Sau khi xử lý không đạt, tồn kho biến mất.
  **Đ.** Khi IQC không đạt, sê-ri đó tự động di chuyển đến kho không sử dụng. Nếu cần kiểm tra lại, hãy yêu cầu quản lý viên hủy.
- **H.** Làm thế nào để đánh giá khi không có mục kiểm tra?
  **Đ.** Nếu mặt hàng chưa đăng ký mục kiểm tra IQC, click trực tiếp nút PASS/FAIL cho từng sê-ri ở khu vực bên phải modal.
- **H.** Có cần quét sê-ri không nếu chỉ có mục kiểm tra phá hủy?
  **Đ.** Không. Nếu không có mục kiểm tra sê-ri AQL mà chỉ có mục kiểm tra phá hủy/100%, có thể nhập số lượng kiểm tra phá hủy và đăng ký kết quả mà không cần quét sê-ri.

---

## Màn hình liên quan
- [Quản lý Tiêu chuẩn AQL](/quality/aql) — Nơi đăng ký tiêu chuẩn cỡ mẫu·chấp nhận (Ac)·không chấp nhận (Re)
- [Master Mặt hàng](/master/part) — Nơi thiết lập có IQC hay không và chính sách AQL cho mặt hàng
