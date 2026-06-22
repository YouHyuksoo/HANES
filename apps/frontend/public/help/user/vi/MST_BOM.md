---
menuCode: MST_BOM
audience: user
title: Quản lý BOM
summary: Màn hình đăng ký và quản lý mặt hàng con (định mức nguyên vật liệu) cấu thành mặt hàng cha, nhu cầu, công đoạn, thời hạn hiệu lực dưới dạng cây
tags: [thông tin cơ bản, BOM, định mức nguyên vật liệu, master]
keywords: [định mức nguyên vật liệu, mặt hàng cha, mặt hàng con, nhu cầu, qtyPer, công đoạn, revision, side, thời hạn hiệu lực, cây BOM, cấp, khai triển, tải lên Excel, ECO]
related: [MST_PART]
---

# Quản lý BOM

## Mục đích màn hình
Quản lý **Định mức Nguyên vật liệu (BOM)** định nghĩa thành phần cấu tạo của thành phẩm/bán thành phẩm từ **mặt hàng con (vật tư)** nào. Cấu hình được đăng ký tại đây là cơ sở tính toán nhu cầu vật tư (khai triển) và đầu vào khi sản xuất.

## Bố cục màn hình
- **Bên trái**: Chọn mặt hàng cha (thành phẩm/bán thành phẩm).
- **Bên phải**: **Cây BOM** của mặt hàng cha đã chọn. Nếu mặt hàng con lại có mặt hàng con cấp dưới, được khai triển theo **cấp (Lv)** (cấu trúc đệ quy). Có thể gập/mở rộng hàng (gập/mở rộng tất cả).
- **Tải lên Excel**: Đăng ký nhiều hàng BOM cùng lúc.
- Có thể thêm/sửa hàng từ form BOM và kiểm tra định tuyến công đoạn của mặt hàng con.

## Quan hệ khái niệm
```
Mặt hàng cha (thành phẩm) ─┬─ Mặt hàng con A (nhu cầu)
                  ├─ Mặt hàng con B (nhu cầu)
                  └─ Bán thành phẩm C (nhu cầu) ─┬─ Mặt hàng con C1
                                        └─ Mặt hàng con C2
```

---

## Cột BOM (BOM_MASTERS)

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Lv (Cấp)** | Độ sâu trong cây BOM. Ngay dưới cha là 1, nếu mặt hàng con đó lại là cha thì là 2, v.v. (giá trị tính từ cây, không phải giá trị lưu). |
| **Mã mặt hàng con(childItemCode)** | **Mã mặt hàng con** cấu thành cha. Phải là mặt hàng đã đăng ký trong master mặt hàng. (Cha + Mặt hàng con + Revision là khóa của một hàng) |
| **Tên mặt hàng con(childPartName)** | Tên của mặt hàng con (lấy từ master mặt hàng, để hiển thị). |
| **Loại(type)** | Loại mặt hàng của mặt hàng con (nguyên vật liệu/bán thành phẩm, v.v., giá trị master mặt hàng). Nếu là bán thành phẩm, được khai triển thêm BOM cấp dưới. |
| **Công đoạn(oper)** | **Công đoạn** nơi mặt hàng con này được đầu vào. Xác định công đoạn nào cần đến. |
| **Nhu cầu(qtyPer)** | **Số lượng** mặt hàng con này cần để tạo 1 cha. Tính tổng nhu cầu = số lượng sản xuất × nhu cầu. |
| **Revision(revision)** | Revision của cấu hình BOM (mặc định `A`). Cùng cha-mặt hàng con nhưng phân biệt phiên bản bằng revision (một phần của khóa). |
| **Side(side)** | Giá trị phân biệt mặt áp dụng (ví dụ: TOP/BOT) cho bảng mạch hai mặt, v.v. |
| **Hiệu lực từ(validFrom)** | Ngày bắt đầu áp dụng hàng BOM này. |
| **Hiệu lực đến(validTo)** | Ngày kết thúc áp dụng hàng BOM này. (Không áp dụng ngoài thời hạn) |

### Mục nhập cùng trong form
| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Thứ tự(seq)** | Thứ tự hiển thị/xử lý mặt hàng con trong cùng cha. |
| **Nhóm BOM(bomGrp)** | Giá trị phân loại dùng khi quản lý BOM theo nhóm. |
| **Số ECO(ecoNo)** | Số theo dõi thay đổi thiết kế (ECO). Quản lý căn cứ thay đổi. |
| **Ghi chú(remark)** | Ghi chú. |
| **Sử dụng hay không(useYn)** | Chỉ được sử dụng làm cấu hình hợp lệ khi `Y`. |

---

## Trình tự thực hiện
1. Chọn **mặt hàng cha** ở bên trái.
2. Chọn hàng trong cây bên phải và **thêm mặt hàng con** (nhập mã mặt hàng con, nhu cầu, công đoạn, thời hạn hiệu lực).
3. Nếu mặt hàng con là bán thành phẩm, cấu hình BOM cấp dưới với bán thành phẩm đó làm cha.
4. Có thể đăng ký nhiều hàng cùng lúc bằng **tải lên Excel**.

## Quy tắc nhập
- Mã mặt hàng con phải tồn tại trong master mặt hàng.
- Nhu cầu phải lớn hơn 0.
- Không thể trùng lặp tổ hợp cùng cha + mặt hàng con + revision (khóa của một hàng).

## Câu hỏi thường gặp
- **H.** Cấp (Lv) được xác định thế nào?
  **Đ.** Không phải nhập trực tiếp, mà tự động sâu hơn một cấp nếu mặt hàng con có BOM (khai triển đệ quy).
- **H.** Nhu cầu dựa trên cái gì?
  **Đ.** Là số lượng mặt hàng con cần để tạo 1 cha. Tổng nhu cầu = số lượng sản xuất × nhu cầu.
- **H.** Tại sao revision được bao gồm trong khóa?
  **Đ.** Vì có thể có cấu hình khác nhau theo thay đổi thông số kỹ thuật (revision) cho cùng cha-mặt hàng con.

## Màn hình liên quan
- [Master Mặt hàng](/master/part) — Cha/mặt hàng con phải được đăng ký trước
