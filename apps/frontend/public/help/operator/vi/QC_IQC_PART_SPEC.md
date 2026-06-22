---
menuCode: QC_IQC_PART_SPEC
audience: operator
title: Quản lý hạng mục IQC theo hạng mục — Hướng dẫn vận hành
summary: Toàn bộ cột·DB mapping của tiêu chuẩn kiểm tra IQC theo hạng mục (header/hạng mục kiểm tra), logic loại kiểm tra·phương pháp lấy mẫu, liên kết pool hạng mục kiểm tra·AQL và xử lý sự cố
tags: [chất lượng, IQC, kiểm tra nhập, vận hành, thông tin cơ sở]
keywords: [IQC_PART_SPECS, IQC_PART_SPEC_ITEMS, IQC_ITEM_POOL, hạng mục kiểm tra, loại kiểm tra, phương pháp lấy mẫu, INSPECTION_TYPE, SAMPLE_METHOD, DESTRUCTIVE, FULL, AQL, FIXED, LSL, USL, cấp lỗi, mức kiểm tra, đa khách hàng, xử lý sự cố]
related: [QC_IQC_ITEM, QC_AQL, MST_PART, QC_IQC]
---

# Quản lý hạng mục IQC theo hạng mục — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Xác định **phiếu tiêu chuẩn kiểm tra nhập (IQC)** cho từng hạng mục nguyên liệu. Lưu một lần header (cỡ mẫu·có kiểm tra phá hủy) và N hạng mục kiểm tra (tham chiếu pool hạng mục kiểm tra + tiêu chuẩn·cấp lỗi·phương pháp lấy mẫu), tiêu chuẩn này là đầu vào cho phiếu kiểm tra và đánh giá AQL trên màn hình kiểm tra nhập. Định nghĩa hạng mục kiểm tra được cung cấp từ pool hạng mục kiểm tra (`IQC_ITEM_POOL`), cỡ mẫu·ngưỡng đạt/không đạt (Ac/Re) được cung cấp từ chính sách/tiêu chuẩn AQL.

## Cấu trúc dữ liệu
```
IQC_PART_SPECS (Header: COMPANY+PLANT_CD+ITEM_CODE)
        │ 1:N (CASCADE)
        ▼
IQC_PART_SPEC_ITEMS (Hạng mục kiểm tra: +SEQ)
        │ (tham chiếu INSP_ITEM_CODE, eager)
        ▼
IQC_ITEM_POOL (Pool hạng mục kiểm tra: tên·phương pháp đánh giá·đơn vị)

ITEM_MASTERS.IQC_AQL_POLICY_CODE ──▶ Chính sách/tiêu chuẩn AQL (Thẻ tóm tắt·tính cỡ mẫu tự động)
```

---

## ① Header phiếu kiểm tra — IQC_PART_SPECS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã hạng mục | `ITEM_CODE` | Một phần PK. Hạng mục nguyên liệu chọn từ danh sách bên trái. Tra cứu từ `/master/parts?itemType=RAW_MATERIAL`. |
| Cỡ mẫu cơ bản | `SAMPLE_QTY` | Số mẫu mặc định khi không có cỡ mẫu cố định theo hạng mục. Giá trị mặc định 1. |
| Kiểm tra phá hủy | `IS_DEST` | `Y`=kiểm tra phá hủy / `N`=không phá hủy. Hiển thị mẫu có bị tiêu hao hay không. |
| Sử dụng | `USE_YN` | Chỉ `Y` mới là đối tượng kiểm tra. Mặc định `Y`. |
| Cột kiểm toán | `CREATED_BY`/`UPDATED_BY`/`CREATED_AT`/`UPDATED_AT` | Lịch sử tạo·sửa. `CREATED_AT`/`UPDATED_AT` là DB DEFAULT SYSTIMESTAMP. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Một phần PK. Phạm vi `COMPANY='40'`, `PLANT_CD='1000'`. |

> Lưu theo phương thức upsert **POST toàn bộ header+hạng mục một lần**(`/master/iqc-part-specs`). Hạng mục được tái cấu trúc mỗi khi lưu, các dòng có `INSP_ITEM_CODE` trống bị loại trừ.

---

## ② Hạng mục kiểm tra — IQC_PART_SPEC_ITEMS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Thứ tự | `SEQ` | Một phần PK. Được cấp lại từ 1 khi lưu. |
| Hạng mục kiểm tra | `INSP_ITEM_CODE` | Tham chiếu `IQC_ITEM_POOL.INSP_ITEM_CODE` (eager). Loại·đơn vị theo từ pool. |
| Loại | (`judgeMethod` của pool) | `MEASURE` (đo lường)=so sánh LSL/USL / `VISUAL` (đánh giá)=tiêu chuẩn đánh giá. Không lưu trong bảng này, xác định từ pool. |
| Loại kiểm tra | `INSPECTION_TYPE` | Mã chung `IQC_ITEM_INSP_TYPE`. `AQL`/`DESTRUCTIVE`/`FULL`. **NULL được coi là AQL**. |
| Phương pháp lấy mẫu | `SAMPLE_METHOD` | Mã chung `IQC_SAMPLE_METHOD`. `AQL`(tự động)/`FIXED`(cố định). Nếu loại kiểm tra là AQL thì tự động đặt `AQL`, ngoài ra tự động đặt `FIXED`. **NULL=AQL**. |
| Cỡ mẫu | `SAMPLE_QTY` | Số mẫu cố định cho FIXED/DESTRUCTIVE/FULL (mỗi LOT). Nếu AQL thì NULL (tính tự động). |
| Cấp lỗi | `DEFECT_GRADE` | Mã chung `DEFECT_GRADE`. `CRITICAL`/`MAJOR`/`MINOR`. Áp dụng Ac/Re theo cấp khi đánh giá AQL. |
| Mức kiểm tra | `INSPECTION_LEVEL` | Mã chung `AQL_INSP_LEVEL` (II, S4 v.v.). Xác định cỡ mẫu. |
| AQL | `AQL` | Mã chung `AQL_VALUE` (0.65/1.0/2.5 v.v.). Giới hạn chất lượng chấp nhận. Càng nhỏ càng nghiêm ngặt. |
| Cận dưới (LSL) | `LSL` | Giá trị tối thiểu cho phép của loại đo lường. Dưới mức này là lỗi. NUMBER(12,4). |
| Cận trên (USL) | `USL` | Giá trị tối đa cho phép của loại đo lường. Vượt quá là lỗi. NUMBER(12,4). |
| Tiêu chuẩn đánh giá | `JUDGE_CRITERIA` | Văn bản tiêu chuẩn đạt/không đạt của loại đánh giá (tối đa 500 ký tự). |
| Sử dụng | `USE_YN` | Chỉ `Y` mới áp dụng. |
| Đơn vị | (`unit` của pool) | Chỉ hiển thị. Theo từ pool. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Một phần PK. Phạm vi `40` / `1000`. |

---

## Logic loại kiểm tra·phương pháp lấy mẫu
- **Thay đổi loại kiểm tra (INSPECTION_TYPE) thì phương pháp lấy mẫu được đồng bộ**. Chọn `AQL` → `SAMPLE_METHOD='AQL'` + `SAMPLE_QTY=NULL` (tính tự động), chọn khác (`DESTRUCTIVE`/`FULL`) → chuyển sang `SAMPLE_METHOD='FIXED'` và **nhập trực tiếp cỡ mẫu**.
- **Loại (judgeMethod) được xác định từ pool hạng mục kiểm tra**. Chỉ khi `MEASURE` mới mở trường nhập LSL/USL, `VISUAL` quản lý bằng tiêu chuẩn đánh giá.
- Cỡ mẫu·Ac/Re của thẻ tóm tắt AQL không phải từ bảng này mà là giá trị tham khảo được tính từ **chính sách AQL của hạng mục**(`/quality/aql/resolve-iqc-items`) dựa trên số lượng LOT.

## Thiết lập trước (Master·Mã chung)
- Mã chung: `DEFECT_GRADE` (cấp lỗi), `AQL_INSP_LEVEL` (mức kiểm tra), `AQL_VALUE` (giá trị AQL), `IQC_ITEM_INSP_TYPE` (loại kiểm tra), `IQC_SAMPLE_METHOD` (phương pháp lấy mẫu)
- Master: Pool hạng mục kiểm tra (`IQC_ITEM_POOL`, `USE_YN='Y'`), Hạng mục nguyên liệu (`ITEM_MASTERS` itemType=RAW_MATERIAL), Kết nối chính sách AQL của hạng mục (`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)

## Quy trình vận hành
1. Đăng ký hạng mục (tên·phương pháp đánh giá·đơn vị) trong [Pool hạng mục kiểm tra] trước.
2. Chọn hạng mục → Đặt header (cỡ mẫu·phá hủy) → Thêm hạng mục kiểm tra (hoặc áp dụng template).
3. Nhập loại kiểm tra·cấp lỗi·mức kiểm tra·AQL·tiêu chuẩn (LSL/USL hoặc tiêu chuẩn đánh giá) theo hạng mục rồi lưu.
4. Kết nối chính sách AQL trong [Master hạng mục] thì thẻ tóm tắt và cỡ mẫu tự động kiểm tra nhập sẽ được điền.

## Phân quyền
Quản trị viên chất lượng (đăng ký/sửa tiêu chuẩn). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Danh sách chọn hạng mục kiểm tra trống | Pool hạng mục kiểm tra chưa đăng ký hoặc `USE_YN='N'` | Đăng ký·kích hoạt hạng mục trong [Pool hạng mục kiểm tra] |
| Hạng mục biến mất sau khi lưu | Dòng chưa chọn `INSP_ITEM_CODE` bị loại khỏi lưu | Chọn hạng mục kiểm tra cho tất cả các dòng rồi lưu |
| Trường nhập LSL/USL không mở | Loại hạng mục là `VISUAL` (đánh giá) | Nhập bằng tiêu chuẩn đánh giá hoặc thay bằng hạng mục `MEASURE` từ pool |
| Cỡ mẫu chỉ hiển thị `Tự động` | Loại kiểm tra là `AQL` | Nếu cần mẫu cố định, đổi thành `DESTRUCTIVE`/`FULL` |
| Thẻ tóm tắt AQL đều là `-` | Hạng mục chưa kết nối chính sách AQL | Chỉ định chính sách AQL trong [Master hạng mục] |
| Thấy/không thấy dữ liệu nhà máy khác | Phạm vi `COMPANY`/`PLANT_CD` | Kiểm tra phạm vi `40`/`1000` |

## Dữ liệu & Liên kết
- Bảng: `IQC_PART_SPECS` (header), `IQC_PART_SPEC_ITEMS` (hạng mục, CASCADE)
- Tham chiếu: `IQC_ITEM_POOL` (pool hạng mục kiểm tra), `ITEM_MASTERS` (hạng mục·chính sách AQL)
- Liên kết: Pool hạng mục kiểm tra, Quản lý tiêu chuẩn AQL (tóm tắt·tính cỡ mẫu), Thực hiện kiểm tra nhập (IQC)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
