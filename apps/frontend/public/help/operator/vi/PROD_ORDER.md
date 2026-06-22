---
menuCode: PROD_ORDER
audience: operator
title: Quản lý lệnh sản xuất — Hướng dẫn vận hành
summary: Toàn bộ cột·DB mapping lệnh sản xuất (JOB_ORDERS), logic chuyển trạng thái, quy tắc đánh số, tự động khai triển BOM, đa khách hàng và xử lý sự cố
tags: [sản xuất, lệnh sản xuất, vận hành, chuyển trạng thái, BOM, đánh số]
keywords: [JOB_ORDERS, lệnh sản xuất, WO, ORDER_NO, chuyển trạng thái, WAITING, RUNNING, HOLD, DONE, CANCELED, đánh số, nextJobOrderNo, khai triển BOM, PARENT_ID, ROOT_ORDER_NO, ROUTING_CODE, PROD_RESULTS, đa khách hàng, xử lý sự cố]
related: [PROD_RESULT, MST_PART]
---

# Quản lý lệnh sản xuất — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình phát hành·quản lý lệnh sản xuất cho thành phẩm·bán thành phẩm, là **điểm xuất phát của kết quả sản xuất·kiểm tra·xuất hàng·tồn kho**. 1 lệnh sản xuất có khóa tự nhiên `ORDER_NO` làm PK, tham chiếu hạng mục (`ITEM_CODE`)·routing (`ROUTING_CODE`), và tạo hệ thống phân cấp thành phẩm-bán thành phẩm qua tự tham chiếu (`PARENT_ID`). Trạng thái chỉ chuyển qua API chuyên dụng (bắt đầu/tạm giữ/bỏ tạm giữ/hoàn tất/hủy), không thể thay đổi trực tiếp.

> API base: `/production/job-orders`. Mã menu `PROD_ORDER`, đường dẫn `/production/order`.

## Cấu trúc dữ liệu
```
ITEM_MASTERS(hạng mục) ──ITEM_CODE──▶ JOB_ORDERS ◀──PARENT_ID── (lệnh sản xuất con bán thành phẩm)
        │                            │  │
        │                            │  └──ROOT_ORDER_NO── Nhóm tạo đồng thời cấp cao nhất
ROUTING_GROUPS ──ROUTING_CODE────────┘  │
PROD_PLANS ──PLAN_NO────────────────────┤
                                        │
                            PROD_RESULTS(kết quả) ◀──ORDER_NO── (tổng hợp kết quả: GOOD_QTY/DEFECT_QTY)
                            FG_LABELS(mã vạch thành phẩm) ◀──ORDER_NO── (PRE_ISSUE phát hành trước)
```
- Khai triển BOM: Từ `BOM_MASTERS`(parentItemCode → childItemCode) chọn `SEMI_PRODUCT` để tạo đệ quy lệnh sản xuất con.
- Tổng hợp kết quả: Khi liệt kê·hoàn tất, tổng hợp số lượng tốt/phế từ `PROD_RESULTS` (loại CANCELED) vào `GOOD_QTY`/`DEFECT_QTY`.

> Lưu ý (không khớp code): Xem trước `sqlQuery` bên phải lưới màn hình ghi `PROD_ORDERS`, nhưng **tên entity/table thực tế là `JOB_ORDERS`** (entity `@Entity({ name: 'JOB_ORDERS' })`). Tiêu chuẩn vận hành là `JOB_ORDERS`.

---

## ① Lệnh sản xuất — JOB_ORDERS (toàn bộ cột)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số lệnh sản xuất | `ORDER_NO` | PK (khóa tự nhiên, varchar2 50). Nếu không nhập, server tự đánh số. Không thể thay đổi. |
| Lệnh sản xuất cấp trên | `PARENT_ID` | `ORDER_NO` của lệnh sản xuất cha (self FK). Lệnh con bán thành phẩm có ORDER_NO thành phẩm. Cấp cao nhất là NULL. |
| Root tạo đồng thời | `ROOT_ORDER_NO` | ORDER_NO cao nhất của nhóm tự động khai triển BOM. Bản thân cấp cao nhất là NULL. |
| Số kế hoạch sản xuất | `PLAN_NO` | `PROD_PLANS.PLAN_NO` đã kết nối (tùy chọn). Khi hủy, trừ `ORDER_QTY` của kế hoạch đó. |
| Mã hạng mục | `ITEM_CODE` | Tham chiếu `PART_MASTERS.ITEM_CODE` (bắt buộc). Kiểm tra tồn tại hạng mục·khớp tenant khi tạo. |
| Dây chuyền | `LINE_CODE` | Dây chuyền sản xuất (tùy chọn). |
| Mã routing | `ROUTING_CODE` | Tự động tra theo hạng mục (`ROUTING_GROUPS`, useYn='Y'). Không nhập trực tiếp. |
| Công đoạn | `PROCESS_CODE` | Công đoạn đại diện. Nếu không chỉ định, tự động kế thừa từ SEQ đầu routing. Đổi công đoạn thì reset thiết bị. |
| Thiết bị | `EQUIP_CODE` | Thiết bị sản xuất (tùy chọn). Khi tạo thường NULL, phân bổ sau. |
| Số lượng kế hoạch | `PLAN_QTY` | int. Bắt buộc, từ 1 trở lên. Con (bán thành phẩm) là `ceil(số lượng cha × định mức BOM)`. |
| Số lượng tốt | `GOOD_QTY` | int (mặc định 0). Giá trị tổng hợp kết quả (tổng PROD_RESULTS). Cập nhật xác nhận khi hoàn tất. |
| Số lượng phế phẩm | `DEFECT_QTY` | int (mặc định 0). Giá trị tổng hợp kết quả. |
| Ngày kế hoạch | `PLAN_DATE` | date (nullable). Bộ lọc mặc định tra danh sách. NULL luôn hiển thị không phụ thuộc bộ lọc phạm vi. |
| Thời gian bắt đầu | `START_TIME` | timestamp. Ghi lần đầu khi start. |
| Thời gian kết thúc | `END_TIME` | timestamp. Ghi khi complete/cancel. |
| Ưu tiên | `PRIORITY` | int (mặc định 5). 1(cao nhất)~10(thấp nhất). Danh sách sắp xếp PRIORITY ASC, PLAN_DATE ASC, CREATED_AT DESC. |
| Trạng thái | `STATUS` | varchar2 20 (mặc định WAITING). Mã chung `JOB_ORDER_STATUS`. Giá trị: WAITING/RUNNING/HOLD/DONE/CANCELED. |
| Số PO khách hàng | `CUST_PO_NO` | PO khách hàng đối ứng (tùy chọn). |
| Ghi chú | `REMARK` | varchar2 500. Khi HOLD, chèn prefix `[HOLD] Trạng thái trước:{state}` để bảo toàn trạng thái phục hồi. |
| Đồng bộ ERP | `ERP_SYNC_YN` | 'Y'/'N'(mặc định N). Trong các lệnh DONE, 'N' hiển thị là danh sách chưa đồng bộ ERP. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi công ty/cơ sở. Giá trị chuẩn `COMPANY='40'`, `PLANT_CD='1000'`. Kiểm tra khớp tenant với hạng mục·routing. |
| Người đăng/sửa | `CREATED_BY`, `UPDATED_BY` | Cột kiểm toán. |
| Thời gian đăng/sửa | `CREATED_AT`, `UPDATED_AT` | timestamp (DEFAULT SYSTIMESTAMP). |

> `REMARK` của lệnh sản xuất con (bán thành phẩm tự động tạo) được ghi là `[Tự động tạo] Bán thành phẩm của {ORDER_NO cha}`.

---

## Quy tắc đánh số
- Đánh số: `nextJobOrderNo()` → kênh `JOB_ORDER` (dựa trên Oracle SEQUENCE, chia sẻ `QueryRunner` trong giao dịch).
- Định dạng: `W + YYMMDD + - + 3 số sequence ngày`. VD: `W260519-001`. Reset hàng ngày 0 giờ (DBMS_SCHEDULER).
- Quy ước code chi tiết (theo bộ phận): `Mã đầy đủ-Số bộ phận`(VD: `W260519-001-HNS-A-R1`). Serial thay `W→S` ở đầu.
- Nguồn duy nhất: `docs/standards/numbering-rules.md`.

## Logic chuyển trạng thái
Chỉ chuyển qua API chuyên dụng. `PUT /:id/status` (thay đổi trực tiếp) luôn bị từ chối (chống bypass chuyển trạng thái).

| Chuyển | API | Trạng thái cho phép | Xử lý |
|------|------|------|------|
| Bắt đầu | `POST /:id/start` | WAITING → RUNNING | Ghi START_TIME lần đầu. Nếu `FG_BARCODE_ISSUE_TIMING=PRE_ISSUE` thì phát hành FG_LABELS với số lượng kế hoạch. |
| Tạm giữ | `POST /:id/hold` | WAITING/RUNNING → HOLD | Chèn `[HOLD] Trạng thái trước:{state}` vào REMARK (để phục hồi). Chặn đăng ký kết quả·xuất hàng. |
| Bỏ tạm giữ | `POST /:id/hold-release` | HOLD → trạng thái trước | Parse trạng thái trước từ REMARK để phục hồi, xóa prefix. |
| Hoàn tất | `POST /:id/complete` | RUNNING → DONE | Xác nhận GOOD_QTY/DEFECT_QTY bằng tổng PROD_RESULTS, ghi END_TIME (giao dịch). Kết thúc không phụ thuộc số lượng còn lại. |
| Hủy | `POST /:id/cancel` | WAITING/HOLD → CANCELED | Từ chối nếu có dù chỉ 1 kết quả. Nếu kết nối PLAN_NO thì trừ ORDER_QTY kế hoạch, ghi END_TIME. |

- **Sửa(PUT)**: DONE/CANCELED không thể sửa. Cũng từ chối sửa trực tiếp trường `status`. Đổi itemCode thì tra lại ROUTING_CODE.
- **Xóa(DELETE)**: RUNNING không thể xóa (các trạng thái còn lại hard delete).

## Logic tự động khai triển BOM (khi tạo)
1. Nếu `autoCreateChildren !== false` (mặc định ON), sau khi lưu cha, bắt đầu khai triển đệ quy.
2. Tra `BOM_MASTERS`(parentItemCode=hạng mục hiện tại, useYn='Y') → hạng mục con.
3. Trong con, chỉ tạo lệnh sản xuất cho mục có `PART_MASTERS.ITEM_TYPE='SEMI_PRODUCT'`.
4. PLAN_QTY con = `ceil(PLAN_QTY cha × BOM.QTY_PER)`. PARENT_ID=cha, ROOT_ORDER_NO=cấp cao nhất.
5. Đệ quy lại 2~4 với con. Chặn vòng lặp vô hạn bằng theo dõi đường dẫn tổ tiên·backstop độ sâu 50.

## Thiết lập trước (Master·Mã chung)
- Mã chung: `JOB_ORDER_STATUS`(badge trạng thái/bộ lọc), `JOB_ORDER_TYPE`(loại: NORMAL/REWORK/SAMPLE/TRIAL).
- Master tiên quyết: Master hạng mục (`PART_MASTERS`), Routing (`ROUTING_GROUPS`/`ROUTING_PROCESS`), BOM (`BOM_MASTERS`), Thiết bị·Dây chuyền.
- Cài đặt hệ thống: `FG_BARCODE_ISSUE_TIMING`(`ON_INSPECT` mặc định / `PRE_ISSUE` thì phát hành mã vạch hàng loạt khi bắt đầu·phát hành trước).

## Quy trình vận hành
1. Đăng ký hạng mục·Routing·BOM trước (không có routing thì không tự động kế thừa công đoạn/thiết bị).
2. Tạo lệnh sản xuất (bắt buộc: hạng mục·số lượng kế hoạch·ngày kế hoạch). Thành phẩm tự động tạo bán thành phẩm đồng thời qua khai triển BOM.
3. Tiến hành theo thứ tự Bắt đầu → (đăng ký kết quả sản xuất) → Hoàn tất. Tạm giữ/bỏ tạm giữ khi cần.
4. Lệnh hoàn tất kiểm tra tại danh sách chưa đồng bộ ERP (`GET /erp/unsynced`) rồi xử lý đồng bộ (`POST /erp/mark-synced`).

## Phân quyền
Quản trị viên sản xuất (tạo/sửa/xóa·chuyển trạng thái). Người dùng thông thường chỉ tra cứu. (Chỉ tra cứu/thao tác trong phạm vi đa khách hàng)

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Nút bắt đầu bị vô hiệu | Trạng thái không phải WAITING | Chỉ WAITING mới bắt đầu được. Tạm giữ thì bỏ tạm giữ rồi bắt đầu. |
| Không hoàn tất được(400) | Trạng thái không phải RUNNING | Bắt đầu (RUNNING) rồi mới hoàn tất. |
| Từ chối hủy(400) | Có kết quả sản xuất | Xóa kết quả rồi hủy, hoặc kết thúc bằng hoàn tất. |
| Từ chối sửa(400) | DONE/CANCELED hoặc cố gắng sửa trực tiếp status | Không thể sửa lệnh đã hoàn tất/hủy. Trạng thái chỉ qua API chuyên dụng. |
| Từ chối xóa(400) | RUNNING | Đang tiến hành không thể xóa (xử lý sau khi hoàn tất/hủy). |
| Routing/công đoạn không tự động vào | Routing hạng mục chưa đăng ký (không có useYn='Y') | Đăng ký nhóm routing hoặc chỉ định trực tiếp công đoạn. |
| Danh sách thiết bị trống | Không có thiết bị mapping với công đoạn đã chọn | Đăng ký thiết bị công đoạn đó trong master thiết bị. |
| Lệnh sản xuất bán thành phẩm không được tạo | BOM con không phải SEMI_PRODUCT/BOM chưa đăng ký/bỏ check | Kiểm tra BOM·loại hạng mục, bật check tự động tạo. |
| Số trùng(409) | Đã tồn tại ORDER_NO giống | Dùng đánh số tự động (tránh nhập trực tiếp). |
| Không thấy trong danh sách | Ngoài phạm vi bộ lọc ngày kế hoạch | Mở rộng bộ lọc (ngày kế hoạch NULL luôn hiển thị). |

## Dữ liệu & Liên kết
- Bảng: `JOB_ORDERS`(+ tự tham chiếu PARENT_ID/ROOT_ORDER_NO)
- Tham chiếu: `PART_MASTERS`(ITEM_CODE), `ROUTING_GROUPS`/`ROUTING_PROCESS`(ROUTING_CODE), `BOM_MASTERS`(khai triển), `PROD_PLANS`(PLAN_NO)
- Liên kết: `PROD_RESULTS`(tổng hợp kết quả → GOOD_QTY/DEFECT_QTY), `FG_LABELS`(PRE_ISSUE phát hành trước), Xuất hàng/kiểm tra (chặn khi HOLD), Đồng bộ ERP
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
