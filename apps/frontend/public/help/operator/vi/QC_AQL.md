---
menuCode: QC_AQL
audience: operator
title: Quản lý tiêu chuẩn AQL — Hướng dẫn vận hành
summary: Ý nghĩa toàn bộ cột của chính sách AQL/tiêu chuẩn/tiêu chí đánh giá, DB mapping, logic đánh giá, liên kết hạng mục và xử lý sự cố
tags: [chất lượng, IQC, AQL, vận hành, cài đặt]
keywords: [IQC_AQL_POLICIES, AQL_STANDARDS, liên kết hạng mục, mức kiểm tra, khuyết tật nghiêm trọng, IMMEDIATE_FAIL, Ac, Re, cỡ mẫu, xử lý sự cố, ITEM_MASTERS]
related: [MST_PART]
---

# Quản lý tiêu chuẩn AQL — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Xác định **chính sách AQL / tiêu chuẩn AQL / tiêu chí đánh giá theo khoảng LOT** làm cơ sở đánh giá kiểm tra nhập (IQC) theo hạng mục. Trường chính sách AQL của master hạng mục (`ITEM_MASTERS.IQC_AQL_POLICY_CODE`) tham chiếu chính sách này; khi kiểm tra LOT nhập, cỡ mẫu·Ac·Re được tính theo thứ tự chính sách → tiêu chuẩn → khoảng LOT để tự động đánh giá đạt/không đạt.

## Cấu trúc dữ liệu (3 tầng)
```
ITEM_MASTERS.IQC_AQL_POLICY_CODE
        │ (tham chiếu)
        ▼
IQC_AQL_POLICIES  ──(MAJOR_AQL_CODE / MINOR_AQL_CODE)──▶  AQL_STANDARDS  ──(1:N)──▶  Tiêu chí đánh giá theo khoảng LOT (rules)
```

---

## ① Chính sách AQL — IQC_AQL_POLICIES (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã chính sách | `POLICY_CODE` | PK. Khóa master hạng mục tham chiếu. Không thể thay đổi (tránh mất kết nối). Khuyến nghị đặt tên: `AQLP-{mức kiểm tra}-{Major}-{Minor}`. |
| Tên chính sách | `POLICY_NAME` | Tên hiển thị. |
| Mức kiểm tra | `INSPECTION_LEVEL` | Mã chung `AQL_INSP_LEVEL`. Tiêu chuẩn xác định chữ mã (code letter) từ kích thước LOT. Mặc định là II. |
| Major AQL | `MAJOR_AQL_CODE` | Tham chiếu `AQL_STANDARDS.AQL_CODE` cho khuyết tật chính (tính FK). Nếu chưa đặt thì không thể tự động đánh giá khuyết tật chính. |
| Minor AQL | `MINOR_AQL_CODE` | Tham chiếu `AQL_STANDARDS.AQL_CODE` cho khuyết tật phụ. |
| Xử lý khuyết tật nghiêm trọng | `CRITICAL_MODE` | `IMMEDIATE_FAIL` = nếu có dù chỉ 1 khuyết tật nghiêm trọng thì LOT không đạt ngay (không phụ thuộc cỡ mẫu/Ac). |
| Sử dụng | `USE_YN` | Chỉ `Y` mới được kết nối hạng mục·kiểm tra. "Ngừng sử dụng" chính sách là bất hoạt mềm (`N`). |
| Ghi chú | `REMARK` | Ghi nhớ. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Chính sách quản lý trong phạm vi `COMPANY='40'`, `PLANT_CD='1000'`. |

---

## ② Tiêu chuẩn AQL — AQL_STANDARDS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã AQL | `AQL_CODE` | PK. Chính sách Major/Minor tham chiếu. Không thể thay đổi. VD: `AQL-1.0`. |
| Tên AQL | `AQL_NAME` | Hiển thị. |
| Mức kiểm tra | `INSPECTION_LEVEL` | Mã chung `AQL_INSP_LEVEL`. Vận hành nhất quán với mức kiểm tra chính sách. |
| Giá trị AQL | `AQL_VALUE` | Mã chung `AQL_VALUE` (0.65/1.0/2.5 v.v.). Giới hạn chất lượng chấp nhận. **Càng nhỏ càng nghiêm ngặt**. Kết hợp với cỡ mẫu tính Ac/Re. |
| Sử dụng | `USE_YN` | Chỉ `Y` mới được chọn trong chính sách. |
| Ghi chú | `REMARK` | Ghi nhớ. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000`. |

---

## ③ Tiêu chí đánh giá theo khoảng LOT — rules (toàn bộ cột)

Một tiêu chuẩn AQL có N dòng khoảng LOT. Xác định cỡ mẫu·Ac·Re theo từng khoảng kích thước LOT (dựa trên bảng KS Q ISO 2859-1).

| Mục màn hình | Cột | Vai trò / Ý nghĩa |
|------|------|------|
| LOT From | `lotQtyFrom` | Cận dưới khoảng LOT áp dụng. |
| LOT To | `lotQtyTo` | Cận trên khoảng LOT áp dụng. |
| Cỡ mẫu (n) | `sampleSize` | Số mẫu kiểm tra. |
| Ac | `acceptQty` | Số chấp nhận. Số khuyết tật ≤ Ac → đạt. |
| Re | `rejectQty` | Số loại bỏ. Số khuyết tật ≥ Re → không đạt. Thường Re = Ac+1. |
| Thứ tự | `sortOrder` | Sắp xếp theo LOT khi lưu. |

**Xác thực nhập (chặn khi lưu)**: From ≤ To, Re > Ac, khoảng không trùng (To trước < From sau).

---

## Logic đánh giá (khi kiểm tra LOT nhập)
1. Tra chính sách theo `IQC_AQL_POLICY_CODE` của hạng mục. Nếu không có thì không áp dụng tự động đánh giá.
2. Nếu có khuyết tật nghiêm trọng và `CRITICAL_MODE='IMMEDIATE_FAIL'` thì không đạt ngay.
3. Major/Minor riêng: Tiêu chuẩn AQL tương ứng của chính sách → chọn dòng khoảng phù hợp LOT → áp dụng n·Ac·Re của dòng đó.
4. So sánh số khuyết tật theo cấp với Ac/Re. Nếu bất kỳ cấp nào không đạt thì LOT không đạt.

## Thiết lập trước (Master·Mã chung)
- Mã chung: `AQL_INSP_LEVEL` (mức kiểm tra), `AQL_VALUE` (giá trị AQL)
- Đăng ký theo thứ tự: Tiêu chuẩn AQL → Tiêu chí LOT → Chính sách, sau đó kết nối chính sách với hạng mục trong master hạng mục

## Quy trình vận hành
1. Định nghĩa `AQL_STANDARDS` (tiêu chuẩn theo giá trị AQL) + đăng ký tiêu chí đánh giá khoảng LOT cho mỗi tiêu chuẩn
2. Trong `IQC_AQL_POLICIES`, kết nối tiêu chuẩn với Major/Minor, đặt mức kiểm tra·xử lý khuyết tật nghiêm trọng
3. Kết nối chính sách với hạng mục trong [Master hạng mục] (`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)
4. Xác nhận tự động đánh giá trong kiểm tra nhập LOT

## Phân quyền
Quản trị viên chất lượng (đăng ký/sửa tiêu chuẩn). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Kiểm tra không tự động đánh giá AQL | Hạng mục chưa kết nối chính sách | Chỉ định chính sách AQL trong master hạng mục |
| Tiêu chuẩn không chọn được trong chính sách | Tiêu chuẩn AQL đó `USE_YN='N'` | Kích hoạt tiêu chuẩn thành `Y` |
| Thiếu đánh giá cho LOT cụ thể | Không có dòng khoảng chứa số lượng đó | Thêm dòng khoảng LOT (loại bỏ khoảng trống) |
| Khuyết tật nghiêm trọng nhưng đạt | `CRITICAL_MODE` chưa đặt | Đặt `IMMEDIATE_FAIL` trong chính sách |
| Từ chối lưu (khoảng trùng/Re≤Ac) | Vi phạm xác thực nhập | Sửa From≤To, Re>Ac, khoảng không trùng |

## Dữ liệu & Liên kết
- Bảng: `IQC_AQL_POLICIES`, `AQL_STANDARDS` (+ tiêu chí LOT rules)
- Liên kết: Master hạng mục (`ITEM_MASTERS.IQC_AQL_POLICY_CODE`), Engine đánh giá IQC
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
