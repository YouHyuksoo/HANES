---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: user
title: Lịch Kiểm Tra Định Kỳ
summary: Xem lịch kiểm tra định kỳ theo tháng (tự động tính từ danh mục hạng mục và chu kỳ của từng thiết bị) và nhập kết quả kiểm tra (đạt/không đạt) theo ngày
tags: [thiết-bị, kiểm-tra-định-kỳ, lịch-kiểm-tra, bảo-trì-phòng-ngừa, PERIODIC]
keywords: [kiểm-tra-định-kỳ, lịch-kiểm-tra, chu-kỳ-kiểm-tra, cycle, kiểm-tra-theo-chu-kỳ, kiểm-tra-hàng-tháng, kiểm-tra-hàng-tuần, kiểm-tra-phòng-ngừa, đạt, không-đạt, PASS, FAIL, trễ-hạn, OVERDUE, khóa-liên-động, INTERLOCK, thêm-kiểm-tra-riêng-lẻ]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM, EQUIP_PERIODIC]
---

# Lịch Kiểm Tra Định Kỳ

## Mục Đích Màn Hình
Màn hình này quản lý **kiểm tra định kỳ** (kiểm tra phòng ngừa thực hiện theo chu kỳ) của thiết bị dưới dạng lịch tháng.
Dựa trên **chu kỳ (cycle)** được định nghĩa trong danh mục hạng mục kiểm tra theo từng thiết bị, "ngày nào cần kiểm tra thiết bị nào" được tự động tính toán và hiển thị trên lịch. Chọn ngày để nhập kết quả kiểm tra (đạt/không đạt) theo từng thiết bị.

> Cấu trúc màn hình và thao tác giống hệt lịch kiểm tra hằng ngày; chỉ khác **loại kiểm tra là định kỳ (PERIODIC)**. Hạng mục và kết quả kiểm tra được quản lý riêng biệt với kiểm tra hằng ngày.

## Bố Cục Màn Hình
- **Thanh tiêu đề trên**: Bộ lọc công đoạn, nút tạo tháng hiện/tháng sau, làm mới
- **4 Thẻ thống kê tháng**: Tổng kế hoạch / Hoàn thành / Không đạt / Trễ hạn
- **Trái — Lịch**: Hiển thị tiến độ kiểm tra theo ngày bằng màu sắc và thanh tiến độ
- **Phải — Bảng theo ngày**: Danh sách thiết bị cần kiểm tra vào ngày đã chọn + thực hiện/thêm kiểm tra riêng lẻ
- **Cửa sổ thực hiện kiểm tra**: Nhập đạt/không đạt theo từng hạng mục và lưu

## Mối Quan Hệ Khái Niệm
```
Hạng mục kiểm tra theo thiết bị (chu kỳ cycle) ──tự động lập lịch──▶ Lịch (đối tượng kiểm tra theo ngày) ──chọn ngày──▶ Thực hiện kiểm tra (đạt/không đạt theo hạng mục) ──▶ Kết quả tổng hợp (PASS/FAIL)
```

---

## ① Thanh Tiêu Đề Trên

| Mục | Chức năng / Ý nghĩa |
|------|------|
| **Bộ lọc công đoạn** | Chỉ hiển thị thiết bị của công đoạn cụ thể trên lịch và bảng theo ngày. Để trống để hiển thị tất cả công đoạn. |
| **Tạo tháng hiện tại** | Chuyển đến tháng hiện tại và tính lại lịch kiểm tra cho tháng đó. |
| **Tạo tháng sau** | Chuyển đến tháng sau để xem trước lịch kiểm tra của tháng tiếp theo. |
| **Làm mới** | Tải lại dữ liệu của tháng đang xem. |

## ② Thẻ Thống Kê Tháng

| Thẻ | Chức năng / Ý nghĩa |
|------|------|
| **Tổng kế hoạch** | Tổng số (thiết bị × ngày) kiểm tra dự kiến trong tháng. Tự động tính theo chu kỳ (cycle). |
| **Hoàn thành** | Số lượng kiểm tra đã hoàn thành với kết quả được nhập. |
| **Không đạt** | Số lượng kiểm tra có kết quả tổng hợp là **không đạt (FAIL)**. |
| **Trễ hạn** | Số ngày có lịch kiểm tra đã qua nhưng chưa được kiểm tra — **OVERDUE**. |

## ③ Lịch

Mỗi ô ngày hiển thị tiến độ kiểm tra trong ngày một cách trực quan.

| Hiển thị | Chức năng / Ý nghĩa |
|------|------|
| **Văn bản tỷ lệ (N/M)** | Số lượng hoàn thành / tổng số kế hoạch. |
| **Thanh tiến độ** | Hiển thị tỷ lệ hoàn thành dưới dạng thanh. |
| **Màu trạng thái** | Phân biệt trạng thái theo màu sắc theo từng ngày (xem bên dưới). |

> Trạng thái ngày (status)
> - **Tất cả đạt (ALL_PASS)**: Đã hoàn thành tất cả kiểm tra kế hoạch và không có kết quả không đạt — xanh lá
> - **Có không đạt (HAS_FAIL)**: Có ít nhất một trường hợp không đạt — đỏ
> - **Đang tiến hành (IN_PROGRESS)**: Hoàn thành một phần — vàng
> - **Trễ hạn (OVERDUE)**: Đã qua ngày dự kiến nhưng chưa bắt đầu — viền đỏ
> - **Chưa bắt đầu (NOT_STARTED)**: Ngày kế hoạch trong tương lai chưa đến
> - **Không có (NONE)**: Không có lịch kiểm tra trong ngày đó

## ④ Bảng Theo Ngày — Thẻ Thiết Bị

Thiết bị cần kiểm tra vào ngày đã chọn được liệt kê dưới dạng thẻ.

| Mục | Chức năng / Ý nghĩa |
|------|------|
| **Mã thiết bị / Tên thiết bị** | Thiết bị cần kiểm tra. |
| **Dây chuyền / Loại thiết bị** | Mã dây chuyền và loại thiết bị (thông tin tham khảo). |
| **Biểu tượng trạng thái** | Biểu thị đạt (dấu tích xanh) / không đạt (dấu X đỏ) / chưa kiểm tra (đồng hồ xám). |
| **Kết quả tổng hợp** | Hiển thị bằng nhãn PASS/FAIL khi hoàn thành kiểm tra. |
| **Nhãn hạng mục kiểm tra** | Các hạng mục kiểm tra của thiết bị đó. Mỗi hạng mục hiển thị ✅đạt / ❌không đạt / ⏳chưa kiểm tra. |
| **Người kiểm tra** | Tên công nhân thực hiện kiểm tra. |
| **Nút Thực hiện / Chỉnh sửa** | **Thực hiện kiểm tra** nếu chưa kiểm tra; **Chỉnh sửa** để sửa kết quả đã hoàn thành. |
| **Thêm kiểm tra riêng lẻ** | Nút ở góc trên phải bảng. Cho phép chọn thêm thiết bị không có trong lịch tự động để kiểm tra. |

## ⑤ Cửa Sổ Thực Hiện Kiểm Tra

| Mục | Chức năng / Ý nghĩa |
|------|------|
| **Ngày kiểm tra** | Tự động đặt theo ngày đã chọn (không thể thay đổi). |
| **Người kiểm tra** | Chọn công nhân thực hiện kiểm tra. |
| **Hạng mục kiểm tra (thứ tự, tên hạng mục, tiêu chuẩn, hình ảnh tiêu chuẩn)** | Hiển thị các hạng mục và tiêu chuẩn đánh giá được định nghĩa trong danh mục. Nếu có hình ảnh tiêu chuẩn sẽ hiển thị kèm theo. |
| **Kết quả (Đạt/Không đạt)** | Chọn PASS hoặc FAIL cho từng hạng mục. |
| **Lý do không đạt (Ghi chú)** | Nhập lý do khi hạng mục được đánh dấu là FAIL. |
| **Kết quả tổng hợp** | Tự động tính từ kết quả đã nhập. **Chỉ cần 1 hạng mục FAIL thì kết quả tổng hợp là FAIL**; tất cả đạt thì là PASS. |
| **Ghi chú chung** | Ghi chú tổng quát cho toàn bộ lần kiểm tra (tùy chọn). |

> ⚠️ Nếu kết quả tổng hợp được lưu là **không đạt (FAIL)**, thiết bị đó sẽ tự động chuyển sang trạng thái **khóa liên động (INTERLOCK)**. Sau khi xử lý nguyên nhân, cần khôi phục trạng thái thiết bị về bình thường.

## ⑥ Cửa Sổ Thêm Kiểm Tra Riêng Lẻ

| Mục | Chức năng / Ý nghĩa |
|------|------|
| **Chọn thiết bị** | Chọn thiết bị cần kiểm tra. Khi chọn, **hạng mục kiểm tra định kỳ** của thiết bị đó sẽ tự động được tải từ danh mục. |
| **Tiếp theo** | Mở cửa sổ thực hiện kiểm tra với các hạng mục đã tải. |

---

## Trình Tự Sử Dụng
1. Dùng **bộ lọc công đoạn** (nếu cần) và nút **tạo tháng hiện/tháng sau** để hiển thị tháng cần kiểm tra.
2. **Nhấp vào ngày** trên lịch, phía bên phải sẽ hiển thị thiết bị cần kiểm tra trong ngày đó.
3. Nhấn **Thực hiện kiểm tra** trên thẻ thiết bị để nhập **đạt/không đạt** cho từng hạng mục (nhập lý do nếu không đạt).
4. Sau khi **lưu**, kết quả tổng hợp được tính tự động và tiến độ lịch được cập nhật.
5. Để kiểm tra thiết bị không có trong lịch tự động, sử dụng **Thêm kiểm tra riêng lẻ**.

## Quy Tắc Nhập / Xác Nhận
- **Tất cả hạng mục phải chọn đạt/không đạt** thì kết quả tổng hợp mới được xác định (nếu có hạng mục chưa nhập, sẽ có xác nhận trước khi lưu).
- **Hạng mục không đạt** theo nguyên tắc phải nhập lý do (ghi chú).
- Ngày kiểm tra cố định theo ngày đã chọn trên lịch.
- Kiểm tra định kỳ của cùng một thiết bị vào cùng một ngày được quản lý như 1 bản ghi; kiểm tra lại sử dụng **Chỉnh sửa** để sửa đổi.

## Câu Hỏi Thường Gặp
- **Q.** Lịch không hiển thị đối tượng kiểm tra.
  **A.** Cần đăng ký **hạng mục kiểm tra định kỳ (PERIODIC)** và **chu kỳ (cycle)** trong danh mục hạng mục kiểm tra theo từng thiết bị. Theo chu kỳ, chỉ hiển thị vào ngày tương ứng (hàng tuần = thứ Hai, hàng tháng = ngày 1 mỗi tháng).
- **Q.** Khác gì so với kiểm tra hằng ngày?
  **A.** Thao tác màn hình giống nhau, nhưng loại kiểm tra là định kỳ, và hạng mục/kết quả được thống kê riêng biệt với kiểm tra hằng ngày.
- **Q.** Thiết bị bị khóa sau khi lưu kết quả không đạt.
  **A.** Khi không đạt, thiết bị sẽ vào trạng thái khóa liên động (INTERLOCK). Sau khi xử lý nguyên nhân, hãy chuyển trạng thái thiết bị về bình thường.
- **Q.** OVERDUE hiển thị khi nào?
  **A.** Hiển thị vào ngày có lịch kiểm tra đã qua nhưng hoàn toàn không có bản ghi kiểm tra nào.

## Màn Hình Liên Quan
- [Lịch Kiểm Tra Hằng Ngày](/equipment/inspect-calendar) — Kiểm tra hằng ngày thực hiện mỗi ngày
- [Hạng Mục Kiểm Tra Theo Thiết Bị](/master/equip-inspect) — Nơi liên kết hạng mục và chu kỳ kiểm tra định kỳ với thiết bị
- [Kết Quả Kiểm Tra Định Kỳ](/equipment/periodic-inspect) — Xem danh sách bản ghi kiểm tra định kỳ
