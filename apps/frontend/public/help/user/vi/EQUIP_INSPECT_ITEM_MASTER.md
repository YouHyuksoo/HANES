---
menuCode: EQUIP_INSPECT_ITEM_MASTER
audience: user
title: Danh mục hạng mục kiểm tra
summary: Màn hình dữ liệu chuẩn để đăng ký, sửa đổi, xóa hạng mục kiểm tra (mã hạng mục, loại kiểm tra, tiêu chuẩn đánh giá, chu kỳ) theo loại thiết bị
tags: [설비, 점검, 항목, 마스터, 기준정보, 관리]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, 점검항목, 설비점검, 일상점검, 정기점검, PM, 작업자점검, 판정형, 측정형, VISUAL, MEASURE, LSL, USL]
related: [EQUIP_INSPECT_ITEM]
---

# Danh mục hạng mục kiểm tra

## Mục đích màn hình
Đăng ký và quản lý **Hạng mục kiểm tra** (Inspection Item) dùng cho kiểm tra thiết bị dưới dạng dữ liệu chuẩn. Mỗi hạng mục có các thuộc tính như loại kiểm tra (hàng ngày/định kỳ/PM/nhân viên), loại đánh giá (trực quan/đo lường), chu kỳ, tiêu chuẩn đánh giá (giới hạn trên/dưới). Các hạng mục đã đăng ký được liên kết với từng thiết bị trên màn hình [Hạng mục kiểm tra theo thiết bị].

## Bố cục màn hình
- **Danh sách DataGrid**: Hiển thị danh sách các hạng mục kiểm tra đã đăng ký kèm ảnh, mã hạng mục, loại thiết bị, tên hạng mục kiểm tra, loại kiểm tra, loại đánh giá, tiêu chuẩn đánh giá, chu kỳ và trạng thái sử dụng.
- **Bảng điều khiển bên phải (Đăng ký/Sửa)**: Bảng trượt mở ra bên phải khi thêm hoặc sửa hạng mục.
- **Bộ lọc trên cùng**: Từ khóa tìm kiếm + loại thiết bị + chọn loại kiểm tra

---

## ① Cột danh sách DataGrid

| Cột | Vai trò / Mô tả |
|------|------|
| **Ảnh (imageUrl)** | Ảnh tham chiếu liên quan đến hạng mục kiểm tra. Hiển thị dạng thumbnail, nhấp để phóng to. |
| **Mã hạng mục (itemCode)** | Mã duy nhất xác định hạng mục kiểm tra. Không thể sửa sau khi đăng ký. |
| **Loại thiết bị (equipType)** | Loại thiết bị mà hạng mục kiểm tra này áp dụng (mã chung `EQUIP_TYPE`). |
| **Tên hạng mục kiểm tra (itemName)** | Tên của hạng mục kiểm tra. |
| **Loại kiểm tra (inspectType)** | Phân loại theo chủ thể/thời điểm kiểm tra. **DAILY** (kiểm tra hàng ngày, xanh dương) / **PERIODIC** (kiểm tra định kỳ, cam) / **PM** (bảo trì phòng ngừa, tím) / **WORKER** (kiểm tra nhân viên, xanh lá). |
| **Loại đánh giá (itemType)** | Phương thức đánh giá kết quả kiểm tra. **VISUAL** (đánh giá trực quan, xám) = OK/NG bằng mắt thường / **MEASURE** (đo lường, xanh lơ) = đo giá trị số. |
| **Tiêu chuẩn đánh giá (criteria)** | Tiêu chuẩn đạt/không đạt của kết quả kiểm tra. Loại đo lường hiển thị dưới dạng **Giới hạn dưới (LSL) ~ Giới hạn trên (USL)** kèm đơn vị. |
| **Chu kỳ (cycle)** | Chu kỳ thực hiện kiểm tra. DAILY / WEEKLY / MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL. |
| **Sử dụng (useYn)** | `Y` (xanh lá) = Đang sử dụng, `N` (đỏ) = Không sử dụng. |

---

## ② Trường bảng đăng ký/sửa

| Trường | Vai trò / Mô tả |
|------|------|
| **Mã hạng mục (itemCode)** | Mã nhận dạng duy nhất của hạng mục kiểm tra. Không thể sửa sau khi đăng ký. |
| **Loại thiết bị (equipType)** | Loại thiết bị mà hạng mục kiểm tra áp dụng. |
| **Tên hạng mục kiểm tra (itemName)** | Tên gọi của hạng mục kiểm tra. |
| **Loại kiểm tra (inspectType)** | Chọn loại kiểm tra (DAILY/PERIODIC/PM/WORKER). |
| **Loại đánh giá (itemType)** | **VISUAL** (đánh giá trực quan): Đánh giá OK/NG bằng mắt thường / **MEASURE** (đo lường): Đo giá trị số để kiểm tra trong phạm vi tiêu chuẩn. |
| **Chu kỳ (cycle)** | Chọn chu kỳ thực hiện kiểm tra. |
| **Sử dụng (useYn)** | Trạng thái sử dụng (Y/N). |
| **Tiêu chuẩn đánh giá (criteria)** | VISUAL: Nhập văn bản tiêu chuẩn đánh giá OK/NG. / MEASURE: Chọn đơn vị + nhập giá trị **Giới hạn dưới (LSL)** + **Giới hạn trên (USL)**. |
| **Ảnh (imageUrl)** | Tải lên ảnh tham chiếu kiểm tra (JPEG/PNG/GIF/WebP). Có thể tải lên bằng cách nhấp hoặc kéo & thả. |
| **Ghi chú (remark)** | Ghi chú quản lý bổ sung. |

## Trình tự sử dụng
1. Nhấp nút **Thêm** để đăng ký hạng mục kiểm tra mới (bảng bên phải).
2. Nhập các thuộc tính như loại kiểm tra, loại đánh giá, chu kỳ. Với loại đo lường, thiết lập giá trị tiêu chuẩn giới hạn trên/dưới.
3. Tải lên ảnh tham chiếu kiểm tra nếu cần.
4. Nhấp biểu tượng sửa trong danh sách để sửa hạng mục hiện có.
5. Các hạng mục đã đăng ký được liên kết với từng thiết bị trên màn hình [Hạng mục kiểm tra theo thiết bị].

## Quy tắc nhập / Xác thực
- Mã hạng mục và tên hạng mục kiểm tra là **trường bắt buộc**.
- Với loại đo lường (MEASURE), phải nhập cả giới hạn dưới (LSL) và giới hạn trên (USL).
- Chỉ có thể tải lên tệp ảnh (JPEG/PNG/GIF/WebP), giới hạn tối đa 5MB.

## Câu hỏi thường gặp
- **H.** Sự khác biệt giữa các loại kiểm tra là gì? **Đ.** **DAILY**=kiểm tra hàng ngày trước khi làm việc, **PERIODIC**=định kỳ (tháng/quý/nửa năm/năm), **PM**=bảo trì phòng ngừa thiết bị, **WORKER**=kiểm tra do nhân viên tự thực hiện.
- **H.** Sự khác biệt giữa loại đánh giá trực quan (VISUAL) và đo lường (MEASURE) là gì? **Đ.** Loại trực quan là đánh giá định tính như OK/NG, loại đo lường là đo giá trị cụ thể để kiểm tra xem có nằm trong phạm vi tiêu chuẩn (giới hạn dưới~giới hạn trên) hay không.
- **H.** Có thể thay đổi mã hạng mục sau khi đăng ký không? **Đ.** Không, vì đó là khóa chính. Phải xóa và đăng ký lại.

## Màn hình liên quan
- [Hạng mục kiểm tra theo thiết bị](/master/equip-inspect) — Màn hình liên kết các hạng mục kiểm tra đã đăng ký với từng thiết bị
