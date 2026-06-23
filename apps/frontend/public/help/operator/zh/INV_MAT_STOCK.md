---
menuCode: INV_MAT_STOCK
audience: operator
title: 物料库存现状查询 — 操作指南
summary: MAT_STOCKS表全部列、库存状态判定逻辑、LOT关联结构与故障排除
tags: [库存, 物料, 操作, 查询, 安全库存]
keywords: [MAT_STOCKS, MAT_LOTS, 库存查询, 安全库存, 可用库存, QTY, RESERVED_QTY, AVAILABLE_QTY, 按序列, SAFETY_STOCK, 有效期, ITEM_MASTERS]
related: [INV_TRANSACTION, INV_MAT_PHYSICAL_INV]
---

# 物料库存现状查询 — 操作指南

## 系统目的·作用
基于`MAT_STOCKS`表实时查询按仓库·物料的物料库存现状。同时显示与物料主数据(`ITEM_MASTERS`)的安全库存(`SAFETY_STOCK`)对比的库存是否不足、以及与LOT有效期(`MAT_LOTS.EXPIRE_DATE`)对比的过期状态，支持库存运营决策。

## 数据结构
```
MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
    │
    ├── QTY (总库存) = RESERVED_QTY (预留) + AVAILABLE_QTY (可用)
    │
    ├──▶ ITEM_MASTERS.ITEM_CODE — 物料名称(itemName), 单位(unit), 安全库存(safetyStock)
    │
    ├──▶ MAT_LOTS.MAT_UID — 生产日期(manufactureDate), 保质期(expireDate)
    │
    └──▶ WAREHOUSES.WAREHOUSE_CODE — 仓库名称(warehouseName)
```

---

## ① 库存 — MAT_STOCKS (全部列)

| 画面项目 | DB列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 公司 | `COMPANY` | **PK (1/5)**。多租户。`'40'`。 |
| 工厂 | `PLANT_CD` | **PK (2/5)**。多租户。`'1000'`。 |
| 仓库代码 | `WAREHOUSE_CODE` | **PK (3/5)**。库存保管仓库。 |
| 物料代码 | `ITEM_CODE` | **PK (4/5)**。库存物料。引用`ITEM_MASTERS.ITEM_CODE`。 |
| 物料序列号 | `MAT_UID` | **PK (5/5)**。LOT单位标识符。引用`MAT_LOTS.MAT_UID`。 |
| 库位 | `LOCATION_CODE` | 仓库内详细存放位置(可选)。 |
| 总数量 | `QTY` | 当前仓库中保管的库存总数量。 |
| 预留数量 | `RESERVED_QTY` | 因出库请求等预留的数量。 |
| 可用数量 | `AVAILABLE_QTY` | 即时可用数量(= QTY - RESERVED_QTY)。 |
| 最后盘点日 | `LAST_COUNT` | 最后进行盘点(Physical Count)的时间。 |
| 创建者 | `CREATED_BY` | 首次注册人。 |
| 修改者 | `UPDATED_BY` | 最后修改人。 |
| 创建时间 | `CREATED_AT` | 首次注册时间。 |
| 修改时间 | `UPDATED_AT` | 最后修改时间。 |

> **库存数量关系**: `QTY = RESERVED_QTY + AVAILABLE_QTY`。实际可出库的数量为`AVAILABLE_QTY`。

---

## 库存状态判定逻辑

比较物料主数据的`SAFETY_STOCK`(安全库存)基准与实际数量(`QTY`)，显示3级状态:

| 状态 | 条件 | 显示 |
|------|------|------|
| **不足(Shortage)** | `QTY < SAFETY_STOCK × 0.5` | 红色徽标 |
| **注意(Caution)** | `QTY < SAFETY_STOCK` | 黄色徽标 |
| **正常(Normal)** | `QTY ≥ SAFETY_STOCK` | 绿色徽标 |

## 有效期状态判定逻辑

比较LOT的`EXPIRE_DATE`与当前日期，显示3级有效期状态:

| 状态 | 条件 | 显示 |
|------|------|------|
| **已过期(Expired)** | `remainingDays ≤ 0` | 红色徽标 + 行背景红色 |
| **即将到期(Imminent)** | `remainingDays ≤ 10` | 黄色徽标 + 行背景黄色 |
| **正常(Normal)** | `remainingDays > 10` | 绿色徽标 |

---

## 操作流程
1. 定期查询库存现状，确认安全库存不足的物料和有效期过期的LOT。
2. 安全库存不足的物料考虑采购或从其他仓库调拨。
3. 有效期过期的LOT进行废弃或退货处理，即将到期的LOT制定优先使用计划。

## 权限
具有库存查询权限的所有用户(基础信息·生产·物料管理员)。仅查询专用(不可修改)。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 特定物料不在列表中 | 该仓库中无库存(`MAT_STOCKS`中无行) | 进行入库或调整处理 |
| 数量与实际不符 | 出入库遗漏或重复处理 | 确认出入库历史后进行调整 |
| 可用数量小于总数量 | 存在出库请求(LOT预留) | 确认预留状态后必要时取消预留 |
| 有效期过期LOT显示红色 | `remainingDays ≤ 0` | 废弃·退货或经质量批准后使用 |
| 安全库存不足显示不准确 | `SAFETY_STOCK`值未设置或不正确 | 在物料主数据中确认·修改安全库存基准 |

## 数据·关联
- **表**: `MAT_STOCKS` (库存), `MAT_LOTS` (LOT信息), `ITEM_MASTERS` (物料), `WAREHOUSES` (仓库)
- **关联**: 物料入库 → `MAT_STOCKS`增加, 物料出库 → `MAT_STOCKS`减少, 库存调整 → `MAT_STOCKS`增减
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
