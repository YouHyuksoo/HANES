---
menuCode: CONS_RECEIVING
audience: user
title: Nhập kho Vật tư Tiêu hao
summary: Màn hình xử lý nhập kho và trả lại vật tư tiêu hao bằng quét mã vạch hoặc đăng ký thủ công, tra cứu lịch sử nhập kho và danh sách chờ nhập kho
tags: [vật tư tiêu hao, nhập kho, xuất nhập]
keywords: [nhập kho vật tư tiêu hao, nhập kho, trả lại, nhập kho trả lại, trả lại nhập kho, số lượng, tồn kho, mã vạch, quét, UID, conUid, chưa nhập kho, danh sách chờ, nhà cung cấp, đơn giá, loại nhập kho, mới, thay thế, vị trí lưu trữ]
related: [CONS_MASTER, CONS_LABEL, CONS_STOCK]
---

# Nhập kho Vật tư Tiêu hao

## Mục đích màn hình
Màn hình **xác nhận vật tư tiêu hao nhập kho thành tồn kho trong kho**. Có thể quét mã vạch UID vật tư tiêu hao đã được đánh số từ Phát hành nhãn để nhập kho từng cái, hoặc nhập thủ công theo số lượng mà không cần UID. Khi nhập kho, tồn kho của master vật tư tiêu hao tăng lên và lịch sử nhập kho được ghi lại.

> Có hai cách nhập kho vật tư tiêu hao. **① Nhập kho bằng quét mã vạch** là quét và xác nhận từng UID riêng lẻ đã được phát hành trước tại [Phát hành Nhãn Vật tư Tiêu hao](/consumables/label), **② Nhập thủ công** là tăng tồn kho chỉ bằng vật tư tiêu hao và số lượng mà không cần UID.

## Bố cục màn hình
- **Phía trên (bảng quét mã vạch)**: Chuyển đổi chế độ Nhập kho/Trả lại và quét mã vạch UID. Ở chế độ Nhập kho, hiển thị cả danh sách **Chờ nhập kho** chưa được nhập.
- **Phía dưới (lịch sử nhập kho)**: Grid lịch sử nhập kho và trả lại. Sử dụng **khoảng thời gian**, **từ khóa**, **bộ lọc loại** ở thanh công cụ phía trên để thu hẹp phạm vi tra cứu.
- **Bên phải (bảng trượt)**: Form nhập thủ công mở ra khi nhấn nút **Đăng ký nhập kho** ở phía trên.

---

## ① Bảng quét mã vạch

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Chế độ Nhập kho / Trả lại** | Chọn loại xử lý bằng chuyển đổi bên trái. **Nhập kho** xác nhận nhập kho UID chưa nhập, **Trả lại (nhập kho trả lại)** hoàn tác UID đã nhập kho để giảm tồn kho. |
| **Nhập UID mã vạch** | Quét mã vạch UID vật tư tiêu hao (hoặc nhập và Enter) để xử lý ngay lập tức. Sau khi quét, ô nhập tự động trống để nhận lần quét tiếp theo. |
| **Vị trí lưu trữ (chế độ Nhập kho)** | Chọn vị trí lưu trữ để đặt vật tư tiêu hao nhập kho (tùy chọn). Được ghi lại làm vị trí lưu trữ của UID đó khi xác nhận nhập kho. |
| **Lý do trả lại (chế độ Trả lại)** | Nhập lý do trả lại (tùy chọn). Được lưu làm lý do trong lịch sử trả lại. |
| **Nút Xác nhận Nhập kho / Xác nhận Trả lại** | Xử lý UID đã nhập. Nếu máy quét mã vạch nhập Enter, tự động xử lý mà không cần nhấn nút. |

### Danh sách Chờ nhập kho (chỉ hiển thị ở chế độ Nhập kho)
Hiển thị các UID đã phát hành nhãn nhưng chưa được nhập kho (đang chờ). Quét UID ở đây sẽ xác nhận nhập kho.

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **UID(conUid)** | Số nhận dạng riêng lẻ của vật tư tiêu hao đang chờ nhập kho. |
| **Mã vật tư(consumableCode)** | Mã vật tư tiêu hao của UID đó. |
| **Tên vật tư(consumableName)** | Tên vật tư tiêu hao. |
| **Danh mục(category)** | Phân loại vật tư tiêu hao như khuôn, jig, dụng cụ. |
| **Ngày in nhãn(labelPrintedAt)** | Thời gian nhãn UID đó được phát hành. |
| **Nhà cung cấp(vendorName)** | Nhà cung cấp đã nhập khi phát hành nhãn. |

## ② Grid Lịch sử Nhập kho

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Thời gian(createdAt)** | Thời gian xử lý nhập kho/trả lại. |
| **Mã vật tư(consumableCode)** | Mã vật tư tiêu hao đã nhập kho. |
| **Tên vật tư(consumableName)** | Tên vật tư tiêu hao. |
| **UID(conUid)** | UID riêng lẻ khi nhập kho bằng quét mã vạch. Nhập thủ công không có UID, hiển thị `-`. |
| **Loại(logType)** | **Nhập kho(IN)** hoặc **Trả lại nhập kho(IN_RETURN)**. Phân biệt bằng badge màu sắc. |
| **Số lượng(qty)** | Số lượng nhập kho/trả lại. Nhập kho hiển thị `+`, Trả lại hiển thị `-`. |
| **Mã nhà cung cấp(vendorCode)** | Mã nhà cung cấp. |
| **Tên nhà cung cấp(vendorName)** | Tên nhà cung cấp. |
| **Đơn giá(unitPrice)** | Đơn giá nhập kho (won). |
| **Loại nhập kho(incomingType)** | **Mới (NEW)** hoặc **Thay thế (REPLACEMENT)**. |
| **Ghi chú(remark)** | Ghi chú khi nhập kho/trả lại. |

### Bộ lọc thanh công cụ
| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Ngày bắt đầu / Ngày kết thúc** | Khoảng thời gian tra cứu lịch sử nhập kho. |
| **Từ khóa** | Tìm kiếm lịch sử theo mã vật tư, tên vật tư. |
| **Bộ lọc loại** | Chọn loại hiển thị: Tất cả / Nhập kho / Trả lại nhập kho. |

## ③ Form Nhập thủ công (Bảng bên phải)

Mở bằng nút **Đăng ký nhập kho** ở phía trên. Tăng tồn kho theo vật tư tiêu hao và số lượng mà không cần UID.

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Vật tư tiêu hao** | Tìm kiếm và chọn vật tư tiêu hao bằng nút kính lúp. Là đối tượng nhập kho và bắt buộc. |
| **Số lượng(qty)** | Số lượng nhập kho. Tồn kho tăng tương ứng với số lượng này (mặc định 1). |
| **Loại nhập kho(incomingType)** | Chọn **Mới** hoặc **Thay thế**. |
| **Mã nhà cung cấp / Tên nhà cung cấp** | Thông tin nhà cung cấp của vật tư tiêu hao nhập kho. |
| **Đơn giá(unitPrice)** | Đơn giá nhập kho của 1 vật tư tiêu hao (tùy chọn). |
| **Ghi chú(remark)** | Ghi chú nhập kho (tùy chọn). |

## Trình tự thực hiện
1. **Nhập kho bằng quét mã vạch**: Xác nhận chế độ **Nhập kho** ở phía trên → (nếu cần) chọn vị trí lưu trữ → quét mã vạch UID → xác nhận nhập kho ngay lập tức. Có thể kiểm tra UID mục tiêu trong danh sách chờ nhập kho.
2. **Nhập kho trả lại**: Chuyển chế độ sang **Trả lại** → (nếu cần) nhập lý do trả lại → quét UID đã nhập kho → xác nhận trả lại (giảm tồn kho).
3. **Nhập thủ công**: **Đăng ký nhập kho** ở phía trên → tìm kiếm và chọn vật tư tiêu hao → nhập số lượng, loại nhập kho, nhà cung cấp, đơn giá → **Đăng ký**.
4. Kiểm tra kết quả xử lý trong grid **Lịch sử nhập kho** ở phía dưới.

## Quy tắc nhập / Kiểm tra
- Nhập thủ công phải **chọn vật tư tiêu hao** để kích hoạt nút đăng ký.
- Nhập kho bằng quét chỉ xác nhận được **UID ở trạng thái chưa nhập (chờ)**. Nếu quét lại UID đã nhập kho sẽ báo lỗi.
- Nhập kho trả lại chỉ xử lý được **UID ở trạng thái nhập kho (đang hoạt động)** hiện tại.

## Câu hỏi thường gặp
- **H.** Không có UID trong danh sách chờ nhập kho.
  **Đ.** Để nhập kho, trước tiên cần phát hành UID tại [Phát hành Nhãn Vật tư Tiêu hao](/consumables/label). Khi nhãn được phát hành, UID sẽ xuất hiện trong danh sách chờ.
- **H.** Khi quét, báo "Đã ở trạng thái nhập kho".
  **Đ.** UID đó đã được xác nhận nhập kho. Hãy kiểm tra trong lịch sử nhập kho.
- **H.** Nhập thủ công và nhập bằng quét khác nhau thế nào?
  **Đ.** Nhập bằng quét là nhập từng cái theo dõi riêng lẻ theo UID; nhập thủ công là tăng tồn kho theo số lượng mà không cần UID. Cả hai đều làm tăng tồn kho.
- **H.** Số lượng nhập kho được phản ánh vào tồn kho như thế nào?
  **Đ.** Nhập kho (IN) làm tăng tồn kho, Trả lại (IN_RETURN) làm giảm tồn kho.

## Màn hình liên quan
- [Phát hành Nhãn Vật tư Tiêu hao](/consumables/label) — Đánh số và phát hành UID (mã vạch) trước khi nhập kho
- [Master Vật tư Tiêu hao](/consumables/master) — Thông tin cơ bản của vật tư tiêu hao đối tượng nhập kho
- [Tồn kho Vật tư Tiêu hao](/consumables/stock) — Tình trạng tồn kho sau khi nhập kho
