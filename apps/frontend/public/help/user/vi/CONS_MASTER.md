---
menuCode: CONS_MASTER
audience: user
title: Master Vật tư Tiêu hao
summary: Màn hình đăng ký và quản lý thông tin nhận dạng, phân loại, tuổi thọ dự kiến, tồn kho an toàn, đơn giá, vị trí lưu trữ và ánh xạ nơi sử dụng sản phẩm/thiết bị của vật tư tiêu hao như khuôn, jig, dụng cụ
tags: [vật tư tiêu hao, master, thông tin cơ bản]
keywords: [vật tư tiêu hao, master vật tư tiêu hao, mã vật tư tiêu hao, khuôn, jig, dụng cụ, MOLD, JIG, TOOL, tuổi thọ dự kiến, số lần sử dụng, ngưỡng cảnh báo, tồn kho an toàn, đơn giá, vị trí lưu trữ, khách hàng, ánh xạ nơi sử dụng, linh kiện thiết bị, BOM sản phẩm, lượng sử dụng trên đơn vị, sử dụng hay không]
related: [MST_PART]
---

# Master Vật tư Tiêu hao

## Mục đích màn hình
Đăng ký và quản lý **thông tin cơ bản của vật tư tiêu hao (khuôn, jig, dụng cụ, v.v.)** dùng trong sản xuất. Vật tư tiêu hao được đăng ký tại đây là cơ sở cho nhập/xuất kho, quản lý tồn kho và tuổi thọ (số lần sử dụng), đầu vào vật tư tiêu hao cho sản lượng sản xuất tại kiosk, và ánh xạ nơi sử dụng (sản phẩm, thiết bị).

> Vật tư tiêu hao là những vật liệu bị mòn hoặc hết tuổi thọ khi sử dụng. Màn hình này định nghĩa **cái gì (mã, tên, phân loại), có thể dùng bao lâu (tuổi thọ dự kiến, ngưỡng cảnh báo), để ở đâu với số lượng bao nhiêu (tồn kho an toàn, vị trí lưu trữ), dùng ở đâu (ánh xạ nơi sử dụng)** tại một nơi.

## Bố cục màn hình
- **Bên trái (danh sách)**: Grid vật tư tiêu hao. Tìm kiếm **tên/mã vật tư**, **lọc phân loại**, **làm mới**, **đăng ký vật tư tiêu hao** ở phía trên.
- **Ở giữa (bảng trượt)**: Form đăng ký/sửa mở ra khi click ✏️(sửa) hoặc "Đăng ký vật tư tiêu hao".
- **Bên phải (bảng ánh xạ sử dụng)**: Chọn hàng trong danh sách để đăng ký, sửa, xóa **ánh xạ sử dụng sản phẩm/thiết bị** thường xuyên.

## Hai cách sử dụng Vật tư Tiêu hao
Cùng một master vật tư tiêu hao nhưng được dùng theo hai hướng tại hiện trường.
- **Dùng để lắp trên thiết bị (khuôn, jig, lưỡi cắt, v.v.)**: Lắp vào thiết bị, tích lũy số lần sử dụng và thay thế khi đạt tuổi thọ dự kiến. Thuộc đối tượng quản lý "Linh kiện thiết bị tiêu hao" của kiosk.
- **Dùng để đầu vào BOM sản phẩm**: Linh kiện tiêu hao được đầu vào cùng khi sản xuất sản phẩm. Được bao gồm trong BOM của sản phẩm và giảm trừ theo số lượng sản xuất.

> Sản phẩm/thiết bị nào sử dụng vật tư tiêu hao nào được định nghĩa bởi **ánh xạ sử dụng** ở bên phải.

---

## ① Thông tin cơ bản

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Mã vật tư tiêu hao(consumableCode)** | **Mã duy nhất** để nhận dạng vật tư tiêu hao. Ví dụ: `CM-AP-110`. Nhập/xuất kho, tồn kho, ánh xạ sử dụng được kết nối qua mã này, do đó không thay đổi sau khi đăng ký (bị khóa ở chế độ sửa). |
| **Tên vật tư tiêu hao(consumableName)** | Tên để nhận dạng tại hiện trường. Ví dụ: `Khuôn ép đầu nối 110`. |
| **Phân loại(category)** | Loại vật tư tiêu hao. Chọn từ khuôn(MOLD) / jig(JIG) / dụng cụ(TOOL) (mã chung CONSUMABLE_CATEGORY). Là tiêu chí cho bộ lọc danh sách và thống kê. |
| **Hình ảnh(imageUrl)** | Ảnh vật tư tiêu hao. **Chỉ có thể tải lên sau khi lưu (đăng ký)** và hiển thị dưới dạng hình thu nhỏ trong danh sách. |

## ② Tuổi thọ / Quản lý

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Tuổi thọ dự kiến(expectedLife)** | **Số lần sử dụng tích lũy** mà vật tư tiêu hao này có thể dùng mà không cần thay thế. Ví dụ: `100000`. Khi số lần sử dụng tích lũy đạt giá trị này, trạng thái chuyển thành **Cần thay thế (REPLACE)**. |
| **Ngưỡng cảnh báo(warningCount)** | Số lần sử dụng để cảnh báo trước khi cần thay thế. Ví dụ: `80000`. Khi số lần sử dụng tích lũy đạt giá trị này, trạng thái chuyển thành **Cảnh báo (WARNING)** để chuẩn bị thay thế. Thường đặt nhỏ hơn tuổi thọ dự kiến. |
| **Tồn kho an toàn(safetyStock)** | Số lượng tiêu chuẩn dùng để đánh giá thiếu tồn kho. Nếu tồn kho dưới giá trị này được coi là thiếu. |

> Số lần sử dụng tích lũy (số lần sử dụng hiện tại) được tự động tích lũy/đặt lại tại kiosk sản xuất, thay thế, v.v. Màn hình này chỉ định nghĩa **giá trị tiêu chuẩn (tuổi thọ dự kiến, ngưỡng cảnh báo)**.

## ③ Khách hàng / Vị trí

| Cột | Vai trò / Ý nghĩa |
|------|------|
| **Vị trí lưu trữ(location)** | Nơi lưu trữ mặc định của vật tư tiêu hao. Ví dụ: `Phòng khuôn-A1`. |
| **Khách hàng(vendor)** | Khách hàng/nhà sản xuất cung cấp vật tư tiêu hao. Ví dụ: `JST`. |
| **Đơn giá(unitPrice)** | Đơn giá của 1 vật tư tiêu hao. Dùng tham khảo cho đơn giá nhập kho và định giá tài sản. |

---

## Ánh xạ nơi sử dụng (Bảng bên phải)
Đăng ký vật tư tiêu hao đã chọn được sử dụng ở **sản phẩm (model) nào, thiết bị nào**. Là tiêu chí để tìm vật tư tiêu hao phù hợp với lệnh sản xuất (sản phẩm, thiết bị) trong sản lượng sản xuất tại kiosk.

| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Sản phẩm/Model(productItemCode)** | Sản phẩm/model sử dụng vật tư tiêu hao này. Chỉ có thể chọn mặt hàng thành phẩm hoặc bán thành phẩm. |
| **Thiết bị(equipCode)** | Thiết bị sử dụng vật tư tiêu hao này khi sản xuất sản phẩm đó. |
| **Lượng sử dụng trên đơn vị(usagePerUnit)** | **Số lần sử dụng tiêu hao trên mỗi đơn vị sản xuất**. Số lượng sản xuất × giá trị này sẽ tích lũy số lần sử dụng vật tư tiêu hao. Mặc định là 1. |
| **Sử dụng hay không(useYn)** | Chỉ là ánh xạ hoạt động khi `Y`. Nếu `N`, giữ ánh xạ nhưng loại khỏi sử dụng (chuyển đổi bằng cách click badge `Y` trong danh sách). |
| **Ghi chú(remark)** | Ghi chú quản lý ánh xạ. |

> Ánh xạ sử dụng là 1 giao dịch với tổ hợp **Sản phẩm + Thiết bị + Vật tư tiêu hao**. Có thể ánh xạ cùng một vật tư tiêu hao cho nhiều sản phẩm, thiết bị.

## Trình tự thực hiện
1. Click **Đăng ký vật tư tiêu hao** (hoặc ✏️ trên hàng) ở phía trên để mở form trượt.
2. Nhập **Thông tin cơ bản** (mã, tên, phân loại) và lưu.
3. Sau khi lưu, mở lại form để tải lên **hình ảnh** (không thể tải lên ngay sau khi đăng ký).
4. Điền **Tuổi thọ/Quản lý** (tuổi thọ dự kiến, ngưỡng cảnh báo, tồn kho an toàn), **Khách hàng/Vị trí** (vị trí lưu trữ, khách hàng, đơn giá).
5. Chọn hàng vật tư tiêu hao trong danh sách, đăng ký **Ánh xạ sử dụng** bên phải với sản phẩm, thiết bị, lượng sử dụng trên đơn vị.

## Quy tắc nhập / Kiểm tra
- **Mã vật tư tiêu hao** và **Tên vật tư tiêu hao** là bắt buộc. Nếu để trống, nút lưu bị vô hiệu.
- Mã vật tư tiêu hao không được trùng lặp (từ chối lưu nếu đã tồn tại).
- Hình ảnh **chỉ có thể đăng ký sau khi lưu** (jpg/png/gif/webp, dưới 5MB).
- Ánh xạ sử dụng phải **chọn cả Sản phẩm và Thiết bị** để lưu.

## Câu hỏi thường gặp
- **H.** Tôi đã nhập sai mã và không thể sửa ở chế độ sửa.
  **Đ.** Mã vật tư tiêu hao là khóa kết nối nhập/xuất kho, tồn kho, ánh xạ nên không thể thay đổi. Hãy xóa và đăng ký lại.
- **H.** Khi đăng ký, ô tải ảnh bị mờ.
  **Đ.** Tải ảnh sau khi lưu. Trước tiên lưu thông tin cơ bản, sau đó mở lại để tải lên.
- **H.** Tuổi thọ dự kiến và ngưỡng cảnh báo khác nhau thế nào?
  **Đ.** Khi đạt ngưỡng cảnh báo, trạng thái chuyển thành **Cảnh báo (chuẩn bị thay thế)**; khi đạt tuổi thọ dự kiến, trạng thái chuyển thành **Cần thay thế**. Đó là thứ tự thông báo trước → thời điểm thay thế thực tế.
- **H.** Có vật tư tiêu hao không hiển thị trong danh sách.
  **Đ.** Danh sách chỉ hiển thị vật tư tiêu hao đang sử dụng (`useYn=Y`). Hãy kiểm tra bộ lọc phân loại và từ khóa tìm kiếm.

## Màn hình liên quan
- [Master Mặt hàng](/master/part) — Đăng ký mặt hàng sản phẩm/model để kết nối với ánh xạ sử dụng
