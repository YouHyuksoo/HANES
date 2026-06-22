---
menuCode: CONS_LABEL
audience: user
title: Phát hành Nhãn Vật tư Tiêu hao
summary: Màn hình chọn master vật tư tiêu hao để phát hành UID riêng lẻ, in nhãn theo thiết kế template, và xem trước/tái phát hành các instance chưa nhập kho (PENDING)
tags: [vật tư tiêu hao, nhãn, phát hành, in ấn]
keywords: [nhãn vật tư tiêu hao, phát hành nhãn vật tư tiêu hao, UID, conUid, UID vật tư tiêu hao, phát hành nhãn, in ấn, mã vạch, in nhãn, số lượng phát hành, chưa nhập kho, PENDING, instance, tái phát hành, xem trước, template nhãn, thiết kế nhãn, khuôn, jig, dụng cụ]
related: [CONS_MASTER, CONS_RECEIVING]
---

# Phát hành Nhãn Vật tư Tiêu hao

## Mục đích màn hình
Màn hình phát hành **UID vật tư tiêu hao (conUid)** duy nhất cho từng đối tượng để theo dõi **riêng lẻ** vật tư tiêu hao (khuôn, jig, dụng cụ, v.v.) và in nhãn (mã vạch) có chứa UID đó. Cùng một mã vật tư nhưng mỗi cái nhập kho đều có UID riêng, do đó việc dán nhãn cho phép quản lý riêng lẻ các hoạt động nhập, xuất, lắp đặt, thay thế sau này.

> Phát hành UID đồng nghĩa với **tạo instance Chưa nhập kho (PENDING)**. Sau khi in nhãn và dán lên vật phẩm, quét mã vạch tại màn hình Nhập kho Vật tư Tiêu hao để xác nhận nhập kho, trạng thái chuyển thành khả dụng (ACTIVE) và số lượng tồn kho tăng lên.

## Bố cục màn hình
- **Bên trái (danh sách)**: Grid master vật tư tiêu hao có thể phát hành nhãn. Tìm kiếm **mã vật tư/tên vật tư**, **lọc danh mục**, **làm mới** ở phía trên. Mỗi hàng có **checkbox chọn** và ô nhập **số lượng phát hành**.
- **Phía trên bên phải (công cụ phát hành)**: **Thông báo trạng thái**(hướng dẫn tiến trình phát hành/in), **Làm mới**, **Chọn template nhãn**, nút **Phát hành UID**.
- **Bên phải (bảng chi tiết)**: Click vào hàng trong danh sách để mở danh sách **instance Chưa nhập kho (PENDING)** của vật tư đó. Có thể **Xem trước** hoặc **Tái phát hành** (in lại nhãn) từng instance.

## Luồng từ Phát hành đến In
```
Chọn vật tư tiêu hao + Nhập số lượng phát hành
        │
        ▼
Click [Phát hành UID] → Đánh số conUid tương ứng (tạo instance chưa nhập kho)
        │
        ▼
Vẽ nhãn với template nhãn đã chọn và gọi cửa sổ in trình duyệt
        │
        ▼
Dán nhãn lên vật tư tiêu hao thực tế → Quét và xác nhận nhập kho tại màn hình Nhập kho Vật tư Tiêu hao
```

---

## ① Cột danh sách (Grid bên trái)

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Chọn (checkbox)** | Chọn vật tư tiêu hao để phát hành nhãn. Checkbox header cho phép **chọn/bỏ chọn tất cả**. Cần chọn ít nhất 1 hàng để kích hoạt phát hành UID. |
| **Hình ảnh** | Hình thu nhỏ của vật tư tiêu hao. Click để xem lớn, cũng được đưa vào nhãn in (tùy template). Hiển thị `-` nếu không có ảnh. |
| **Mã vật tư(consumableCode)** | Mã duy nhất của vật tư tiêu hao cần phát hành. Tất cả UID được phát hành đều gắn với mã này. |
| **Tên vật tư(consumableName)** | Tên vật tư tiêu hao. Dùng cho tìm kiếm và hiển thị trên nhãn. |
| **Danh mục(category)** | Phân loại khuôn(MOLD) / jig(JIG) / dụng cụ(TOOL) (mã chung CONSUMABLE_CATEGORY). Là tiêu chí cho bộ lọc danh mục phía trên. |
| **Tồn kho hiện tại(stockQty)** | Số lượng tồn kho tích lũy của master vật tư tiêu hao. Tăng khi xác nhận nhập kho. |
| **Instance(instanceCount)** | **Số UID (đối tượng) đã được phát hành** cho đến nay. Nếu hiển thị thêm **(Chưa nhập: n)** màu vàng, đó là số lượng PENDING chưa được xác nhận nhập kho. |
| **Số lượng phát hành(qtyInput)** | Số lượng UID sẽ phát hành lần này (1~99). Ví dụ: nhập `5` sẽ đánh số 5 conUid. Mặc định là 1. |

## ② Công cụ Phát hành Nhãn (Phía trên bên phải)

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Thông báo trạng thái** | Hiển thị tiến trình phát hành/in trong một dòng (ví dụ: "Đã phát hành {{count}} mục", màu đỏ nếu có lỗi). Nếu có mục được chọn và không đang xử lý, hiển thị "Đã chọn {{count}} mục". |
| **Làm mới** | Tải lại danh sách và số lượng phát hành/số chưa nhập mới nhất. |
| **Chọn template nhãn** | Chọn thiết kế nhãn để in. Chọn **Thiết kế mặc định** hoặc template đã đăng ký (danh mục vật tư tiêu hao/jig). Mỗi template có kích thước nhãn, mã vạch, mục hiển thị và phương thức in khác nhau. |
| **Phát hành UID** | Đánh số UID cho vật tư tiêu hao đã chọn theo số lượng phát hành và mở ngay cửa sổ in nhãn. Trong khi phát hành hiển thị "Đang phát hành...", khi chuẩn bị in hiển thị "Đang xuất". |

## ③ Bảng Instance Chưa nhập kho (Bên phải)
Mở ra khi click vào hàng vật tư tiêu hao trong danh sách. Chỉ hiển thị **UID Chưa nhập kho (PENDING)** của vật tư đó (loại trừ các mục đã nhập kho).

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Tóm tắt (tồn kho hiện tại·chưa nhập·vị trí lưu trữ)** | Tóm tắt tồn kho hiện tại, số lượng chưa nhập và vị trí lưu trữ mặc định của vật tư đã chọn ở đầu bảng. |
| **UID Vật tư(conUid)** | UID riêng lẻ đã được phát hành. Khóa theo dõi được in trên nhãn/mã vạch. |
| **Trạng thái** | Badge trạng thái instance. Bảng này chỉ hiển thị **Chưa nhập kho (PENDING)** (mã chung CON_STOCK_STATUS). |
| **Số lần sử dụng(currentCount / expectedLife)** | Số lần sử dụng tích lũy và tuổi thọ dự kiến. Ở giai đoạn chưa nhập kho, thường là `0`. |
| **Ngày nhập kho(recvDate)** | Ngày đã xác nhận nhập kho. Các mục chưa nhập để trống (`-`). |
| **Xem trước** | Xem mã vạch và bố trí nhãn UID đó trong modal trước khi in (không in). |
| **Tái phát hành** | **In lại** nhãn UID đó. Dùng khi nhãn bị hỏng hoặc mất, gửi đến máy in nhãn (agent). |

## Trình tự thực hiện
1. **Check** vật tư tiêu hao cần phát hành nhãn trong danh sách bên trái (dùng tìm kiếm, lọc danh mục để tìm nhanh).
2. Nhập **số lượng phát hành** cho mỗi hàng (tương ứng số lượng riêng lẻ).
3. Kiểm tra và chọn **template nhãn** ở phía trên.
4. Nhấn **Phát hành UID** để đánh số UID và mở cửa sổ in. In từ hộp thoại in.
5. Dán nhãn đã in lên vật tư tiêu hao thực tế.
6. (Nếu cần in lại) Click vào vật tư đó trong danh sách, dùng bảng bên phải để **Xem trước/Tái phát hành** UID tương ứng.
7. Sau khi dán nhãn, quét mã vạch tại màn hình **Nhập kho Vật tư Tiêu hao** để xác nhận nhập kho.

## Quy tắc nhập / Kiểm tra
- **Phải chọn ít nhất 1 vật tư tiêu hao** để kích hoạt nút Phát hành UID.
- **Số lượng phát hành** trong phạm vi 1~99 (tự động điều chỉnh nếu ngoài phạm vi).
- In ấn mở ở **cửa sổ mới (popup)**. Nếu trình duyệt chặn popup, việc phát hành sẽ bị gián đoạn; hãy cho phép popup cho trang web này.
- Nếu số lượng phát hành lớn hoặc mã vạch chưa được tạo xong, hãy xem trước nhãn trước khi in (chặn in nếu mã vạch chưa hoàn thành).

## Câu hỏi thường gặp
- **H.** Phát hành UID có làm tăng tồn kho ngay không?
  **Đ.** Không. Phát hành chỉ tạo **instance Chưa nhập kho (PENDING)**. Phải dán nhãn và quét·xác nhận nhập kho tại màn hình **Nhập kho Vật tư Tiêu hao** để chuyển sang khả dụng (ACTIVE) và tăng tồn kho hiện tại.
- **H.** Tôi bị mất nhãn. Làm thế nào để in lại?
  **Đ.** Click vào vật tư đó trong danh sách, tại bảng chưa nhập kho bên phải, nhấn **Tái phát hành** cho UID tương ứng. Nhãn sẽ được in lại với cùng UID.
- **H.** Cửa sổ in không hiện ra.
  **Đ.** Do trình duyệt chặn popup. Hãy bật cho phép popup trên thanh địa chỉ và phát hành lại.
- **H.** Không thể nhập số lượng phát hành từ 100 trở lên.
  **Đ.** Mỗi lần chỉ phát hành được 1~99. Nếu cần nhiều, hãy chia nhỏ và phát hành nhiều lần.
- **H.** "(Chưa nhập: n)" bên cạnh instance có nghĩa là gì?
  **Đ.** Đó là số lượng UID đã được phát hành nhưng chưa được xác nhận nhập kho. Báo hiệu cần dán nhãn và xử lý nhập kho.

## Màn hình liên quan
- [Master Vật tư Tiêu hao](/consumables/master) — Đăng ký thông tin cơ bản, tuổi thọ dự kiến, vị trí lưu trữ của vật tư tiêu hao để phát hành nhãn
- [Nhập kho Vật tư Tiêu hao](/consumables/receiving) — Quét nhãn đã phát hành để xác nhận nhập kho (PENDING → ACTIVE)
