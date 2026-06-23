---
menuCode: MAT_HOLD
audience: operator
title: 物料库存保留管理 — 操作指南
summary: 基于MAT_LOTS.status的保留机制、相关表、库存影响与故障排除
tags: [物料, 保留, 操作, LOT, 质量]
keywords: [MAT_LOTS, STATUS, HOLD, NORMAL, DEPLETED, 库存保留, 质量保留, LOT阻止, 出库阻止, MAT_STOCKS]
related: [INV_MAT_STOCK]
---

# 物料库存保留管理 — 操作指南

## 系统目的·作用
将`MAT_LOTS.STATUS`值从`NORMAL`变更为`HOLD`(或从`HOLD`变更为`NORMAL`)，以阻止或解除特定LOT的使用。被保留的LOT虽存在于`MAT_STOCKS`的库存中，但无法出库·投入生产(系统通过检查`status = 'HOLD'`进行阻止)。

## 数据结构
```
MAT_LOTS (PK: MAT_UID)
    │
    ├── STATUS (NORMAL / HOLD / DEPLETED / SPLIT / MERGED)
    ├── ITEM_CODE → ITEM_MASTERS (itemName, unit)
    ├── VENDOR → PARTNER_MASTERS (vendorName)
    │
    └──▶ MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
            └── 库存数量保持不变，但HOLD状态LOT从可用库存中排除
```

---

## ① LOT — MAT_LOTS (保留相关列)

| 画面项目 | DB列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 物料序列号 | `MAT_UID` | **PK**。LOT/序列号。 |
| 物料代码 | `ITEM_CODE` | 物料。引用`ITEM_MASTERS`。 |
| 当前余量 | `CURRENT_QTY` | LOT的当前库存数量。 |
| 状态 | `STATUS` | `NORMAL`(正常) / `HOLD`(保留) / `DEPLETED`(耗尽) / `SPLIT`(已分割) / `MERGED`(已合并)。 |
| 供应商代码 | `VENDOR` | 供应方代码。引用`PARTNER_MASTERS`。 |
| IQC状态 | `IQC_STATUS` | `PENDING` / `PASS` / `FAIL` / `HOLD`。 |
| 公司 | `COMPANY` | 多租户。 |
| 工厂 | `PLANT_CD` | 多租户。 |
| 生产日期 | `MANUFACTURE_DATE` | 生产日期。 |
| 保质期 | `EXPIRE_DATE` | 有效期到期日。 |

---

## 保留机制

| 操作 | 前提条件 | DB变更 | 库存效果 |
|------|---------|---------|----------|
| **保留** | LOT存在，`STATUS ≠ HOLD`，`STATUS ≠ DEPLETED` | `MAT_LOTS.STATUS = 'HOLD'` | 库存保留但从可用库存中排除 |
| **解除** | LOT存在，`STATUS = 'HOLD'` | `MAT_LOTS.STATUS = 'NORMAL'` | 重新纳入可用库存 |

> **注意**: `DEPLETED`状态的LOT不可保留，被保留的LOT的所有库存变动(出库·生产投入等)将被阻止。

---

## 保留目标案例
| 情况 | 说明 |
|------|------|
| 质量不良 | IQC FAIL或生产中发现不良时保留该LOT |
| 保质期过期 | 有效期已过的LOT保留后做废弃处理 |
| 供应商索赔 | 怀疑特定供应商的LOT有问题时预先保留 |
| 系统错误更正 | 因出入库错误导致数量异常的LOT临时阻止 |

## 权限
具有库存保留权限的用户(质量·物料管理员)。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 保留按钮不显示 | LOT已是HOLD状态 | 已切换为解除按钮 |
| "无法保留DEPLETED LOT"错误 | 已耗尽的LOT | 耗尽LOT无需保留 |
| 无法解除保留 | LOT的STATUS不是HOLD | 确认当前状态 |
| 已保留却仍可出库 | 出库流程缺少`MAT_LOTS.STATUS`检查逻辑 | 确认出库服务中的HOLD检查逻辑 |
| 原因未保存 | 当前服务未将`reason`字段存入DB | 需要单独审计历史时需扩展 |
| 保留LOT的库存仍在汇总中 | `MAT_STOCKS.qty`未变更(仅变更状态) | 总库存中需单独管理HOLD LOT |

## 数据·关联
- **表**: `MAT_LOTS` (LOT状态), `MAT_STOCKS` (库存)
- **引用**: `ITEM_MASTERS`(物料名称), `PARTNER_MASTERS`(供应商名称)
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
- **参考**: 产品(`PRODUCT_STOCKS`)有单独的`HOLD_REASON`, `HOLD_AT`, `HOLD_BY`列，与物料结构不同。
