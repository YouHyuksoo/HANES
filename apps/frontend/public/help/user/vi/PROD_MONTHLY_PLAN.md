---
menuCode: PROD_MONTHLY_PLAN
audience: user
title: Kế hoạch Sản xuất Sản phẩm
summary: Màn hình đăng ký kế hoạch sản xuất thành phẩm/bán thành phẩm theo tháng (YYYY-MM) và phát hành lệnh sản xuất sau khi xác nhận
tags: [sản xuất, kế hoạch sản xuất, MPS, lệnh sản xuất, kế hoạch tháng]
keywords: [kế hoạch sản xuất sản phẩm, kế hoạch sản xuất tháng, kế hoạch sản xuất, MPS, số lượng kế hoạch, số lượng phát hành, số lượng còn lại, tỷ lệ phát hành, lệnh sản xuất, phát hành lệnh sản xuất, xác nhận, hủy xác nhận, kết thúc, dự thảo, DRAFT, CONFIRMED, CLOSED, tự động sắp xếp, tải lên Excel, ưu tiên, thành phẩm, bán thành phẩm, FINISHED, SEMI_PRODUCT, số kế hoạch]
related: [MST_PART, PROD_JOB_ORDER]
---

# Kế hoạch Sản xuất Sản phẩm

## Mục đích màn hình
Màn hình đăng ký và quản lý kế hoạch sản xuất thành phẩm/bán thành phẩm **khi nào (tháng nào) và bao nhiêu**.
Kế hoạch được tạo theo đơn vị **tháng (YYYY-MM)**, một giao dịch có nghĩa là "tháng này sản xuất mặt hàng này với số lượng bao nhiêu". Sau khi **xác nhận** kế hoạch, **phát hành lệnh sản xuất** dựa trên kế hoạch đó để chỉ đạo sản xuất thực tế.

> Kế hoạch sản xuất là đơn vị **tháng**, không phải ngày. Cùng tháng, cùng mặt hàng nhưng có thể tạo nhiều kế hoạch, mỗi kế hoạch được gán số kế hoạch (PLAN_NO).

## Bố cục màn hình
- **Phía trên — Nút công cụ**: Làm mới / Tải template xuống / Tải lên Excel / Giao diện ERP / Tự động sắp xếp / Thêm kế hoạch
- **Bộ lọc phía trên (trên grid)**: Ngày bắt đầu·Ngày kết thúc (phạm vi tháng kế hoạch), từ khóa, loại mặt hàng, trạng thái
- **Giữa — Danh sách kế hoạch (grid)**: Hiển thị từng dòng kế hoạch sản xuất đã đăng ký. Hàng DRAFT có icon sửa·xóa bên trái.
- **Bên phải — Bảng đăng ký/sửa**: Mở trượt từ bên phải khi nhấn 'Thêm kế hoạch' hoặc icon sửa.

## Luồng trạng thái
```
DRAFT(Dự thảo) ──Xác nhận──▶ CONFIRMED(Đã xác nhận) ──Kết thúc──▶ CLOSED(Đã kết thúc)
                  ◀─Hủy xác nhận─┘
Chỉ DRAFT mới sửa·xóa được / Chỉ CONFIRMED mới phát hành lệnh sản xuất được
```

---

## ① Cột Danh sách Kế hoạch

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **(Sửa/Xóa)** | Icon bên trái chỉ hiển thị trên hàng **Dự thảo (DRAFT)**. Bút chì=mở bảng sửa, thùng rác=xóa. Không hiển thị sau trạng thái xác nhận (không thể sửa·xóa). |
| **Số kế hoạch(planNo)** | Số duy nhất nhận dạng kế hoạch. Định dạng `PP-YYYYMM-NNN` (ví dụ: `PP-202606-001`). Tự động đánh số khi đăng ký và không thể thay đổi. |
| **Tháng kế hoạch(planMonth)** | **Tháng sản xuất mục tiêu** mà kế hoạch này áp dụng (`YYYY-MM`). Không có ngày, ngày kế hoạch cụ thể được chỉ định tại thời điểm phát hành lệnh sản xuất. |
| **Hành động(actions)** | Nút thay đổi theo trạng thái. DRAFT hiển thị **Xác nhận**, CONFIRMED hiển thị **Phát hành lệnh sản xuất**·**Hủy xác nhận**. Nếu số lượng còn lại bằng 0, nút phát hành bị vô hiệu. |
| **Loại mặt hàng(itemType)** | `FINISHED` (thành phẩm) hoặc `SEMI_PRODUCT` (bán thành phẩm). Phân biệt kế hoạch sản xuất cái gì. |
| **Mã mặt hàng(partCode)** | Mã của mặt hàng sản xuất mục tiêu. Giá trị chọn từ master mặt hàng. |
| **Tên mặt hàng(partName)** | Tên mặt hàng kết nối với mã mặt hàng (hiển thị theo master mặt hàng). |
| **Số lượng kế hoạch(planQty)** | **Số lượng mục tiêu** muốn sản xuất trong tháng này. Là giới hạn trên của phát hành lệnh sản xuất. |
| **Số lượng phát hành(orderQty)** | **Số lượng tích lũy đã phát hành dưới dạng lệnh sản xuất** từ kế hoạch này. Tự động tăng mỗi khi phát hành. |
| **Tỷ lệ phát hành(issueRate)** | Hiển thị `Số lượng phát hành ÷ Số lượng kế hoạch` dưới dạng biểu đồ thanh và %. Nếu 100%, nghĩa là đã phát hành hết số lượng kế hoạch và thanh chuyển sang màu xanh lá. |
| **Dây chuyền(lineCode)** | Dây chuyền sản xuất cơ bản để tiến hành sản xuất. Được kế thừa làm giá trị mặc định khi phát hành lệnh sản xuất và có thể thay đổi. |
| **Khách hàng(customer)** | Khách hàng kết nối với kế hoạch này (tham khảo đáp ứng đơn hàng, v.v.). |
| **Ưu tiên(priority)** | Thứ tự ưu tiên xử lý kế hoạch (1~10, mặc định 5). **Số càng nhỏ càng xử lý trước**, danh sách cũng sắp xếp theo thứ tự ưu tiên tăng dần. |
| **Trạng thái(status)** | Giai đoạn tiến triển của kế hoạch. **DRAFT (Dự thảo)**=sửa·xóa được, **CONFIRMED (Đã xác nhận)**=không sửa·xóa được·phát hành lệnh sản xuất được, **CLOSED (Đã kết thúc)**=kết thúc. Có mô tả chuyển tiếp ở dấu hỏi (?) trong tiêu đề. |

> **Ngày bắt đầu·Ngày kết thúc** trong bộ lọc phía trên là bộ lọc phạm vi tháng kế hoạch. Chỉ so sánh **tháng (7 ký tự đầu)** của ngày nhập, do đó bất kỳ ngày nào trong cùng tháng cũng bao gồm tháng đó.

---

## ② Trường nhập Bảng Đăng ký/Sửa

Các mục nhập của bảng bên phải mở bằng 'Thêm kế hoạch' hoặc icon sửa. **Ở chế độ sửa, không thể thay đổi tháng kế hoạch, mã mặt hàng, loại mặt hàng** (khóa).

### Thông tin cơ bản
| Trường | Vai trò / Ý nghĩa |
|------|------|
| **Tháng kế hoạch(planMonth)** | Chọn tháng sản xuất mục tiêu (`YYYY-MM`). Là tiêu chí đánh số kế hoạch. Khóa khi sửa. |
| **Loại mặt hàng(itemType)** | Chọn thành phẩm/bán thành phẩm. Cũng được dùng làm bộ lọc tìm kiếm mặt hàng. Khóa khi sửa. |
| **Mã mặt hàng(itemCode)** | Chọn mặt hàng sản xuất từ master mặt hàng bằng nút kính lúp. Không thể nhập trực tiếp (chỉ chọn tìm kiếm). Bắt buộc. |
| **Số lượng kế hoạch(planQty)** | Số lượng sản xuất mục tiêu. Phải **từ 1 trở lên** để lưu (nếu ≤ 0, nút lưu bị vô hiệu). |
| **Ưu tiên(priority)** | Giá trị từ 1~10 (mặc định 5). Số càng nhỏ càng xử lý trước. |

### Thông tin chi tiết
| Trường | Vai trò / Ý nghĩa |
|------|------|
| **Khách hàng(customer)** | Chọn từ danh sách khách hàng (nhập tùy chọn). |
| **Dây chuyền(lineCode)** | Chọn dây chuyền sản xuất cơ bản (nhập tùy chọn). Được dùng làm giá trị mặc định khi phát hành lệnh sản xuất. |
| **Ghi chú(remark)** | Ghi chú tự do (nhập tùy chọn). |

---

## ③ Trường nhập Phát hành Lệnh Sản xuất (IssueJobOrder)

Modal mở ra khi nhấn nút **Phát hành lệnh sản xuất** của kế hoạch **CONFIRMED** trong danh sách. Phía trên hiển thị tóm tắt số kế hoạch, mặt hàng, số lượng kế hoạch, số lượng phát hành, **số lượng còn lại**.

| Trường | Vai trò / Ý nghĩa |
|------|------|
| **Số lượng phát hành(issueQty)** | Số lượng sẽ xuất dưới dạng lệnh sản xuất lần này. Phải **≤ số lượng còn lại (số lượng kế hoạch − số lượng phát hành)**, nếu vượt quá cảnh báo và chặn phát hành. Bắt buộc. |
| **Ngày kế hoạch(planDate)** | Ngày sản xuất dự kiến cụ thể của lệnh sản xuất (tùy chọn). Kế hoạch là đơn vị tháng nhưng lệnh sản xuất có ngày. |
| **Dây chuyền(lineCode)** | Dây chuyền để tiến hành lệnh sản xuất. Kế thừa dây chuyền của kế hoạch làm mặc định và có thể thay đổi. |
| **Ưu tiên(priority)** | Ưu tiên lệnh sản xuất (1~10). Kế thừa giá trị kế hoạch. |
| **Tự động tạo bán thành phẩm BOM(autoCreateChildren)** | Nếu check, tự động tạo lệnh sản xuất **bán thành phẩm (SEMI_PRODUCT)** cấp dưới BOM của mặt hàng này toàn bộ các cấp. Dùng khi cần sản xuất cùng bán thành phẩm. |
| **Ghi chú(remark)** | Ghi chú lệnh sản xuất (nếu không nhập, ghi là `Phát hành từ (số kế hoạch)`). |

> Phát hành sẽ tạo lệnh sản xuất (trạng thái WAITING) và **tự động tăng số lượng phát hành của kế hoạch lên bằng số lượng phát hành**. Nếu phát hành hết số lượng còn lại, tỷ lệ phát hành trở thành 100%.

---

## ④ Mục nhập Tự động Sắp xếp (MPS)

Modal mở bằng nút **Tự động sắp xếp** ở phía trên. Tạo kế hoạch hàng loạt dưới dạng DRAFT dựa trên đơn hàng (đơn hàng khách hàng).

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Tháng mục tiêu(month)** | Tháng của kế hoạch sẽ tạo (mặc định=tháng sau). Thay đổi tháng sẽ tự động đặt khoảng thời gian giao hàng từ ngày 1~cuối tháng đó. |
| **Ngày bắt đầu·Ngày kết thúc giao hàng** | Khoảng thời gian giao hàng của đơn hàng làm mục tiêu. |
| **Khách hàng(customer)** | Có thể thu hẹp chỉ đơn hàng của khách hàng cụ thể (không chọn=tất cả). |
| **Xem trước(preview)** | Tra cứu đơn hàng phù hợp điều kiện dưới dạng bảng. Có checkbox trên mỗi hàng để chỉ chọn mục sẽ sắp xếp (hiển thị số đơn hàng·ngày giao·mặt hàng·khách hàng·số lượng đặt). |
| **Thực hiện sắp xếp** | Tạo mục đơn hàng đã chọn dưới dạng DRAFT kế hoạch sản xuất. Khi thực thi, **DRAFT hiện có của tháng đó bị xóa và sắp xếp lại**, do đó modal xác nhận xuất hiện. |

---

## Trình tự thực hiện
1. Đăng ký kế hoạch bằng **Thêm kế hoạch** (hoặc Tự động sắp xếp/Tải lên Excel) → trạng thái **DRAFT**.
2. Nếu nội dung đúng, nhấn nút **Xác nhận** trong danh sách để chuyển sang **CONFIRMED** (sau đó không thể sửa·xóa).
3. Từ kế hoạch CONFIRMED, nhấn nút **Phát hành lệnh sản xuất** để phát hành lệnh sản xuất trong phạm vi số lượng còn lại.
4. Mỗi lần phát hành, số lượng phát hành và tỷ lệ phát hành được cập nhật. Kết thúc (CLOSED) các kế hoạch không cần xử lý thêm.
5. Nếu đã xác nhận sai, nhấn **Hủy xác nhận** để quay lại DRAFT và sửa.

## Quy tắc nhập / Kiểm tra
- Mã mặt hàng là bắt buộc, số lượng kế hoạch phải **từ 1 trở lên** để lưu.
- **Chỉ DRAFT** mới sửa·xóa được (CONFIRMED·CLOSED không được).
- Lệnh sản xuất chỉ phát hành **khi CONFIRMED** và **≤ số lượng còn lại**.
- Ưu tiên trong phạm vi 1~10.
- Tải lên Excel chỉ kích hoạt nút tải lên khi tất cả hàng đều vượt qua kiểm tra (0 lỗi).

## Câu hỏi thường gặp
- **H.** Tôi đã xác nhận kế hoạch nhưng nhập sai số lượng.
  **Đ.** Nếu chưa phát hành lệnh sản xuất, nhấn **Hủy xác nhận** để quay lại DRAFT, sửa và xác nhận lại.
- **H.** Nút phát hành bị vô hiệu.
  **Đ.** Khi số lượng còn lại (số lượng kế hoạch − số lượng phát hành) bằng 0, hoặc kế hoạch không phải CONFIRMED.
- **H.** Có thể phát hành lệnh sản xuất nhiều lần từ một kế hoạch không?
  **Đ.** Có. Có thể phát hành nhiều lần miễn là còn số lượng còn lại (số lượng phát hành được tính tổng tích lũy).
- **H.** Khi thực hiện tự động sắp xếp, kế hoạch hiện có biến mất không?
  **Đ.** Chỉ **DRAFT của cùng tháng** bị thay thế bằng sắp xếp lại. Kế hoạch CONFIRMED·CLOSED không bị ảnh hưởng.

## Màn hình liên quan
- [Master Mặt hàng](/master/part) — Nơi quản lý mặt hàng sản xuất mục tiêu, BOM và định tuyến
- [Lệnh sản xuất](/production/job-order) — Nơi tra cứu và quản lý lệnh sản xuất đã phát hành từ màn hình này
