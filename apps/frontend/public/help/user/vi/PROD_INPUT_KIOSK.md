---
menuCode: PROD_INPUT_KIOSK
audience: user
title: Nhập Sản lượng (Kiosk)
summary: Màn hình kiosk sản lượng sản xuất tại máy tính bảng/PC cạnh thiết bị hiện trường, xử lý chọn lệnh sản xuất, đầu vào vật tư, nhập số lượng sản xuất/lỗi, kiểm tra tự động trên một màn hình
tags: [sản xuất, nhập sản lượng, kiosk, hiện trường]
keywords: [sản lượng sản xuất, kiosk, lệnh sản xuất, thiết bị, công nhân, số lượng tốt, số lượng lỗi, đầu vào vật tư, vật tư tiêu hao, kiểm tra tự động, đầu ca, giữa ca, cuối ca, hướng dẫn công việc, interlock, kiểm tra chuẩn bị]
related: [MST_PART, MST_BOM]
---

# Nhập Sản lượng (Kiosk)

## Mục đích màn hình
Màn hình tích hợp cho công nhân nhập trực tiếp sản lượng sản xuất tại **máy tính bảng/PC** cạnh thiết bị hiện trường. Xử lý từ chọn lệnh sản xuất, đầu vào vật tư, xem hướng dẫn công việc, nhập số lượng sản xuất/lỗi, kiểm tra tự động trên cùng một màn hình. (Sử dụng ở chế độ toàn màn hình - chromeless)

## Bố cục màn hình
```
┌──────────────────────────────────────────────────────────┐
│ Tiêu đề trên 2 dòng: ①ID thiết bị·mã vạch·kiểm tra thiết bị hằng ngày  ②Lệnh sản xuất·công nhân·sản lượng·kiểm tra thiết bị công nhân │
├───────────────┬──────────────────────────┬───────────────┤
│ Trái: Vật tư  │ Giữa: Hướng dẫn công việc │ Phải: Điều kiện│
│   BOM + Vật tư│   3 ô dưới:               │   tốt + Lịch  │
│   tiêu hao    │   Kiểm tra tự động | Lỗi | Nhập sản lượng │   sử công việc│
│   thiết bị    │                           │               │
└───────────────┴──────────────────────────┴───────────────┘
```

## ① Tiêu đề phía trên (Chọn · Kiểm tra)
| Mục | Vai trò / Ý nghĩa |
|------|------|
| **ID thiết bị/Mã vạch** | Chọn thiết bị để làm việc. Lệnh sản xuất, công đoạn, vật tư được kết nối dựa trên thiết bị. |
| **Kiểm tra thiết bị hằng ngày** | Phải hoàn thành kiểm tra thường ngày thiết bị mới có thể tiến hành công việc (kiểm tra chuẩn bị = interlock). |
| **Lệnh sản xuất** | Chọn lệnh sản xuất (đối tượng sản xuất, số lượng) sẽ thực hiện trên thiết bị này. |
| **Công nhân** | Chọn công nhân để đăng ký sản lượng (có thể nhiều người). |
| **Kiểm tra thiết bị công nhân** | Kiểm tra thiết bị do công nhân thực hiện (đối tượng interlock). |
| **Sản lượng (tiến độ)** | Hiển thị sản lượng/tiến độ đã đăng ký cho đến nay so với lệnh sản xuất. |

> **Interlock (Kiểm tra chuẩn bị)**: Phải hoàn thành các kiểm tra bắt buộc như Kiểm tra thiết bị hằng ngày, Kiểm tra thiết bị công nhân để mở khóa lưu sản lượng. Nếu chưa hoàn thành, tiến trình bị chặn.

## ② Bên trái — Đầu vào Vật tư
| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Danh sách vật tư BOM** | Danh sách vật tư đầu vào dựa trên BOM của lệnh sản xuất (sản phẩm) đã chọn. Kiểm tra số lượng đầu vào so với nhu cầu. |
| **Quét vật tư** | Quét sê-ri vật tư (matUid) cần đầu vào để xử lý đầu vào. |
| **Linh kiện thiết bị tiêu hao** | Vật tư tiêu hao lắp trên thiết bị (riêng với BOM sản phẩm). Quét đầu vào ở phần dưới. |

## ③ Giữa — Hướng dẫn Công việc + Sản lượng/Kiểm tra
| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Hướng dẫn công việc** | Hiển thị hướng dẫn công việc theo mặt hàng và công đoạn (hình ảnh/PDF/tài liệu). Click để phóng to. |
| **Nhập sản lượng** | Nhập **số lượng tốt (goodQty)** · **số lượng lỗi (defectQty)** · (nếu cần, sê-ri sản xuất) để lưu sản lượng. |
| **Lỗi** | Nhập chi tiết lỗi **theo cấp độ (nghiêm trọng/lớn/nhẹ)**. Tổng lỗi nhập được lưu cùng với số lượng lỗi của sản lượng. |
| **Kiểm tra tự động** | Kiểm tra self của công nhân (tham khảo luồng bên dưới). |

## ④ Bên phải — Điều kiện Tốt · Lịch sử Công việc
| Mục | Vai trò / Ý nghĩa |
|------|------|
| **Điều kiện tốt** | Hướng dẫn tiêu chuẩn được công nhận là tốt. |
| **Lịch sử công việc** | Lịch sử sản lượng đã đăng ký trong công việc này. |

## Luồng Kiểm tra Tự động (Đầu ca, Giữa ca, Cuối ca)
| Thời điểm | Kích hoạt | Ý nghĩa |
|------|------|------|
| **Đầu ca (FIRST)** | **Tự động mở** ngay sau khi lưu sản lượng đầu tiên | Xác nhận chất lượng ban đầu sản xuất |
| **Giữa ca (MID)** | Click nút bảng hoặc **chặn ở 60% tiến độ** | Xác nhận chất lượng giữa tiến trình |
| **Cuối ca (LAST)** | Click nút bảng | Xác nhận khi kết thúc sản xuất |

## Trình tự thực hiện
1. **Chọn thiết bị** → Hoàn thành kiểm tra thiết bị hằng ngày.
2. **Chọn lệnh sản xuất·công nhân** → Hoàn thành kiểm tra thiết bị công nhân (giải phóng interlock).
3. **Quét đầu vào vật tư/vật tư tiêu hao** ở bên trái.
4. Làm việc trong khi xem hướng dẫn công việc ở giữa.
5. **Nhập số lượng tốt·số lượng lỗi và lưu** (nhập chi tiết lỗi theo cấp độ).
6. Thực hiện **Kiểm tra tự động** (đầu ca/giữa ca/cuối ca) theo thời điểm.

## Câu hỏi thường gặp
- **H.** Nút lưu sản lượng không nhấn được.
  **Đ.** Có thể kiểm tra chuẩn bị (kiểm tra thiết bị/công nhân) chưa hoàn thành hoặc chưa chọn lệnh sản xuất/công nhân. Kiểm tra trạng thái interlock.
- **H.** Không thể tiến hành thêm vì chưa làm kiểm tra giữa ca.
  **Đ.** Kiểm tra tự động giữa ca chặn ở 60% tiến độ. Thực hiện kiểm tra tự động để giải phóng.
- **H.** Tôi đã nhập trực tiếp số lượng lỗi, có trùng lặp với nhập chi tiết theo cấp độ không?
  **Đ.** Nếu có tổng lỗi chi tiết theo cấp độ, giá trị đó được ưu tiên áp dụng (không bị tính hai lần).

## Màn hình liên quan
- [Master Mặt hàng](/master/part) · [Quản lý BOM](/master/bom) — Tiêu chuẩn cấu hình sản phẩm và vật tư
