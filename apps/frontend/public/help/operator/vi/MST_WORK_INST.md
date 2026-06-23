---
menuCode: MST_WORK_INST
audience: operator
title: Quản lý Hướng dẫn Công việc — Hướng dẫn vận hành
summary: Ý nghĩa toàn bộ cột, DB mapping, cấu trúc tải tệp, quản lý revision và xử lý sự cố
tags: [thông tin cơ sở, hướng dẫn công việc, vận hành, cài đặt, revision]
keywords: [WORK_INSTRUCTIONS, ITEM_MASTERS, quản lý revision, tải tệp lên, CLOB, tài liệu hiện trường, tiêu chuẩn công việc, liên kết mặt hàng, MST_PART]
related: [MST_PART]
---

# Quản lý Hướng dẫn Công việc — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Quản lý **hướng dẫn công việc (Work Instruction)** dưới dạng tài liệu để công nhân hiện trường tham khảo theo từng mặt hàng·quy trình. Được liên kết dựa trên mã mặt hàng của master mặt hàng; cùng một mặt hàng có thể vận hành đồng thời nhiều phiên bản tài liệu theo quy trình·revision. Tại hiện trường sản xuất, công nhân xác nhận phương pháp·trình tự·lưu ý dựa trên tài liệu này.

## Cấu trúc dữ liệu
```
ITEM_MASTERS.ITEM_CODE
        │ (tham chiếu·liên kết — FK logic, không ràng buộc DB)
        ▼
WORK_INSTRUCTIONS (COMPOSITE PK: ITEM_CODE + PROCESS_CODE + REVISION)
        │
        ├── Thông tin cơ bản: TITLE, CONTENT(CLOB), IMAGE_URL, USE_YN
        ├── Đa khách hàng: COMPANY, PLANT_CD
        └── Lịch sử: CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY
```

---

## ① Hướng dẫn Công việc — WORK_INSTRUCTIONS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã mặt hàng | `ITEM_CODE` | **PK (1/3)**. Mặt hàng mục tiêu của hướng dẫn công việc. Kết nối logic với `ITEM_MASTERS.ITEM_CODE` (không ràng buộc FK DB). Không thể thay đổi sau khi đăng ký. |
| Mã quy trình | `PROCESS_CODE` | **PK (2/3)**. Quy trình trong mặt hàng đó. Không thể thay đổi sau khi đăng ký. |
| Phiên bản | `REVISION` | **PK (3/3)**. Phiên bản sửa đổi tài liệu. Mặc định `A`. Không thể thay đổi sau khi đăng ký. Khi cần phiên bản mới, đăng ký dòng mới. |
| Tiêu đề tài liệu | `TITLE` | Tiêu đề hướng dẫn công việc. Hiển thị trong danh sách·xem trước. Dùng để nhận dạng tại hiện trường. |
| Nội dung | `CONTENT` | **Kiểu CLOB**. Nội dung chính như trình tự thao tác·lưu ý. Có thể lưu văn bản dài. |
| URL tệp đính kèm | `IMAGE_URL` | Đường dẫn tệp đã tải lên hoặc URL bên ngoài. `varchar2(500)`. |
| Sử dụng hay không | `USE_YN` | `Y` = hoạt động (hiển thị danh sách), `N` = không hoạt động (khái niệm xóa mềm). Mặc định `Y`. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi mã công ty(`40`) / mã nhà máy(`1000`). Tự động áp dụng cho mọi truy vấn. |
| Người tạo | `CREATED_BY` | Người dùng đăng ký đầu tiên. |
| Người sửa | `UPDATED_BY` | Người dùng sửa cuối cùng. |
| Ngày tạo | `CREATED_AT` | Thời điểm đăng ký đầu tiên (tự động). |
| Ngày sửa cuối | `UPDATED_AT` | Thời điểm sửa cuối cùng (tự động). Hiển thị trong danh sách. |

---

## Cấu trúc tải tệp lên

- **Endpoint tải lên**: `POST /master/work-instructions/upload` (multipart/form-data)
- **Đường dẫn lưu**: Lưu trong thư mục Server `./uploads/work-instructions/` với tên tệp dựa trên timestamp
- **Định dạng cho phép**: Hình ảnh(`image/*`), PDF, tài liệu Office(`.doc/.docx/.xls/.xlsx`), văn bản(`.txt`)
- **Kích thước tối đa**: 10MB
- **Nhập URL trực tiếp**: Có thể nhập URL bên ngoài thay vì tải lên (hình ảnh·PDF v.v.)
- **Giá trị trả về**: `{ url, originalName, size }` — url được lưu vào `IMAGE_URL` trên màn hình

> `IMAGE_URL` là đường dẫn tệp đã tải lên hay URL bên ngoài không được tự động phân biệt. Khi vận hành, hãy chú ý đến tính hợp lệ của đường dẫn.

---

## Quản lý Revision

- Có thể có nhiều dòng `REVISION` với cùng `ITEM_CODE + PROCESS_CODE`.
- Revision được vận hành tuần tự nhưng hệ thống không tự động tăng. Người vận hành chỉ định rõ ràng.
- Mọi truy vấn đều sắp xếp `REVISION DESC` nên revision mới nhất hiển thị trước.
- Có thể vô hiệu hóa revision cũ không cần thiết bằng `USE_YN='N'` (không xóa vật lý, chỉ xóa mềm).

---

## Quy trình vận hành
1. Tại **Master Mặt hàng**, xác nhận mặt hàng cần hướng dẫn công việc.
2. Tại màn hình **Quản lý Hướng dẫn Công việc**, đăng ký tài liệu với mã mặt hàng·mã quy trình tương ứng.
3. Tải lên tệp đính kèm (hình ảnh/PDF tiêu chuẩn công việc) và viết trình tự thao tác trong nội dung.
4. Nếu cần sửa đổi tài liệu, đăng ký thêm với PK giống tài liệu hiện tại nhưng revision mới (ví dụ: B).
5. Khi tham khảo tài liệu tại hiện trường, revision mới nhất được ưu tiên hiển thị.

## Phân quyền
Người dùng có quyền quản lý dữ liệu master (quản trị viên thông tin cơ sở). Người dùng thông thường chỉ được xem (theo chính sách quyền truy cập màn hình).

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Nút lưu bị vô hiệu hóa | Thiếu mã mặt hàng·mã quy trình·tiêu đề | Điền đầy đủ các trường bắt buộc |
| Lỗi "Trùng tài liệu" | PK (mặt hàng+quy trình+revision) đã tồn tại | Thay đổi revision hoặc sửa tài liệu hiện có |
| Tải tệp lên thất bại | Vượt quá 10MB hoặc định dạng không hỗ trợ | Kiểm tra kích thước·định dạng tệp |
| Không thấy hình ảnh trong xem trước | Đường dẫn `IMAGE_URL` không đúng hoặc tệp đã bị xóa | Kiểm tra URL/đường dẫn tệp |
| Là hình ảnh nhưng hiển thị dạng PDF | Phần mở rộng URL không phải định dạng hình ảnh | Kiểm tra URL kết thúc bằng `.jpg/.png/.gif` |

## Dữ liệu & Liên kết
- **Bảng**: `WORK_INSTRUCTIONS`
- **Liên kết**: `ITEM_MASTERS.ITEM_CODE` (tham chiếu logic), bộ nhớ tải tệp lên
- **Phạm vi**: `COMPANY='40'`, `PLANT_CD='1000'`
- **Lưu tệp**: Server local `./uploads/work-instructions/` (có thể mở rộng khi cần kết nối bộ nhớ tệp riêng)
