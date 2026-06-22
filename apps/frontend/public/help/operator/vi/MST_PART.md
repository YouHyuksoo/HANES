---
menuCode: MST_PART
audience: operator
title: Master hạng mục — Hướng dẫn vận hành
summary: DB mapping toàn bộ cột master hạng mục, đồng bộ ERP (IF_ITEM_MASTER), liên kết IQC/AQL, phân quyền, xử lý sự cố
tags: [thông tin cơ sở, hạng mục, master, vận hành, ERP]
keywords: [ITEM_MASTERS, IF_ITEM_MASTER, ERP-IF, IQC_AQL_POLICY_CODE, PRODUCT_TYPE, IQC_INSPECT_METHOD, UNIT_TYPE, loại hạng mục, đồng bộ, đa khách hàng]
related: [QC_AQL]
---

# Master hạng mục — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình quản lý **bảng master `ITEM_MASTERS`** chứa thông tin cơ sở của mọi hạng mục. BOM·kết quả sản xuất·nhập xuất vật tư·kiểm tra nhập (IQC)·tồn kho đều tham chiếu master này qua `ITEM_CODE`.

## Cấu trúc dữ liệu
```
ITEM_MASTERS (PK: COMPANY, PLANT_CD, ITEM_CODE)
   ├─ IQC_AQL_POLICY_CODE ──▶ IQC_AQL_POLICIES (Chính sách AQL kiểm tra nhập)
   └─ Tham chiếu: BOM / Sản xuất / Nhập xuất vật tư / Tồn kho / Nhãn
```

## Toàn bộ cột — ITEM_MASTERS

| Mục màn hình | Cột DB | Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã hạng mục | `ITEM_CODE` | Thành phần PK. Khuyến nghị bất biến (toàn vẹn kết nối). |
| Mã hàng | `PART_NO` | Bản vẽ/ERP/mã hàng khách hàng. |
| Tên hạng mục | `ITEM_NAME` | Tên hiển thị. |
| Mã hàng khách hàng | `CUST_PART_NO` | Mã hàng khách hàng (xuất hàng/khớp nhãn). |
| Rev | `REV` | Phiên bản bản vẽ/quy cách. |
| Nội dung đánh dấu | `MARKING_TEXT` | Nội dung chuyển đến thiết bị đánh dấu·nhãn. |
| Loại hạng mục | `ITEM_TYPE` | RAW_MATERIAL/SEMI_PRODUCT/FINISHED/CONSUMABLE. Rẽ nhánh xử lý vật tư·sản xuất. |
| Nhóm hạng mục | `PRODUCT_TYPE` | Mã chung PRODUCT_TYPE. |
| Loại xe/Mô hình | `MODEL_NAME` | Đặc tính quản lý. |
| Quy cách | `SPEC` | Quy cách/kích thước. |
| Màu sắc | `COLOR` | Màu dây v.v. |
| Đơn vị | `UNIT` | Mã chung UNIT_TYPE. Đơn vị tiêu chuẩn tồn kho·cấp phát. |
| IQC | `IQC_FLAG` | Y=đối tượng kiểm tra nhập. |
| Phương pháp kiểm tra | `INSPECT_METHOD` | Mã chung IQC_INSPECT_METHOD. |
| Số lượng mẫu cơ bản | `SAMPLE_QTY` | Số lượng mẫu IQC cơ bản (riêng với số mẫu AQL). |
| Chính sách AQL | `IQC_AQL_POLICY_CODE` | Tham chiếu `IQC_AQL_POLICIES.POLICY_CODE`. Tiêu chuẩn đánh giá LOT nhập. |
| Số lượng hộp | `BOX_QTY` | Tiêu chuẩn đóng hộp. |
| Số lượng đóng gói tối thiểu | `MIN_PACK_QTY` | Đơn vị cấp phát tối thiểu. |
| Đơn vị cấu thành LOT | `LOT_UNIT_QTY` | Đơn vị gom sản phẩm công đoạn. |
| Đơn vị cấu thành Pallet | `PACK_UNIT` | Đơn vị đóng gói cấp trên. |
| Tồn kho an toàn | `SAFETY_STOCK` | Tiêu chuẩn đánh giá thiếu. |
| Thời hạn | `EXPIRY_DATE` | Số ngày hiệu lực. |
| Gia hạn thời hạn | `EXPIRY_EXT_DAYS` | Số ngày tối đa có thể gia hạn. |
| Vị trí lưu trữ | `STORAGE_LOCATION` | Vị trí lưu mặc định. |
| Hình ảnh | `IMAGE_URL` | Đường dẫn file upload (`/uploads/parts/...`). |
| Sử dụng | `USE_YN` | Chỉ Y hoạt động. |
| Ghi chú | `REMARK` | Ghi nhớ. |
| Kiểm toán | `CREATED_BY`, `CREATED_AT`, `UPDATED_AT` | Lịch sử tạo/sửa. Đồng bộ ERP có `CREATED_BY='ERP-IF'`. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000`. |

## Đồng bộ ERP (IF_ITEM_MASTER)
- Nút **Đồng bộ ERP** trên cùng → `POST /interface/inbound/item-master` → chạy Oracle procedure **`IF_ITEM_MASTER`** (sau modal xác nhận).
- Hoạt động: **MERGE** `MTL_SYSTEM_ITEMS` của ERP vào `ITEM_MASTERS`. Mới thì INSERT(`CREATED_BY='ERP-IF'`), cũ thì UPDATE với giá trị ERP mới nhất.
- Kết quả: Trả về số lượng `{ insert, update }`.
- **Khôi phục thao tác sai**: Hạng mục mới do ERP thêm nhầm có thể nhận diện bằng `CREATED_BY='ERP-IF'` + batch `CREATED_AT` và xóa (kiểm tra tham chiếu con PROD_PLANS trước khi xóa). Có thể lên đến vài chục nghìn bản ghi một lần, nhớ kiểm tra kỹ modal xác nhận trước khi thực hiện.

## Liên kết IQC / AQL
- Chỉ hạng mục `IQC_FLAG='Y'` mới là đối tượng kiểm tra nhập khi nhập kho.
- `IQC_AQL_POLICY_CODE` tham chiếu `IQC_AQL_POLICIES` → tự động tính số mẫu·Ac·Re trong kiểm tra LOT nhập. Nếu chưa đặt thì không áp dụng tự động đánh giá.

## Thiết lập trước (Master·Mã chung)
- Mã chung: `PRODUCT_TYPE`, `IQC_INSPECT_METHOD`, `UNIT_TYPE`, `USE_YN`
- Chính sách AQL ([Quản lý tiêu chuẩn AQL]) phải có trước mới kết nối được vào hạng mục.

## Phân quyền
Quản trị viên thông tin cơ sở (đăng ký/sửa/đồng bộ ERP). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Đồng bộ ERP thêm nhầm hàng loạt hạng mục | Chạy đồng bộ ERP nhầm | Nhận diện batch `CREATED_BY='ERP-IF'` rồi xóa (kiểm tra tham chiếu con) |
| Ảnh trong danh sách bị hỏng | File đường dẫn `IMAGE_URL` không tồn tại (404) | Tải lại ảnh hoặc dọn đường dẫn (frontend có placeholder fallback) |
| Kiểm tra nhập không tự động đánh giá AQL | Chưa đặt `IQC_AQL_POLICY_CODE` | Kết nối chính sách AQL vào hạng mục |
| Hạng mục không hiện trong danh sách chọn | `USE_YN='N'` | Kích hoạt USE_YN thành Y |
| Lỗi trùng mã khi lưu | Đã tồn tại `ITEM_CODE` giống | Kiểm tra mã (khóa bất biến) |

## Dữ liệu & Liên kết
- Bảng: `ITEM_MASTERS`
- Liên kết: BOM, Kết quả sản xuất, Nhập xuất vật tư, Tồn kho, Nhãn, Kiểm tra nhập (IQC)·AQL(`IQC_AQL_POLICIES`)
- Bên ngoài: ERP `MTL_SYSTEM_ITEMS`(IF_ITEM_MASTER MERGE)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
