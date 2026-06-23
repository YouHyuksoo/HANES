---
menuCode: MST_WORK_INST
audience: user
title: Quản lý Hướng dẫn Công việc
summary: Màn hình đăng ký, sửa, xem, xóa hướng dẫn công việc (tài liệu·hình ảnh) theo mặt hàng/quy trình
tags: [thông tin cơ sở, hướng dẫn công việc, chỉ thị, tài liệu quy trình]
keywords: [hướng dẫn công việc, Work Instruction, tiêu chuẩn công việc, trình tự công việc, revision, tài liệu quy trình, tài liệu hiện trường, thông tin cơ sở]
related: [MST_PART]
---

# Quản lý Hướng dẫn Công việc

## Mục đích màn hình
Đăng ký và quản lý **hướng dẫn công việc (Work Instruction)** theo mặt hàng và quy trình. Quản lý dưới dạng tài liệu bao gồm trình tự thao tác, lưu ý, hình ảnh/tệp tham khảo mà công nhân hiện trường cần thực hiện. Tài liệu được xác định bằng tổ hợp mặt hàng·quy trình·revision và có thể cấp revision để quản lý lịch sử.

## Bố cục màn hình
- **Khu vực chính — Danh sách DataGrid**: Hiển thị danh sách hướng dẫn công việc đã đăng ký. Cung cấp chức năng lọc cột, sắp xếp, xuất Excel.
- **Bảng điều khiển bên phải (Xem trước)**: Khi nhấp vào dòng, hiển thị thông tin chi tiết hướng dẫn (tiêu đề·revision·tệp đính kèm·nội dung) ở bên phải.
- **Bảng điều khiển bên phải (Đăng ký/Sửa)**: Khi nhấp vào nút thêm hoặc sửa, bảng biểu mẫu mở ra bên phải.

---

## ① Cột Danh sách DataGrid

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng(itemCode)** | Mã của mặt hàng được áp dụng hướng dẫn công việc. Tham chiếu `ITEM_MASTERS.ITEM_CODE`. |
| **Tên mặt hàng(itemName)** | Tên của mặt hàng mục tiêu. |
| **Mã quy trình(processCode)** | Mã quy trình mà hướng dẫn công việc thuộc về. Cùng với mã mặt hàng và revision tạo thành định danh (PK) của tài liệu. |
| **Tiêu đề tài liệu(title)** | Tiêu đề của hướng dẫn công việc. Là tiêu chí phân biệt tài liệu tại hiện trường. |
| **Phiên bản(revision)** | Phiên bản sửa đổi của tài liệu. Mặc định là `A` khi đăng ký mới, khi sửa đổi sẽ tăng lên B, C, ... |
| **Ngày sửa cuối(updatedAt)** | Thời điểm tài liệu được sửa lần cuối. |
| **Sử dụng hay không(useYn)** | `Y` = đang sử dụng (hoạt động), `N` = không sử dụng (không hoạt động). Hiển thị bằng chấm tròn xanh/xám. |

---

## ② Trường Biểu mẫu Đăng ký/Sửa

| Trường | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng(itemCode)** | Mã mặt hàng áp dụng hướng dẫn công việc. Không thể sửa sau khi đăng ký. |
| **Mã quy trình(processCode)** | Quy trình mà hướng dẫn công việc thuộc về trong mặt hàng đó. Không thể sửa sau khi đăng ký. |
| **Tiêu đề tài liệu(title)** | Tiêu đề của hướng dẫn công việc. Trường bắt buộc. |
| **Phiên bản(revision)** | Phiên bản tài liệu. Nếu để trống sẽ lưu là `A`, không thể sửa sau khi đăng ký. |
| **Tệp đính kèm(imageUrl)** | Tệp hình ảnh/PDF/tài liệu đính kèm vào hướng dẫn công việc. Có thể **kéo thả hoặc chọn tệp** để tải lên, hoặc **nhập trực tiếp URL**. |
| **Nội dung(content)** | Nội dung chính của hướng dẫn công việc như trình tự thao tác, lưu ý. |

---

## Trình tự thực hiện
1. Nhấp nút **Thêm** để đăng ký hướng dẫn công việc mới (bảng bên phải).
2. Nhập mã mặt hàng·mã quy trình·tiêu đề tài liệu, nếu cần thì tải lên tệp đính kèm và viết nội dung.
3. Nhấp vào dòng trong danh sách để xem chi tiết ở chế độ **Xem trước**.
4. Trong chế độ xem trước, nhấp nút **Sửa** hoặc biểu tượng chỉnh sửa trên lưới để thay đổi nội dung.

## Quy tắc nhập / Kiểm tra
- Mã mặt hàng·mã quy trình·tiêu đề tài liệu là **bắt buộc nhập**. Nếu bất kỳ trường nào trống, nút lưu sẽ bị vô hiệu hóa.
- Không thể đăng ký trùng tổ hợp `mã mặt hàng + mã quy trình + revision`.
- Tệp đính kèm hỗ trợ hình ảnh, PDF, tài liệu Office, tệp TXT, giới hạn **tối đa 10MB**.

## Câu hỏi thường gặp
- **H.** Làm thế nào để quản lý revision? **Đ.** Khi đăng ký mới, mặc định là `A`. Khi sửa tài liệu hiện tại, có thể giữ nguyên revision hoặc tạo revision mới (ví dụ: B). Có thể duy trì nhiều revision cho cùng mặt hàng·quy trình.
- **H.** Có thể thay đổi mã mặt hàng·mã quy trình đã đăng ký không? **Đ.** Sau khi đăng ký, không thể thay đổi PK (mã mặt hàng·mã quy trình·revision). Phải đăng ký dưới dạng tài liệu mới.
- **H.** Có thể chỉ nhập URL mà không tải tệp lên không? **Đ.** Có, có thể nhập trực tiếp URL của hình ảnh/tài liệu bên ngoài. Có thể chọn giữa tải lên và URL.

## Màn hình liên quan
- [Master Mặt hàng](/master/part) — Màn hình đăng ký·quản lý mặt hàng là đối tượng của hướng dẫn công việc
