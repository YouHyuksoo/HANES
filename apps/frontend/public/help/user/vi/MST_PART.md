---
menuCode: MST_PART
audience: user
title: Master Mặt hàng
summary: Màn hình đăng ký và quản lý thông tin nhận dạng, phân loại, thông số kỹ thuật, IQC, tiêu chuẩn đóng gói của tất cả mặt hàng như nguyên vật liệu, bán thành phẩm, thành phẩm, vật tư tiêu hao
tags: [thông tin cơ bản, mặt hàng, master]
keywords: [mã mặt hàng, mã mặt hàng, loại mặt hàng, nhóm mặt hàng, loại xe, model, thông số kỹ thuật, đơn vị, IQC, kiểm tra nhập, AQL, tồn kho an toàn, hạn sử dụng, số lượng thùng, đơn vị đóng gói, vị trí xếp, đồng bộ ERP, ảnh mặt hàng]
related: [QC_AQL]
---

# Master Mặt hàng

## Mục đích màn hình
Đăng ký và quản lý **thông tin cơ bản của tất cả mặt hàng (nguyên vật liệu, bán thành phẩm, thành phẩm, vật tư tiêu hao)** được xử lý trong MES. Mặt hàng đã đăng ký tại đây là cơ sở cho BOM, sản xuất, xuất nhập vật tư, kiểm tra nhập, tồn kho.

## Bố cục màn hình
- **Bên trái (danh sách)**: Grid mặt hàng. Phía trên có bộ lọc loại mặt hàng, sử dụng hay không, tìm kiếm mã mặt hàng/tên mặt hàng, **đồng bộ ERP**, **thêm mặt hàng**.
- **Bên phải (bảng trượt)**: Form đăng ký/sửa mở ra khi click ✏️(sửa) hoặc "Thêm mặt hàng".
- Mặt hàng đối tượng IQC (`iqcYn=Y`) có thể **thiết lập tiêu chuẩn kiểm tra IQC** riêng.

---

## ① Thông tin nhận dạng

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã mặt hàng(itemCode)** | **Mã duy nhất** để nhận dạng mặt hàng trong MES. Nguyên tắc không thay đổi sau khi đăng ký (BOM, tồn kho, sản lượng kết nối qua mã này). |
| **Mã hàng(itemNo)** | Mã hàng dùng trong bản vẽ, ERP, tài liệu khách hàng. Số được gọi nhiều nhất trong thực tế. |
| **Tên mặt hàng(itemName)** | Tên mặt hàng để nhận dạng tại hiện trường. |
| **Mã hàng khách hàng(custPartNo)** | Mã hàng do khách hàng sử dụng (dùng cho xuất hàng và khớp nhãn). |
| **Rev(rev)** | Revision của bản vẽ/thông số kỹ thuật mặt hàng. Phân biệt lịch sử thay đổi thông số kỹ thuật. |
| **Văn bản đánh dấu(markingText)** | Văn bản hiển thị sẽ truyền đến thiết bị đánh dấu/in nhãn. |

## ② Phân loại

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Loại mặt hàng(itemType)** | Phân loại lớn theo luồng MES. Nguyên vật liệu (RAW_MATERIAL), Bán thành phẩm (SEMI_PRODUCT), Thành phẩm (FINISHED), Vật tư tiêu hao (CONSUMABLE). Phương thức xử lý xuất nhập vật tư và sản xuất thay đổi theo giá trị này. |
| **Nhóm mặt hàng(productType)** | Mã dòng sản phẩm/nhóm mặt hàng (mã chung PRODUCT_TYPE). Tham chiếu trong thông số kỹ thuật mạch, v.v. |
| **Loại xe/Model(modelName)** | Đặc tính quản lý phân biệt model xe hoặc loại xe. |

## ③ Thông số kỹ thuật

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Thông số kỹ thuật(spec)** | Mô tả phụ trợ về thông số kỹ thuật, kích thước, v.v. của mặt hàng. |
| **Màu sắc(color)** | Thông tin màu sắc mặt hàng như màu dây. |
| **Đơn vị(unit)** | Đơn vị cơ bản để diễn giải số lượng (EA, v.v., mã chung UNIT_TYPE). Số lượng tồn kho và cấp phát dựa trên đơn vị này. |

## ④ Kiểm tra Nhập (IQC)

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Có IQC hay không(iqcYn)** | Có là đối tượng kiểm tra nhập khi nhập kho không. Nếu `Y`, IQC được áp dụng cho LOT nhập kho. |
| **Phương thức kiểm tra(inspectMethod)** | Phương thức áp dụng IQC kiểm tra/không kiểm tra, v.v. (mã chung IQC_INSPECT_METHOD). |
| **Số lượng mẫu cơ bản(sampleQty)** | Số lượng mẫu cơ bản sử dụng khi kiểm tra IQC. (Riêng biệt với số mẫu tính theo AQL) |
| **Chính sách AQL(iqcAqlPolicyCode)** | **Chính sách AQL** áp dụng cho mặt hàng này. Khi kiểm tra LOT nhập kho, chính sách này tự động tính toán số mẫu, chấp nhận (Ac), từ chối (Re). Chính sách được đăng ký tại [Quản lý Tiêu chuẩn AQL]; nếu để trống, đánh giá tự động AQL không được áp dụng. |

## ⑤ Số lượng · Đóng gói

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Số lượng thùng(boxQty)** | Số lượng tiêu chuẩn đóng gói trong một thùng (tiêu chuẩn đóng gói, nhãn thùng). |
| **Số lượng đóng gói tối thiểu(minPackQty)** | Số lượng có thể xử lý làm đơn vị tối thiểu khi cấp phát vật tư. |
| **Đơn vị cấu thành LOT(lotUnitQty)** | Số lượng tiêu chuẩn để xử lý sản phẩm công đoạn sản xuất theo đơn vị bó. |
| **Đơn vị cấu thành Pallet(packUnit)** | Tiêu chuẩn cấu thành Pallet hoặc đơn vị đóng gói cấp trên. |
| **Tồn kho an toàn(safetyStock)** | Số lượng tiêu chuẩn dùng đánh giá thiếu tồn kho. Dưới giá trị này được coi là thiếu. |

## ⑥ Hạn sử dụng

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Hạn sử dụng(expiryDate)** | Hạn sử dụng **số ngày** dựa trên nhập kho hoặc sản xuất. |
| **Gia hạn hạn sử dụng(expiryExtDays)** | **Số ngày tối đa** có thể gia hạn hạn sử dụng sau đánh giá chất lượng. |

## ⑦ Khác

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Vị trí xếp(storageLocation)** | Vị trí xếp cơ bản cố định theo mặt hàng. |
| **Ảnh(imageUrl)** | Ảnh mặt hàng. Tải lên từ form, hiển thị dưới dạng hình thu nhỏ trong danh sách. |
| **Sử dụng hay không(useYn)** | Chỉ là đối tượng tra cứu, chọn, sử dụng khi `Y`. Ngừng sử dụng là `N`. |
| **Ghi chú(remark)** | Tham khảo quản lý mặt hàng. |

---

## Đồng bộ ERP
Nút **Đồng bộ ERP** ở phía trên lấy master mặt hàng từ ERP và **thêm mới/thay đổi** vào MES. Modal xác nhận xuất hiện trước khi thực thi. Có thể nhập hàng chục nghìn bản cùng lúc, chỉ thực hiện khi có chủ đích.

## Trình tự thực hiện
1. Click **Thêm mặt hàng** (hoặc ✏️ trên hàng) ở phía trên để mở form trượt.
2. Nhập thông tin nhận dạng (mã mặt hàng, mã hàng, tên mặt hàng) và phân loại (loại mặt hàng).
3. Điền các mục cần thiết (thông số kỹ thuật, IQC, đóng gói, hạn sử dụng, v.v.) và lưu.
4. Nếu là đối tượng IQC, kết nối **tiêu chuẩn kiểm tra IQC** và **chính sách AQL** của mặt hàng.

## Câu hỏi thường gặp
- **H.** Mã mặt hàng và mã hàng khác nhau thế nào?
  **Đ.** Mã mặt hàng là định danh nội bộ MES (không thay đổi), mã hàng là số dùng trong bản vẽ/ERP/tài liệu khách hàng.
- **H.** Nếu để trống chính sách AQL?
  **Đ.** Đánh giá tự động AQL không được áp dụng trong kiểm tra nhập (không kiểm tra hoặc thủ công).
- **H.** Đã thêm sai qua đồng bộ ERP.
  **Đ.** Mặt hàng nhập qua ERP-IF có thể được quản lý viên dọn dẹp (tham khảo hướng dẫn vận hành).

## Màn hình liên quan
- [Quản lý Tiêu chuẩn AQL](/quality/aql) — Đăng ký chính sách AQL để kết nối với mặt hàng
