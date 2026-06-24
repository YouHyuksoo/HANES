---
menuCode: QC_INSPECT
audience: user
title: Kiểm Tra Ngoại Quan
summary: Màn hình kiểm tra trực quan sản phẩm đã hoàn thành, xác định ĐẠT/KHÔNG ĐẠT (PASS/FAIL) và đăng ký lịch sử kiểm tra
tags: [chất lượng, kiểm-tra-ngoại-quan, VISUAL, xác-định-đạt-không-đạt, nhãn-FG]
keywords: [QC_INSPECT, kiểm-tra-ngoại-quan, VISUAL, FG_BARCODE, PASS, FAIL, VISUAL_DEFECT, đạt, không-đạt]
related: [QC_DEFECT_CODE, QC_DEFECT]
---

# Kiểm Tra Ngoại Quan

## Mục Đích Màn Hình
Kiểm tra trực quan sản phẩm đã hoàn thành và đã được phát hành nhãn FG, xác định ĐẠT (PASS) hoặc KHÔNG ĐẠT (FAIL), và đăng ký kết quả.

## Bố Cục Màn Hình
- **Bên trái — Danh sách Lệnh SX**: Danh sách lệnh sản xuất (đã hoàn thành) cần kiểm tra ngoại quan. Có thể tìm kiếm theo số lệnh SX và mã mặt hàng.
- **Bên phải — Bảng Kiểm Tra Ngoại Quan**: Hiển thị quét mã vạch FG, xác định đạt/không đạt và lịch sử kiểm tra cho lệnh SX đã chọn.

---

## Trình Tự Sử Dụng
1. Chọn lệnh sản xuất cần kiểm tra từ danh sách bên trái.
2. Quét mã vạch sản phẩm vào ô nhập mã vạch FG.
3. Xác nhận thông tin sản phẩm đã quét.
4. Nhấn nút **ĐẠT (PASS)** hoặc **KHÔNG ĐẠT (FAIL)** để xác định kết quả.
   - Khi KHÔNG ĐẠT, phải nhập mã lỗi và lý do chi tiết.
5. Kết quả kiểm tra được phản ánh ngay vào lưới lịch sử ở góc dưới bên phải.

## Quy Tắc Nhập
- Chỉ kiểm tra được nhãn FG ở trạng thái **ISSUED** (sản phẩm đã kiểm tra, đóng gói, xuất hàng không thể kiểm tra).
- Mã vạch đã quét phải thuộc lệnh sản xuất đã chọn.
- Khi KHÔNG ĐẠT (FAIL) phải nhập mã lỗi (mã nhóm `VISUAL_DEFECT`) và lý do chi tiết.
- Sản phẩm đã kiểm tra xong không thể kiểm tra lại.

## Các Cột Lịch Sử Kiểm Tra

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Thời gian kiểm tra** | Ngày giờ thực hiện kiểm tra ngoại quan. |
| **Kết quả** | Kết quả ĐẠT (PASS/xanh) hoặc KHÔNG ĐẠT (FAIL/đỏ). |
| **Mã vạch FG** | Mã vạch FG của sản phẩm được kiểm tra. |
| **Mã lỗi** | Mã lỗi đã chọn khi KHÔNG ĐẠT. |
| **Lý do chi tiết** | Nội dung lỗi chi tiết đã nhập khi KHÔNG ĐẠT. |

## Màn Hình Liên Quan
- [Quản lý Mã lỗi](/quality/defect-code) — Màn hình đăng ký mã lỗi (`VISUAL_DEFECT`) dùng cho kiểm tra ngoại quan
- [Quản lý Lỗi](/quality/defect) — Màn hình tra cứu lịch sử lỗi đã đăng ký
