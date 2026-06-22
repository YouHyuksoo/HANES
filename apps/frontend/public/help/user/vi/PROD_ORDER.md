---
menuCode: PROD_ORDER
audience: user
title: Quản lý Lệnh Sản xuất
summary: Màn hình chỉ đạo sản xuất thành phẩm/bán thành phẩm, quản lý trạng thái bắt đầu, tạm dừng, hoàn thành, hủy và tự động tạo lệnh sản xuất bán thành phẩm dựa trên BOM
tags: [sản xuất, lệnh sản xuất, WO, quản lý trạng thái, BOM]
keywords: [lệnh sản xuất, WO, số lệnh, số lệnh sản xuất, bắt đầu, khởi công, hoàn thành, tạm dừng, giữ, hủy, sản lượng, ưu tiên, số lượng kế hoạch, ngày kế hoạch, BOM, bán thành phẩm, tự động tạo, treeview, định tuyến, công đoạn, thiết bị, tiến độ, phát hành trước]
related: [PROD_RESULT, MST_PART]
---

# Quản lý Lệnh Sản xuất

## Mục đích màn hình
Tạo **lệnh sản xuất (lệnh sản xuất)** cho thành phẩm/bán thành phẩm và quản lý trạng thái tiến triển sản xuất.
1 lệnh sản xuất là chỉ thị "làm mặt hàng nào, khi nào (ngày kế hoạch), bao nhiêu cái (số lượng kế hoạch)", sau khi tạo tiến triển qua **Bắt đầu → Hoàn thành**. Có thể **Tạm dừng** hoặc **Hủy** nếu cần.

> Lệnh sản xuất là điểm khởi đầu của sản lượng sản xuất, kiểm tra, xuất hàng. Nếu không có lệnh sản xuất, không thể đăng ký sản lượng cho mặt hàng đó.

## Bố cục màn hình
- **Phía trên — Tiêu đề·Nút**: Xem công cụ, Làm mới, Chuyển chế độ xem danh sách/cây, Tạo lệnh sản xuất.
- **Thanh hành động**: Khi chọn hàng, hiển thị số·trạng thái lệnh sản xuất đó và chỉ kích hoạt nút hành động khả dụng ở trạng thái hiện tại (Bắt đầu/Hoàn thành/Tạm dừng/Giải phóng tạm dừng/Hủy). Nút in phiếu lệnh sản xuất cũng ở đây.
- **Danh sách (grid)**: Danh sách lệnh sản xuất. Phía trên có bộ lọc tìm kiếm, trạng thái, thiết bị, công đoạn, ngày kế hoạch.
- **Bảng trượt bên phải**: Form nhập tạo/sửa (mở từ bên phải).

## Luồng trạng thái
Lệnh sản xuất có 5 trạng thái sau, chỉ chuyển theo thứ tự định trước.

```
WAITING(Chờ) ──Bắt đầu──▶ RUNNING(Đang tiến hành) ──Hoàn thành──▶ DONE(Hoàn thành)
   │                        │
   │                        └──Tạm dừng──┐
   └──Tạm dừng───────────────────────────┤
   │                                 ▼
   │                            HOLD(Tạm dừng) ──Giải phóng tạm dừng──▶ Quay lại trạng thái trước
   │
   └──Hủy──▶ CANCELED(Đã hủy)   (Có thể hủy ngay cả ở trạng thái HOLD)
```

| Trạng thái | Ý nghĩa |
|------|------|
| **Chờ (WAITING)** | Trạng thái mặc định ngay sau khi tạo. Chưa bắt đầu công việc. Có thể Bắt đầu, Tạm dừng, Hủy. |
| **Đang tiến hành (RUNNING)** | Trạng thái đã bắt đầu công việc. Đăng ký sản lượng sản xuất ở trạng thái này. Có thể Hoàn thành, Tạm dừng. |
| **Tạm dừng (HOLD)** | Trạng thái tạm thời giữ. **Đăng ký sản lượng·xuất hàng đều bị chặn**. Giải phóng tạm dừng để quay lại trạng thái trước (Chờ/Đang tiến hành). |
| **Hoàn thành (DONE)** | Trạng thái kết thúc công việc. Sản lượng tự động được tổng hợp. Không thể sửa·thay đổi trạng thái thêm. |
| **Đã hủy (CANCELED)** | Trạng thái đã hủy. Không thể hủy nếu đã có ít nhất 1 sản lượng. |

---

## ① Cột Danh sách

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Hành động (Sửa/Xóa)** | Nút hành động nhanh trên từng hàng. Bút chì=mở bảng sửa, thùng rác=xóa. (Không thể xóa lệnh sản xuất đang tiến hành) |
| **Ngày kế hoạch(planDate)** | **Ngày sản xuất dự kiến** của lệnh sản xuất này. Danh sách tra cứu theo phạm vi ngày kế hoạch mặc định, các mục chưa chỉ định ngày kế hoạch luôn hiển thị cùng. |
| **Ưu tiên(priority)** | Thứ tự xử lý công việc. **1 là cao nhất và 10 là thấp nhất** (mặc định 5). 1~3 được tô sáng (viền đỏ), 7~10 hiển thị mờ để nhanh chóng nhận dạng lệnh khẩn cấp. Danh sách sắp xếp theo thứ tự ưu tiên tăng dần. |
| **Số lệnh sản xuất(orderNo)** | Số duy nhất nhận dạng lệnh sản xuất (ví dụ: `W260519-001`). Trong chế độ xem cây, hiển thị quan hệ trên·dưới (thành phẩm - bán thành phẩm) bằng thụt lề và mũi tên. |
| **Mã mặt hàng(partCode)** | Mã của mặt hàng sản xuất mục tiêu. |
| **Tên mặt hàng(partName)** | Tên của mặt hàng sản xuất mục tiêu. |
| **Loại mặt hàng(partType)** | Loại mặt hàng. **FG=thành phẩm**, **WIP=bán thành phẩm** phân biệt bằng badge màu. |
| **Dây chuyền(lineCode)** | Dây chuyền sản xuất thực hiện công việc (giá trị tùy chọn). |
| **Công đoạn(processCode)** | **Công đoạn đại diện** của lệnh sản xuất này. Tự động kế thừa từ công đoạn đầu tiên của định tuyến mặt hàng, cũng có thể chỉ định trực tiếp. |
| **Thiết bị(equipCode)** | Mã thiết bị công việc. Có thể để trống khi tạo và phân bổ sau. |
| **Số PO khách hàng(custPoNo)** | Số đơn đặt hàng (PO) khách hàng mà lệnh này đáp ứng (giá trị tùy chọn). |
| **Số lượng kế hoạch(planQty)** | Số lượng đã lên kế hoạch sản xuất. |
| **Số lượng sản lượng(goodQty)** | **Số lượng tốt** thực tế đã sản xuất. Sản lượng sản xuất được tổng hợp và hiển thị. |
| **Tiến độ(progress)** | Tỷ lệ (%) số lượng tốt so với số lượng kế hoạch. Hiển thị bằng biểu đồ thanh. |
| **Trạng thái(status)** | Trạng thái lệnh sản xuất hiện tại (Chờ/Đang tiến hành/Tạm dừng/Hoàn thành/Hủy). Hiển thị bằng badge màu. |

---

## ② Mục nhập Bảng Tạo/Sửa

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Số lệnh sản xuất(orderNo)** | Không nhập trực tiếp. **Tự động tạo khi lưu** (`W+ngày+số thứ tự`). |
| **Tên mặt hàng(itemCode)** | Mở modal tìm kiếm mặt hàng bằng nút kính lúp để chọn. **Chỉ chọn được thành phẩm·bán thành phẩm**. Khi chọn, thông tin định tuyến tự động được tra cứu. |
| **Số lượng kế hoạch(planQty)** | Số lượng sẽ sản xuất. **Bắt buộc** và phải từ 1 trở lên. |
| **Ngày kế hoạch(planDate)** | Ngày sản xuất dự kiến. **Bắt buộc**. |
| **Ưu tiên(priority)** | Giá trị từ 1~10 (mặc định 5). Số càng nhỏ xử lý trước. |
| **Số PO khách hàng(custPoNo)** | Số PO khách hàng đáp ứng (giá trị tùy chọn, ví dụ: `PO-2026-0001`). |
| **Thông tin định tuyến** | Không phải giá trị nhập mà **tự động hiển thị**. Hiển thị mã·tên định tuyến và thứ tự công đoạn (mũi tên) của mặt hàng đã chọn. Nếu không có định tuyến, hiển thị thông báo "Mặt hàng chưa đăng ký định tuyến". |
| **Dây chuyền(lineCode)** | Chọn dây chuyền công việc (giá trị tùy chọn). |
| **Công đoạn(processCode)** | Chọn công đoạn đại diện. Nếu không chỉ định, công đoạn đầu tiên của định tuyến được tự động áp dụng. Thay đổi công đoạn sẽ đặt lại lựa chọn thiết bị. |
| **Thiết bị(equipCode)** | Chọn từ danh sách thiết bị đã đăng ký cho công đoạn đã chọn. Có thể không chỉ định. Nếu công đoạn đó không có thiết bị, hiển thị thông báo. |
| **Ghi chú(remark)** | Ghi chú quản lý. |
| **Tự động tạo lệnh sản xuất bán thành phẩm dựa trên BOM(autoCreateChildren)** | Checkbox chỉ xuất hiện **khi tạo mới** (mặc định bật). Nếu bật, khai triển BOM thành phẩm để **tự động tạo cùng lệnh sản xuất bán thành phẩm** bên trong. Số lượng kế hoạch bán thành phẩm được tính theo nhu cầu BOM. |

---

## ③ Hành động Thanh Hành động

| Nút | Trạng thái khả dụng | Hành động |
|------|------|------|
| **In phiếu lệnh sản xuất** | Có hàng được chọn | In phiếu lệnh sản xuất (A4: lệnh sản xuất phía trên + yêu cầu vật tư phía dưới). |
| **Bắt đầu** | Chờ (WAITING) | Chuyển sang Đang tiến hành (RUNNING) và ghi lại thời gian bắt đầu. |
| **Hoàn thành** | Đang tiến hành (RUNNING) | Chuyển sang Hoàn thành (DONE) và tự động tổng hợp sản lượng. **Kết thúc ngay cả khi còn dư.** |
| **Tạm dừng** | Chờ/Đang tiến hành | Chuyển sang Tạm dừng (HOLD). Chặn đăng ký sản lượng·xuất hàng. |
| **Giải phóng tạm dừng** | Tạm dừng (HOLD) | Quay lại trạng thái ngay trước khi tạm dừng (Chờ/Đang tiến hành). |
| **Hủy** | Chờ/Tạm dừng | Chuyển sang Hủy (CANCELED). **Không thể hủy nếu có sản lượng.** |
| **Phát hành trước** | (Chỉ hiển thị ở chế độ phát hành trước) | Phát hành trước mã vạch thành phẩm tương ứng số lượng lệnh sản xuất. |

---

## Trình tự thực hiện
1. Nhấn **[Tạo lệnh sản xuất]** để mở bảng bên phải.
2. Nhập **Mặt hàng** (kính lúp), **Số lượng kế hoạch**, **Ngày kế hoạch** (3 mục bắt buộc). Nếu cần, chỉ định dây chuyền, công đoạn, thiết bị, ưu tiên, PO khách hàng.
3. Nếu là thành phẩm và muốn tạo cùng bán thành phẩm, giữ check **Tự động tạo BOM** và lưu.
4. Click chọn hàng lệnh sản xuất trong danh sách và nhấn nút **Bắt đầu** để khởi công.
5. Trong khi sản xuất tiến hành, đăng ký sản lượng tại [Sản lượng Sản xuất].
6. Khi công việc kết thúc, nhấn nút **Hoàn thành** để kết thúc (tự động tổng hợp sản lượng).

## Quy tắc nhập / Kiểm tra
- Cần có đủ mặt hàng, số lượng kế hoạch, ngày kế hoạch để lưu (số lượng kế hoạch từ 1 trở lên).
- Số lệnh sản xuất không nhập trực tiếp mà tự động đánh số khi lưu.
- Trạng thái chỉ có thể thay đổi bằng nút hành động, không thể bỏ qua tùy ý (ví dụ: không thể từ Chờ sang Hoàn thành ngay).
- Lệnh sản xuất đã hoàn thành·hủy không thể sửa.
- Không thể xóa lệnh sản xuất đang tiến hành.
- Hủy chỉ khả dụng khi chưa có sản lượng nào.

## Câu hỏi thường gặp
- **H.** Tôi có thể tự đặt số lệnh sản xuất không?
  **Đ.** Không. Tự động tạo theo định dạng `W+YYMMDD+số thứ tự` khi lưu.
- **H.** Nếu bật tự động tạo BOM, cái gì được tạo?
  **Đ.** Khai triển BOM thành phẩm để tạo **lệnh sản xuất cho mỗi bán thành phẩm** bên trong (hiển thị dưới dạng cấp dưới trong chế độ xem cây). Số lượng bán thành phẩm tính theo nhu cầu BOM.
- **H.** Tạm dừng và Hủy khác nhau thế nào?
  **Đ.** Tạm dừng là **tạm thời dừng** (có thể giải phóng để tiếp tục), Hủy là **xử lý kết thúc** (không thể hoàn tác).
- **H.** Tôi nhấn Hoàn thành nhưng chưa đủ số lượng kế hoạch.
  **Đ.** Vẫn hoàn thành ngay cả khi còn dư. Sản lượng được tổng hợp đến thời điểm hoàn thành.
- **H.** Không thấy lệnh sản xuất trong danh sách.
  **Đ.** Kiểm tra phạm vi bộ lọc ngày kế hoạch phía trên. Mặc định là hôm nay. Mở rộng ngày kế hoạch để hiển thị nhiều hơn.

## Màn hình liên quan
- [Sản lượng Sản xuất](/production/result) — Nơi đăng ký sản lượng cho lệnh sản xuất đang tiến hành
- [Master Mặt hàng](/master/part) — Nơi đăng ký mặt hàng, BOM, định tuyến
