---
menuCode: QC_DEFECT_CODE
audience: operator
title: Quản lý mã lỗi — Hướng dẫn vận hành
summary: Phân loại lỗi 3 cấp (giai đoạn kiểm tra/phân nhóm mẫu/loại lỗi) và toàn bộ cột·DB mapping của master mã lỗi, liên kết mã chung phân nhóm mẫu, giá trị mã cấp/phạm vi áp dụng, quy trình vận hành và xử lý sự cố
tags: [chất lượng, mã lỗi, vận hành, master, cài đặt]
keywords: [DEFECT_CODE_MASTERS, DEFECT_CATEGORY_MASTERS, DEFECT_CODE_PRODUCT_TYPES, DEFECT_MODEL_GROUP, DEFECT_LOGS, cấp lỗi, defectGrade, CRITICAL, MAJOR, MINOR, phạm vi áp dụng, defectScope, RAW_MATERIAL, PRODUCT, PROCESS, COMMON, giai đoạn kiểm tra, IQC, LQC, OQC, phân nhóm mẫu, LV, HV, low voltage, high voltage, loại lỗi, 3 cấp, phân cấp, COMPANY, PLANT_CD, xử lý sự cố]
related: [QC_DEFECT, QC_AQL, MST_PART]
---

# Quản lý mã lỗi — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Master mã lỗi là **nguồn duy nhất của mã lỗi** được chọn trong kiểm tra (nhập/quy trình/xuất) và đăng ký lỗi sản xuất. Mã lỗi chỉ kết nối với cấp 3 trong **hệ thống phân loại 3 cấp** (cấp 1 giai đoạn kiểm tra → cấp 2 phân nhóm mẫu → cấp 3 loại lỗi), mỗi mã có **cấp lỗi**, **phạm vi áp dụng**, và **danh sách áp dụng phân nhóm mẫu**. Lịch sử lỗi (`DEFECT_LOGS.DEFECT_CODE`) tham chiếu mã này.

## Cấu trúc dữ liệu (3 tầng + mapping mẫu)
```
DEFECT_CATEGORY_MASTERS (cây tự tham chiếu, LEVEL_NO 1→2→3)
  Cấp 1 Giai đoạn kiểm tra: IQC / LQC / OQC
    Cấp 2 Phân nhóm mẫu: {stage}_LV / {stage}_HV         (VD: IQC_LV)
      Cấp 3 Loại lỗi: {cấp2}_FUNCTION / _APPEARANCE / _ETC   (VD: IQC_LV_FUNCTION)
                             │ (CATEGORY_CODE, chỉ cấp 3 kết nối)
                             ▼
DEFECT_CODE_MASTERS ──(DEFECT_CODE)──▶ DEFECT_CODE_PRODUCT_TYPES (áp dụng theo phân nhóm mẫu, 1:N)
                                             │ PRODUCT_TYPE = mã DEFECT_MODEL_GROUP (LV/HV)
DEFECT_LOGS.DEFECT_CODE ──(tham chiếu)──▶ DEFECT_CODE_MASTERS.DEFECT_CODE
```
- Mã cấp 2 theo quy tắc `{cấp1}_{phân nhóm mẫu}` (VD: `IQC_LV`). Màn hình lấy phân nhóm mẫu (`LV`) bằng cách bỏ tiền tố (`IQC_`) từ mã cấp 2, và khi lưu ghi giá trị đó vào `DEFECT_CODE_PRODUCT_TYPES.PRODUCT_TYPE`.

---

## ① Phân loại lỗi — DEFECT_CATEGORY_MASTERS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã phân loại | `CATEGORY_CODE` | PK. Khóa nút của cây tự tham chiếu. Quy tắc đặt tên: cấp 1 `IQC`, cấp 2 `IQC_LV`, cấp 3 `IQC_LV_FUNCTION`. IN HOA. |
| Tên phân loại | `CATEGORY_NAME` | Tên hiển thị (VD: `IQC`, `Low Voltage`, `Chức năng`). |
| Cấp phân loại | `LEVEL_NO` | `1`=giai đoạn kiểm tra, `2`=phân nhóm mẫu, `3`=loại lỗi. Mã lỗi chỉ kết nối được với cấp 3. |
| Phân loại cha | `PARENT_CATEGORY_CODE` | Nút cha (self FK `FK_DEFECT_CATEGORY_PARENT`). Cấp 1 là NULL. Cấp cha phải là `hiện tại-1` (xác thực server). |
| Thứ tự | `SORT_ORDER` | Thứ tự hiển thị cây. |
| Sử dụng | `USE_YN` | Chỉ `Y` mới hiển thị trong lựa chọn·kết nối được. Phân loại bỏ là `N` (bất hoạt mềm). |
| Mô tả | `DESCRIPTION` | Ghi nhớ. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Một phần PK. Phạm vi chính `COMPANY='40'`, `PLANT_CD='1000'`. |
| (Kiểm toán) | `CREATED_BY` / `UPDATED_BY` / `CREATED_AT` / `UPDATED_AT` | Người/giờ đăng·sửa. |

API tra cứu `GET /quality/defect-codes/categories` trả về dạng cây từ các dòng phẳng.

---

## ② Mã lỗi — DEFECT_CODE_MASTERS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã lỗi | `DEFECT_CODE` | PK. Khóa `DEFECT_LOGS` tham chiếu. Không thể thay đổi sau đăng ký (khóa trên màn hình). Chuẩn hóa IN HOA. |
| Tên lỗi | `DEFECT_NAME` | Tên hiển thị. Bắt buộc. |
| Phân loại (cấp 3) | `CATEGORY_CODE` | Mã phân loại cấp 3 đã kết nối. Server xác thực `LEVEL_NO=3` và `USE_YN='Y'` (`assertLeafCategory`). Cấp 1·2·3 trong danh sách màn hình được tính từ mã này truy ngược cha. |
| Cấp | `DEFECT_GRADE` | `CRITICAL`=nghiêm trọng (an toàn·chức năng cốt lõi), `MAJOR`=khuyết tật chính, `MINOR`=khuyết tật phụ. Mặc định `MAJOR`. Tiêu chuẩn đạt/không đạt·thống kê. |
| Phạm vi áp dụng | `DEFECT_SCOPE` | `COMMON`=chung, `RAW_MATERIAL`=nguyên liệu, `PRODUCT`=sản phẩm, `PROCESS`=quy trình. Mặc định `COMMON`. Khi lọc `defectScope` trong `findOptions`, hiển thị phạm vi đó + `COMMON`. |
| Sử dụng | `USE_YN` | Chỉ `Y` mới hiển thị trong tùy chọn/kiểm tra. Ngừng sử dụng (`DELETE` API) là bất hoạt mềm `USE_YN='N'`. |
| Mô tả | `DESCRIPTION` | Ghi nhớ (tối đa 500 ký tự). |
| Thứ tự | `SORT_ORDER` | Khóa sắp xếp danh sách/tùy chọn (ASC, sau đó theo mã). |
| (Áp dụng phân nhóm mẫu) | — (bảng riêng) | Phân nhóm mẫu (LV/HV) tính từ giá trị chọn cấp 2 được lưu vào `DEFECT_CODE_PRODUCT_TYPES`. Bảng này không có cột. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Một phần PK. Phạm vi `40` / `1000`. |
| (Kiểm toán) | `CREATED_BY` / `UPDATED_BY` / `CREATED_AT` / `UPDATED_AT` | Người/giờ đăng·sửa. |

---

## ③ Mapping áp dụng phân nhóm mẫu — DEFECT_CODE_PRODUCT_TYPES (toàn bộ cột)

Một mã lỗi có N mapping phân nhóm mẫu áp dụng (hiện tại màn hình lưu 1 bản ghi tính từ cấp 2).

| Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|
| `COMPANY`, `PLANT_CD`, `DEFECT_CODE`, `PRODUCT_TYPE` | PK phức hợp. `PRODUCT_TYPE` là DETAIL_CODE của mã chung `DEFECT_MODEL_GROUP` (`LV`=Low Voltage, `HV`=High Voltage). |
| `CREATED_BY`, `CREATED_AT` | Người/giờ đăng. |

Logic lưu (`replaceProductTypes`): Xóa toàn bộ mapping cũ của mã lỗi đó rồi INSERT lại (thay thế toàn bộ). Màn hình tính 1 phân nhóm mẫu từ mã cấp 2.

---

## Giá trị mã (Lựa chọn·Mã chung)

| Phân loại | Giá trị | Ý nghĩa |
|------|------|------|
| Cấp `DEFECT_GRADE` | CRITICAL / MAJOR / MINOR | Nghiêm trọng / Chính / Phụ |
| Phạm vi áp dụng `DEFECT_SCOPE` | COMMON / RAW_MATERIAL / PRODUCT / PROCESS | Chung / Nguyên liệu / Sản phẩm / Quy trình |
| Phân nhóm mẫu `DEFECT_MODEL_GROUP` (mã chung) | LV / HV | Low Voltage / High Voltage |
| Giai đoạn kiểm tra (cấp 1 phân loại) | IQC / LQC / OQC | Kiểm tra nhập / Kiểm tra quy trình / Kiểm tra xuất |
| Loại lỗi (cấp 3 phân loại) | FUNCTION / APPEARANCE / ETC | Chức năng / Ngoại quan / Khác |

> Cấp·Phạm vi áp dụng được cố định bằng enum màn hình (server DTO `IsIn`). Chỉ phân nhóm mẫu có thể mở rộng qua mã chung (`DEFECT_MODEL_GROUP`).

## Thiết lập trước (Master·Mã chung)
- Đăng ký mã chung `DEFECT_MODEL_GROUP` (LV/HV) — cơ sở phân loại cấp 2·mapping phân nhóm mẫu.
- Cây phân loại: Cấu hình trước: cấp 1 (IQC/LQC/OQC) → cấp 2 (`{stage}_LV`/`{stage}_HV`) → cấp 3 (`{cấp2}_FUNCTION`/`_APPEARANCE`/`_ETC`).
- Mã chung `USE_YN` (select sử dụng trên màn hình).

## Quy trình vận hành
1. Kiểm tra·đăng ký mã chung `DEFECT_MODEL_GROUP` (LV/HV).
2. Xây dựng cây phân loại cấp 1→2→3 bằng thêm nhanh (cấp phải tăng dần từng bậc để lưu được).
3. Đăng ký mã lỗi: Chọn cấp 1·2·3 + nhập mã lỗi·tên lỗi·cấp·phạm vi áp dụng. Giá trị chọn cấp 2 được lưu làm mapping phân nhóm mẫu.
4. Kiểm tra mã hiển thị trong [Quản lý lỗi]·Kiểm tra·Kiosk sản xuất.
5. Mã bỏ chuyển sang ngừng sử dụng (`USE_YN='N'`) (không xóa).

## Phân quyền
Quản trị viên chất lượng (đăng ký/sửa/ngừng sử dụng phân loại·mã). Người dùng thông thường chỉ tra cứu·chọn trong kiểm tra và sản xuất.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Khi lưu "Vui lòng chọn phân loại cấp 3" | Chưa chọn đủ cấp 1·2·3 | Chọn theo thứ tự 1→2→3 |
| "Mã lỗi chỉ kết nối được với phân loại cấp 3" | Chỉ định mã cấp 1 hoặc 2 làm phân loại | Chọn phân loại cấp 3 (loại lỗi) |
| "Chỉ kết nối được phân loại lỗi đang sử dụng" | Phân loại cấp 3 đó `USE_YN='N'` | Kích hoạt phân loại thành `Y` |
| Không thấy lựa chọn cấp 2 | Chưa chọn cấp 1 hoặc không có cấp 2 bên dưới/bị bất hoạt | Chọn cấp 1 trước, đăng ký·kích hoạt phân loại cấp 2 |
| Mã lỗi không hiển thị trong kiểm tra/sản xuất | Mã `USE_YN='N'` hoặc phạm vi áp dụng·mẫu không khớp | Kích hoạt mã, kiểm tra `DEFECT_SCOPE`·phân nhóm mẫu |
| "Mã lỗi đã tồn tại" | Đăng ký trùng mã | Dùng mã khác (mã duy nhất trong tenant) |
| Mapping phân nhóm mẫu trống | Cấp 2 không theo quy tắc `{stage}_{model}` | Sửa mã cấp 2 theo định dạng `IQC_LV` |

## Dữ liệu & Liên kết
- Bảng: `DEFECT_CATEGORY_MASTERS` (cây phân loại), `DEFECT_CODE_MASTERS` (mã), `DEFECT_CODE_PRODUCT_TYPES` (mapping phân nhóm mẫu).
- API: `GET/POST /quality/defect-codes/categories`, `PUT .../categories/:categoryCode`, `GET /quality/defect-codes`, `GET /quality/defect-codes/options`, `POST /quality/defect-codes`, `PUT/DELETE /quality/defect-codes/:defectCode`.
- Liên kết: Lịch sử lỗi (`DEFECT_LOGS.DEFECT_CODE`), Quản lý lỗi (`/quality/defect`), Kiểm tra tích hợp (`/inspection/integrated`), Nhập lỗi Kiosk sản xuất.
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'` (bao gồm trong PK của tất cả bảng).
