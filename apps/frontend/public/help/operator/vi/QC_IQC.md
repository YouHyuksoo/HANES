---
menuCode: QC_IQC
audience: operator
title: Kiểm tra nhập (IQC) — Hướng dẫn vận hành
summary: Cấu trúc DB·toàn bộ mapping cột màn hình IQC, logic đánh giá AQL tự động, di chuyển tồn kho khi không đạt, tự động xuất kho kiểm tra phá hủy, điều kiện hủy đánh giá, phạm vi đa khách hàng và các vấn đề vận hành cốt lõi
tags: [chất lượng, IQC, kiểm tra nhập, vận hành, AQL, kho phế liệu]
keywords: [IQC_LOGS, MAT_LOTS, MAT_ARRIVALS, IQC_PART_SPECS, IQC_PART_SPEC_ITEMS, IQC_ITEM_POOL, PENDING, PASSED, FAILED, IQC_IN_PROGRESS, PASS, FAIL, INITIAL, RETEST, đánh giá AQL, kho phế liệu, kiểm tra phá hủy, AUTO_ISSUE, DEFECT_TYPE, DEFECT_GRADE, CRITICAL, MAJOR, MINOR, LSL, USL, INSPECT_DATE, SEQ, đa khách hàng, COMPANY, PLANT_CD, phiếu kiểm tra, CERT_FILE_PATH, hủy, CANCELED]
related: [QC_AQL, MST_PART]
---

# Kiểm tra nhập (IQC) — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình kiểm tra chất lượng LOT nguyên liệu đã nhập và đánh giá đạt/không đạt.
- Kết quả đánh giá được phản ánh ngay vào `MAT_LOTS.IQC_STATUS` và `MAT_ARRIVALS.IQC_STATUS`.
- Khi không đạt (FAIL), tất cả serial của lô nhập đó tự động di chuyển đến **kho phế liệu (warehouseType='DEFECT')** (xử lý `MAT_STOCKS` về 0 rồi cấp lại vào kho phế liệu).
- Khi đạt (PASS), nếu hạng mục có cài đặt thời hạn hiệu lực thì tự động tính `MAT_LOTS.EXPIRE_DATE` dựa trên ngày nhập.
- Khi cài đặt `IQC_SAMPLE_ISSUE_MODE = 'AUTO_ISSUE'`, nếu PASS + có số lượng mẫu thì tự động xuất kho mẫu kiểm tra phá hủy (ghi `STOCK_TRANSACTIONS`, `refType='IQC_DESTRUCT'`).
- Sau đánh giá, mức kiểm tra nhà cung cấp AQL được cập nhật (tích lũy lịch sử kiểm tra nhập → chuyển đổi chế độ kiểm tra).

## Cấu trúc dữ liệu

```
MAT_LOTS (PK: COMPANY, PLANT_CD, MAT_UID)
   ├─ IQC_STATUS: PENDING / PASS / FAIL  ← Cập nhật sau đánh giá IQC
   ├─ ARRIVAL_NO ──▶ MAT_ARRIVALS (Header nhập, đồng bộ IQC_STATUS)
   └─ ITEM_CODE ──▶ ITEM_MASTERS (Thông tin hạng mục)
                        └─ IQC_AQL_POLICY_CODE ──▶ IQC_AQL_POLICIES (Chính sách AQL)
                                                        └─ AQL_STANDARDS → Tiêu chí LOT

IQC_PART_SPECS (PK: COMPANY, PLANT_CD, ITEM_CODE) ── Header tiêu chuẩn IQC theo hạng mục
   └─ IQC_PART_SPEC_ITEMS (PK: ... ITEM_CODE, SEQ) ── LSL/USL/AQL theo hạng mục
         └─ INSP_ITEM_CODE ──▶ IQC_ITEM_POOL (Định nghĩa hạng mục kiểm tra toàn cục)

IQC_LOGS (PK: INSPECT_DATE, SEQ) ── 1 bản ghi lịch sử kiểm tra (theo lô nhập, matUid=null)
   ├─ ARRIVAL_NO, ITEM_CODE, VENDOR_CODE
   ├─ RESULT: PASS / FAIL
   ├─ DETAILS (CLOB, JSON) ── Chi tiết đo theo serial
   ├─ ITEM_RESULTS (CLOB, JSON) ── Kết quả đánh giá AQL theo hạng mục kiểm tra
   └─ Các cột AQL_* ── Snapshot tiêu chuẩn AQL áp dụng khi đánh giá

MAT_STOCKS ── Tồn kho (di chuyển đến kho phế liệu khi FAIL)
STOCK_TRANSACTIONS ── Lịch sử di chuyển/xuất kho (refType: IQC_FAIL / IQC_DESTRUCT)
```

---

## ① Danh sách đối tượng kiểm tra — MAT_LOTS (view tổng hợp)

Danh sách màn hình là kết quả tổng hợp `MAT_LOTS` GROUP BY `ARRIVAL_NO + ITEM_CODE`.

| Mục màn hình | Cột DB/Nguồn | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| Số lô nhập | `MAT_LOTS.ARRIVAL_NO` | Định danh lô nhập. Khóa GROUP BY. |
| Ngày nhập | `MIN(MAT_LOTS.RECV_DATE)` | Ngày nhận đầu tiên của lô nhập. |
| Nhà cung cấp | `MAT_LOTS.VENDOR` (→ JOIN tên đối tác) | Mã và tên nhà cung cấp giao hàng. |
| Mã hạng mục | `MAT_LOTS.ITEM_CODE` | Khóa GROUP BY. |
| Tên hạng mục | `ITEM_MASTERS.ITEM_NAME` | LEFT JOIN. |
| Phương pháp kiểm tra | `ITEM_MASTERS.INSPECT_METHOD` | Mã chung `IQC_INSPECT_METHOD`. `FULL`=kiểm tra, `SKIP`=không kiểm tra. Khác với `INSPECT_CLASS` (cột legacy của IQC_LOGS). |
| Số serial | `COUNT(*)` | Số serial của lô nhập đó. |
| Tổng số lượng | `SUM(MAT_LOTS.INIT_QTY)` | Tổng số lượng ban đầu của tất cả serial. |
| Trạng thái | `MAT_LOTS.IQC_STATUS` | `PENDING`=chờ kiểm tra, `PASS`=đạt (→ frontend `PASSED`), `FAIL`=không đạt (→ `FAILED`). Màn hình cũng có thể hiển thị `IQC_IN_PROGRESS` (khi một phần LOT đang được kiểm tra). |

---

## ② Lịch sử kiểm tra — IQC_LOGS (toàn bộ cột)

Khi đăng ký kết quả kiểm tra, 1 bản ghi được tạo theo lô nhập (`MAT_UID=null`, đánh dấu kiểm tra theo lô nhập).

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| (PK phức hợp) | `INSPECT_DATE` | Thời gian đăng ký kiểm tra (TIMESTAMP). Một phần PK. |
| (PK phức hợp) | `SEQ` | Số thứ tự trong cùng thời gian (mặc định 1). Một phần PK. |
| Số lô nhập | `ARRIVAL_NO` | Lô nhập được kiểm tra. Bắt buộc khi kiểm tra theo lô nhập. |
| UID vật tư | `MAT_UID` | Định danh serial khi kiểm tra theo serial. Kiểm tra theo lô nhập (phương thức hiện tại) là `null`. |
| Mã hạng mục | `ITEM_CODE` | Hạng mục được kiểm tra. |
| Mã nhà cung cấp | `VENDOR_CODE` | Mã đối tác giao hàng (cơ sở cập nhật mức kiểm tra AQL). |
| Loại kiểm tra | `INSPECT_TYPE` | `INITIAL`=kiểm tra lần đầu (mặc định), `RETEST`=kiểm tra lại. Dùng với `RETEST_ROUND`. |
| Kết quả kiểm tra | `RESULT` | `PASS` / `FAIL`. Giá trị frontend gửi (`PASSED`/`FAILED`) được service chuyển đổi. |
| Chi tiết | `DETAILS` (CLOB) | JSON giá trị đo theo serial·hạng mục. Định dạng: `{type:"SERIAL_INSPECTION", serials:[...], destructive:[...]}`. |
| Đánh giá theo hạng mục | `ITEM_RESULTS` (CLOB) | JSON kết quả đánh giá AQL theo hạng mục kiểm tra. Do service AQL tạo. |
| Người kiểm tra | `INSPECTOR_NAME` | Tên người thực hiện kiểm tra (nhập tự do). |
| Phân loại kiểm tra | `INSPECT_CLASS` | Cột legacy. Màn hình hiện tại không dùng để ghi phân loại kiểm tra IQC (FULL/SKIP). |
| Số lượng mẫu phá hủy | `DESTRUCT_SAMPLE_QTY` | Số lượng mẫu kiểm tra phá hủy. Nếu giá trị này > 0 và PASS, ở chế độ AUTO_ISSUE sẽ tự động xuất kho. |
| Phiếu kiểm tra | `CERT_FILE_PATH` | Đường dẫn server của file đã tải lên (`/uploads/iqc/...`). Lưu riêng qua API tải file. |
| Mã vạch mẫu | `SAMPLE_BARCODE` | Danh sách serial đã quét (phân cách bằng dấu phẩy). Tự động nén nếu vượt quá 500 byte (hậu tố `...(+N more)`). |
| Số lượng LOT | `LOT_QTY` | Tổng số lượng LOT dùng trong đánh giá AQL. |
| Mức kiểm tra AQL | `AQL_INSPECTION_LEVEL` | Mức kiểm tra AQL đã áp dụng (VD: `II`). |
| Chế độ kiểm tra AQL | `AQL_INSPECTION_MODE` | Chế độ kiểm tra đã áp dụng (VD: `NORMAL`). |
| Cỡ mẫu AQL | `AQL_SAMPLE_QTY` | Số mẫu khuyến nghị tính theo tiêu chuẩn AQL. |
| Mã AQL Major | `AQL_MAJOR_CODE` | Mã tiêu chuẩn AQL Major đã áp dụng. |
| Major Ac | `AQL_MAJOR_AC` | Số chấp nhận Major. |
| Major Re | `AQL_MAJOR_RE` | Số loại bỏ Major. |
| Mã AQL Minor | `AQL_MINOR_CODE` | Mã tiêu chuẩn AQL Minor đã áp dụng. |
| Minor Ac | `AQL_MINOR_AC` | Số chấp nhận Minor. |
| Minor Re | `AQL_MINOR_RE` | Số loại bỏ Minor. |
| Số lỗi nghiêm trọng | `DEFECT_CRITICAL` | Số lượng lỗi cấp Critical. |
| Số lỗi chính | `DEFECT_MAJOR` | Số lượng lỗi cấp Major. |
| Số lỗi phụ | `DEFECT_MINOR` | Số lượng lỗi cấp Minor. |
| Lý do đánh giá AQL | `AQL_JUDGE_REASON` | Lý do kết quả của logic đánh giá AQL tự động (tạo tự động). |
| Trạng thái | `STATUS` | `DONE`=đã đánh giá (mặc định), `CANCELED`=đã hủy. |
| Số lần kiểm tra lại | `RETEST_ROUND` | Chỉ dùng cho `INSPECT_TYPE=RETEST`. Số lần kiểm tra lại. |
| Ghi chú | `REMARK` | Ghi nhớ kiểm tra. Khi hủy, lý do hủy cũng được ghi ở đây. |
| Đa khách hàng | `COMPANY`, `PLANT_CD` | Phạm vi `40` / `1000`. |
| Tạo/sửa | `CREATED_AT`, `UPDATED_AT`, `CREATED_BY`, `UPDATED_BY` | Cột kiểm toán. |

---

## ③ Tiêu chuẩn IQC theo hạng mục — IQC_PART_SPECS / IQC_PART_SPEC_ITEMS

Bảng tiêu chuẩn để tra cứu hạng mục kiểm tra và cỡ mẫu cơ bản của hạng mục trong modal kiểm tra.

### IQC_PART_SPECS (Header theo hạng mục)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| (PK) | `COMPANY`, `PLANT_CD`, `ITEM_CODE` | PK phức hợp. 1 dòng mỗi hạng mục. |
| Cỡ mẫu cơ bản | `SAMPLE_QTY` | Được tải làm giá trị ban đầu của cỡ mẫu trong modal kiểm tra. Người kiểm tra có thể sửa. |
| Kiểm tra phá hủy | `IS_DEST` | `Y` nếu là hạng mục kiểm tra phá hủy. |
| Sử dụng | `USE_YN` | `N` thì bị loại khỏi tra cứu hạng mục kiểm tra. |

### IQC_PART_SPEC_ITEMS (Chi tiết theo hạng mục)

| Mục màn hình | Cột DB | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|------|
| (PK) | `COMPANY`, `PLANT_CD`, `ITEM_CODE`, `SEQ` | PK phức hợp. Phân biệt hạng mục bằng số thứ tự. |
| Mã hạng mục kiểm tra | `INSP_ITEM_CODE` | Tham chiếu `IQC_ITEM_POOL.INSP_ITEM_CODE`. Lấy tên hạng mục·phương pháp đánh giá·LSL/USL cơ bản. |
| Cận dưới (LSL) | `LSL` | Cận dưới đạt của đo lường (NULL nếu không có). NULL thì xử lý là đánh giá trực quan. |
| Cận trên (USL) | `USL` | Cận trên đạt của đo lường (NULL nếu không có). |
| Tiêu chuẩn đánh giá | `JUDGE_CRITERIA` | Mô tả tiêu chuẩn đánh giá trực quan. |
| Cấp lỗi | `DEFECT_GRADE` | `CRITICAL`/`MAJOR`/`MINOR`. Mã chung `DEFECT_GRADE`. Cấp này ánh xạ số lỗi với Ac/Re AQL. |
| Mức kiểm tra | `INSPECTION_LEVEL` | Mức kiểm tra ISO 2859-1. Mã chung `AQL_INSP_LEVEL`. |
| Giá trị AQL | `AQL` | AQL theo hạng mục (giới hạn chất lượng chấp nhận). Mã chung `AQL_VALUE`. |
| Loại kiểm tra | `INSPECTION_TYPE` | `AQL`(mặc định)/`DESTRUCTIVE`(phá hủy)/`FULL`(toàn bộ). NULL được coi là AQL. Mã chung `IQC_ITEM_INSP_TYPE`. |
| Phương pháp lấy mẫu | `SAMPLE_METHOD` | `AQL`(tự động)/`FIXED`(cố định). NULL là AQL. Mã chung `IQC_SAMPLE_METHOD`. |
| Cỡ mẫu cố định | `SAMPLE_QTY` | Số mẫu cố định mỗi LOT cho hạng mục có `INSPECTION_TYPE=DESTRUCTIVE/FULL` hoặc `SAMPLE_METHOD=FIXED`. |
| Sử dụng | `USE_YN` | `N` thì không hiển thị khi kiểm tra. |

### IQC_ITEM_POOL (Định nghĩa hạng mục kiểm tra toàn cục)

| Cột | Vai trò / Ý nghĩa · Lưu ý vận hành |
|------|------|
| `INSP_ITEM_CODE` | Mã hạng mục kiểm tra duy nhất (PK). VD: `IQC-001`. |
| `INSP_ITEM_NAME` | Tên hạng mục kiểm tra. Hiển thị trong cột hạng mục kiểm tra của modal. |
| `JUDGE_METHOD` | `VISUAL`(trực quan)/`MEASURE`(đo lường). Đo lường thì kích hoạt trường nhập giá trị đo. |
| `CRITERIA` | Tiêu chuẩn đánh giá cơ bản. Dùng giá trị này nếu `IQC_PART_SPEC_ITEMS.JUDGE_CRITERIA` không có. |
| `LSL`, `USL`, `UNIT` | Phạm vi đạt cơ bản. Có thể định nghĩa lại trong hạng mục. |
| `REVISION`, `EFFECTIVE_DATE` | Quản lý lịch sử sửa đổi hạng mục kiểm tra. |

---

## Logic đánh giá AQL

Khi đăng ký kết quả kiểm tra theo lô nhập (`POST /material/iqc-history/arrival`), kết quả cuối cùng được xác định theo thứ tự sau:

```
1. Tra cứu toàn bộ serial PENDING của lô nhập → tính tổng số lượng LOT
2. Phân tích DETAILS JSON → tổng hợp FAIL theo serial·hạng mục (itemDefectCounts)
3. Phân tích phần phá hủy (destructive) → tổng hợp inspectedQty/defectQty theo hạng mục
4. Service AQL gọi resolveIqcPolicyByItem:
   a. Tra IQC_AQL_POLICY_CODE của hạng mục → IQC_AQL_POLICIES
   b. Nếu có lỗi nghiêm trọng (CRITICAL) và criticalMode='IMMEDIATE_FAIL' → FAIL ngay
   c. Hạng mục có defectGrade: tra khoảng LOT theo inspectionLevel/AQL của hạng mục → so sánh Ac/Re
   d. Hạng mục chưa đặt cấp: fallback về toàn bộ Major/Minor Ac/Re
   e. Major hoặc Minor ≥ Re → FAIL / ≤ Ac → PASS
5. Cập nhật hàng loạt serial PENDING với kết quả cuối cùng (PASS/FAIL)
6. Tạo 1 bản ghi IQC_LOGS (lưu snapshot tiêu chuẩn AQL)
7. FAIL → tự động di chuyển đến kho phế liệu (STOCK_TRANSACTIONS refType='IQC_FAIL')
8. PASS + thời hạn hiệu lực → tự động tính EXPIRE_DATE
9. PASS + số lượng mẫu > 0 + chế độ AUTO_ISSUE → tự động xuất kho mẫu phá hủy (refType='IQC_DESTRUCT')
10. Cập nhật mức kiểm tra nhà cung cấp AQL
```

> Khi nhập mã lỗi (`defects[]`) mà không có hạng mục nào bị FAIL thì bị chặn với lỗi 400 (`assertDefectCodesHaveFailedInspection`).

---

## Điều kiện hủy đánh giá

Khi gọi `DELETE /material/iqc-history/{inspectDate}/{seq}`, kiểm tra các điều kiện sau:

| Điều kiện | Hành vi |
|------|------|
| Đã `STATUS='CANCELED'` | Lỗi 400 ("Đã hủy đánh giá") |
| Lô nhập đó đã nhập kho (`MAT_RECEIVINGS.STATUS='DONE'`) | Lỗi 400 ("Lô nhập đã nhập kho") |
| PASS và có tự động xuất kho mẫu phá hủy (`refType='IQC_DESTRUCT'`) | Lỗi 400 ("Cần xử lý xuất kho mẫu trước") |
| FAIL và có lịch sử di chuyển kho phế liệu | Tự động di chuyển ngược (`refType='IQC_FAIL_CANCEL'`) rồi cho phép hủy |
| Hủy thành công | `IQC_LOGS.STATUS='CANCELED'`, khôi phục serial → `IQC_STATUS='PENDING'` |

---

## Đường dẫn API

| Mục đích | Phương thức | Đường dẫn |
|------|------|------|
| Tra cứu danh sách chờ kiểm tra | GET | `/material/iqc-history/pending-arrivals` |
| Tra cứu serial chờ kiểm tra | GET | `/material/iqc-history/pending-serials` |
| Đăng ký kết quả kiểm tra theo lô nhập | POST | `/material/iqc-history/arrival` |
| Tải lên phiếu kiểm tra | POST | `/material/iqc-history/{inspectDate}/{seq}/upload-cert` |
| Hủy đánh giá | DELETE | `/material/iqc-history/{inspectDate}/{seq}` |
| Tra cứu hạng mục kiểm tra của hạng mục | GET | `/master/iqc-part-specs/{itemCode}/resolve-items` |
| Tra cứu header tiêu chuẩn hạng mục | GET | `/master/iqc-part-specs/{itemCode}` |
| Tra cứu cỡ mẫu AQL | GET | `/quality/aql/resolve-iqc-items` |

---

## Thiết lập trước (Master·Mã chung)

- Mã chung: `IQC_INSPECT_METHOD` (FULL/SKIP), `IQC_STATUS`, `DEFECT_TYPE` (mã lỗi, `ATTR1` bắt buộc có cấp), `DEFECT_GRADE` (CRITICAL/MAJOR/MINOR), `IQC_ITEM_INSP_TYPE` (AQL/DESTRUCTIVE/FULL), `IQC_SAMPLE_METHOD` (AQL/FIXED), `AQL_INSP_LEVEL`, `AQL_VALUE`
- `ITEM_MASTERS.IQC_FLAG='Y'` bắt buộc (hạng mục IQC)
- `IQC_ITEM_POOL` — cần đăng ký pool hạng mục kiểm tra
- `IQC_PART_SPECS` + `IQC_PART_SPEC_ITEMS` — cần cấu hình hạng mục kiểm tra theo hạng mục
- `IQC_AQL_POLICIES` — cần cài đặt chính sách AQL và kết nối hạng mục
- Kho phế liệu (`warehouseType='DEFECT'`, `USE_YN='Y'`) bắt buộc — nếu không có thì không thể di chuyển tồn kho không đạt (bỏ qua không báo lỗi)

---

## Phân quyền

| Vai trò | Khả năng |
|------|------|
| Nhân viên kiểm tra | Đăng ký kết quả kiểm tra, quét serial, tải lên phiếu kiểm tra |
| Quản trị viên chất lượng | Trên + hủy đánh giá |
| Vận hành viên | Trên + cài đặt mã chung·tiêu chuẩn |

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Nút kiểm tra bị vô hiệu | Trạng thái là PASSED/FAILED | Cần hủy đánh giá (quản trị viên). Chỉ hủy được nếu chưa có lịch sử nhập kho |
| Cỡ mẫu AQL không hiển thị | Hạng mục chưa kết nối chính sách AQL | Đặt `IQC_AQL_POLICY_CODE` trong master hạng mục |
| Sau xử lý không đạt, tồn kho không di chuyển đến kho phế liệu | Chưa đăng ký kho phế liệu (`warehouseType='DEFECT'`) | Đăng ký kho loại DEFECT trong master kho |
| Khi hủy "Lô nhập đã nhập kho" | Lô nhập đó đã nhập kho (MAT_RECEIVINGS DONE) | Hủy nhập kho trước rồi hủy đánh giá IQC |
| Khi hủy "Cần xử lý xuất kho mẫu trước" | Có lịch sử tự động xuất kho IQC_DESTRUCT | Hủy STOCK_TRANSACTIONS đó rồi thử lại |
| Hạng mục kiểm tra không hiển thị trong modal | `IQC_PART_SPECS`/`IQC_PART_SPEC_ITEMS` chưa đăng ký hoặc `USE_YN='N'` | Kiểm tra cài đặt master hạng mục kiểm tra IQC |
| Chặn đăng ký sau khi nhập mã lỗi | Nhập mã lỗi mà không có hạng mục nào bị FAIL | Mã lỗi chỉ đăng ký được khi có hạng mục bị FAIL |
| ORA-04068 (500 ở lần gọi đầu) | DDL bảng làm mất hiệu lực PL/SQL package | Chạy `ALTER PACKAGE <tên> COMPILE` hoặc thử lại (callProc cứng 1 lần thử lại) |
| Không tự động xuất kho mẫu phá hủy | `IQC_SAMPLE_ISSUE_MODE != 'AUTO_ISSUE'` hoặc `DESTRUCT_SAMPLE_QTY=0` | Kiểm tra cài đặt hệ thống `IQC_SAMPLE_ISSUE_MODE='AUTO_ISSUE'` và nhập số lượng mẫu |

---

## Dữ liệu & Liên kết

- **Bảng chính**: `IQC_LOGS`, `MAT_LOTS`, `MAT_ARRIVALS`, `IQC_PART_SPECS`, `IQC_PART_SPEC_ITEMS`, `IQC_ITEM_POOL`
- **Bảng tồn kho**: `MAT_STOCKS` (tồn kho), `STOCK_TRANSACTIONS` (lịch sử di chuyển/xuất kho)
- **Bảng master**: `ITEM_MASTERS` (hạng mục), `IQC_AQL_POLICIES`, `AQL_STANDARDS` (tiêu chuẩn AQL)
- **Màn hình liên kết**: [Quản lý tiêu chuẩn AQL](/quality/aql), [Master hạng mục](/master/part), Nhập kho vật tư, Lịch sử kiểm tra nhập
- **Phạm vi đa khách hàng**: `COMPANY='40'`, `PLANT_CD='1000'`. Tất cả tra cứu·lưu đều bao gồm tham số tenant. `assertSameTenant` chặn truy cập chéo.
