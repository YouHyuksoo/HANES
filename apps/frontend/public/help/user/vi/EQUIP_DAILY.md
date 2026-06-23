---
menuCode: EQUIP_DAILY
audience: user
title: Kiểm Tra Hằng Ngày
summary: Màn hình đăng ký và quản lý kết quả kiểm tra hằng ngày (DAILY) của thiết bị, nhập phán định ĐẠT/KHÔNG ĐẠT cho từng hạng mục kiểm tra theo thiết bị
tags: [thiết-bị, kiểm-tra, hằng-ngày, DAILY, kết-quả, quản-lý]
keywords: [EQUIP_DAILY, kiểm-tra-hằng-ngày, kiểm-tra-thiết-bị, kết-quả-kiểm-tra, PASS, FAIL, loại-phán-định, loại-đo-lường, VISUAL, MEASURE]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM]
---

# Kiểm Tra Hằng Ngày

## Mục Đích Màn Hình
Đăng ký và quản lý kết quả kiểm tra hằng ngày (DAILY) của thiết bị được thực hiện trước và sau ca làm việc. Chọn thiết bị mục tiêu từ danh sách thiết bị bên trái và phán định ĐẠT/KHÔNG ĐẠT cho từng hạng mục kiểm tra ở bảng bên phải để lưu.

## Bố Cục Màn Hình
- **Trái — Danh sách thiết bị (EquipListPanel)**: Hiển thị danh sách thiết bị cần kiểm tra trong ngày, được nhóm theo loại thiết bị. Cung cấp bộ lọc tìm kiếm và lọc theo trạng thái (Chưa kiểm tra / Hoàn thành OK / Hoàn thành NG).
- **Phải — Nhập kiểm tra (InspectEntryPanel)**: Hiển thị danh sách hạng mục kiểm tra và biểu mẫu nhập phán định cho thiết bị đã chọn.

---

## ① Cột Danh Sách Thiết Bị Bên Trái

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Mã Thiết Bị** | Mã định danh duy nhất của từng thiết bị. |
| **Tên Thiết Bị** | Tên của thiết bị. |
| **Người Kiểm Tra** | Tên công nhân đã thực hiện kiểm tra cho thiết bị đó. |
| **Kết Quả** | Kết quả kiểm tra tổng hợp (Chưa kiểm tra / Đạt / Không đạt). |
| **Số Lượng Mục** | Số lượng hạng mục kiểm tra đã đăng ký cho thiết bị. |

## ② Cấu Trúc Bảng Nhập Kiểm Tra

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Ngày Kiểm Tra** | Ngày thực hiện kiểm tra (mặc định: hôm nay). |
| **Người Kiểm Tra (Bắt buộc)** | Chọn công nhân thực hiện kiểm tra. Được truy vấn từ danh mục công nhân. |
| **Thời Gian Bắt Đầu** | Thời gian bắt đầu kiểm tra. |
| **Danh Sách Hạng Mục Kiểm Tra** | Hiển thị các hạng mục kiểm tra liên kết với thiết bị đã chọn. |
| **Nhập Phán Định** | Chọn OK (Đạt) hoặc NG (Không đạt) cho từng mục, hoặc nhập giá trị số cho loại đo lường. |
| **Phán Định Tổng Hợp** | Tự động hiển thị dựa trên kết quả phán định của tất cả các mục. |

## Cột Danh Sách Hạng Mục Kiểm Tra

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Hình Ảnh** | Hình ảnh tham chiếu kiểm tra (hình thu nhỏ). |
| **Hạng Mục Kiểm Tra** | Tên hạng mục từ danh mục hạng mục kiểm tra. |
| **Loại** | Phân loại: loại phán định (VISUAL) hoặc loại đo lường (MEASURE). |
| **Tiêu Chuẩn** | Tiêu chuẩn đánh giá ĐẠT/KHÔNG ĐẠT hoặc phạm vi đo lường. |
| **Giá Trị Đo / Nhập** | Nhập giá trị đo cho loại đo lường, chọn OK/NG cho loại phán định. |
| **Phán Định** | Kết quả OK (Đạt) hoặc NG (Không đạt). |

## Trình Tự Sử Dụng
1. Chọn thiết bị cần kiểm tra từ danh sách thiết bị bên trái.
2. Xác nhận/chọn ngày kiểm tra và người kiểm tra ở bảng bên phải.
3. Nhập kết quả cho từng hạng mục kiểm tra:
   - **Loại Phán Định (VISUAL)**: Chọn OK/NG bằng dropdown hoặc nút bấm
   - **Loại Đo Lường (MEASURE)**: Nhập giá trị đo thực tế dưới dạng số
4. Nếu có mục NG (Không đạt), nhập nội dung lỗi.
5. Nhấn nút **Lưu (PASS)** hoặc **Lưu (NG)** để lưu kết quả.

## Quy Tắc Nhập
- **Người kiểm tra là bắt buộc**.
- Phải nhập kết quả phán định cho tất cả các hạng mục kiểm tra mới có thể lưu.
- Loại đo lường tự động phán định NG nếu giá trị nằm ngoài phạm vi LSL (giới hạn dưới) và USL (giới hạn trên).
- Nếu NG (Không đạt), cần nhập nguyên nhân/ghi chú.

## Màn Hình Liên Quan
- [Lịch Kiểm Tra Hằng Ngày](/equipment/inspect-calendar) — Xem tình trạng kiểm tra hằng ngày theo lịch tháng và thực hiện kiểm tra
- [Danh Mục Hạng Mục Kiểm Tra](/master/equip-inspect-item) — Màn hình đăng ký hạng mục kiểm tra
- [Hạng Mục Kiểm Tra Theo Thiết Bị](/master/equip-inspect) — Màn hình liên kết hạng mục kiểm tra với từng thiết bị
