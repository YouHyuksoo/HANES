---
menuCode: MAT_ISSUE
audience: user
title: Quản lý Xuất kho Vật tư (Sản xuất hàng loạt)
summary: Màn hình dành riêng cho sản xuất hàng loạt để phê duyệt và xử lý yêu cầu xuất kho vật tư từ hiện trường, hoặc xuất kho ngay lập tức bằng quét mã vạch LOT
tags: [vật tư, xuất kho, sản xuất hàng loạt, quét mã vạch, yêu cầu xuất]
keywords: [xuất kho vật tư, xuất sản xuất hàng loạt, yêu cầu xuất, phê duyệt, từ chối, xử lý xuất, quét mã vạch, quét LOT, xuất toàn bộ, lịch sử xuất, hủy xuất, PRODUCTION, tài khoản xuất, ISSUE_TYPE, số xuất, số yêu cầu, lệnh sản xuất, giảm tồn kho, MatStock, matUid, sê-ri vật tư]
related: [MAT_REQUEST, MAT_ISSUE_OTHER, MST_PART]
---

# Quản lý Xuất kho Vật tư (Sản xuất hàng loạt)

## Mục đích màn hình
Màn hình để **xem xét, phê duyệt và xuất kho** các yêu cầu xuất kho vật tư từ hiện trường theo kế hoạch sản xuất, hoặc nhân viên kho **quét mã vạch LOT để xuất toàn bộ ngay lập tức**. Tài khoản xuất cố định là **Sản xuất hàng loạt (PRODUCTION)**, các tài khoản khác (lỗi, mẫu, gia công, hủy, v.v.) được xử lý tại [Quản lý Xuất Khác](/material/issue-other).

> Luồng: Tạo yêu cầu xuất (hiện trường) → Phê duyệt (kho/quản lý) → Xử lý xuất → Giảm tồn kho (MatStock)

## Bố cục màn hình
Màn hình gồm ba tab.

| Tab | Vai trò |
|---|---|
| **Xử lý Yêu cầu Xuất** | Tra cứu danh sách yêu cầu xuất đã tiếp nhận từ hiện trường. Thực hiện phê duyệt, từ chối, xử lý xuất |
| **Quét Mã vạch** | Quét trực tiếp mã vạch LOT để xử lý xuất toàn bộ ngay lập tức |
| **Lịch sử Xuất** | Tra cứu toàn bộ lịch sử xuất bao gồm đã hoàn thành và đã hủy, hủy xuất |

---

## ① Tab Xử lý Yêu cầu Xuất

### Thẻ thống kê

| Thẻ | Ý nghĩa |
|---|---|
| **Yêu cầu** | Số lượng yêu cầu xuất đang chờ phê duyệt |
| **Phê duyệt** | Số lượng đã phê duyệt đang chờ xử lý xuất |
| **Hoàn thành** | Số lượng đã xử lý xuất hoàn thành |
| **Từ chối** | Số lượng đã bị từ chối |

### Cột danh sách yêu cầu

| Cột | Vai trò / Ý nghĩa |
|---|---|
| **Số yêu cầu(requestNo)** | Số nhận dạng duy nhất của yêu cầu xuất. Định dạng đánh số là `REQ-YYYYMMDD-NNN`. |
| **Ngày yêu cầu(requestDate)** | Ngày yêu cầu xuất được đăng ký. |
| **Lệnh sản xuất(workOrderNo)** | Số lệnh sản xuất kết nối với yêu cầu xuất này. Nếu yêu cầu dựa trên lệnh sản xuất, được tô sáng màu xanh. |
| **Số mặt hàng(itemCount)** | Số dòng mặt hàng trong yêu cầu này. |
| **Tổng số lượng(totalQty)** | Tổng số lượng của tất cả mặt hàng được yêu cầu. |
| **Tài khoản xuất(issueType)** | Loại xuất. Trên màn hình này, cố định là **Sản xuất hàng loạt (PRODUCTION)**. |
| **Trạng thái(status)** | Trạng thái xử lý hiện tại (tham khảo giá trị trạng thái bên dưới). |
| **Người yêu cầu(requester)** | Người yêu cầu xuất. |
| **Xử lý(actions)** | Hiển thị nút phê duyệt, từ chối, xử lý xuất tùy theo trạng thái. |

### Giá trị trạng thái yêu cầu xuất

| Mã trạng thái | Hiển thị | Ý nghĩa |
|---|---|---|
| `REQUESTED` | Yêu cầu | Yêu cầu xuất đã được tiếp nhận, đang chờ phê duyệt. |
| `APPROVED` | Phê duyệt | Đã phê duyệt, đang chờ xử lý xuất. |
| `COMPLETED` | Hoàn thành | Tất cả mặt hàng đã được xử lý xuất. |
| `REJECTED` | Từ chối | Yêu cầu đã bị từ chối. |

### Cột Modal Xử lý Xuất (khi xử lý xuất sau phê duyệt)

| Cột | Vai trò / Ý nghĩa |
|---|---|
| **Mã mặt hàng(itemCode)** | Mã của mặt hàng cần xuất (theo master mặt hàng). |
| **Tên mặt hàng(itemName)** | Tên của mặt hàng cần xuất. |
| **Số lượng yêu cầu(requestQty)** | Số lượng hiện trường yêu cầu. |
| **Đã xuất(issuedQty)** | Số lượng đã được xử lý xuất (tích lũy xuất một phần). |
| **Còn lại(remainQty)** | Số lượng còn lại chưa xuất (= số lượng yêu cầu − đã xuất). |
| **LOT Xuất(matUidSelect)** | Chọn LOT vật tư để xuất. Khi chọn, hiển thị dưới dạng `Sê-ri LOT / Tên kho / Số lượng khả dụng`. |
| **Số lượng xuất(issueQty)** | Nhập số lượng thực tế sẽ xuất. Không thể vượt quá số lượng còn lại. |
| **Đơn vị(unit)** | Đơn vị của số lượng (theo master mặt hàng). |

---

## ② Tab Quét Mã vạch

Quét mã vạch LOT để **xuất ngay lập tức toàn bộ tồn kho còn lại của LOT đó**. Sử dụng khi cần xuất nhanh mà không cần điều chỉnh số lượng riêng lẻ.

### Thông tin kết quả quét

| Mục | Vai trò / Ý nghĩa |
|---|---|
| **Mã mặt hàng** | Mã mặt hàng của LOT đã quét. |
| **Tên mặt hàng** | Tên mặt hàng của LOT đã quét. |
| **Sê-ri vật tư(matUid)** | Sê-ri duy nhất (giá trị nhận dạng LOT) của LOT đã quét. |
| **Số lượng hiện tại** | Số lượng tồn kho hiện tại của LOT đó. Số lượng này sẽ bị giảm khi xuất toàn bộ. |
| **IQC** | Kết quả kiểm tra nhập. LOT không ở trạng thái PASS hoặc bị HOLD sẽ bị chặn xuất. |
| **Nhà cung cấp** | Tên nhà cung cấp giao vật tư. |

### Lịch sử xuất quét hôm nay

| Cột | Vai trò / Ý nghĩa |
|---|---|
| **Thời gian(issuedAt)** | Thời gian xử lý xuất quét. |
| **Mã mặt hàng** | Mã của mặt hàng đã xuất. |
| **Tên mặt hàng** | Tên của mặt hàng đã xuất. |
| **Sê-ri vật tư(matUid)** | Sê-ri của LOT đã xuất. |
| **Số lượng xuất(issueQty)** | Số lượng đã xuất. |
| **Đơn vị(unit)** | Đơn vị số lượng. |

---

## ③ Tab Lịch sử Xuất

### Bộ lọc

| Bộ lọc | Vai trò / Ý nghĩa |
|---|---|
| **Ngày xuất (khoảng thời gian)** | Phạm vi ngày xuất để tra cứu. Mặc định là hôm nay. |
| **Tìm kiếm(searchText)** | Tìm kiếm văn bản theo số xuất, mã mặt hàng, tên mặt hàng, sê-ri vật tư. |
| **Trạng thái(statusFilter)** | Bộ lọc hoàn thành/hủy. |
| **Tài khoản xuất(issueTypeFilter)** | Lọc theo loại xuất (mã chung ISSUE_TYPE). |

### Cột lịch sử

| Cột | Vai trò / Ý nghĩa |
|---|---|
| **Số xuất(issueNo)** | Số nhận dạng duy nhất của giao dịch xuất. |
| **Ngày xuất(issueDate)** | Ngày xuất được xử lý. |
| **Mã mặt hàng(itemCode)** | Mã của mặt hàng đã xuất. |
| **Tên mặt hàng(itemName)** | Tên của mặt hàng đã xuất. |
| **Sê-ri vật tư(matUid)** | Sê-ri của LOT đã xuất. |
| **Số lượng(issueQty)** | Số lượng xuất. Hiển thị kèm đơn vị. |
| **Tài khoản xuất(issueType)** | Loại xuất (mã chung ISSUE_TYPE). |
| **Lệnh sản xuất(jobOrderNo)** | Số lệnh sản xuất kết nối với xuất (nếu có). |
| **Trạng thái(status)** | Hoàn thành (DONE) hoặc Hủy (CANCELED). |
| **(Nút hủy)** | Chỉ hiển thị khi trạng thái Hoàn thành (DONE). Click để nhập lý do hủy và xử lý hủy xuất. Khi hủy, tồn kho được phục hồi. |

---

## Trình tự thực hiện

### Phương thức Xử lý Yêu cầu Xuất
1. Click tab **Xử lý Yêu cầu Xuất**.
2. Kiểm tra đối tượng trong danh sách yêu cầu. Có thể sử dụng bộ lọc trạng thái hoặc tìm kiếm văn bản.
3. Click icon check (phê duyệt) trên mục có trạng thái **Yêu cầu (REQUESTED)** để phê duyệt. Nếu cần từ chối, click icon X và nhập lý do.
4. Click icon tái chế (xử lý xuất) trên mục có trạng thái **Phê duyệt (APPROVED)**.
5. Trong modal xử lý xuất, chọn **LOT Xuất** cho từng mặt hàng, kiểm tra (sửa nếu cần) **Số lượng xuất**, sau đó click nút **Xuất**.
6. Khi tất cả số lượng mặt hàng đã được xuất hết, trạng thái yêu cầu chuyển thành **Hoàn thành (COMPLETED)**.

### Phương thức Quét Mã vạch
1. Click tab **Quét Mã vạch**.
2. Quét mã vạch LOT vào ô nhập hoặc nhập trực tiếp sê-ri vật tư và nhấn Enter.
3. Kiểm tra thông tin LOT (tên mặt hàng, số lượng hiện tại, trạng thái IQC, v.v.).
4. Click nút **Xuất toàn bộ**.
5. Giao dịch xử lý được thêm vào 'Lịch sử xuất quét hôm nay' ở phía dưới, ô nhập tự động focus để tiếp tục quét tiếp theo.

---

## Quy tắc nhập / Kiểm tra

- Khi xử lý xuất, nếu **không chọn LOT Xuất**, xuất sẽ bị chặn.
- Số lượng xuất **không được vượt quá số lượng còn lại**.
- Xuất bằng quét mã vạch chỉ khả dụng cho LOT ở trạng thái **IQC đạt (PASS)** và **không bị HOLD**.
- Khi quét mã vạch, LOT đã hết tồn kho sẽ bị từ chối xuất.
- Hủy xuất chỉ khả dụng ở trạng thái **Hoàn thành (DONE)**, bắt buộc nhập lý do hủy.
- Xuất đã có công đoạn sau (sản lượng sản xuất) đã tiến hành sẽ bị chặn hủy.

---

## Câu hỏi thường gặp

- **H.** Không thấy mục trong danh sách yêu cầu xuất.
  **Đ.** Hãy kiểm tra bộ lọc trạng thái có đang được đặt ở một trạng thái cụ thể không. Thử thay đổi thành 'Tất cả trạng thái' hoặc xóa từ khóa tìm kiếm.

- **H.** Danh sách LOT trống trong modal xử lý xuất.
  **Đ.** Đó là trường hợp không có tồn kho khả dụng xuất (IQC đạt, số lượng khả dụng > 0) cho mặt hàng đó. Hãy kiểm tra tình trạng nhập kho.

- **H.** Khi quét mã vạch, báo lỗi "LOT chưa đạt IQC".
  **Đ.** LOT đó chưa được xử lý đạt kiểm tra nhập (IQC). Hãy yêu cầu nhân viên IQC hoàn thành kiểm tra.

- **H.** Không thể hủy xuất.
  **Đ.** Nếu công đoạn sau (sản lượng sản xuất) đã tiến hành, việc hủy sẽ bị chặn. Hãy xử lý ngược theo thứ tự Sản lượng sản xuất → Nhãn FG → Hộp/OQC → Pallet → Xuất hàng, sau đó thử lại.

- **H.** Làm thế nào để xuất cho các tài khoản khác ngoài sản xuất hàng loạt (mẫu, lỗi, v.v.)?
  **Đ.** Sử dụng màn hình [Quản lý Xuất Khác](/material/issue-other).

---

## Màn hình liên quan
- [Quản lý Xuất Khác](/material/issue-other) — Xuất cho các tài khoản ngoài sản xuất hàng loạt
- [Master Mặt hàng](/master/part) — Tiêu chuẩn mặt hàng/đơn vị
- [Quản lý Yêu cầu Xuất](/material/request) — Đăng ký, tra cứu yêu cầu xuất
