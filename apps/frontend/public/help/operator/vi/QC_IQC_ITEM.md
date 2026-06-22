---
menuCode: QC_IQC_ITEM
audience: operator
title: Master hạng mục kiểm tra — Hướng dẫn vận hành
summary: Hướng dẫn vận hành màn hình quản lý pool hạng mục kiểm tra IQC toàn cục (IQC_ITEM_POOL). Mapping mục màn hình↔cột DB, giá trị phương pháp đánh giá, màn hình liên kết.
tags: [chất lượng, IQC, kiểm tra nhập, hạng mục kiểm tra, thông tin cơ sở, hướng dẫn vận hành]
keywords: [IQC_ITEM_POOL, pool hạng mục kiểm tra, INSP_ITEM_CODE, INSP_ITEM_NAME, JUDGE_METHOD, LSL, USL, CRITERIA, USE_YN, phương pháp đánh giá, trực quan, đo lường, đơn vị, UNIT_TYPE, đa khách hàng]
related: [QC_IQC_PART_SPEC, QC_IQC, QC_AQL]
---

# Master hạng mục kiểm tra — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
**Pool hạng mục kiểm tra chung** của hệ thống kiểm tra nhập (IQC). Các hạng mục đăng ký tại màn hình này được [Quản lý hạng mục IQC theo hạng mục](/master/iqc-part-spec) tham chiếu để cấu hình hạng mục nào sẽ kiểm tra với tiêu chuẩn nào cho từng hạng mục. Nghĩa là trách nhiệm được phân tách thành **định nghĩa hạng mục (ở đây) ↔ áp dụng·tiêu chuẩn theo hạng mục (Quản lý hạng mục IQC theo hạng mục)**.

## Cấu trúc dữ liệu
```
IQC_ITEM_POOL (Pool hạng mục kiểm tra · Màn hình này)
   └─ Tham chiếu bằng INSP_ITEM_CODE ─▶ IQC_PART_SPEC_ITEMS (Chi tiết hạng mục kiểm tra theo hạng mục)
                                      └─ IQC_PART_SPECS (Header tiêu chuẩn IQC theo hạng mục)
```
- API màn hình này: `GET/POST/PUT/DELETE /master/iqc-item-pool`
- Khóa: `INSP_ITEM_CODE` (+ đa khách hàng `COMPANY`/`PLANT_CD`)

## ① Hạng mục kiểm tra — IQC_ITEM_POOL (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|---|---|---|
| **Mã hạng mục** | `INSP_ITEM_CODE` | Khóa định danh hạng mục kiểm tra (NOT NULL). Chỉ nhập khi tạo mới, khóa khi sửa. Thận trọng khi xóa vì chi tiết theo hạng mục tham chiếu bằng mã này. |
| **Hạng mục kiểm tra** | `INSP_ITEM_NAME` | Tên hạng mục kiểm tra (NOT NULL). |
| **Phương pháp đánh giá** | `JUDGE_METHOD` | NOT NULL. Giá trị chọn trên màn hình **VISUAL=trực quan / MEASURE=đo lường**. (Chú thích cột DB còn ghi NUMERIC/VISUAL/GONOGG nhưng giá trị màn hình này dùng là VISUAL·MEASURE.) |
| **Đơn vị** | `UNIT` | Đơn vị đo (cho phép NULL). Chọn từ mã chung `UNIT_TYPE`. Dùng cho hạng mục đo lường. |
| (Không sửa trên màn hình) | `CRITERIA` | Văn bản tiêu chuẩn đánh giá. Không nhập trên màn hình này — tiêu chuẩn theo hạng mục được quản lý tại IQC_PART_SPEC_ITEMS. |
| (Không sửa trên màn hình) | `LSL` / `USL` | Giá trị tiêu chuẩn cận dưới/trên (NUMBER). Không sửa trên màn hình này (tiêu chuẩn theo hạng mục tại Quản lý hạng mục IQC theo hạng mục). |
| (Không sửa trên màn hình) | `REVISION` | Số phiên bản (NOT NULL). |
| (Không sửa trên màn hình) | `EFFECTIVE_DATE` | Ngày hiệu lực. |
| (Không sửa trên màn hình) | `USE_YN` | Sử dụng (NOT NULL, mặc định Y). Màn hình này quản lý bằng xóa thay vì toggle UI. |
| (Không sửa trên màn hình) | `REMARK` | Ghi chú. |
| Phạm vi | `COMPANY` / `PLANT_CD` | Phạm vi đa khách hàng (NOT NULL). Mặc định `40` / `1000`. |
| Kiểm toán | `CREATED_BY` `UPDATED_BY` `CREATED_AT` `UPDATED_AT` | Theo dõi đăng/sửa. CREATED_AT/UPDATED_AT là NOT NULL (mặc định SYSTIMESTAMP). |

> Form màn hình này chỉ trực tiếp sửa 4 trường `INSP_ITEM_CODE / INSP_ITEM_NAME / JUDGE_METHOD / UNIT`. Các trường còn lại (CRITERIA·LSL·USL·USE_YN v.v.) được tạo với giá trị mặc định, tiêu chuẩn theo hạng mục được đặt tại Quản lý hạng mục IQC theo hạng mục.

## Giá trị phương pháp đánh giá (JUDGE_METHOD)
| Giá trị | Nhãn màn hình | Ý nghĩa |
|---|---|---|
| `VISUAL` | Trực quan | Đánh giá đạt/không đạt bằng mắt (ngoại quan v.v.). Không cần đơn vị. |
| `MEASURE` | Đo lường | So sánh giá trị thiết bị đo với tiêu chuẩn (LSL/USL). Khuyến nghị có đơn vị. |

## Thiết lập trước (Master·Mã chung)
- Mã chung `UNIT_TYPE` — nguồn dropdown đơn vị. Nếu chưa có đơn vị cần (mm, g, kg v.v.), thêm trước trong [Quản lý mã chung].

## Quy trình vận hành
1. `Thêm hạng mục kiểm tra` → nhập mã hạng mục·tên hạng mục·phương pháp đánh giá (·đơn vị) → lưu (`POST /master/iqc-item-pool`).
2. Sửa bằng ✎ trên dòng → sửa các trường ngoại trừ mã (`PUT /master/iqc-item-pool/{code}`).
3. Xóa bằng 🗑 → xác nhận (`DELETE /master/iqc-item-pool/{code}`). **Kiểm tra tác động trước khi xóa nếu đang được sử dụng trong chi tiết theo hạng mục.**

## Phân quyền
- Người có quyền đăng ký master thông tin cơ sở (quản trị viên chất lượng/thông tin cơ sở) quản lý.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Dropdown đơn vị trống | Mã chung `UNIT_TYPE` chưa đăng ký | Thêm mã đơn vị trong Quản lý mã chung |
| Nút lưu bị vô hiệu | Chưa nhập mã hạng mục hoặc tên hạng mục | Nhập 2 trường bắt buộc |
| Không sửa được mã hạng mục | Mã là khóa (khóa sửa) | Xóa rồi đăng ký lại (cũng thiết lập lại kết nối) |
| Hạng mục biến mất sau khi xóa trong kiểm tra hạng mục | Chi tiết theo hạng mục đang tham chiếu mã đó | Kiểm tra nơi sử dụng trong Quản lý hạng mục IQC theo hạng mục trước khi xóa |

## Dữ liệu & Liên kết
- Bảng: `IQC_ITEM_POOL`
- Màn hình liên kết: [Quản lý hạng mục IQC theo hạng mục](/master/iqc-part-spec) (tham chiếu pool này), [Kiểm tra nhập (IQC)](/material/iqc)
- Phạm vi đa khách hàng: `COMPANY='40'`, `PLANT_CD='1000'`
