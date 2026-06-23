---
menuCode: INV_MAT_PHYSICAL_INV
audience: operator
title: 物料库存盘点管理 — 操作指南
summary: PHYSICAL_INV_SESSIONS + COUNT_DETAILS全部列、盘点流程(会话→扫描→反映)、库存冻结机制
tags: [库存, 盘点, 操作, 会话, 冻结]
keywords: [PHYSICAL_INV_SESSIONS, PHYSICAL_INV_COUNT_DETAILS, 库存盘点, IN_PROGRESS, InventoryFreezeGuard, PDA扫描, 会话开始, 会话结束, 盘点反映, MAT_STOCKS]
related: [INV_MAT_PHYSICAL_INV_APPLY, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# 物料库存盘点管理 — 操作指南

## 系统目的·作用
为查找实际仓库库存与系统库存的差异，管理**库存盘点(Physical Inventory)**会话。开始盘点会话后，该仓库的库存事务将被阻止(`InventoryFreezeGuard`)，PDA可扫描各物料的盘点数量。会话完成后将盘点结果反映到库存。

## 数据结构
```
PHYSICAL_INV_SESSIONS (PK: SESSION_DATE + SEQ)
    │
    ├── STATUS: IN_PROGRESS → COMPLETED
    ├── INV_TYPE: MATERIAL / PRODUCT
    │
    └──▶ PHYSICAL_INV_COUNT_DETAILS (PK: SESSION_DATE + SEQ + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
            │
            ├── SYSTEM_QTY (开始时点快照)
            ├── COUNTED_QTY (PDA累积扫描)
            └──▶ 反映时 → MAT_STOCKS更新 + STOCK_TRANSACTIONS + INV_ADJ_LOGS
```

---

## ① 盘点会话 — PHYSICAL_INV_SESSIONS (全部列)

| 画面项目 | DB列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 会话日期 | `SESSION_DATE` | **PK (1/2)**。会话创建日期。自动生成(`SYSDATE`)。 |
| 序列号 | `SEQ` | **PK (2/2)**。序列编号。 |
| 盘点类型 | `INV_TYPE` | `MATERIAL`(物料) / `PRODUCT`(产品)。 |
| 状态 | `STATUS` | `IN_PROGRESS`(进行中) / `COMPLETED`(已完成) / `CANCELLED`(已取消)。 |
| 基准年月 | `COUNT_MONTH` | 盘点目标月份。`YYYY-MM`格式。 |
| 仓库代码 | `WAREHOUSE_CODE` | 盘点目标仓库(NULL=全部)。 |
| 公司 | `COMPANY` | 多租户。 |
| 工厂 | `PLANT_CD` | 多租户。 |
| 开始人 | `STARTED_BY` | 会话开始用户。 |
| 完成人 | `COMPLETED_BY` | 会话完成用户。 |
| 完成时间 | `COMPLETED_AT` | 会话完成时间。 |
| 备注 | `REMARK` | 备注。 |
| 创建时间 | `CREATED_AT` | 记录创建时间。 |
| 修改时间 | `UPDATED_AT` | 记录修改时间。 |

---

## ② 盘点明细 — PHYSICAL_INV_COUNT_DETAILS (全部列)

| 画面项目 | DB列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 会话日期 | `SESSION_DATE` | **PK (1/5)**。引用上级会话。 |
| 会话SEQ | `SEQ` | **PK (2/5)**。引用上级会话。 |
| 仓库代码 | `WAREHOUSE_CODE` | **PK (3/5)**。 |
| 物料代码 | `ITEM_CODE` | **PK (4/5)**。 |
| 物料序列号 | `MAT_UID` | **PK (5/5)**。LOT序列号。 |
| 库位代码 | `LOCATION_CODE` | PDA扫描时的库位。 |
| 系统数量 | `SYSTEM_QTY` | 会话开始时点的系统库存数量快照。 |
| 盘点数量 | `COUNTED_QTY` | PDA累积扫描的盘点数量。 |
| 扫描用户 | `COUNTED_BY` | 最后扫描用户。 |
| 实际库位 | `ACTUAL_LOCATION` | 确认的实际存放位置(用于调整)。 |
| 备注 | `REMARK` | 备注。 |
| 创建时间 | `CREATED_AT` | |
| 修改时间 | `UPDATED_AT` | |

---

## 库存冻结(Freeze)机制

盘点会话为`IN_PROGRESS`状态期间，应用`InventoryFreezeGuard`阻止以下事务:

| 阻止对象 | 详情 |
|----------|------|
| 物料入库 | `POST /material/receiving` |
| 物料出库 | `POST /material/issue` |
| 库存调整 | `POST /material/adjustment` |
| LOT分割/合并 | 相关API |
| 库存移动 | 相关API |

> 冻结通过检查`PHYSICAL_INV_SESSIONS`中是否存在`IN_PROGRESS`行来实现。会话完成或取消时自动解除。

---

## 盘点完整流程

```
1. [PC] 会话开始 → POST /material/physical-inv/session/start
    → PHYSICAL_INV_SESSIONS INSERT (IN_PROGRESS)
    → 开始阻止库存事务

2. [PDA] 现场扫描 → POST /material/physical-inv/count
    → PHYSICAL_INV_COUNT_DETAILS UPSERT (countedQty累积 +1)
    → 重复扫描累积盘点数量

3. [PC] 会话结束 → POST /material/physical-inv/session/:date/:seq/complete
    → PHYSICAL_INV_SESSIONS UPDATE (COMPLETED)
    → 解除库存事务阻止

4. [PC] 盘点反映 → POST /material/physical-inv
    → 更新 MAT_STOCKS.qty
    → STOCK_TRANSACTIONS (PHYSCOUNT_IN/OUT)
    → INV_ADJ_LOGS (PHYSICAL_COUNT)
```

---

## 权限
具有库存盘点管理权限的用户(物料/质量管理员)。PDA扫描为现场作业人员。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| "已存在进行中的会话"错误 | 已存在同一IN_PROGRESS会话 | 完成现有会话后重新开始 |
| 入库/出库/调整被阻止(403) | 盘点会话为IN_PROGRESS状态 | 结束或取消盘点 |
| PDA无法扫描 | 无激活会话或会话中未包含该仓库 | 确认会话已开始及仓库一致 |
| 盘点数量显示为0 | PDA尚未扫描或UPSERT失败 | 确认PDA连接状态后重新扫描 |
| 差异列未计算 | `countedQty`为NULL | PDA扫描完成后刷新 |

## 数据·关联
- **表**: `PHYSICAL_INV_SESSIONS`, `PHYSICAL_INV_COUNT_DETAILS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `INV_ADJ_LOGS`
- **关联**: PDA对接(POST /count), 盘点反映(Apply)页面, 库存冻结(InventoryFreezeGuard)
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
