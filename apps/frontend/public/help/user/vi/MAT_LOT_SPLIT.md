---
menuCode: MAT_LOT_SPLIT
audience: user
title: Phân tách Vật tư
summary: Màn hình chia một LOT vật tư đã nhập kho thành hai sê-ri mới. Sê-ri gốc bị hủy và in nhãn kết quả phân tách
tags: [vật tư, LOT, phân tách, sê-ri, tồn kho]
keywords: [phân tách lô, phân tách lô, phân tách LOT, phân tách vật tư, số lượng phân tách, lô vật tư, sê-ri, sê-ri vật tư, matUid, sê-ri mới, hủy gốc, SPLIT, đã nhập kho, số lượng hiện tại, số dư, in nhãn, theo dõi, origin]
related: [MAT_LOT, MAT_LOT_MERGE, MAT_ARRIVAL, MAT_ISSUE]
---

# Phân tách Vật tư

## Mục đích màn hình
Màn hình **chia một LOT vật tư (sê-ri) đã nhập kho thành hai phần**. Sử dụng khi cần tách một phần số lượng trong một sê-ri cho công việc, kho, mục đích khác. Khi phân tách, sê-ri gốc bị hủy (SPLIT) và **phần số lượng phân tách** cùng **phần số dư** được tạo thành hai sê-ri vật tư mới.

> Phân tách = 1 sê-ri → 2 sê-ri. Bản gốc không còn mà bị hủy, cả hai phần đều nhận sê-ri và nhãn mới.

## Luồng phân tách
```
LOT đã nhập kho (1 sê-ri, số lượng 100)
  → Nhập số lượng phân tách 30
  → Sê-ri gốc bị hủy (SPLIT, tồn kho 0)
  → Tạo sê-ri mới A (30) + sê-ri mới B (70)
  → In nhãn vật tư của hai phần
```

## Bố cục màn hình
- **Thẻ thống kê phía trên**: Hiển thị tổng số LOT có thể phân tách và tổng số lượng.
- **Grid chính (danh sách LOT có thể phân tách)**: Chỉ hiển thị LOT ở trạng thái đã nhập kho + tồn kho > 1 + Bình thường (NORMAL). Có tìm kiếm số LOT, tên mặt hàng ở phía trên.
- **Nút Phân tách (bên trái hàng)**: Mở modal nhập phân tách cho LOT đó.
- **Modal Phân tách**: Nhập số lượng phân tách, xem trước hai phần được chia.
- **Modal Xem trước Nhãn**: In nhãn của 2 sê-ri mới sau khi phân tách thành công.

---

## ① Cột Grid LOT Có thể Phân tách

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **(Hành động) Phân tách** | Nút mở modal phân tách cho LOT đó. Tất cả hàng hiển thị đều có thể phân tách. |
| **Sê-ri vật tư(matUid)** | Số nhận dạng duy nhất (sê-ri) của LOT vật tư. Được in trên mã vạch nhãn, là sê-ri gốc đối tượng phân tách. |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng nội bộ MES của vật tư. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng vật tư. |
| **Số lượng hiện tại(qty)** | Số lượng tồn kho hiện tại của sê-ri này. Hiển thị kèm đơn vị, số lượng phân tách phải nhỏ hơn giá trị này. |
| **Nhà cung cấp(vendor)** | Tên khách hàng (nhà cung cấp) giao vật tư này. Chỉ hiển thị mã nếu chỉ có mã. |

> Điều kiện danh sách: **Đã nhập kho** (LOT đã hoàn tất nhập kho) + **Số lượng hiện tại ≥ 2** + **Số lượng đặt trước = 0** + **Trạng thái NORMAL**. LOT có lịch sử xuất hoặc trạng thái HOLD không hiển thị.

---

## ② Modal Phân tách (khi click nút Phân tách)

Màn hình nhập để chia LOT đã chọn thành hai phần.

| Mục nhập | Vai trò / Ý nghĩa |
|------|------|
| **Thông tin gốc (tóm tắt phía trên)** | Hiển thị tóm tắt sê-ri vật tư / mã mặt hàng / tên mặt hàng / số lượng hiện tại đã chọn (chỉ đọc). |
| **Số lượng phân tách \*** | Số lượng sẽ tách ra khỏi bản gốc. Phải **từ 1 trở lên và nhỏ hơn số lượng hiện tại**. Phần còn lại tự động trở thành phần số dư. |
| **Xem trước phân tách** | Khi nhập số lượng phân tách, hiển thị trước hai phần được chia dưới dạng `{số lượng phân tách} + {số dư}`. |
| **Ghi chú** | Nhập lý do hoặc ghi chú phân tách tự do (tùy chọn, trong vòng 200 ký tự). |

Khi lưu, sê-ri gốc bị hủy, 2 sê-ri mới được tạo, sau đó **Modal Xem trước Nhãn** mở ra.

---

## ③ Modal Xem trước Nhãn (sau khi phân tách thành công)

Xem trước và in nhãn của 2 sê-ri mới được tạo từ phân tách.

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Khu vực xem trước nhãn** | Nhãn của hai sê-ri mới được hiển thị. Mỗi nhãn in sê-ri vật tư mới, mã mặt hàng, số lượng, v.v. |
| **Hiển thị nhà sản xuất** | Cả hai phần đều kế thừa nhà sản xuất của LOT gốc để hiển thị và in. |
| **In nhãn (nút in)** | Gửi đến máy in nhãn qua Print Agent cục bộ. |

---

## Trình tự thực hiện

1. Tìm LOT cần phân tách bằng tìm kiếm phía trên theo sê-ri vật tư (số LOT) hoặc tên mặt hàng.
2. Click nút **Phân tách** trên hàng đó.
3. Trong modal, nhập **số lượng phân tách** (nhỏ hơn số lượng hiện tại).
4. Kiểm tra xem trước `số lượng phân tách + số dư` có đúng như mong muốn không.
5. Nếu cần, nhập **ghi chú** và click **Phân tách**.
6. Trong xem trước nhãn, kiểm tra nhãn của 2 sê-ri mới và **In nhãn**.
7. Dán nhãn đã in lên từng gói vật tư (hủy nhãn gốc).

---

## Quy tắc nhập / Kiểm tra

- Số lượng phân tách phải **từ 1 trở lên và nhỏ hơn số lượng hiện tại**. Nếu bằng hoặc lớn hơn số lượng hiện tại, nút phân tách bị vô hiệu.
- Không thể phân tách các LOT sau (không hiển thị trong danh sách hoặc bị chặn khi lưu):
  - **LOT chưa nhập kho xong** (cần tiến hành nhập kho trước)
  - **LOT có trạng thái không phải NORMAL** (HOLD/SPLIT/MERGED/DEPLETED, v.v.)
  - **LOT có số lượng đặt trước** (cần dọn dẹp đặt trước trước)
  - **LOT có lịch sử xuất** (cần dọn dẹp xuất trước)
  - **Mặt hàng được đặt không thể phân tách (isSplittable = N) trong master mặt hàng**
- Phân tách không thể hoàn tác. Sê-ri gốc bị hủy và thay thế bằng 2 sê-ri mới.

---

## Câu hỏi thường gặp

- **H.** Sau khi phân tách, sê-ri gốc sẽ ra sao?
  **Đ.** Bản gốc bị xử lý hủy (SPLIT), tồn kho về 0 và không thể sử dụng. Thay vào đó, phần số lượng phân tách và phần số dư được tạo thành **sê-ri mới** tương ứng.

- **H.** Có thể chia thành ba phần trở lên không?
  **Đ.** Mỗi lần phân tách chỉ tạo được hai phần. Để chia nhỏ hơn, có thể phân tách lại sê-ri mới từ kết quả phân tách (có thể phân tách lại).

- **H.** Lịch sử nhập kho và kiểm tra của vật tư đã phân tách có được theo dõi không?
  **Đ.** Có. Các phần mới kế thừa số hàng đến, nhà sản xuất, thông tin sê-ri gốc (origin), do đó có thể theo dõi ngược.

- **H.** Không thấy LOT trong danh sách.
  **Đ.** Đó là trường hợp chưa nhập kho xong, số lượng hiện tại ≤ 1, có lịch sử đặt trước/xuất, hoặc trạng thái không phải NORMAL. Hãy kiểm tra trạng thái tại [Tình trạng LOT Nguyên vật liệu].

- **H.** Nhãn không in được.
  **Đ.** Hãy kiểm tra xem Print Agent có đang chạy trên PC không.

---

## Màn hình liên quan
- [Tình trạng LOT Nguyên vật liệu](/material/lot) — Kiểm tra trạng thái và số lượng LOT
- [Hợp nhất Vật tư](/material/lot-merge) — Gộp LOT cùng mặt hàng thành một
- [Quản lý Hàng đến](/material/arrival) — Cấp LOT vật tư lần đầu
- [Xuất kho Vật tư](/material/issue) — Xuất theo đơn vị LOT
