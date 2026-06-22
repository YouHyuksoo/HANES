---
menuCode: MAT_RECEIVE
audience: operator
title: Quản lý nhập kho vật tư — Hướng dẫn vận hành
summary: Logic xử lý nhập kho quét cho LOT đạt IQC, điều kiện tính hàng chờ nhập, mapping mã vạch/chặn chứng chỉ, phản ánh tồn kho và xử lý sự cố
tags: [vật tư, nhập kho, nhập xuất, vận hành]
keywords: [hàng chờ nhập, IQC đạt, matUid, vendor-barcode, mapping mã vạch nhà sản xuất, MatStock, phản ánh tồn kho, chứng chỉ, certRequired, số lượng còn lại, đánh số, PROD, MRO]
related: [MST_PART, QC_AQL]
---

# Quản lý nhập kho vật tư — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình xử lý **xác nhận vật tư đã qua nhập hàng·kiểm tra nhập thành tồn kho**. Chỉ LOT đạt IQC mới là đối tượng nhập kho, khi xác nhận nhập kho thì phản ánh vào tồn kho (`MatStock`) và tạo lịch sử giao dịch nhập.

## Luồng xử lý
```
Nhập hàng (PO nhập kho) → Kiểm tra IQC → [Đạt + còn lại>0] = Hàng chờ nhập
   → Quét nhập kho (mapping mã vạch nhà cung cấp + serial vật tư) → Phản ánh tồn kho (MatStock) + Đánh số lịch sử nhập
```

## Dữ liệu / API
- Tra hàng chờ nhập: `GET /material/receiving/receivable` — Chỉ trả về LOT **IQC đạt + chưa nhập (số lượng còn lại>0)**.
- Xác nhận nhập: Xử lý theo đơn vị mapping quét (`{ vendorBarcode, matUid }`). Chỉ xác nhận những cái đã mapping.
- Tiêu chuẩn tồn kho: Số lượng tồn kho hiện tại được quản lý trong `MatStock` (tăng khi nhập kho).

## Điều kiện tính hàng chờ nhập (điểm kiểm tra người vận hành)
LOT muốn xuất hiện trong hàng chờ nhập phải **đáp ứng tất cả**:
- Kết quả kiểm tra nhập `iqcStatus = Đạt`
- Số lượng còn lại (`remainingQty = initQty − receivedQty`) > 0
- (Hạng mục cần chứng chỉ) Không có lý do chặn nhập

## Ý nghĩa trường chính · Lưu ý vận hành

| Mục màn hình | Ý nghĩa / Tính toán · Liên kết |
|------|------|
| Serial vật tư(matUid) | Giá trị định danh LOT được đánh số khi nhập hàng. Quét mã vạch tự dán. |
| Số lượng nhập / Đã nhập / Còn lại | `initQty` / `receivedQty`(tích lũy nhập một phần) / `remainingQty`(có thể nhập). Hỗ trợ tích lũy nhập một phần. |
| Trạng thái kiểm tra(iqcStatus) | Kết quả IQC. Chỉ hàng đạt mới có trong hàng chờ nhập. |
| Kho nhập hàng(arrivalWarehouse) | Kho chứa hàng nhập. Khi nhập kho, di chuyển đến kho nhập. |
| Chứng chỉ(certRequired/certUploaded) | Nếu cần mà chưa upload thì đặt `receivingBlockedReason` → chặn nhập. |
| Lý do chặn nhập(receivingBlockedReason) | Nguyên nhân không thể nhập kho. Giải quyết xong mới nhập được. |
| Mã vạch nhà cung cấp(vendorBarcode) | Kết nối với [mapping mã vạch nhà sản xuất](vendor-barcode master) với mã hàng/serial MES. Mapping chưa đăng ký thì quét thất bại. |
| Phân loại(materialClass) | PROD(sản xuất hàng loạt) / MRO(vật tư tiêu hao). Phân loại lịch sử nhập. |
| Số nhập/số giao dịch(receiveNo/transNo) | Giá trị đánh số xử lý nhập. |

## Logic nhập quét
1. Bắt đầu xử lý nhập → quét mã vạch nhà cung cấp → master vendor-barcode giải mã mã hàng/serial.
2. Quét serial vật tư(matUid) → mapping với LOT hàng chờ nhập.
3. Chỉ xác nhận nhập những cái mapping thành công → tăng `MatStock` + tạo lịch sử nhập.
4. Mapping thất bại (mã vạch chưa đăng ký/không phải đối tượng) thì không xác nhận.

## Thiết lập trước
- Master hạng mục (IQC·cần chứng chỉ), chính sách AQL (kiểm tra nhập), mapping mã vạch nhà sản xuất (vendor-barcode), master kho.

## Phân quyền
Nhân viên vật tư (xử lý nhập). Người dùng thông thường chỉ tra cứu.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không có LOT trong hàng chờ nhập | IQC chưa đạt hoặc số lượng còn lại 0 | Kiểm tra đã kiểm tra/đạt chưa, đã nhập chưa |
| Xử lý nhập bị chặn | Cần chứng chỉ nhưng chưa upload | Upload chứng chỉ rồi giải quyết lý do chặn |
| Quét mã vạch nhà cung cấp thất bại | vendor-barcode chưa đăng ký mapping | Đăng ký mapping mã vạch↔mã hàng tại [Mapping mã vạch nhà sản xuất] |
| Quét serial vật tư không khớp | Không phải đối tượng hàng chờ nhập (LOT khác/đã nhập hết) | Kiểm tra LOT đích·số lượng còn lại |
| Không phản ánh vào tồn kho | Chưa xác nhận nhập (mới mapping chưa xác nhận) | Kiểm tra đã xác nhận sau mapping quét chưa |

## Dữ liệu & Liên kết
- Tồn kho: `MatStock`(tăng khi nhập kho)
- Liên kết: Nhập hàng/PO, Kiểm tra nhập (IQC)·AQL, mapping mã vạch nhà sản xuất (vendor-barcode), kho, master hạng mục
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
