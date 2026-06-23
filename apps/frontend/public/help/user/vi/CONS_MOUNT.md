---
menuCode: CONS_MOUNT
audience: user
title: Quản lý lắp đặt vật tư tiêu hao
summary: Màn hình dùng để lắp đặt/tháo gỡ vật tư tiêu hao (khuôn mẫu, jig, dụng cụ,...) khỏi thiết bị, chuyển sang trạng thái sửa chữa/đưa trở lại kho, và tra cứu lịch sử lắp đặt
tags: [vật tư tiêu hao, lắp đặt, tháo gỡ, sửa chữa, thiết bị, khuôn mẫu, jig, dụng cụ]
keywords: [lắp đặt vật tư tiêu hao, lắp đặt thiết bị, lắp đặt khuôn mẫu, lắp đặt jig, lắp đặt dụng cụ, tháo gỡ lắp đặt, chuyển sửa chữa, hoàn thành sửa chữa, lịch sử lắp đặt, MOUNTED, WAREHOUSE, REPAIR, CONSUMABLE_MOUNT_LOGS]
related: [CONS_MASTER, CONS_STOCK, CONS_LIFE]
---

# Quản lý lắp đặt vật tư tiêu hao

## Mục đích màn hình
Màn hình này dùng để **lắp đặt** hoặc **tháo gỡ** **vật tư tiêu hao (khuôn mẫu, jig, dụng cụ,...)** trên thiết bị sản xuất, chuyển sang **trạng thái sửa chữa** khi cần, hoặc **đưa trở lại kho** sau khi sửa chữa hoàn tất. Có thể xác nhận lịch sử lắp đặt/tháo gỡ của từng vật tư tiêu hao.

> Màn hình này quản lý **vị trí/trạng thái vật lý** của vật tư tiêu hao. Nhập/xuất kho hoặc tuổi thọ được quản lý riêng tại màn hình [Nhập vật tư tiêu hao], [Xuất vật tư tiêu hao], [Tình trạng tuổi thọ].

## Cấu trúc màn hình
- **Tiêu đề trên cùng**: Tiêu đề màn hình và nút làm mới
- **Lưới chính**: Danh sách vật tư tiêu hao. Mỗi hàng hiển thị các nút hành động phù hợp với trạng thái.
- **Modal hành động**: Cửa sổ bật lên để thực hiện lắp đặt/tháo gỡ/chuyển sửa chữa/hoàn thành sửa chữa
- **Modal lịch sử**: Xem lịch sử lắp đặt/tháo gỡ của vật tư tiêu hao đã chọn dưới dạng bảng

## ① Cột lưới chính

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Quản lý** | Tập hợp các nút hành động theo hàng. Tùy theo trạng thái, các nút **Lắp đặt**, **Tháo gỡ**, **Chuyển sửa chữa**, **Hoàn thành sửa chữa**, **Lịch sử** sẽ xuất hiện. |
| **Trạng thái vận hành (operStatus)** | Vị trí/trạng thái hiện tại của vật tư tiêu hao. Là một trong `Kho` (WAREHOUSE) / `Lắp đặt` (MOUNTED) / `Sửa chữa` (REPAIR). |
| **Mã vật tư tiêu hao (consumableCode)** | Mã duy nhất để nhận diện vật tư tiêu hao. |
| **Tên vật tư tiêu hao (consumableName)** | Tên của vật tư tiêu hao. |
| **Phân loại (category)** | Loại vật tư tiêu hao. Là giá trị mã chung `CONSUMABLE_CATEGORY` như khuôn mẫu (MOLD), jig (JIG), dụng cụ (TOOL),... |
| **Thiết bị lắp đặt (mountedEquip)** | Mã thiết bị hiện đang lắp đặt vật tư tiêu hao. Nếu không ở trạng thái lắp đặt, hiển thị `-`. |
| **Trạng thái tuổi thọ (status)** | Trạng thái tuổi thọ của vật tư tiêu hao. Là một trong `NORMAL` (Bình thường) / `WARNING` (Cảnh báo) / `REPLACE` (Cần thay thế). |
| **Tuổi thọ (lifeProgress)** | Hiển thị tỷ lệ số lần sử dụng hiện tại so với tuổi thọ kỳ vọng dưới dạng biểu đồ thanh. Từ 80% trở lên tô màu vàng, từ 100% trở lên tô màu đỏ để nhấn mạnh. |
| **Vị trí lưu giữ (location)** | Địa điểm lưu giữ mặc định của vật tư tiêu hao. |

## ② Hành động khả dụng theo trạng thái

| Trạng thái hiện tại | Hành động khả dụng | Mô tả |
|------|------|------|
| **Kho** (WAREHOUSE) | Lắp đặt, Chuyển sửa chữa | Chọn thiết bị để lắp đặt hoặc chuyển sang trạng thái sửa chữa. |
| **Lắp đặt** (MOUNTED) | Tháo gỡ, Chuyển sửa chữa | Tháo gỡ khỏi thiết bị đang lắp đặt, hoặc tự động tháo gỡ rồi chuyển sang trạng thái sửa chữa. |
| **Sửa chữa** (REPAIR) | Hoàn thành sửa chữa | Đưa vật tư tiêu hao đã sửa chữa xong trở lại trạng thái kho. |

## ③ Mục nhập modal hành động

| Mục | Mô tả |
|------|------|
| **Thiết bị đích** | Bắt buộc khi lắp đặt. Chọn thiết bị cần lắp đặt từ thành phần chọn thiết bị. |
| **Ghi chú** | Tùy chọn. Ghi lý do lắp đặt/tháo gỡ/sửa chữa,... Tối đa 500 ký tự. |

## Thứ tự sử dụng
1. Tìm vật tư tiêu hao cần thao tác bằng ô tìm kiếm trên cùng hoặc bộ lọc **Phân loại/Trạng thái vận hành**.
2. Nhấp nút hành động phù hợp với trạng thái của hàng.
   - Lắp đặt: Nút `Lắp đặt` → Chọn thiết bị đích → Lưu
   - Tháo gỡ: Nút `Tháo gỡ` → Nhập ghi chú (tùy chọn) → Lưu
   - Sửa chữa: Nút `Chuyển sửa chữa` → Nhập ghi chú (tùy chọn) → Lưu
   - Hoàn thành sửa chữa: Nút `Hoàn thành sửa chữa` → Lưu
3. Sau khi thay đổi, danh sách sẽ tự động làm mới.
4. Để xem lịch sử quá khứ của một vật tư tiêu hao cụ thể, nhấp nút `Lịch sử`.

## Quy tắc nhập / Kiểm tra
- **Lắp đặt** bắt buộc phải chọn thiết bị đích. Nếu chưa chọn, nút Lưu sẽ bị vô hiệu hóa.
- Vật tư tiêu hao đã lắp đặt không thể lắp đặt lại.
- Vật tư tiêu hao không ở trạng thái lắp đặt không thể tháo gỡ.
- Vật tư tiêu hao không ở trạng thái sửa chữa không thể xử lý hoàn thành sửa chữa.
- Khi chuyển sửa chữa, nếu đang lắp đặt thì hệ thống sẽ tự động ghi nhận thao tác tháo gỡ trước, sau đó mới chuyển sang trạng thái sửa chữa.

## Câu hỏi thường gặp
- **Hỏi.** Nút Lắp đặt không hiển thị.
  **Đáp.** Nút Lắp đặt chỉ hiển thị cho vật tư tiêu hao có trạng thái vận hành là `Kho` (WAREHOUSE). Vui lòng kiểm tra bộ lọc.
- **Hỏi.** Sau khi chuyển sửa chữa, làm thế nào để đưa trở lại kho?
  **Đáp.** Nhấn nút `Hoàn thành sửa chữa`. Khi đó trạng thái vận hành sẽ trở lại `Kho` (WAREHOUSE).
- **Hỏi.** Đã tháo gỡ khỏi thiết bị nhưng thông báo tuổi thọ đã vượt quá hiện ra.
  **Đáp.** Việc tháo gỡ vẫn có thể thực hiện được. Vui lòng kiểm tra tuổi thọ kỳ vọng và ngưỡng cảnh báo trong [Vật tư tiêu hao - Master] và thay thế hoặc đặt lại nếu cần.
- **Hỏi.** Không thấy người thực hiện trong lịch sử.
  **Đáp.** Màn hình hiện tại không có ô nhập người thực hiện; khi gọi API, thông tin người dùng đăng nhập sẽ được ghi lại. Nếu cần, vui lòng kiểm tra logic phía backend.

## Màn hình liên quan
- [Vật tư tiêu hao - Master](/consumables/master) — Đăng ký thông tin cơ bản vật tư tiêu hao
- [Nhập vật tư tiêu hao](/consumables/receiving) — Nhập kho/trả lại vật tư tiêu hao
- [Xuất vật tư tiêu hao](/consumables/issuing) — Xuất kho vật tư tiêu hao
- [Tình trạng tuổi thọ](/consumables/life) — Tra cứu tình trạng tuổi thọ vật tư tiêu hao
