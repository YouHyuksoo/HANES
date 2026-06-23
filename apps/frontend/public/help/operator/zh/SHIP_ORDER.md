---
menuCode: SHIP_ORDER
audience: operator
title: 出货指示 — 操作指南
summary: 出货指示CRUD — 客户·PO号·出货日指定, 品目添加/数量设定, DRAFT→CONFIRMED确认, QR码打印
tags: [出货, 出货指示, 装运, CRUD]
keywords: [SHIPMENT_ORDERS, SHIPMENT_ORDER_ITEMS, DRAFT, CONFIRMED, SHIPPED, CLOSED, SHIP_ORDER_STATUS, CUSTOMER, 出货指示, 出货, 装运, 客户]
related: [SHIP_PACK, SHIP_PALLET]
---

# 出货指示 — 操作指南

## 系统目的·角色
注册·管理向客户出货的品目和数量的**出货指示(Ship Order)**。在DRAFT状态下编写·修改后确认为CONFIRMED，之后可进行箱子出货·托盘装载作业。

```
DRAFT → CONFIRMED → SHIPPING → SHIPPED → CLOSED
```

## 数据结构
```
SHIPMENT_ORDERS (PK: SHIP_ORDER_NO, 自动编号)
   ├─ CUSTOMER_ID → PARTNER_MASTERS (客户)
   ├─ CUSTOMER_PO_NO (客户PO号)
   ├─ DUE_DATE / SHIP_DATE
   └─ STATUS: DRAFT → CONFIRMED → SHIPPING → SHIPPED → CLOSED

SHIPMENT_ORDER_ITEMS (PK: SHIP_ORDER_ID + SEQ)
   ├─ ITEM_CODE → ITEM_MASTERS (成品 FINISHED)
   ├─ ORDER_QTY / SHIPPED_QTY
   └─ REMARK
```

## 界面构成

### 主要区域
- **头部**: 标题 + 刷新·注册按钮
- **DataGrid**: `GET /shipping/orders?limit=5000`
  - 列: 操作·出货指示编号·客户·PO号·交货期·出货日·品目数·总数量·状态
  - 操作: 打印·确认(DRAFT)·修改(DRAFT)·删除(DRAFT)
  - 状态头部 `HelpCircle` → 状态说明工具提示
  - 搜索: 出货指示编号, 状态筛选

### 右侧面板 (480px)
| 项目 | 说明 |
|------|------|
| 出货指示编号 | 自动生成 (修改时显示) |
| 客户 | `CUSTOMER`类型伙伴选择 |
| 客户PO号 | 手动输入 (最多100字) |
| 交货期 / 出货日 | date picker (出货日必须) |
| 备注 | 自由文本 |
| 品目列表 | `+`按钮 → `PartSearchModal`(成品) |
| 品目卡片 | 代码·名·单位, 数量(`QtyInput`), 备注, 删除 |
| 合计 | 品目数, 总数量 |

### 打印区域 (A4 出货指示书)
- `Printer`图标 → A4纵向格式
- 二维码(出货指示编号), 客户信息, 品目表格
- 通过`@media print` CSS在画面隐藏

## 作业流程

### ① 创建 (POST /shipping/orders)
- 在右侧面板输入客户·出货日·品目
- 不可重复添加品目 (按itemCode)
- 所有品目`orderQty > 0` + 出货日必须

### ② 修改 (PUT /shipping/orders/:id)
- **仅DRAFT状态**
- 可添加/删除品目, 更改数量

### ③ 确认 (PUT /shipping/orders/:id/confirm)
- DRAFT → CONFIRMED转换
- 确认后不可修改·删除
- 必须有至少1个品目

### ④ 删除 (DELETE /shipping/orders/:id)
- **仅DRAFT状态**

### ⑤ 打印
- 任何状态均可打印
- 含二维码的A4打印

## 状态代码 (SHIP_ORDER_STATUS)

| 代码 | 含义 | 可操作 |
|------|------|--------|
| DRAFT | 编写中 | 修改·删除·确认 |
| CONFIRMED | 已确认 | 箱子出货·托盘装载 |
| SHIPPING | 出货进行中 | 部分出货 |
| SHIPPED | 出货完成 | 仅查看 |
| CLOSED | 已关闭 | 仅查看 |

## 互锁

| 条件 | 说明 |
|------|------|
| 出货日未输入 | 保存按钮禁用 |
| 品目数量为0 | 保存按钮禁用 |
| CONFIRMED后 | 修改·删除禁用 |
| 确认时无品目 | 确认按钮禁用+工具提示 |

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 品目不可选 | PartSearchModal筛选 | 仅可选择成品 |
| 确认失败 | 无品目 | 添加至少1个品目 |
| 打印不工作 | 浏览器弹出窗口被阻止 | 允许弹出窗口 |
| 保存失败 | 缺少必填字段 | 确认出货日和品目数量 |

## 数据·关联
- 表: `SHIPMENT_ORDERS`, `SHIPMENT_ORDER_ITEMS`, `PARTNER_MASTERS`, `ITEM_MASTERS`
- 关联: 产品包装(`/shipping/pack`) → 托盘装载(`/shipping/pallet`) → 出货
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
