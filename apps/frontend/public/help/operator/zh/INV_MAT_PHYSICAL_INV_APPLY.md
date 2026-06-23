---
menuCode: INV_MAT_PHYSICAL_INV_APPLY
audience: operator
title: 物料库存盘点反映 — 操作指南
summary: 盘点反映流程、库存更新结构、事务处理与故障排除
tags: [库存, 盘点, 反映, 操作, 数量]
keywords: [PHYSICAL_INV_COUNT_DETAILS, MAT_STOCKS, 盘点反映, applyCount, STOCK_TRANSACTIONS, INV_ADJ_LOGS, PHYSCOUNT_IN, PHYSCOUNT_OUT]
related: [INV_MAT_PHYSICAL_INV, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# 物料库存盘点反映 — 操作指南

## 系统目的·作用
库存盘点会话完成后，以PDA扫描数量(或PC直接输入的数量)为基准，使系统库存与实际一致的最终反映阶段。执行`applyCount()`时，更新`MAT_STOCKS`的数量，在`STOCK_TRANSACTIONS`中记录`PHYSCOUNT_IN/OUT`，并在`INV_ADJ_LOGS`中创建`PHYSICAL_COUNT`类型的审计历史。

## 数据结构
```
PHYSICAL_INV_SESSIONS (COMPLETED)
    │
    └── PHYSICAL_INV_COUNT_DETAILS (systemQty, countedQty, diffQty)
            │
            ▼ 反映(apply)时
    MAT_STOCKS.qty = countedQty 更新
    MAT_STOCKS.lastCountAt = now
    MAT_STOCKS.availableQty 重新计算
            │
            ├── STOCK_TRANSACTIONS (PHYSCOUNT_IN / PHYSCOUNT_OUT)
            │
            └── INV_ADJ_LOGS (adjType = 'PHYSICAL_COUNT')
```

---

## ① 盘点反映列

| 画面项目 | DB(来源) | 作用 / 含义 · 操作要点 |
|------|------|------|
| 仓库 | `PHYSICAL_INV_COUNT_DETAILS.WAREHOUSE_CODE` | 盘点目标仓库。 |
| 物料代码 | `PHYSICAL_INV_COUNT_DETAILS.ITEM_CODE` | 盘点物料。 |
| 物料序列号 | `PHYSICAL_INV_COUNT_DETAILS.MAT_UID` | LOT序列号。 |
| 系统数量 | `PHYSICAL_INV_COUNT_DETAILS.SYSTEM_QTY` | 会话开始时点快照(不可更改)。 |
| 盘点数量 | `PHYSICAL_INV_COUNT_DETAILS.COUNTED_QTY` | PDA累积值或PC直接输入。**反映前可修改**。 |
| 差异 | `COUNTED_QTY - SYSTEM_QTY` | 正数 = 实际更多，负数 = 实际更少。 |

---

## 反映(Apply)处理详情

`POST /material/physical-inv` → `PhysicalInvService.applyCount()`执行:

1. 按各`PhysicalInvItemDto.stockId`(warehouseCode::itemCode::matUid)查询`MatStock`
2. 将`MatStock.qty`设置为`countedQty`
3. 重新计算`MatStock.availableQty`(`qty - reservedQty`)
4. 更新`MatStock.lastCountAt`
5. 创建`StockTransaction`:
   - `PHYSCOUNT_IN`: 差异为正数时记录增加部分
   - `PHYSCOUNT_OUT`: 差异为负数时记录减少部分
6. 记录`InvAdjLog`: `adjType = 'PHYSICAL_COUNT'`, 保存`diffQty`

---

## 反映前确认事项
- **确认PDA扫描是否完成**(有无漏扫)。
- **盘点数量为0**的项目视为实际无库存，但需考虑PDA漏扫的可能性。
- **差异较大的项目**可能需要重新确认(盗窃·丢失·出入库错误)。
- 反映后`MAT_STOCKS`将被直接更改，请谨慎执行。

## 权限
具有库存盘点反映权限的用户(物料/质量管理员)。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 盘点反映按钮停用 | 所选条件下无不一致项(全部一致) | 盘点结果准确则无需反映 |
| "MatStock not found"错误 | 无对应`stockId`的库存记录 | 确认该物料的入库历史 |
| 盘点数量无法修改 | 输入字段为readonly或值被处理为字符串 | 仅输入数字(0以上整数) |
| 反映后数量与PDA不符 | 反映前系统数量已变更 | 确认出入库历史后需重新盘点 |
| 反映后仍有差异 | 其他会话或调整中数量已变更 | 重新查询库存现状并分析原因 |

## 数据·关联
- **表**: `PHYSICAL_INV_COUNT_DETAILS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `INV_ADJ_LOGS`
- **关联**: 库存盘点管理(会话), 物料库存现状查询
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
