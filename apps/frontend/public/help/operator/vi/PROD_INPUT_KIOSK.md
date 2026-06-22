---
menuCode: PROD_INPUT_KIOSK
audience: operator
title: Nhập kết quả (Kiosk) — Hướng dẫn vận hành
summary: Interlock (kiểm tra chuẩn bị) trong xử lý kết quả sản xuất kiosk·trigger tự kiểm tra·đầu vào 2 loại vật tư/vật tư tiêu hao·giao dịch lưu kết quả/phế phẩm và xử lý sự cố
tags: [sản xuất, nhập kết quả, kiosk, vận hành]
keywords: [kết quả sản xuất, interlock, tự kiểm tra, đầu ca, giữa ca, cuối ca, FIRST, MID, LAST, goodQty, defectQty, prdUid, đầu vào BOM, phụ tùng thiết bị tiêu hao, WIP, hướng dẫn công việc, chromeless]
related: [MST_PART, MST_BOM]
---

# Nhập kết quả (Kiosk) — Hướng dẫn vận hành

## Mục đích & vai trò hệ thống
Màn hình tích hợp để đăng ký kết quả sản xuất tại terminal cạnh thiết bị hiện trường. Xử lý một màn hình: chọn thiết bị·lệnh sản xuất·công nhân, kiểm tra chuẩn bị (interlock), đầu vào vật tư/vật tư tiêu hao, nhập số lượng sản xuất·phế phẩm, tự kiểm tra (đầu ca/giữa ca/cuối ca). Hoạt động ở chế độ toàn màn hình (chromeless, `view=work`), trạng thái được bảo toàn qua `kioskStore`(zustand persist).

## Cấu hình màn hình (4 khu vực)
- Header trên 2 dòng: ①ID thiết bị·mã vạch·kiểm tra thiết bị hàng ngày ②Lệnh sản xuất·công nhân·kết quả sản xuất·kiểm tra thiết bị công nhân
- Bên trái: Danh sách vật tư BOM + Phụ tùng thiết bị tiêu hao
- Giữa: Hướng dẫn công việc + 3 ô dưới (Tự kiểm tra | Phế phẩm | Nhập kết quả)
- Bên phải: Điều kiện hàng tốt + Lịch sử công việc

## Logic Interlock (kiểm tra chuẩn bị)
- Chặn lưu kết quả khi chưa hoàn tất kiểm tra bắt buộc như kiểm tra thiết bị hàng ngày·kiểm tra thiết bị công nhân (`isAllInterlockDone`).
- Cũng không lưu được nếu chưa chọn lệnh sản xuất·công nhân.

## Trigger tự kiểm tra
| Thời điểm | Điều kiện |
|------|------|
| Đầu ca FIRST | Lần lưu đầu sau `savedResultCount === 0` → tự động mở |
| Giữa ca MID | Nhấn nút panel, hoặc **chặn ở 60% tiến độ**(không thể tiếp tục nếu chưa thực hiện) |
| Cuối ca LAST | Nhấn nút panel |

## Phân biệt 2 loại vật tư/vật tư tiêu hao
- **Vật tư đầu vào BOM**: Danh sách vật tư bên trái = đối tượng đầu vào theo BOM của sản phẩm lệnh sản xuất (quét vật tư).
- **Phụ tùng thiết bị tiêu hao**: Mục "Phụ tùng thiết bị tiêu hao" phía dưới = vật tư tiêu hao gắn trên thiết bị, riêng với BOM sản phẩm. (Hiển thị tách biệt để tránh nhầm lẫn hai loại.)

## Lưu kết quả/phế phẩm
| Nhập | Ý nghĩa / Xử lý |
|------|------|
| Số lượng tốt(goodQty) | Số lượng sản xuất tốt. |
| Số lượng phế phẩm(defectQty) | Số lượng phế phẩm. **Nếu có tổng chi tiết theo cấp (pendingDefects) thì ưu tiên giá trị đó** (tránh tính trùng). |
| Serial sản xuất(prdUid) | Serial sản phẩm (nếu có). |
| Cấp phế phẩm | Lưu chi tiết theo cấp nghiêm trọng/trung bình/nhẹ trong **cùng giao dịch** với kết quả sản xuất (đã khắc phục lỗi đếm trùng defect-logs riêng). |

- Khi lưu kết quả, tiến độ lệnh sản xuất·kết quả sản xuất được cập nhật, phản ánh vào luồng tồn kho WIP/sản phẩm (tùy theo phân bổ thiết bị·công đoạn).

## Phân quyền
Công nhân hiện trường (đăng ký kết quả). Terminal vận hành ở chế độ kiosk.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân | Xử lý |
|------|------|------|
| Không thể lưu kết quả | Interlock chưa hoàn tất (kiểm tra thiết bị/công nhân) hoặc chưa chọn lệnh sản xuất·công nhân | Xác nhận hoàn tất kiểm tra chuẩn bị·chọn |
| Chặn tiến triển ở 60% | Chưa thực hiện tự kiểm tra giữa ca | Thực hiện tự kiểm tra giữa ca |
| Nghi ngờ đếm trùng số lượng phế phẩm | Nhập lẫn chi tiết theo cấp và nhập trực tiếp | Tổng theo cấp được ưu tiên (thiết kế không có đếm trùng) |
| Quét vật tư không khớp | Không phải vật tư đầu vào BOM/nhầm với vật tư tiêu hao | Phân biệt vật tư BOM bên trái vs Phụ tùng thiết bị tiêu hao phía dưới |
| Không thấy hướng dẫn công việc | Chưa đăng ký hướng dẫn công việc cho hạng mục/công đoạn hoặc lỗi đường dẫn file | Đăng ký hướng dẫn công việc·kiểm tra đường dẫn |

## Dữ liệu & Liên kết
- Trạng thái: `kioskStore`(zustand persist)
- Liên kết: Lệnh sản xuất, Hạng mục/BOM, Hướng dẫn công việc, Thiết bị/Công đoạn, Tự kiểm tra, Kết quả sản xuất·Phế phẩm, Tồn kho (WIP/Sản phẩm)
- Phạm vi: `COMPANY='40'`, `PLANT_CD='1000'`
