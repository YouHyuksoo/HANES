---
menuCode: MAT_LOT_MERGE
audience: user
title: Hợp nhất Vật tư
summary: Màn hình quét mã vạch nhiều LOT vật tư cùng mặt hàng và cùng lô hàng đến để hợp nhất thành một sê-ri tích hợp mới
tags: [vật tư, LOT, hợp nhất, sê-ri, mã vạch]
keywords: [hợp nhất lô, hợp nhất LOT, hợp nhất vật tư, gộp, lô vật tư, sê-ri, matUid, UID vật tư, sê-ri tích hợp, hợp nhất, số hàng đến, arrivalNo, quét mã vạch, hủy, MERGED, phân tách, lot-split]
related: [MAT_LOT_SPLIT, MAT_ARRIVAL, QC_IQC]
---

# Hợp nhất Vật tư

## Mục đích màn hình
Màn hình **hợp nhất nhiều LOT vật tư (sê-ri) cùng mặt hàng và cùng lô hàng đến thành một sê-ri tích hợp mới**. Sử dụng khi cần gộp các LOT nhỏ lẻ đã bị chia nhỏ để đơn giản hóa quản lý và cấp phát. Khi hợp nhất, tất cả LOT gốc bị hủy (MERGED) và **1 sê-ri vật tư mới** với tổng số lượng được tạo ra, có thể in nhãn.

> Hợp nhất vật tư là khái niệm đối xứng với Phân tách vật tư (tách LOT). Phân tách chia 1 thành nhiều, hợp nhất gộp nhiều thành 1.

## Bố cục màn hình
- **Khu vực quét mã vạch (phía trên)**: Quét mã vạch hoặc nhập trực tiếp các sê-ri cần hợp nhất và tích lũy. Các sê-ri tích lũy được hiển thị dưới dạng thẻ, kèm thẻ thống kê số LOT đã chọn và tổng số lượng, và nút **Hợp nhất đã chọn**.
- **Danh sách LOT có thể hợp nhất (grid phía dưới)**: Hiển thị tất cả LOT hiện có thể hợp nhất. Nút **＋** trên mỗi hàng để tích lũy vào khu vực quét. Lọc theo số LOT, mã mặt hàng bằng tìm kiếm phía trên.
- **Modal Xác nhận Hợp nhất**: Xác nhận cuối cùng đối tượng hợp nhất và tổng số lượng.
- **Modal Xem trước Nhãn**: Xem trước và in nhãn vật tư của sê-ri mới sau khi hợp nhất thành công.

---

## ① Cột Grid Danh sách LOT Có thể Hợp nhất

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **(Thêm)** | Nút **＋** tích lũy hàng vào khu vực quét. Vô hiệu nếu sê-ri đã được thêm. |
| **Sê-ri vật tư(matUid)** | Định danh duy nhất của LOT vật tư (mã vạch nhãn). Tiêu chí nhận dạng đối tượng hợp nhất. |
| **Mã mặt hàng(itemCode)** | Mã mặt hàng của vật tư. Chỉ có thể hợp nhất **cùng mã mặt hàng**. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng vật tư. |
| **Số lượng(qty)** | Số lượng tồn kho hiện tại của LOT đó. Tất cả số lượng này sẽ được tổng hợp khi hợp nhất. |
| **Số hàng đến(arrivalNo)** | Số hàng đến của LOT. Chỉ cho phép hợp nhất **cùng số hàng đến** (mục đích kế thừa nhãn hàng đến). |
| **Nhà cung cấp(vendor)** | Khách hàng giao LOT. Hiển thị tên nếu có, nếu không hiển thị mã. |

> Danh sách này chỉ hiển thị LOT thỏa mãn tất cả điều kiện: **Bình thường (NORMAL)·có tồn kho·đã nhập kho xong·không có đặt trước·không có lịch sử xuất**.

---

## ② Khu vực Quét Mã vạch

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Ô nhập quét** | Quét mã vạch vật tư hoặc nhập trực tiếp sê-ri và nhấn Enter để tích lũy. Tự động focus lại sau khi quét. |
| **Nút Thêm** | Thêm giá trị từ ô nhập vào danh sách tích lũy. |
| **Thẻ sê-ri tích lũy** | Sê-ri đã tích lũy được hiển thị dưới dạng thẻ kèm số lượng. Có thể xóa từng thẻ bằng **✕**. |
| **LOT đã chọn (thẻ)** | Số lượng sê-ri đã tích lũy. |
| **Tổng số lượng (thẻ)** | Tổng số lượng của các sê-ri đã tích lũy. Sẽ là số lượng của sê-ri mới sau khi hợp nhất. |
| **Nút Bỏ chọn** | Xóa tất cả sê-ri đã tích lũy. |
| **Nút Hợp nhất đã chọn** | Mở modal xác nhận hợp nhất. Vô hiệu nếu tích lũy dưới 2. |

---

## ③ Modal Xác nhận Hợp nhất

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **LOT hợp nhất** | Hiển thị danh sách sê-ri đối tượng hợp nhất (chỉ đọc). |
| **Tổng số lượng** | Tổng số lượng sẽ được đưa vào sê-ri tích hợp mới. |
| **Nút Thực hiện Hợp nhất** | Thực hiện hợp nhất thực tế. Tất cả bản gốc bị hủy và 1 sê-ri mới được tạo. |

> Khi hợp nhất, tất cả LOT gốc bị hủy (MERGED) và **1 sê-ri mới** với tổng số lượng được tạo. Không thể hoàn tác, hãy kiểm tra cẩn thận.

---

## ④ Modal Xem trước Nhãn

Sau khi hợp nhất thành công, nhãn vật tư của sê-ri mới được mở để xem trước. Nhãn in UID vật tư mới, mã mặt hàng, tên mặt hàng, tổng số lượng, số hàng đến, nhà sản xuất, v.v. Nhấn [In nhãn] để gửi đến máy in nhãn và dán lên thùng sê-ri mới.

---

## Trình tự thực hiện

1. Tìm LOT cần hợp nhất trong danh sách phía dưới hoặc lọc bằng tìm kiếm phía trên.
2. Quét mã vạch vật tư cần hợp nhất hoặc nhấn nút **＋** trên hàng danh sách để tích lũy sê-ri (2 trở lên).
3. Kiểm tra sê-ri tích lũy và tổng số lượng trong thẻ thống kê.
4. Click nút **Hợp nhất đã chọn**.
5. Trong modal xác nhận, kiểm tra LOT hợp nhất và tổng số lượng, sau đó click **Thực hiện Hợp nhất**.
6. Trong xem trước nhãn, kiểm tra nhãn sê-ri mới, **In nhãn** và dán lên thùng mới.

---

## Quy tắc nhập / Kiểm tra

- Cần tích lũy **2 sê-ri khác nhau trở lên** để hợp nhất.
- Chỉ có thể hợp nhất LOT **cùng mã mặt hàng** (báo lỗi nếu thêm mặt hàng khác).
- Chỉ có thể hợp nhất LOT **cùng số hàng đến**. Không thể hợp nhất LOT không có số hàng đến.
- Không thể hợp nhất các LOT sau: trạng thái HOLD, không phải trạng thái Bình thường (NORMAL), tồn kho 0, có số lượng đặt trước, chưa nhập kho xong (cần xác nhận nhập kho), có lịch sử xuất vật tư.
- Sê-ri đã thêm không được thêm trùng lặp.

---

## Câu hỏi thường gặp

- **H.** Tôi quét mặt hàng khác và bị lỗi.
  **Đ.** Chỉ có thể hợp nhất cùng mã mặt hàng. Mặt hàng khác với LOT đã thêm trước sẽ không được thêm.

- **H.** Tại sao không thể hợp nhất LOT có số hàng đến khác?
  **Đ.** Vì sê-ri mới cần kế thừa số hàng đến và thông tin hàng đến của bản gốc để đảm bảo tính nhất quán của nhãn và lịch sử theo dõi, chỉ cho phép hợp nhất LOT cùng lô hàng đến.

- **H.** Sau khi hợp nhất, sê-ri gốc sẽ ra sao?
  **Đ.** Tất cả LOT gốc bị hủy (MERGED) và tồn kho về 0. 1 sê-ri mới với tổng số lượng được tạo. Lịch sử xuất nhập vẫn được giữ lại, do đó có thể theo dõi.

- **H.** Tôi đã hợp nhất sai. Có thể hoàn tác không?
  **Đ.** Không có màn hình hoàn tác hợp nhất. Nếu cần, hãy sử dụng [Phân tách Vật tư](/material/lot-split) để chia lại.

- **H.** Không thấy LOT trong danh sách.
  **Đ.** LOT chưa nhập kho xong, tồn kho 0, có số lượng đặt trước, có lịch sử xuất, trạng thái HOLD/không bình thường bị loại khỏi danh sách. Hãy kiểm tra xác nhận nhập kho, hủy đặt trước, v.v.

---

## Màn hình liên quan
- [Phân tách Vật tư](/material/lot-split) — Chia 1 LOT thành nhiều (đối xứng với hợp nhất)
- [Quản lý Hàng đến](/material/arrival) — Hàng đến và cấp sê-ri LOT
- [Kiểm tra Nhập (IQC)](/quality/iqc) — Kiểm tra nhập LOT đã đến
