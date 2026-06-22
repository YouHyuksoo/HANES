---
menuCode: MAT_RECEIVE
audience: user
title: Quản lý Nhập kho Vật tư
summary: Màn hình xử lý nhập kho (đặt trong kho) LOT vật tư đã đạt IQC bằng quét mã vạch và tra cứu tình trạng nhập kho
tags: [vật tư, nhập kho, xuất nhập, quét]
keywords: [nhập kho vật tư, nhập kho quét, đạt IQC, chờ nhập kho, sê-ri vật tư, matUid, mã vạch khách hàng, mã vạch tự dán, số lượng còn lại, hạn sử dụng, chứng chỉ, lịch sử nhập kho, sản xuất hàng loạt, MRO]
related: [MST_PART, QC_AQL]
---

# Quản lý Nhập kho Vật tư

## Mục đích màn hình
Màn hình **nhập kho (đặt trong kho) LOT vật tư đã đạt Kiểm tra Nhập (IQC)**. Sử dụng phương thức **quét mã vạch** thay vì nhập tay toàn bộ, ánh xạ mã vạch khách hàng và mã vạch tự dán để xác nhận nhập kho chính xác.

> Luồng: Hàng đến (nhập đặt hàng) → Kiểm tra nhập (IQC) → **Chỉ mục đạt chờ nhập kho** → Nhập kho quét → Phản ánh tồn kho

## Bố cục màn hình
- **Thống kê phía trên**: Số lượng/số lượng chờ nhập kho, số lượng/số lượng nhập kho hôm nay.
- **Bộ lọc**: Ngày hàng đến (mặc định hôm nay), nhà cung cấp, tìm kiếm mặt hàng.
- **Grid chờ nhập kho**: Danh sách LOT đạt IQC + chưa nhập (còn dư). Dùng để xác nhận đối tượng nhập kho.
- **Modal Xử lý Nhập kho (quét)**: Quét luân phiên mã vạch khách hàng → mã vạch tự dán. **Chỉ ánh xạ đã quét mới được xác nhận nhập kho.**

---

## ① Cột Chờ Nhập kho (LOT có thể nhập kho)

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Sê-ri vật tư(matUid)** | Sê-ri duy nhất của LOT vật tư đối tượng nhập kho. Giá trị nhận dạng vật tư được đánh số khi hàng đến. |
| **Mã mặt hàng/Tên mặt hàng(part.itemCode / itemName)** | Mặt hàng đối tượng nhập kho (theo master mặt hàng). |
| **Loại mặt hàng(itemType)** | Phân loại nguyên vật liệu/vật tư tiêu hao, v.v. |
| **Đơn vị(part.unit)** | Đơn vị số lượng. |
| **Số lượng hàng đến(initQty)** | Số lượng LOT ban đầu tại thời điểm hàng đến. |
| **Số lượng đã nhập(receivedQty)** | Số lượng đã xử lý nhập kho (tích lũy nhập một phần). |
| **Số lượng còn lại(remainingQty)** | Số lượng chưa nhập kho (= số lượng có thể nhập kho). |
| **Ngày hàng đến(recvDate)** | Ngày vật tư đến. |
| **Ngày sản xuất(manufactureDate)** | Ngày sản xuất vật tư. |
| **Hạn sử dụng(expireDate / expiryDays)** | Hạn sử dụng và số ngày còn lại của vật tư. Dùng để quản lý sắp hết hạn/quá hạn. |
| **Số PO(poNo)** | Số đơn đặt hàng (PO) kết nối. |
| **Nhà cung cấp(vendor)** | Khách hàng giao vật tư. |
| **Trạng thái kiểm tra(iqcStatus)** | Kết quả kiểm tra nhập. Chỉ hiển thị mục **Đạt** trong chờ nhập kho. |
| **Kho hàng đến(arrivalWarehouse)** | Kho nơi vật tư đã đến. |
| **Chứng chỉ(certRequired / certUploaded)** | Có cần chứng chỉ không và đã tải lên chưa. Nếu cần nhưng chưa tải lên, nhập kho có thể bị chặn. |
| **Lý do chặn nhập kho(receivingBlockedReason)** | Lý do nếu nhập kho bị chặn (ví dụ: chưa nộp chứng chỉ). |

## ② Phương thức Nhập kho Quét
1. Xác nhận đối tượng trong chờ nhập kho và nhấn nút **Xử lý Nhập kho**.
2. Quét **mã vạch khách hàng** (mã vạch do nhà cung cấp dán).
3. Tiếp theo quét **mã vạch tự dán (sê-ri vật tư)**.
4. Chỉ các mục có hai mã vạch được ánh xạ mới được xác nhận nhập kho. Có thể quét luân phiên nhiều mục.

> Mã vạch khách hàng được kết nối với mã mặt hàng/sê-ri MES theo quy tắc đã đăng ký tại [Ánh xạ mã vạch Nhà sản xuất].

## ③ Cột Lịch sử Nhập kho
| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Số nhập kho/Số giao dịch(receiveNo / transNo)** | Số nhận dạng xử lý nhập kho. |
| **Ngày nhập kho(transDate)** | Ngày xử lý nhập kho. |
| **Số lượng(qty)** | Số lượng đã nhập kho. |
| **Kho nhập kho(toWarehouse)** | Kho nơi vật tư được đặt. |
| **Nhà cung cấp/Nhà sản xuất(vendor / manufacturer)** | Khách hàng giao hàng và nhà sản xuất. |
| **Phân loại(materialClass)** | Phân loại sản xuất hàng loạt (PROD) / vật tư tiêu hao (MRO). |
| **Trạng thái(status)** | Trạng thái nhập kho. |

## Câu hỏi thường gặp
- **H.** Không thấy vật tư trong chờ nhập kho.
  **Đ.** Cần đạt IQC + còn số lượng còn lại mới hiển thị. Nếu kiểm tra chưa xong/không đạt hoặc đã nhập hết, sẽ không hiển thị.
- **H.** Nhập kho bị chặn.
  **Đ.** Hãy kiểm tra 'Lý do chặn nhập kho', ví dụ mặt hàng cần chứng chỉ nhưng chưa tải lên.
- **H.** Có thể nhập một phần không?
  **Đ.** Có, nhập một phần được tích lũy trong phạm vi số lượng còn lại.

## Màn hình liên quan
- [Master Mặt hàng](/master/part) — Tiêu chuẩn mặt hàng và có cần chứng chỉ không
- [Quản lý Tiêu chuẩn AQL](/quality/aql) — Tiêu chuẩn đánh giá kiểm tra nhập trước khi nhập kho
