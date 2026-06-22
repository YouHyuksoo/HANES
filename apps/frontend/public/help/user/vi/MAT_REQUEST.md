---
menuCode: MAT_REQUEST
audience: user
title: Quản lý Yêu cầu Xuất
summary: Màn hình yêu cầu xuất nguyên vật liệu theo lệnh sản xuất hoặc thủ công và tra cứu trạng thái yêu cầu (chờ·phê duyệt·từ chối·hoàn thành)
tags: [vật tư, yêu cầu xuất, lệnh sản xuất, BOM]
keywords: [yêu cầu xuất, xuất kho vật tư, số yêu cầu, requestNo, REQUESTED, APPROVED, REJECTED, COMPLETED, chờ, phê duyệt, từ chối, xuất hoàn thành, lệnh sản xuất, nhu cầu BOM, bomReqQty, đã xuất, prevIssueQty, tồn kho hiện trường, floorStockQty, tồn kho hiện tại, số lượng yêu cầu, đầu vào sản xuất, sản phẩm mẫu, mẫu, yêu cầu xuất thủ công]
related: [MAT_ISSUE, MST_PART]
---

# Quản lý Yêu cầu Xuất

## Mục đích màn hình

Màn hình **yêu cầu nhân viên kho xuất nguyên vật liệu** cần thiết cho lệnh sản xuất. Nhu cầu được tự động tính toán dựa trên BOM, giảm gánh nặng nhập số lượng, và theo dõi luồng từ yêu cầu, phê duyệt đến xuất trên cùng một màn hình.

> Luồng: Yêu cầu xuất (REQUESTED) → Phê duyệt (APPROVED) → Xuất thực tế (COMPLETED) / Từ chối (REJECTED)

Phương thức kết nối với lệnh sản xuất là cơ bản, nhưng cũng có thể **yêu cầu xuất thủ công** bằng cách tìm kiếm trực tiếp mặt hàng mà không cần lệnh sản xuất.

## Bố cục màn hình

- **Tiêu đề phía trên**: Tiêu đề màn hình + nút [Yêu cầu xuất thủ công].
- **Thanh lọc**: Nhập số lệnh sản xuất, model (mã mặt hàng/tên mặt hàng), trạng thái lệnh sản xuất để thu hẹp danh sách bên trái.
- **Bên trái — Danh sách lệnh sản xuất**: Liệt kê các lệnh sản xuất hiện có dưới dạng thẻ. Click để hiển thị chi tiết lệnh sản xuất đó ở bên phải.
- **Bên phải — Chi tiết yêu cầu xuất / Tạo mới**: Khi chọn lệnh sản xuất, các yêu cầu xuất hiện có được hiển thị nhóm theo từng yêu cầu. Nhấn [Tạo mới] để chuyển sang grid mặt hàng dựa trên BOM. Nếu không chọn lệnh sản xuất, danh sách yêu cầu xuất gần đây được hiển thị mặc định.

---

## ① Mục Thanh lọc

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Số lệnh sản xuất** | Nhập số lệnh sản xuất cụ thể để lọc danh sách bên trái. Tìm kiếm tự động sau 300ms. |
| **Model (mã mặt hàng/tên mặt hàng)** | Lọc theo mã mặt hàng hoặc tên mặt hàng của sản phẩm kết nối với lệnh sản xuất. |
| **Trạng thái lệnh sản xuất** | Chọn trạng thái theo mã chung `JOB_ORDER_STATUS` (WAITING/RUNNING/HOLD/DONE, v.v.). Dùng khi chỉ muốn xem lệnh sản xuất đang tiến hành. |
| **Đặt lại** | Xóa tất cả bộ lọc đã nhập. Chỉ hiển thị khi có ít nhất một bộ lọc được nhập. |

---

## ② Danh sách Lệnh Sản xuất (Bên trái)

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Số lệnh sản xuất(orderNo)** | Số nhận dạng lệnh sản xuất. Click để chọn lệnh sản xuất đó và tải chi tiết ở bên phải. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng của sản phẩm sẽ sản xuất. |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng của sản phẩm sẽ sản xuất (hiển thị chữ thường dưới tên mặt hàng). |
| **Số lượng kế hoạch(planQty)** | Số lượng mục tiêu sản xuất của lệnh sản xuất. Là cơ sở tính toán nhu cầu BOM. |
| **Trạng thái(status)** | Hiển thị badge theo mã chung `JOB_ORDER_STATUS` (ví dụ: chờ/tiến hành/hoàn thành). |

---

## ③ Chi tiết Yêu cầu Xuất (Bên phải — Chế độ chi tiết)

Khi chọn lệnh sản xuất, các yêu cầu xuất kết nối với lệnh sản xuất đó được hiển thị theo nhóm.

### Tiêu đề nhóm yêu cầu

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Số yêu cầu(requestNo)** | Số nhận dạng yêu cầu xuất. Click để mở modal chi tiết. |
| **Trạng thái(status)** | Badge trạng thái hiện tại của yêu cầu (tham khảo định nghĩa trạng thái bên dưới). |
| **Ngày yêu cầu(requestDate)** | Ngày·giờ yêu cầu xuất được đăng ký. |
| **Số mặt hàng** | Số mặt hàng trong yêu cầu xuất này. |
| **Tổng số lượng yêu cầu(totalRequestQty)** | Tổng số lượng yêu cầu của tất cả mặt hàng trong yêu cầu này. |
| **Người yêu cầu(requester)** | Người yêu cầu xuất. |

### Bảng mặt hàng nhóm yêu cầu

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng(itemCode)** | Mã của mặt hàng yêu cầu xuất. |
| **Tên mặt hàng(itemName)** | Tên của mặt hàng yêu cầu xuất. |
| **Đơn vị(unit)** | Đơn vị số lượng (EA, M, KG, v.v.). |
| **Số lượng yêu cầu(requestQty)** | Số lượng xuất yêu cầu kho. |
| **Đã xuất(issuedQty)** | Số lượng tích lũy đã thực tế xuất từ yêu cầu này. Hoàn thành khi bằng số lượng yêu cầu. |

---

## ④ Tạo mới — Grid Mặt hàng BOM (Bên phải — Chế độ Tạo mới)

Click nút [Tạo mới] để tự động tính toán và hiển thị danh sách nguyên vật liệu cần dựa trên BOM của lệnh sản xuất.

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng(itemCode)** | Mã nguyên vật liệu cần. |
| **Tên mặt hàng(itemName)** | Tên nguyên vật liệu cần. |
| **Đơn vị(unit)** | Đơn vị số lượng. |
| **Nhu cầu BOM(bomReqQty)** | Nhu cầu BOM dựa trên số lượng kế hoạch của lệnh sản xuất này (= nhu cầu đơn vị BOM × số lượng kế hoạch). |
| **Đã xuất(prevIssueQty)** | Số lượng tích lũy đã xuất từ lệnh sản xuất này. Trừ giá trị này khỏi nhu cầu BOM để biết số lượng thực tế cần thêm. |
| **Tồn kho hiện trường(floorStockQty)** | Số lượng đã có tại hiện trường (dây chuyền sản xuất). Nếu tồn kho hiện trường đủ, có thể giảm số lượng yêu cầu xuất. |
| **Tồn kho hiện tại(currentStock)** | Số lượng tồn kho hiện tại trong kho. Nếu số lượng yêu cầu vượt quá tồn kho hiện tại, cảnh báo đỏ được hiển thị. |
| **Số lượng yêu cầu(requestQty)** | Số lượng yêu cầu xuất được nhập trực tiếp. Mặt hàng có số lượng 0 được loại khỏi yêu cầu. |

Sau khi nhập số lượng yêu cầu, chọn **[Lý do yêu cầu]** (đầu vào sản xuất/sản phẩm mẫu/mẫu/khác) ở phía trên và nhấn **[Đăng ký yêu cầu]**.

---

## ⑤ Modal Chi tiết Yêu cầu Xuất

Khi click số yêu cầu, modal chi tiết mở ra.

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Số yêu cầu(requestNo)** | Số nhận dạng duy nhất của yêu cầu xuất. |
| **Lệnh sản xuất(workOrderNo)** | Số lệnh sản xuất kết nối. '-' nếu không có. |
| **Trạng thái(status)** | Badge trạng thái yêu cầu hiện tại. |
| **Tài khoản xuất(issueType)** | Phân loại tài khoản xuất theo mã chung `ISSUE_TYPE` (ví dụ: đầu vào sản xuất, mẫu, v.v.). |
| **Ngày yêu cầu(requestDate)** | Ngày·giờ yêu cầu xuất được đăng ký. |
| **Người yêu cầu(requester)** | Người đăng ký yêu cầu. |
| **Người phê duyệt(approver)** | Người phê duyệt yêu cầu. '-' nếu chưa phê duyệt. |
| **Ngày·giờ phê duyệt(approvedAt)** | Ngày·giờ phê duyệt được xử lý. |
| **Số lượng yêu cầu / Số lượng xuất / Số lượng còn lại** | Giá trị tổng hợp của toàn bộ yêu cầu. Còn lại = yêu cầu - xuất. |
| **Ghi chú(remark)** | Lý do hoặc ghi chú khi yêu cầu. |
| **Lý do từ chối(rejectReason)** | Hiển thị lý do nếu bị từ chối. |

### Bảng mặt hàng modal chi tiết

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng/Tên mặt hàng** | Thông tin nhận dạng mặt hàng yêu cầu. |
| **Yêu cầu(requestQty)** | Số lượng đã yêu cầu. |
| **Xuất(issuedQty)** | Số lượng thực tế đã xuất. |
| **Còn lại** | Số lượng chưa xuất (= yêu cầu - xuất). |
| **Tồn kho hiện tại(currentStock)** | Số lượng tồn kho trong kho tại thời điểm yêu cầu. |
| **Nhu cầu BOM(bomReqQty)** | Nhu cầu theo tiêu chuẩn BOM. |
| **Đã xuất(prevIssueQty)** | Số lượng đã xuất trước đó từ lệnh sản xuất này. |
| **Tồn kho hiện trường(floorStockQty)** | Số lượng đang có tại hiện trường. |
| **Đơn vị(unit)** | Đơn vị số lượng. |

---

## ⑥ Modal Yêu cầu Xuất Thủ công

Khi cần nguyên vật liệu không có lệnh sản xuất, sử dụng nút [Yêu cầu xuất thủ công] ở phía trên.

1. **Lệnh sản xuất**: Nếu chọn, mặt hàng dựa trên BOM tự động được điền. Có thể không chọn.
2. **Lý do yêu cầu**: Chọn Đầu vào sản xuất / Sản phẩm mẫu / Mẫu / Khác.
3. **Tìm kiếm mặt hàng**: Nhập mã mặt hàng hoặc tên mặt hàng và tìm kiếm. Kiểm tra tồn kho hiện tại của mặt hàng tìm được, sau đó nhấn [+] để thêm vào danh sách yêu cầu.
4. **Nhập số lượng yêu cầu**: Nhập số lượng cho từng mặt hàng. Cảnh báo hiển thị nếu vượt quá tồn kho hiện tại.
5. Click nút **Đăng ký yêu cầu**.

---

## Giá trị trạng thái Yêu cầu Xuất

| Mã trạng thái | Hiển thị màn hình | Ý nghĩa |
|------|------|------|
| **REQUESTED** | Chờ (màu vàng) | Yêu cầu xuất đã được đăng ký, đang chờ phê duyệt của nhân viên kho. |
| **APPROVED** | Phê duyệt (màu xanh) | Đã được phê duyệt, có thể xử lý xuất thực tế. |
| **REJECTED** | Từ chối (màu đỏ) | Yêu cầu đã bị từ chối. Kiểm tra lý do từ chối và yêu cầu lại. |
| **COMPLETED** | Xuất hoàn thành (màu xanh lá) | Sau khi phê duyệt, xuất thực tế đã hoàn thành. |

---

## Trình tự thực hiện (Yêu cầu theo lệnh sản xuất)

1. Nhập số lệnh sản xuất hoặc tên model vào thanh lọc để tìm lệnh sản xuất mục tiêu.
2. Click lệnh sản xuất ở bên trái để chọn.
3. Kiểm tra yêu cầu hiện có ở chế độ chi tiết bên phải.
4. Click [Tạo mới] để chuyển sang grid mặt hàng dựa trên BOM.
5. Tham khảo nhu cầu BOM, đã xuất, tồn kho hiện trường, tồn kho hiện tại cho từng mặt hàng và nhập số lượng yêu cầu.
6. Chọn lý do yêu cầu và click [Đăng ký yêu cầu].
7. Kiểm tra yêu cầu đã đăng ký và trạng thái ở chế độ chi tiết bên phải.

> Mặt hàng có số lượng yêu cầu là 0 tự động bị loại. Phải có ít nhất 1 mặt hàng với số lượng từ 1 trở lên để đăng ký.

---

## Quy tắc nhập

- Số lượng yêu cầu phải là số nguyên dương (từ 1 trở lên).
- Trong modal yêu cầu xuất thủ công, phải nhập số lượng cho tất cả mặt hàng để đăng ký (không thể có mặt hàng số lượng 0).
- Trong chế độ tạo mới BOM, đăng ký loại trừ mặt hàng có số lượng 0.
- Có thể đăng ký ngay cả khi số lượng yêu cầu vượt quá tồn kho hiện tại, nhưng cảnh báo được hiển thị (không chặn).

---

## Câu hỏi thường gặp

- **H.** Số lượng dựa trên BOM hiển thị là 0.
  **Đ.** Đó là trường hợp BOM chưa được đăng ký trong master mặt hàng hoặc số lượng kế hoạch lệnh sản xuất là 0. Hãy nhập thủ công số lượng hoặc kiểm tra BOM.

- **H.** Có thể yêu cầu số lượng nhiều hơn tồn kho hiện tại không?
  **Đ.** Cảnh báo được hiển thị nhưng vẫn có thể đăng ký. Tuy nhiên, xuất thực tế chỉ khả dụng trong phạm vi tồn kho trong kho.

- **H.** Yêu cầu xuất đã bị từ chối.
  **Đ.** Kiểm tra lý do từ chối trong modal chi tiết, giải quyết lý do và yêu cầu lại bằng cách tạo mới.

- **H.** Đã APPROVED nhưng chưa phản ánh vào tồn kho.
  **Đ.** Phê duyệt là cho phép yêu cầu xuất, biến động tồn kho thực tế chỉ xảy ra sau khi xử lý xuất thực tế tại màn hình Quản lý Xuất kho Vật tư.

- **H.** Trong yêu cầu xuất thủ công, không tìm thấy mặt hàng ngoài nguyên vật liệu.
  **Đ.** Tìm kiếm mặt hàng yêu cầu xuất chỉ giới hạn ở mặt hàng nguyên vật liệu (RAW_MATERIAL).

---

## Màn hình liên quan

- [Quản lý Xuất kho Vật tư](/material/issue) — Xử lý xuất thực tế dựa trên yêu cầu xuất đã phê duyệt
- [Master Mặt hàng](/master/part) — Mã mặt hàng/tên và thông tin cơ bản BOM
