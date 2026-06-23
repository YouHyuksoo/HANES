---
menuCode: SHIP_PALLET
audience: operator
title: 托盘装载 — 操作指南
summary: 出库托盘管理 — 托盘创建·箱子分配/移除·CLOSE/REOPEN·标签打印·仅OQC PASS箱子可装载
tags: [出库, 托盘, 装载, 箱子, 标签]
keywords: [PALLET_MASTERS, BOX_MASTERS, SHIPMENT_ORDERS, OPEN, CLOSED, LOADED, SHIPPED, PALLET_STATUS, OQC_STATUS, 托盘, 托盘装载, 箱子分配, 标签打印]
related: [SHIP_PACK, SHIP_ORDER]
---

# 托盘装载 — 操作指南

## 系统目的·角色
创建出库托盘并分配箱子。将CLOSED+OQC PASS的箱子装入CONFIRMED出货指示的托盘。CLOSE后打印托盘标签并等待出库。

```
CONFIRMED出货指示 → 创建托盘(OPEN) → 分配箱子 → CLOSE → 打印标签 → LOADED → SHIPPED
```

## 状态流程 (托盘)
```
OPEN → CLOSED(标签已打印) → LOADED(已分配装运) → SHIPPED(已出库)
CLOSED → OPEN (可重新打开)
```

## 数据结构
```
PALLET_MASTERS (PK: PALLET_NO)
   ├─ SHIP_ORDER_NO → SHIPMENT_ORDERS
   ├─ BOX_COUNT / TOTAL_QTY (自动计算)
   ├─ STATUS: OPEN → CLOSED → LOADED → SHIPPED
   └─ CLOSE_TIME / SHIPPED_TIME / SHIPMENT_ID

BOX_MASTERS (PK: BOX_NO + COMPANY + PLANT_CD)
   ├─ ITEM_CODE → ITEM_MASTERS
   ├─ PALLET_NO → PALLET_MASTERS
   ├─ STATUS: OPEN → CLOSED → SHIPPED
   └─ OQC_STATUS: PENDING / PASS / FAIL
```

## 界面构成

### 上方
- **头部**: 标题 + 刷新·创建托盘按钮
- **左侧(2/3)**: DataGrid — 托盘列表
  - 列: 操作·出库指示编号·托盘编号·箱子数·总数量·状态·出库编号·创建时间
  - 操作: 分配箱子(OPEN)·CLOSE(OPEN)·重新打开(CLOSED)·打印标签(CLOSED+)
  - 搜索: 托盘编号, 条码扫描输入, 状态筛选
  - 状态头部 `HelpCircle` → 状态转换说明工具提示
- **右侧(1/3)**: 所选托盘详细
  - 托盘概要信息
  - 已分配箱子列表 (OPEN时可移除)
  - 箱子信息: 箱子编号·物料代码·数量·OQC状态

### 创建弹窗
- 扫描/选择CONFIRMED出货指示 → 创建托盘
- 仅可选择CONFIRMED状态的出货指示

### 分配箱子弹窗
- `+`按钮或箱子编号扫描
- 可分配箱子: `CLOSED` + `unassigned=true` + `oqcStatus=PASS`
- OQC FAIL的箱子不可分配

### 标签弹窗 (PalletLabelModal)
- Code128条码 (bwip-js)
- 箱子数·总数量·状态·物料名
- 可选择模板 (master/label-templates)
- 支持自动打印模式
- 纸张: 100mm × 120mm

## 作业流程

### ① 创建托盘
`POST /shipping/orders/{shipOrderNo}/pallets`
- 选择CONFIRMED出货指示 (扫描或列表选择)
- 每个出货指示仅可创建1个托盘

### ② 分配箱子
`POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes`
- 扫描箱子或从列表选择
- 支持多选
- 仅限OQC PASS + CLOSED + 未分配箱子

### ③ 关闭托盘
`POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/close`
- OPEN → CLOSED转换
- CLOSE后可打印标签

### ④ 重新打开托盘
`POST /shipping/pallets/{palletNo}/reopen`
- CLOSED → OPEN转换
- 用于重新分配/移除

### ⑤ 打印标签
- CLOSED+状态打开标签弹窗
- bwip-js Code128条码
- 可选择模板·打印

## 箱子分配条件

| 条件 | 说明 |
|------|------|
| BOX_MASTERS.STATUS = CLOSED | 箱子已包装完成 |
| OQC_STATUS = PASS | OQC检查合格 |
| PALLET_NO = NULL | 未分配到其他托盘 |
| 同一出货指示范围 | 仅匹配该指示的物料 |

## 互锁

| 条件 | 说明 |
|------|------|
| OQC FAIL箱子 | 不可分配 |
| 已分配箱子 | 不可重复分配 |
| 非CONFIRMED出货指示 | 不可创建托盘 |
| SHIPPED/LOADED托盘 | 不可关闭/重新打开 |
| 每指示1托盘 | 创建限制 |

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 无法创建托盘 | 出货指示未CONFIRMED | 先确认出货指示 |
| 无法分配箱子 | OQC未PASS | 完成外观检查 |
| 箱子搜索不到 | 已分配 | 确认未分配箱子 |
| CLOSE按钮禁用 | 箱子0个 | 先分配箱子 |
| 标签不打印 | 打印机设置 | 确认浏览器打印设置 |

## 数据·关联
- 表: `PALLET_MASTERS`, `BOX_MASTERS`, `SHIPMENT_ORDERS`, `SHIPMENT_ORDER_ITEMS`
- 关联: 出货指示(`/shipping/order`) → 产品包装(`/shipping/pack`) → **托盘装载(当前)** → 出库
- OQC条件: 需外观检查(`/quality/inspect`) PASS
- 标签: bwip-js Code128, `master/label-templates`设计系统
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
