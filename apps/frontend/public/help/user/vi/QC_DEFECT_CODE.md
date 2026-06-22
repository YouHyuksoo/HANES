---
menuCode: QC_DEFECT_CODE
audience: user
title: Quản lý Mã Lỗi
summary: Màn hình đăng ký mã lỗi dưới phân loại 3 cấp (bước kiểm tra, phân loại model, loại lỗi), chỉ định cấp độ lỗi (nghiêm trọng/lớn/nhẹ) và phạm vi áp dụng, dùng để đăng ký lỗi trong kiểm tra và sản lượng sản xuất
tags: [chất lượng, mã lỗi, phân loại lỗi, master, kiểm tra]
keywords: [mã lỗi, tên lỗi, loại lỗi, cấp độ lỗi, phân loại lỗi, phân loại model, bước kiểm tra, phạm vi áp dụng, Critical, Major, Minor, nghiêm trọng, lỗi lớn, lỗi nhẹ, IQC, LQC, OQC, điện áp thấp, điện áp cao, LV, HV, cấp 1, cấp 2, cấp 3, phân loại, danh mục]
related: [QC_DEFECT, QC_AQL, MST_PART]
---

# Quản lý Mã Lỗi

## Mục đích màn hình
Đăng ký và quản lý **mã lỗi** để chọn khi ghi nhận lỗi trong kiểm tra và sản lượng sản xuất. Mã lỗi không được sử dụng trực tiếp mà trước tiên được gán vào **phân loại 3 cấp** (bước kiểm tra → phân loại model → loại lỗi), sau đó gắn **cấp độ lỗi** và **phạm vi áp dụng**.

> Phân loại 3 cấp là: **Cấp 1 = Bước kiểm tra** (IQC nhập / LQC công đoạn / OQC xuất), **Cấp 2 = Phân loại model** (điện áp thấp LV / điện áp cao HV), **Cấp 3 = Loại lỗi** (chức năng / ngoại quan / khác). Mã lỗi bắt buộc phải kết nối với **phân loại cấp 3**.

## Bố cục màn hình
- **Bên trái — Tất cả lỗi đã đăng ký**: Hiển thị tất cả mã lỗi dưới dạng bảng. Click hàng để sửa bên phải. Ô tìm kiếm phía trên để tìm mã lỗi/tên lỗi.
- **Bên phải trên — Thêm/Sửa Mã lỗi**: Nhập tất cả mục của một mã lỗi. Phải chọn phân loại cấp 1·2·3 theo thứ tự để lưu.
- **Bên phải dưới — Thêm nhanh phân loại**: Khu vực tạo phân loại mới (bước kiểm tra/phân loại model/loại lỗi) ngay tại chỗ.

## Quan hệ khái niệm
```
Bước kiểm tra (Cấp 1) ──▶ Phân loại model (Cấp 2) ──▶ Loại lỗi (Cấp 3) ──Kết nối──▶ Mã lỗi ──(Cấp độ/Phạm vi)
   IQC/LQC/OQC              Điện áp thấp LV/Điện áp cao HV      Chức năng/Ngoại quan/Khác       Ví dụ: SOLDER-01
```
- Phân loại model (LV/HV) tự động phản ánh vào **danh sách áp dụng phân loại model** của mã lỗi. Nghĩa là việc chọn cấp 2 nào sẽ xác định mã lỗi đó được dùng cho model nào.

---

## ① Cột Danh sách Mã lỗi (Bảng bên trái)

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã lỗi(defectCode)** | Mã duy nhất nhận dạng lỗi. Màn hình kiểm tra·sản lượng chọn lỗi bằng mã này. Ví dụ: `SOLDER-01`. Không thể thay đổi sau khi đăng ký (tránh hỏng kết nối). |
| **Tên lỗi(defectName)** | Tên lỗi cho con người đọc. Ví dụ: `Lỗi hàn`. Hiển thị cùng trong danh sách màn hình kiểm tra. |
| **Cấp 1** | Tên phân loại **bước kiểm tra** mà mã lỗi này thuộc về (IQC/LQC/OQC). Tự động hiển thị theo phân loại cấp 3. |
| **Cấp 2** | Tên phân loại **phân loại model** (điện áp thấp/điện áp cao). |
| **Cấp 3** | Tên phân loại **loại lỗi** (chức năng/ngoại quan/khác). Là phân loại mà mã lỗi thực tế kết nối. |
| **Cấp độ(defectGrade)** | Mức độ nghiêm trọng của lỗi. **Nghiêm trọng (CRITICAL)** = nguy hiểm đến an toàn·chức năng, **Lớn (MAJOR)** = lỗi lớn ảnh hưởng đến chức năng, **Nhẹ (MINOR)** = lỗi nhẹ như ngoại quan. Là tiêu chí đánh giá đạt/không đạt và thống kê. |
| **Phạm vi áp dụng(defectScope)** | Nơi sử dụng lỗi này. **Chung (COMMON)** = mọi nơi, **Nguyên vật liệu (RAW_MATERIAL)** = vật tư kiểm tra nhập, **Sản phẩm (PRODUCT)** = thành phẩm, **Công đoạn (PROCESS)** = công đoạn sản xuất. |
| **Sử dụng hay không(useYn)** | Chỉ có thể chọn trong kiểm tra·sản lượng khi `Sử dụng (Y)`. Nếu `Vô hiệu (N)`, loại khỏi danh sách. |

---

## ② Trường Thêm/Sửa Mã lỗi (Bên phải trên)

| Trường | Vai trò / Ý nghĩa |
|------|------|
| **Mã lỗi(defectCode)** | Mã duy nhất nhập khi đăng ký mới. Tự động chuyển thành chữ hoa. **Khóa khi sửa, không thể thay đổi.** |
| **Tên lỗi(defectName)** | Tên lỗi. Nhập bắt buộc. |
| **Cấp 1 (Bước kiểm tra)** | Chọn phân loại bước kiểm tra (IQC/LQC/OQC). Phải chọn trước để kích hoạt cấp 2. |
| **Cấp 2 (Phân loại model)** | Chọn phân loại model dưới cấp 1 (điện áp thấp/điện áp cao). Phân loại model đã chọn ở đây chính là **model áp dụng** của mã lỗi này. |
| **Cấp 3 (Loại lỗi)** | Chọn loại lỗi dưới cấp 2 (chức năng/ngoại quan/khác). **Mã lỗi kết nối thực tế với phân loại cấp 3 này**, do đó bắt buộc phải chọn để lưu. |
| **Cấp độ(defectGrade)** | Chọn một trong Nghiêm trọng / Lớn / Nhẹ. Mặc định là **Lớn**. |
| **Phạm vi áp dụng(defectScope)** | Chọn một trong Chung / Nguyên vật liệu / Sản phẩm / Công đoạn. Mặc định là **Chung**. |
| **Sử dụng hay không(useYn)** | Chọn Sử dụng/Vô hiệu. |
| **Mô tả(description)** | Ghi chú bổ sung·tiêu chuẩn về lỗi (tùy chọn). |

> Điều kiện lưu: **Mã lỗi · Tên lỗi · Phân loại cấp 3** đều phải được điền. Phải chọn cấp 1·2·3 theo thứ tự từ trên xuống.

---

## ③ Trường Thêm nhanh Phân loại (Bên phải dưới)

Dùng để tạo phân loại bước kiểm tra, phân loại model, loại lỗi mới.

| Trường | Vai trò / Ý nghĩa |
|------|------|
| **Cấp phân loại(levelNo)** | Cấp của phân loại sẽ tạo. Cấp 1 (bước kiểm tra) / Cấp 2 (phân loại model) / Cấp 3 (loại lỗi). |
| **Phân loại cấp trên(parentCategoryCode)** | Phân loại ngay trên mà phân loại cấp 2·3 trực thuộc. **Nếu là cấp 1 thì để trống** (không có cấp trên). Nếu là cấp 2, chọn cấp 1; nếu là cấp 3, chọn cấp 2. |
| **Mã phân loại(categoryCode)** | Mã duy nhất của phân loại. Chuyển thành chữ hoa. Ví dụ: `IQC`, `IQC_LV`, `IQC_LV_FUNCTION`. |
| **Tên phân loại(categoryName)** | Tên phân loại. Ví dụ: `IQC`, `Điện áp thấp`, `Chức năng`. |

> Phân loại phải khớp chính xác từng cấp một. Ví dụ: cấp trên của cấp 2 bắt buộc phải là cấp 1, cấp 1 không thể có cấp trên.

---

## Trình tự thực hiện
1. (Nếu chưa có phân loại) Dùng **Thêm nhanh phân loại** để tạo lần lượt cấp 1 (bước kiểm tra) → cấp 2 (phân loại model) → cấp 3 (loại lỗi).
2. Trong **Thêm mã lỗi**, chọn phân loại cấp 1·2·3, nhập mã lỗi·tên lỗi·cấp độ·phạm vi áp dụng và lưu.
3. Mã lỗi đã đăng ký có thể chọn trong [Quản lý Lỗi], kiểm tra, nhập lỗi kiosk sản lượng sản xuất.

## Quy tắc nhập / Kiểm tra
- Mã lỗi, tên lỗi, phân loại cấp 3 là bắt buộc. Nếu thiếu dù chỉ một, không lưu được.
- Mã lỗi không thể thay đổi sau khi đăng ký (ô nhập mã bị khóa khi sửa).
- Mã lỗi **chỉ kết nối với phân loại cấp 3 (loại lỗi)**. Không thể kết nối trực tiếp với cấp 1·2.
- Chỉ có thể kết nối mã lỗi với phân loại đang `Sử dụng`.

## Câu hỏi thường gặp
- **H.** Cấp độ (nghiêm trọng/lớn/nhẹ) được xác định thế nào?
  **Đ.** Nếu nguy hiểm đến an toàn·chức năng cốt lõi là **Nghiêm trọng**, lỗi ảnh hưởng lớn đến chức năng là **Lớn**, nhẹ như ngoại quan là **Nhẹ**. Cấp độ là tiêu chí đánh giá đạt/không đạt kiểm tra và thống kê lỗi.
- **H.** Tại sao phải chọn cấp 2 (phân loại model)?
  **Đ.** Vì cùng một lỗi có thể quản lý khác nhau tùy theo sản phẩm điện áp thấp/cao, do đó đăng ký và thống kê mã lỗi theo phân loại model. Phân loại model đã chọn sẽ là model áp dụng của mã lỗi đó.
- **H.** Nếu không dùng mã lỗi nữa, có xóa không?
  **Đ.** Thay vì xóa, hãy để **Sử dụng hay không là Vô hiệu (N)**. Lịch sử lỗi quá khứ không bị mất kết nối.

## Màn hình liên quan
- [Quản lý Lỗi](/quality/defect) — Nơi ghi nhận và quản lý lỗi bằng mã lỗi đã đăng ký
- [Quản lý Tiêu chuẩn AQL](/quality/aql) — Tiêu chuẩn đánh giá đạt/không đạt kiểm tra nhập
- [Master Mặt hàng](/master/part) — Thông tin cơ bản phân loại model mặt hàng
