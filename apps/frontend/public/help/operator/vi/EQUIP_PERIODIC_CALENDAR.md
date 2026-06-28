---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: operator
title: Lịch Kiểm Tra Định Kỳ — Hướng dẫn vận hành
summary: Toàn bộ trường và ánh xạ DB của lịch kiểm tra định kỳ (PERIODIC), tính toán lịch chu kỳ (cycle), logic kết quả tổng hợp và khóa liên động, liên kết danh mục và xử lý sự cố
tags: [thiết-bị, kiểm-tra-định-kỳ, vận-hành, PERIODIC, bảo-trì-phòng-ngừa]
keywords: [EQUIP_INSPECT_LOGS, EQUIP_INSPECT_ITEM_POOL, EQUIP_INSPECT_ITEM_MASTERS, EQUIP_MASTERS, INSPECT_TYPE, PERIODIC, cycle, isDue, OVERALL_RESULT, INTERLOCK, OVERDUE, DETAILS, khóa-liên-động]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM, EQUIP_PERIODIC]
---

# Lịch Kiểm Tra Định Kỳ — Hướng dẫn vận hành

## Mục Đích & Vai Trò Hệ Thống
Màn hình này vận hành **kiểm tra định kỳ (INSPECT_TYPE='PERIODIC')** của thiết bị theo lịch tháng. Dựa trên **chu kỳ (cycle)** trong ánh xạ hạng mục kiểm tra theo thiết bị (`EQUIP_INSPECT_ITEM_POOL`) và danh mục hạng mục (`EQUIP_INSPECT_ITEM_MASTERS`), tự động tính toán đối tượng kiểm tra theo ngày, và lưu kết quả kiểm tra vào `EQUIP_INSPECT_LOGS`. Tái sử dụng các thành phần giống như lịch kiểm tra hằng ngày (InspectCalendar / DaySchedulePanel / InspectExecuteModal) qua props `inspectType` và `apiBasePath`; **dữ liệu chỉ được phân biệt bằng INSPECT_TYPE** (bảng dùng chung).

## Cấu Trúc Dữ Liệu
```
EQUIP_INSPECT_ITEM_MASTERS (tiêu chuẩn hạng mục: tên hạng mục, tiêu chuẩn, CYCLE, hình ảnh tiêu chuẩn)
        │ (tham chiếu ITEM_CODE)
        ▼
EQUIP_INSPECT_ITEM_POOL (ánh xạ hạng mục theo thiết bị, INSPECT_TYPE='PERIODIC', USE_YN='Y')
        │  + EQUIP_MASTERS (thông tin thiết bị)
        ▼  isDue() dựa trên cycle → tính đối tượng kiểm tra theo ngày
Lịch/Bảng theo ngày ──thực hiện kiểm tra──▶ EQUIP_INSPECT_LOGS (1 bản ghi/thiết bị·ngày, kết quả hạng mục trong DETAILS JSON)
```

---

## ① Kết Quả Kiểm Tra — EQUIP_INSPECT_LOGS (tất cả cột)
1 bản ghi mỗi thiết bị × loại kiểm tra × ngày kiểm tra. Bảng dùng chung cho kiểm tra hằng ngày/định kỳ/công nhân.

| Trường màn hình | Cột DB | Chức năng / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| (khóa) Thiết bị | `EQUIP_CODE` | PK phức hợp1. Thiết bị được kiểm tra. |
| Loại kiểm tra | `INSPECT_TYPE` | PK phức hợp2. Cố định là **`PERIODIC`** trong màn hình này. (DAILY=hằng ngày, WORKER=kiểm tra công nhân) |
| Ngày kiểm tra | `INSPECT_DATE` | PK phức hợp3. Ngày được chọn trên lịch (YYYY-MM-DD). |
| — | `WORK_DATE` | Ngày làm việc (máy chủ tính toán). |
| — | `INSPECT_AT` | Dấu thời gian thực tế khi lưu kiểm tra (TIMESTAMP). |
| — | `OP_WINDOW_START_AT` / `OP_WINDOW_END_AT` | Thời điểm bắt đầu/kết thúc ca làm việc (tính lúc lưu). |
| Người kiểm tra | `INSPECTOR_NAME` | Tên công nhân thực hiện kiểm tra. |
| Kết quả tổng hợp | `OVERALL_RESULT` | `PASS` / `FAIL` / `CONDITIONAL` (không dùng). Tự động tính từ kết quả hạng mục. |
| Kết quả hạng mục | `DETAILS` (CLOB) | JSON kết quả theo hạng mục: `{items:[{itemId,seq,itemName,result,remark}]}`. Lưu PASS/FAIL và lý do. |
| Ghi chú chung | `REMARK` | Ghi chú tổng quát cho lần kiểm tra. |
| — | `ORDER_NO` | Số lệnh sản xuất (dùng cho kiểm tra WORKER; không dùng cho kiểm tra định kỳ). |
| Đa thuê bao | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000`. |
| — | `CREATED_BY/AT`, `UPDATED_BY/AT` | Cột kiểm toán. |

---

## ② Ánh Xạ Hạng Mục Kiểm Tra Theo Thiết Bị — EQUIP_INSPECT_ITEM_POOL
Định nghĩa hạng mục kiểm tra định kỳ nào được gắn với thiết bị nào. Quản lý trong màn hình [Hạng Mục Kiểm Tra Theo Thiết Bị].

| Trường màn hình | Cột DB | Chức năng / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Công ty/Nhà máy | `COMPANY`, `PLANT_CD` | PK phức hợp1·2. |
| Thiết bị | `EQUIP_CODE` | PK phức hợp3. |
| Hạng mục kiểm tra | `ITEM_CODE` | PK phức hợp4. Tham chiếu danh mục hạng mục. |
| Loại kiểm tra | `INSPECT_TYPE` | PK phức hợp5. **Đối tượng của màn hình này là `PERIODIC`**. |
| Đang sử dụng | `USE_YN` | Chỉ bản ghi `Y` được đưa vào tính lịch. |
| Thứ tự sắp xếp | `SORT_SEQ` | Thứ tự hiển thị hạng mục khi thực hiện kiểm tra. |

---

## ③ Danh Mục Hạng Mục Kiểm Tra — EQUIP_INSPECT_ITEM_MASTERS
Nguồn tên hạng mục, tiêu chuẩn đánh giá, **chu kỳ (cycle)**, và hình ảnh tiêu chuẩn.

| Trường màn hình | Cột DB | Chức năng / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã hạng mục | `ITEM_CODE` | PK (bao gồm công ty/nhà máy). |
| Tên hạng mục | `ITEM_NAME` | Hiển thị trong cửa sổ thực hiện kiểm tra và nhãn. |
| Loại kiểm tra | `INSPECT_TYPE` | `DAILY` / `PERIODIC`. |
| Loại thiết bị | `EQUIP_TYPE` | Phân loại bộ lọc/mẫu. |
| Loại hạng mục | `ITEM_TYPE` | VISUAL/MEASUREMENT, v.v. |
| Tiêu chuẩn đánh giá | `CRITERIA` | Hiển thị là giá trị/mô tả tham chiếu khi thực hiện kiểm tra. |
| **Chu kỳ** | `CYCLE` | **`DAILY`/`WEEKLY`/`MONTHLY`. Cốt lõi của isDue() — xác định ngày nào là đối tượng kiểm tra.** |
| Đơn vị đo | `UNIT` | Đơn vị cho hạng mục đo lường. |
| Giới hạn dưới/trên tiêu chuẩn | `LSL_VALUE` / `USL_VALUE` | Dải đánh giá cho hạng mục đo lường. |
| QR công nhân | `WORKER_QR_CODE` | Dùng cho tích hợp kiểm tra công nhân. |
| Hình ảnh tiêu chuẩn | `IMAGE_URL` | Hiển thị là hình ảnh tham chiếu trong cửa sổ thực hiện kiểm tra. |
| Đang sử dụng | `USE_YN` | Chỉ bản ghi `Y` được dùng. |
| Ghi chú | `REMARK` | Ghi chú. |

---

## ④ Thông Tin Thiết Bị — EQUIP_MASTERS (cột tham chiếu)

| Trường màn hình | Cột DB | Chức năng / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Mã/Tên thiết bị | `EQUIP_CODE` / `EQUIP_NAME` | Hiển thị trên thẻ. |
| Dây chuyền | `LINE_CODE` | Thông tin bổ sung trên thẻ. |
| Loại thiết bị | `EQUIP_TYPE` | Thông tin bổ sung trên thẻ. |
| Công đoạn | `PROCESS_CODE` | Cơ sở cho **bộ lọc công đoạn**. |
| Trạng thái | `STATUS` | `NORMAL` / `INTERLOCK`. **Tự động chuyển sang INTERLOCK khi lưu kết quả không đạt.** |
| Đang sử dụng | `USE_YN` | Chỉ thiết bị `Y` được đưa vào lịch. |

---

## Logic Lịch và Đánh Giá

### Tính Đối Tượng Kiểm Tra Theo Chu Kỳ (isDue)
Xác định ngày nào là đối tượng kiểm tra dựa trên `EQUIP_INSPECT_ITEM_MASTERS.CYCLE`:
- `DAILY` → mỗi ngày
- `WEEKLY` → **chỉ thứ Hai** (getDay()===1)
- `MONTHLY` → **ngày 1 hàng tháng** (getDate()===1)
- Không có giá trị → coi là DAILY

### Tính Trạng Thái Ngày (status)
`GET /calendar` tính theo từng ngày (theo thứ tự ưu tiên):
1. 0 thiết bị mục tiêu → `NONE`
2. Hoàn thành ≥ tổng AND không đạt = 0 → `ALL_PASS`
3. Không đạt > 0 → `HAS_FAIL`
4. 0 < Hoàn thành < tổng → `IN_PROGRESS`
5. Hoàn thành = 0 → quá khứ: `OVERDUE`, tương lai: `NOT_STARTED`

### Kết Quả Tổng Hợp (OVERALL_RESULT)
Tự động tính trong cửa sổ thực hiện kiểm tra: **chỉ cần 1 kết quả hạng mục là `FAIL` thì kết quả tổng hợp là `FAIL`**; tất cả `PASS` thì là `PASS`. (Chỉ xác định khi tất cả kết quả hạng mục đã được nhập.)

### Xử Lý Tự Động INTERLOCK
Khi lưu (POST/PUT) với `OVERALL_RESULT` là FAIL, `EQUIP_MASTERS.STATUS` tự động thay đổi thành `'INTERLOCK'`. Thiết bị phải được khôi phục về `NORMAL` sau khi xử lý nguyên nhân trước khi vận hành lại.

## Cài Đặt Trước (Danh Mục & Mã Chung)
1. Đăng ký hạng mục `INSPECT_TYPE='PERIODIC'` và **CYCLE** trong **danh mục hạng mục kiểm tra** (`EQUIP_INSPECT_ITEM_MASTERS`).
2. Ánh xạ hạng mục PERIODIC vào thiết bị với `USE_YN='Y'` trong **hạng mục kiểm tra theo thiết bị** (`EQUIP_INSPECT_ITEM_POOL`).
3. Thiết bị mục tiêu kiểm tra phải có `EQUIP_MASTERS.USE_YN='Y'`.
4. Chọn người kiểm tra sử dụng danh mục công nhân.

## Quy Trình Vận Hành
1. Hiển thị tháng mục tiêu bằng bộ lọc công đoạn và nút tạo tháng hiện/tháng sau.
2. Chọn ngày trên lịch → **Thực hiện/Chỉnh sửa kiểm tra** theo thiết bị trong bảng theo ngày.
3. Nhập đạt/không đạt theo hạng mục và lưu → upsert `EQUIP_INSPECT_LOGS`, cập nhật lịch.
4. Kiểm tra trạng thái khóa liên động của thiết bị có kết quả không đạt, xử lý và khôi phục.
5. Kiểm tra thiết bị ngoài lịch tự động bằng **Thêm kiểm tra riêng lẻ** (chọn thiết bị → hạng mục PERIODIC tự động tải).

## Phân Quyền
- Nhập kết quả kiểm tra: công nhân/quản lý thiết bị.
- Xem: tất cả người dùng.

## Xử Lý Sự Cố

| Triệu Chứng | Nguyên Nhân | Biện Pháp |
|------|------|------|
| Không có đối tượng kiểm tra trên lịch | Hạng mục PERIODIC chưa được ánh xạ hoặc `USE_YN='N'` | Xác nhận ánh xạ hạng mục PERIODIC trong `EQUIP_INSPECT_ITEM_POOL` |
| Chỉ các ngày cụ thể bị trống | Điều kiện CYCLE không khớp (hàng tuần=thứ Hai, hàng tháng=ngày 1) | Kiểm tra cài đặt CYCLE trong danh mục hạng mục |
| Lưu kiểm tra thất bại | Chưa chọn người kiểm tra / chưa nhập hạng mục / thiếu lý do FAIL | Bổ sung đầy đủ thông tin bắt buộc và lưu lại |
| Thiết bị không sử dụng được sau khi lưu | INTERLOCK tự động đặt do kết quả không đạt | Xử lý nguyên nhân và khôi phục `EQUIP_MASTERS.STATUS` về NORMAL |
| Kết quả kiểm tra hằng ngày bị lẫn | Nhầm lẫn INSPECT_TYPE | Màn hình này chỉ truy vấn PERIODIC (API base là periodic-inspect) |

## Dữ Liệu & Liên Kết
- **Bảng**: `EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC'), `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_MASTERS`
- **API**: `GET /equipment/periodic-inspect/calendar` (tổng quan tháng), `GET /equipment/periodic-inspect/calendar/day` (lịch ngày), `POST /equipment/periodic-inspect` (lưu), `PUT /equipment/periodic-inspect/{equipCode}/{inspectDate}` (sửa), `DELETE …` (xóa). Khi thêm riêng lẻ: `GET /master/equip-inspect-items?inspectType=PERIODIC`.
- **Khác biệt với kiểm tra hằng ngày**: Chỉ khác INSPECT_TYPE (`PERIODIC` vs `DAILY`) và apiBasePath; bảng, thành phần và logic dùng chung. Kiểm tra định kỳ không có endpoint `/check` (xác nhận hoàn thành kiểm tra) của kiểm tra hằng ngày.
- **Màn hình liên kết**: [Hạng Mục Kiểm Tra Theo Thiết Bị](/master/equip-inspect), [Kết Quả Kiểm Tra Định Kỳ](/equipment/periodic-inspect), [Lịch Kiểm Tra Hằng Ngày](/equipment/inspect-calendar)
- **Phạm vi đa thuê bao**: `COMPANY='40'`, `PLANT_CD='1000'`
