---
menuCode: CONS_ISSUING
audience: user
title: Xuất kho Vật tư Tiêu hao
summary: Màn hình quét mã vạch UID riêng lẻ (conUid) của vật tư tiêu hao để xuất kho ra hiện trường hoặc hủy xuất kho, và tra cứu lịch sử xuất/hủy xuất
tags: [vật tư tiêu hao, xuất kho, trả lại]
keywords: [xuất kho vật tư tiêu hao, xuất kho, xác nhận xuất, hủy xuất, trả lại xuất, trả lại, xác nhận hủy, quét mã vạch, conUid, UID, nơi sử dụng, thiết bị, dây chuyền, bộ phận xuất, lý do xuất, tồn kho, khuôn, jig, dụng cụ]
related: [CONS_MASTER, CONS_RECEIVING, CONS_STOCK]
---

# Xuất kho Vật tư Tiêu hao

## Mục đích màn hình
Màn hình **quét mã vạch UID riêng lẻ (conUid) của vật tư tiêu hao đã nhập kho để xuất ra hiện trường** hoặc **hủy xuất (trả lại)** các giao dịch xuất sai. Lịch sử xuất/hủy xuất có thể tra cứu theo khoảng thời gian và loại ở bảng lịch sử phía dưới.

> Vật tư tiêu hao được gán UID duy nhất (conUid) cho từng cái khi nhập kho, cho phép **theo dõi riêng lẻ**. Xuất kho cũng xử lý theo từng UID, mỗi lần quét giảm 1 đơn vị tồn kho (xuất theo từng cái riêng lẻ).

## Bố cục màn hình
- **Phía trên (bảng quét)**: Khu vực chọn chế độ Xuất / Hủy xuất và quét mã vạch UID.
- **Phía dưới (bảng lịch sử)**: Danh sách lịch sử xuất/hủy xuất. Thanh công cụ phía trên cho phép lọc theo khoảng thời gian, tìm kiếm, loại.
- Nút **Làm mới** ở góc phải trên để tải lại danh sách.

---

## Luồng Xuất/Hủy xuất
Cùng một UID di chuyển qua các trạng thái:

```
Đã nhập kho(ACTIVE)  ──[Xuất]──▶  Đã xuất(ISSUED)
       ▲                              │
       └──────[Hủy xuất(Trả lại)]─────┘
```

- **Xuất**: Chỉ có thể xuất UID ở trạng thái Đã nhập kho (ACTIVE). Khi xuất, trạng thái chuyển thành **Đã xuất (ISSUED)** và tồn kho master giảm 1.
- **Hủy xuất (Trả lại)**: Chỉ có thể hủy UID ở trạng thái Đã xuất (ISSUED). Khi hủy, trạng thái trở lại **Đã nhập kho (ACTIVE)** và tồn kho được phục hồi 1.

---

## ① Bảng quét

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Xuất (nút chế độ)** | Chế độ xử lý xuất kho cho UID đã quét. Chế độ mặc định. |
| **Trả lại xuất (nút chế độ)** | Chế độ hủy xuất (trả lại) cho UID đã quét. Khi chọn, hiển thị thông báo "Chế độ hủy xuất". |
| **Ô nhập UID** | Quét mã vạch UID vật tư tiêu hao hoặc nhập trực tiếp. Nhấn Enter hoặc nút xác nhận để xử lý. Sau khi xử lý, tự động focus lại để quét liên tiếp. |
| **Xác nhận Xuất / Xác nhận Hủy (nút)** | Nhãn thay đổi theo chế độ hiện tại. Chế độ Xuất thì là **Xác nhận Xuất**, chế độ Trả lại thì là **Xác nhận Hủy**. Vô hiệu nếu không có giá trị nhập. |

## ② Cột bảng Lịch sử Xuất

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Thời gian(createdAt)** | Thời gian xử lý xuất/hủy xuất. |
| **Mã vật tư(consumableCode)** | Mã master của vật tư tiêu hao đã xuất. |
| **Tên vật tư(consumableName)** | Tên của vật tư tiêu hao đã xuất. |
| **UID(conUid)** | UID duy nhất của từng instance đã xuất. Xác định đối tượng vật lý nào đã được xuất. |
| **Loại(logType)** | **Xuất(OUT)** hoặc **Trả lại xuất(OUT_RETURN)**. Xuất hiển thị badge màu xanh, Trả lại xuất hiển thị badge màu tím. |
| **Số lượng(qty)** | Số lượng xử lý. Xuất hiển thị `-1` màu đỏ, Hủy xuất (Trả lại) hiển thị `+1` màu xanh lá (dấu hiệu phân biệt tăng/giảm). |
| **Dây chuyền(lineCode)** | Dây chuyền xuất đến (nếu có ghi nhận). |
| **Thiết bị(equipCode)** | Thiết bị xuất đến (nếu có ghi nhận). |
| **Ghi chú(remark)** | Ghi chú nhập khi xuất/hủy hoặc tin nhắn tự động. |

> Thanh công cụ trên bảng: **Ngày bắt đầu・Ngày kết thúc**(mặc định hôm nay), **Tìm kiếm**(mã vật tư・tên vật tư), **Lọc loại**(Tất cả / Xuất / Trả lại xuất). Nút **Xuất** ở góc phải trên để lưu bảng ra file.

---

## Trình tự thực hiện
1. Trên bảng quét phía trên, chọn chế độ **Xuất** (hoặc **Trả lại xuất** khi cần hoàn tác giao dịch sai).
2. Quét **mã vạch UID** của vật tư tiêu hao vào ô nhập UID (hoặc nhập trực tiếp).
3. Nhấn Enter hoặc click nút **Xác nhận Xuất / Xác nhận Hủy**.
4. Sau khi xử lý, ô nhập tự động trống và focus để quét UID tiếp theo.
5. Kiểm tra kết quả xử lý ở bảng lịch sử phía dưới (lọc theo khoảng thời gian, loại).

## Quy tắc nhập / Kiểm tra
- **Xuất**: Chỉ khả dụng với UID ở trạng thái Đã nhập kho (ACTIVE). Từ chối nếu ở trạng thái Chưa nhập (PENDING), Đã xuất (ISSUED), Đã trả lại (RETURNED).
- **Hủy xuất (Trả lại xuất)**: Chỉ khả dụng với UID ở trạng thái Đã xuất (ISSUED).
- Quét UID không tồn tại sẽ hiển thị lỗi "Không tìm thấy UID".
- Mỗi lần quét xử lý số lượng 1. Để xuất nhiều cái, quét từng UID lần lượt.

## Câu hỏi thường gặp
- **H.** Quét xong báo lỗi "Chỉ khả dụng với trạng thái ACTIVE".
  **Đ.** UID đó chưa được xác nhận nhập kho (chưa nhập) hoặc đã được xuất. Vui lòng kiểm tra tại [Nhập kho Vật tư Tiêu hao](/consumables/receiving).
- **H.** Tôi đã xuất sai. Làm thế nào để hoàn tác?
  **Đ.** Chuyển sang chế độ **Trả lại xuất** ở phía trên, quét cùng UID đó và nhấn **Xác nhận Hủy** để phục hồi về trạng thái Đã nhập kho (ACTIVE).
- **H.** Không thấy giao dịch vừa xuất trong bảng lịch sử.
  **Đ.** Khoảng thời gian tra cứu mặc định là hôm nay. Hãy kiểm tra phạm vi ngày và bộ lọc loại, sau đó nhấn **Làm mới**.
- **H.** Có thể xuất cùng lúc nhiều hơn 2 đơn vị không?
  **Đ.** Vật tư tiêu hao được theo dõi và xuất theo từng UID riêng lẻ. Để xuất nhiều cái, hãy quét từng UID một.

## Màn hình liên quan
- [Master Vật tư Tiêu hao](/consumables/master) — Thông tin cơ bản và ánh xạ nơi sử dụng (thiết bị) của vật tư tiêu hao
- [Nhập kho Vật tư Tiêu hao](/consumables/receiving) — Xác nhận nhập kho UID (chuyển ACTIVE trước khi xuất)
- [Tồn kho Vật tư Tiêu hao](/consumables/stock) — Trạng thái hiện tại và tồn kho theo UID
