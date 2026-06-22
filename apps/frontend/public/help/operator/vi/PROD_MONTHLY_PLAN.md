---
menuCode: PROD_MONTHLY_PLAN
audience: operator
title: Kế hoạch sản xuất sản phẩm — Hướng dẫn vận hành
summary: Toàn bộ cột·DB mapping bảng PROD_PLANS, logic chuyển trạng thái/phát hành lệnh sản xuất, quy trình tự động xếp lịch (MPS)·upload Excel, đánh số·phân quyền·xử lý sự cố·đa khách hàng
tags: [sản xuất, kế hoạch sản xuất, MPS, lệnh sản xuất, vận hành, cài đặt]
keywords: [PROD_PLANS, PLAN_NO, kế hoạch sản xuất sản phẩm, kế hoạch sản xuất tháng, MPS, đánh số, PP-YYYYMM-NNN, ORDER_QTY, PLAN_QTY, tỷ lệ phát hành, phát hành lệnh sản xuất, issue-job-order, DRAFT, CONFIRMED, CLOSED, xác nhận, hủy xác nhận, kết thúc, tự động xếp lịch, auto-generate, upload Excel, bulk, autoCreateChildren, khai triển BOM, COMPANY, PLANT_CD, xử lý sự cố]
related: [MST_PART, PROD_JOB_ORDER]
---

# Kế hoạch sản xuất sản phẩm — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình ranh giới master-giao dịch quản lý **kế hoạch sản xuất tháng (YYYY-MM)** của thành phẩm·bán thành phẩm. Sau khi **xác nhận (CONFIRMED)** kế hoạch (`PROD_PLANS`), **phát hành lệnh sản xuất (`JOB_ORDERS`)** để chuyển sang luồng sản xuất thực tế. Khi phát hành, số lượng phát hành (`ORDER_QTY`) của kế hoạch tăng dần tích lũy, tỷ lệ phát hành·số lượng còn lại được tính từ giá trị này. Tự động xếp lịch (MPS) tạo hàng loạt kế hoạch DRAFT dựa trên đơn hàng (`/shipping/customer-orders`).

> Menu/tiêu đề gần đây đã đổi từ "Kế hoạch sản xuất tháng" → "Kế hoạch sản xuất sản phẩm", nhưng route (`/production/monthly-plan`)·API (`/production/prod-plans`)·bảng (`PROD_PLANS`)·namespace i18n (`monthlyPlan.*`) vẫn giữ nguyên.

## Cấu trúc dữ liệu
```
PROD_PLANS (PK: PLAN_NO = PP-YYYYMM-NNN, STATUS: DRAFT→CONFIRMED→CLOSED)
   │ ITEM_CODE (ManyToOne, nullable)
   ▼
PART_MASTERS (tham khảo tên hạng mục·BOM·routing)

Khi phát hành lệnh sản xuất:
PROD_PLANS.ORDER_QTY += issueQty   (tăng nguyên tử trong giao dịch)
   └─▶ JOB_ORDERS (status=WAITING) [+ autoCreateChildren thì tạo đệ quy SEMI_PRODUCT cấp dưới BOM]
```
- API base: `@Controller('production/prod-plans')` → `/api/v1/production/prod-plans`
- Sắp xếp danh sách: `priority ASC, createdAt DESC`. Bộ lọc màn hình cắt `startDate/endDate` thành **tháng (7 ký tự đầu)** để so sánh phạm vi `planMonth`.

---

## ① Kế hoạch sản xuất — PROD_PLANS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số kế hoạch | `PLAN_NO` | PK. Khóa tự nhiên. Dạng `PP-YYYYMM-NNN`. Đánh số bằng MAX+1 của prefix tháng đó (xem logic đánh số dưới). Không thể thay đổi. |
| Tháng kế hoạch | `PLAN_MONTH` | `VARCHAR2(7)`, `YYYY-MM`. Có index. Không có cột ngày (kế hoạch theo tháng). DTO kiểm tra `^\d{4}-\d{2}$`. |
| Mã hạng mục | `ITEM_CODE` | `VARCHAR2(50)`. ManyToOne với `PART_MASTERS.ITEM_CODE`(nullable). Kiểm tra tồn tại hạng mục khi đăng ký (không có thì 404). |
| Loại hạng mục | `ITEM_TYPE` | `VARCHAR2(10)`. Chỉ cho phép `FINISHED`/`SEMI_PRODUCT`(`@IsIn`). |
| Số lượng kế hoạch | `PLAN_QTY` | `int`. Số lượng mục tiêu. `@Min(1)`. Giới hạn trên khi phát hành lệnh sản xuất. |
| Số lượng phát hành | `ORDER_QTY` | `int`, mặc định 0. Lượng phát hành tích lũy. Tăng nguyên tử bằng SQL `ORDER_QTY + :issueQty` khi phát hành (không phải cộng trong app memory). |
| Tỷ lệ phát hành | (Tính toán) | Giá trị tính màn hình `min(round(ORDER_QTY/PLAN_QTY*100),100)`. Không phải cột DB. |
| Khách hàng | `CUSTOMER` | `VARCHAR2(50)`, nullable. Mã khách hàng (CUSTOMER). Dùng tham khảo/đối ứng đơn hàng. |
| Dây chuyền | `LINE_CODE` | `VARCHAR2(255)`, nullable. Dây chuyền sản xuất mặc định. Kế thừa làm giá trị mặc định khi phát hành lệnh sản xuất. |
| Ưu tiên | `PRIORITY` | `int`, mặc định 5. 1~10(`@Min(1)@Max(10)`). Thứ tự sắp xếp danh sách ưu tiên 1 (ASC). |
| Trạng thái | `STATUS` | `VARCHAR2(20)`, mặc định `DRAFT`. Có index. Mã chung `PROD_PLAN_STATUS` hiển thị badge. Chuyển: DRAFT→CONFIRMED→CLOSED, CONFIRMED→DRAFT(hủy). |
| Ghi chú | `REMARK` | `VARCHAR2(500)`, nullable. |
| Công ty | `COMPANY` | `VARCHAR2(50)`. Phạm vi đa khách hàng. Bao gồm trong WHERE mọi truy vấn/sửa. |
| Nhà máy | `PLANT_CD` | `VARCHAR2(50)`(thuộc tính entity `plant`). Phạm vi đa khách hàng. |
| Người đăng/sửa | `CREATED_BY` / `UPDATED_BY` | `VARCHAR2(50)`, nullable. |
| Ngày đăng/sửa | `CREATED_AT` / `UPDATED_AT` | `timestamp`. `@CreateDateColumn`/`@UpdateDateColumn`. |

> Cột lưới màn hình **tên hạng mục(partName)** là `part.itemName`(JOIN PART_MASTERS), **mã hạng mục(partCode)** là `part.itemCode ?? itemCode` — cột dẫn xuất. PROD_PLANS không có cột tên hạng mục.

---

## ② Trường form đăng ký/sửa (PlanFormPanel)

| Mục màn hình | DB/DTO | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Tháng kế hoạch | `planMonth` | Chỉ nhập khi mới, disabled khi sửa (tiêu chuẩn đánh số). |
| Loại hạng mục | `itemType` | Chỉ chọn khi mới, disabled khi sửa. Cũng dùng làm bộ lọc modal tìm hạng mục. |
| Mã hạng mục | `itemCode` | Chỉ chọn PartSearchModal (readOnly). Disabled khi sửa. Bắt buộc. |
| Số lượng kế hoạch | `planQty` | QtyInput. `≤0` thì nút lưu bị vô hiệu. |
| Ưu tiên | `priority` | number, mặc định 5. |
| Khách hàng | `customer` | Select `usePartnerOptions('CUSTOMER')`. Tùy chọn. |
| Dây chuyền | `lineCode` | Select `/master/prod-lines`. Tùy chọn. |
| Ghi chú | `remark` | text. Tùy chọn. |

Rẽ nhánh lưu: mới `POST /production/prod-plans`, sửa `PUT /production/prod-plans/:planNo`. Sửa bị chặn ngoài DRAFT (BadRequest).

---

## ③ Form phát hành lệnh sản xuất (IssueJobOrderModal → issue-job-order)

| Mục màn hình | Trường DTO | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số lượng phát hành | `issueQty` | `@Min(1)`. **Quá số lượng còn lại(planQty−orderQty) thì 400**. Màn hình cũng chặn bằng maxValue. Bắt buộc. |
| Ngày kế hoạch | `planDate` | `@IsDateString`. Mapping vào JobOrder.planDate(`parseDateStart`). Tùy chọn. |
| Dây chuyền | `lineCode` | Nếu không nhập, kế thừa plan.lineCode. |
| Ưu tiên | `priority` | Nếu không nhập, kế thừa plan.priority. |
| Tự động tạo BOM bán thành phẩm | `autoCreateChildren` | `@IsBoolean`. true thì tạo đệ quy lệnh sản xuất SEMI_PRODUCT cấp dưới BOM (logic dưới). |
| Ghi chú | `remark` | Nếu không nhập, `Phát hành từ (planNo)`. |

---

## Chuyển trạng thái / Logic phát hành

### Chuyển trạng thái (service guard)
| Thao tác | API | Trạng thái tiên quyết | Kết quả | Khi vi phạm |
|------|------|------|------|------|
| Xác nhận | `POST :planNo/confirm` | DRAFT | CONFIRMED | 400 (chỉ DRAFT) |
| Hủy xác nhận | `POST :planNo/unconfirm` | CONFIRMED | DRAFT | 400 (chỉ CONFIRMED) |
| Kết thúc | `close()` | CONFIRMED | CLOSED | 400 (chỉ CONFIRMED) |
| Sửa | `PUT :planNo` | DRAFT | Cập nhật | 400 (chỉ DRAFT) |
| Xóa | `DELETE :planNo` | DRAFT | Xóa | 400 (chỉ DRAFT) |
| Xác nhận hàng loạt | `bulkConfirm` | Chỉ lọc DRAFT | CONFIRMED | Ngoài DRAFT thì bỏ qua (count 0) |

> Hiển thị màn hình: Dòng DRAFT → nút xác nhận + icon sửa/xóa bên trái. Dòng CONFIRMED → phát hành lệnh sản xuất (còn lại>0) + hủy xác nhận. CLOSED không có thao tác. **Kết thúc(close) đã được implement trong service nhưng UI lưới hiện tại chưa có nút**(gọi API trực tiếp/đối tượng hiển thị sau này).

### Logic phát hành lệnh sản xuất (`issueJobOrder`, giao dịch)
1. Tra kế hoạch → nếu `STATUS=CONFIRMED` không thì 400.
2. `remainQty = planQty − orderQty`. Nếu `issueQty > remainQty` thì 400.
3. `numbering.nextJobOrderNo()` đánh số lệnh sản xuất.
4. Routing hạng mục (`RoutingGroup.useYn='Y'`) → phân tích công đoạn đầu (`RoutingProcess` seq ASC).
5. Tạo `JOB_ORDERS`(status=`WAITING`, erpSyncYn=`N`, lineCode/priority kế thừa dto→plan).
6. Nếu `autoCreateChildren=true` thì tạo đệ quy khai triển BOM (dưới).
7. `PROD_PLANS.ORDER_QTY += issueQty` tăng nguyên tử bằng SQL update.

### Tạo đệ quy bán thành phẩm BOM (`createChildOrdersFromPlanRecursive`)
- Trong con `BOM_MASTERS`(useYn='Y') của hạng mục cha, chỉ tạo lệnh sản xuất con cho mục có **PART_MASTERS.ITEM_TYPE='SEMI_PRODUCT'**.
- Số lượng con = `ceil(parent.planQty × qtyPer)`. Ghi chuỗi parentOrderNo/rootOrderNo.
- **Bảo vệ tham chiếu vòng**: Theo dõi đường dẫn itemCode tổ tiên, dừng nếu xuất hiện lại (warn). Backstop độ sâu 50.

---

## Đánh số (PLAN_NO)
- Định dạng: `PP-` + `YYYYMM`(bỏ `-` từ planMonth) + `-` + 3 số zero-pad.
- Thuật toán: LIKE prefix đó, `ORDER BY planNo DESC` lấy 1 dòng trên cùng, seq +1.
- Bulk (bulkCreate)·tự động xếp lịch: đánh số tuần tự trong cùng giao dịch.

> Đánh số dùng phương thức **SELECT MAX+1** thay vì Oracle SEQUENCE, có khả năng xung đột PK khi tạo song song cao. Hiện tại giả định người dùng đơn/nhập tuần tự. Nếu nhập đồng thời số lượng lớn thường xuyên, xem xét chuyển sang SEQUENCE.

## Quy trình tự động xếp lịch (MPS)
1. `POST /production/prod-plans/auto-generate/preview` { month, startDate?, endDate?, customerId? } → Trả về ứng viên dựa trên đơn hàng (items: orderNo·dueDate·itemCode·demandQty·planQty), `existingDraftCount`, `warnings`.
2. Chọn mục trên màn hình.
3. `POST /production/prod-plans/auto-generate` { month, selectedItems[] } → Tạo DRAFT cho mục đã chọn. **Xóa DRAFT cũ của tháng đó rồi tái xếp lịch** (modal xác nhận, hiển thị `existingDraftCount`). CONFIRMED/CLOSED được bảo toàn.

## Quy trình upload Excel
1. Tải mẫu (`downloadProdPlanTemplate`).
2. Chọn file → frontend parse xlsx (header mapping Hàn/Việt) → kiểm tra dòng (itemCode bắt buộc, itemType∈{FINISHED,SEMI_PRODUCT}, planQty>0).
3. Chỉ kích hoạt upload khi 0 lỗi → `POST /production/prod-plans/bulk` { planMonth, items[] }. Server kiểm tra hàng loạt hạng mục IN trong giao dịch rồi lưu toàn bộ (nếu 1 hạng mục không tồn tại thì rollback toàn bộ).

## Thiết lập trước (Master·Mã chung)
- Mã chung: `PROD_PLAN_STATUS`(badge trạng thái), `ITEM_TYPE`(bộ lọc).
- Master: `PART_MASTERS`(hạng mục·loại hạng mục), `PROD_LINES`(dây chuyền), `PARTNER_MASTERS`(khách hàng, partnerType='CUSTOMER').
- Tiên quyết phát hành lệnh sản xuất: Hạng mục phải có `ROUTING_GROUPS`(useYn='Y') + `ROUTING_PROCESS` đăng ký. Nếu chưa, routingCode/processCode phát hành với null.
- Khi dùng tự động tạo BOM: `BOM_MASTERS`(useYn='Y', qtyPer) + ITEM_TYPE='SEMI_PRODUCT' của hạng mục con.

## Phân quyền
- Nhân viên kế hoạch sản xuất: đăng ký/sửa/xác nhận/phát hành. Người dùng thông thường: tra cứu.
- Nút giao diện ERP hiện chỉ hiển thị **modal thông báo chưa triển khai**(đang chuẩn bị).

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| "Không tìm thấy hạng mục" khi đăng ký | itemCode không có trong PART_MASTERS phạm vi COMPANY/PLANT | Đăng ký master hạng mục·kiểm tra phạm vi |
| Sửa/xóa bị chặn(400) | Kế hoạch CONFIRMED/CLOSED | Hủy xác nhận để về DRAFT rồi xử lý |
| Nút phát hành lệnh sản xuất bị vô hiệu | Số lượng còn lại 0 hoặc không CONFIRMED | Kiểm tra số lượng còn lại/trạng thái |
| "Số lượng phát hành vượt số lượng còn lại" | issueQty > planQty−orderQty | Đặt số lượng phát hành ≤ số còn lại |
| Lệnh sản xuất phát hành không có công đoạn | Routing hạng mục (useYn='Y')·công đoạn chưa đăng ký | Đăng ký ROUTING_GROUPS/PROCESS rồi phát hành lại |
| Tự động tạo BOM không hoạt động | ITEM_TYPE hạng mục con ≠ SEMI_PRODUCT hoặc BOM useYn='N' | Kiểm tra loại hạng mục·sử dụng BOM |
| Sau tự động xếp lịch, DRAFT biến mất | Tái xếp lịch DRAFT cùng tháng (thiết kế bình thường) | Nếu xác nhận rồi thì bảo toàn khi tự động xếp lịch |
| Nút upload Excel bị vô hiệu | Có dòng lỗi kiểm tra | Sửa dòng lỗi đỏ (itemCode/itemType/planQty) |

## Dữ liệu & Liên kết
- Bảng: `PROD_PLANS`(chính), `PART_MASTERS`(JOIN), `JOB_ORDERS`(kết quả phát hành), `BOM_MASTERS`/`ROUTING_GROUPS`/`ROUTING_PROCESS`(hỗ trợ phát hành).
- Màn hình liên kết: [Master hạng mục](/master/part), [Lệnh sản xuất](/production/job-order). Tự động xếp lịch tham khảo đơn hàng (`/shipping/customer-orders`).
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`. Bao gồm COMPANY·PLANT trong WHERE mọi truy vấn/sửa/xóa.
