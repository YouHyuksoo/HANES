---
menuCode: QC_AQL
audience: user
title: Quản lý Tiêu chuẩn AQL
summary: Màn hình đăng ký và quản lý chính sách AQL, tiêu chuẩn và tiêu chí đánh giá theo số lượng LOT để đánh giá đạt/không đạt LOT trong Kiểm tra Nhập (IQC)
tags: [chất lượng, IQC, AQL, kiểm tra nhập, lấy mẫu]
keywords: [giới hạn chất lượng chấp nhận, Major, Minor, mức kiểm tra, kiểm tra lấy mẫu, Ac, Re, cỡ mẫu, LOT, lỗi nghiêm trọng, mã chính sách, mã AQL, giá trị AQL]
related: [MST_PART]
---

# Quản lý Tiêu chuẩn AQL

## Mục đích màn hình
Đăng ký và quản lý tiêu chuẩn để đánh giá **đạt/không đạt LOT nhập kho bằng kiểm tra lấy mẫu** trong Kiểm tra Nhập (IQC).
Vì không kiểm tra toàn bộ LOT mà chỉ kiểm tra một phần mẫu, cần xác định "lấy bao nhiêu mẫu (cỡ mẫu), trong đó tối đa bao nhiêu lỗi là đạt (Ac) và từ bao nhiêu là không đạt (Re)". Tập hợp các tiêu chuẩn này là **Chính sách AQL** và **Tiêu chuẩn AQL**.

> AQL (Acceptable Quality Limit): Mức lỗi cho phép có thể chấp nhận LOT đạt. **Giá trị càng nhỏ càng nghiêm ngặt** (ví dụ: 1.0 nghiêm ngặt hơn 2.5).

## Bố cục màn hình
- **Bên trái — Quản lý Chính sách AQL**: Đơn vị kết nối trực tiếp với mặt hàng. Gộp tiêu chuẩn AQL nào sẽ sử dụng cho Major (lỗi lớn) và Minor (lỗi nhẹ).
- **Bên phải trên — Danh sách Tiêu chuẩn AQL**: Tiêu chuẩn theo đơn vị giá trị AQL. Chính sách tham chiếu tiêu chuẩn này.
- **Bên phải dưới — Tiêu chí đánh giá theo Số lượng LOT**: Định nghĩa cỡ mẫu, Ac, Re theo khoảng kích thước LOT cho tiêu chuẩn AQL đã chọn.

## Quan hệ khái niệm
```
Master Mặt hàng ──Kết nối──▶ Chính sách AQL ──(Major/Minor)──▶ Tiêu chuẩn AQL ──▶ Tiêu chí đánh giá theo Số lượng LOT (cỡ mẫu·Ac·Re)
```

---

## ① Cột Chính sách AQL (IQC_AQL_POLICIES)

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã chính sách(policyCode)** | Mã duy nhất nhận dạng chính sách. **Trường 'Chính sách AQL' trong Master Mặt hàng tham chiếu mã này.** Ví dụ: `AQLP-II-1.0-2.5`. Không thể thay đổi sau khi đăng ký. |
| **Tên chính sách(policyName)** | Tên để nhận biết cho con người. Ví dụ: `II Major 1.0 Minor 2.5`. |
| **Mức kiểm tra(inspectionLevel)** | Mức xác định cỡ mẫu. Thông thường dùng **II (kiểm tra thường)**. I lấy ít hơn (nới lỏng), III lấy nhiều hơn (nghiêm ngặt). Kích thước LOT và mức kiểm tra kết hợp để xác định cỡ mẫu. |
| **Major AQL(majorAqlCode)** | Chọn tiêu chuẩn AQL áp dụng cho **lỗi lớn** (lỗi ảnh hưởng lớn đến chức năng·an toàn). Chọn một trong các mục trong 'Danh sách Tiêu chuẩn AQL' bên phải. Thường dùng tiêu chuẩn nghiêm ngặt hơn (giá trị nhỏ hơn) Minor. |
| **Minor AQL(minorAqlCode)** | Chọn tiêu chuẩn AQL áp dụng cho **lỗi nhẹ** (lỗi nhẹ như ngoại quan). Thường dùng tiêu chuẩn nới lỏng hơn Major. |
| **Xử lý lỗi nghiêm trọng(criticalMode)** | Phương thức xử lý khi **lỗi nghiêm trọng (Critical)** xảy ra. `IMMEDIATE_FAIL` là nếu có dù chỉ 1 lỗi nghiêm trọng, **đánh giá LOT không đạt ngay lập tức** bất kể cỡ mẫu hay Ac. |
| **Sử dụng hay không(useYn)** | Chỉ được sử dụng cho kết nối mặt hàng·kiểm tra khi `Y`. `N` là vô hiệu (ngừng sử dụng). |
| **Ghi chú(remark)** | Ghi chú quản lý. |

---

## ② Cột Tiêu chuẩn AQL (AQL_STANDARDS)

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã AQL(aqlCode)** | Mã duy nhất nhận dạng tiêu chuẩn AQL. Major/Minor của chính sách tham chiếu mã này. Ví dụ: `AQL-1.0`. Không thể thay đổi sau khi đăng ký. |
| **Tên AQL(aqlName)** | Tên của tiêu chuẩn. Ví dụ: `Kiểm tra thường AQL 1.0`. |
| **Mức kiểm tra(inspectionLevel)** | Mức kiểm tra mà tiêu chuẩn này giả định (thường II). |
| **Giá trị AQL(aqlValue)** | **Giá trị số của giới hạn chất lượng chấp nhận** (ví dụ: 0.65, 1.0, 2.5). Chỉ giới hạn trên của tỷ lệ lỗi cho phép, **càng nhỏ càng nghiêm ngặt**. Cỡ mẫu kết hợp với giá trị này xác định Ac/Re. |
| **Sử dụng hay không(useYn)** | Chỉ có thể chọn trong chính sách khi `Y`. |
| **Ghi chú(remark)** | Ghi chú quản lý. |

---

## ③ Tiêu chí đánh giá theo Số lượng LOT (rules)

Cùng một giá trị AQL, **LOT càng lớn càng phải lấy nhiều mẫu**, do đó định nghĩa riêng cỡ mẫu, Ac, Re cho từng khoảng kích thước LOT.

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **lotQtyFrom** | **Giá trị bắt đầu (dưới)** của khoảng số lượng LOT mà hàng này áp dụng. |
| **lotQtyTo** | **Giá trị kết thúc (trên)** của khoảng số lượng LOT mà hàng này áp dụng. (Ví dụ: 51~500) |
| **sampleSize (n)** | **Số mẫu** sẽ lấy và kiểm tra từ LOT trong khoảng đó. |
| **acceptQty (Ac)** | **Số chấp nhận**. Nếu số lỗi kiểm tra **≤ Ac** thì LOT đạt. |
| **rejectQty (Re)** | **Số không chấp nhận**. Nếu số lỗi kiểm tra **≥ Re** thì LOT không đạt. (Thường Re = Ac + 1) |
| **Thứ tự sắp xếp(sortOrder)** | Thứ tự hiển thị hàng. Tự động sắp xếp theo thứ tự số lượng LOT khi lưu. |

> Ví dụ đánh giá: cỡ mẫu n=13, Ac=1, Re=2 → Trong 13 mẫu, **đến 1 lỗi là đạt**, **từ 2 lỗi trở lên là không đạt**.

---

## Trình tự thực hiện
1. Đăng ký **Tiêu chuẩn AQL** bên phải trước (ví dụ: `AQL-1.0`, `AQL-2.5`). Điền **Tiêu chí đánh giá theo Số lượng LOT** (cỡ mẫu·Ac·Re) cho từng tiêu chuẩn.
2. Tạo **Chính sách AQL** bên trái và kết nối **Major/Minor** với tiêu chuẩn trên.
3. Tại [Master Mặt hàng], chỉ định chính sách này vào trường **Chính sách AQL** của mặt hàng.
4. Sau đó, khi kiểm tra nhập LOT nhập kho của mặt hàng đó, tự động đánh giá theo tiêu chuẩn này.

## Quy tắc nhập / Kiểm tra
- LOT số lượng From không được lớn hơn To.
- Số lượng Re phải lớn hơn số lượng Ac.
- Các khoảng số lượng LOT không được chồng lấn (From của khoảng tiếp theo phải lớn hơn To của khoảng trước).

## Câu hỏi thường gặp
- **H.** Tại sao phải tách riêng Major và Minor?
  **Đ.** Để áp dụng tiêu chuẩn đạt khác nhau theo mức độ nghiêm trọng của lỗi. Thường lỗi lớn (Major) được đặt nghiêm ngặt (AQL nhỏ), lỗi nhẹ (Minor) được đặt nới lỏng.
- **H.** Tại sao cần tiêu chí đánh giá theo số lượng LOT?
  **Đ.** Vì LOT càng lớn càng cần nhiều mẫu hơn để đạt cùng độ tin cậy (theo tiêu chuẩn lấy mẫu KS Q ISO 2859-1).
- **H.** Nếu để trống chính sách (chưa kết nối mặt hàng) thì sao?
  **Đ.** Đánh giá tự động AQL không được áp dụng (không kiểm tra hoặc đánh giá thủ công).

## Màn hình liên quan
- [Master Mặt hàng](/master/part) — Nơi kết nối chính sách AQL với mặt hàng
