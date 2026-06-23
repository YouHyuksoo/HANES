---
menuCode: MAT_ADJUSTMENT
audience: operator
title: 库存调整 — 操作指南
summary: 库存调整的全部列含义、DB映射、审批流程(PDA 2阶段)、库存联动结构与故障排除
tags: [物料, 库存, 调整, 操作, 设置, 盘点]
keywords: [INV_ADJ_LOGS, MAT_STOCKS, 库存调整, 库存盘点, ADJ_TYPE, PHYSICAL_INV, MANUAL_ADJ, 调整审批, PENDING, APPROVED, InventoryFreezeGuard, STOCK_TRANSACTIONS, MAT_LOTS, 仓库库存]
related: [MAT_RECEIVE, MAT_ISSUE]
---

# 库存调整 — 操作指南

## 系统目的·作用
当实物库存与系统库存产生差异时，手动进行更正并将历史记录至`INV_ADJ_LOGS`。发生调整时，`MAT_STOCKS`(按仓库物料库存)的数量发生变更，`STOCK_TRANSACTIONS`中记录ADJUST_IN/ADJUST_OUT事务。分为PDA路径(2阶段审批)和PC路径(即时审批)。

## 数据结构
```
INV_ADJ_LOGS  (PK: ADJ_DATE + SEQ)
    │
    ├── 审批(APPROVED)时 ──▶ MAT_STOCKS.qty更新
    │                           │
    │                           └── STOCK_TRANSACTIONS (ADJUST_IN / ADJUST_OUT)
    │
    └── PENDING状态 ──▶ 待审批/驳回 (PDA注册)
                            │
                            ├── 审批 → MAT_STOCKS反映
                            └── 驳回 → 仅留历史，库存无变动
```

---

## ① 库存调整 — INV_ADJ_LOGS (全部列)

| 画面项目 | DB列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 调整日期 | `ADJ_DATE` | **PK (1/2)**。调整注册日期。自动生成(`SYSDATE`)。 |
| 序列号 | `SEQ` | **PK (2/2)**。同日期内序号。自动编号(序列或`MAX+1`)。 |
| 仓库 | `WAREHOUSE_CODE` | 调整目标仓库。与`MAT_STOCKS.WAREHOUSE_CODE`连接。 |
| 物料代码 | `ITEM_CODE` | 调整目标物料。引用`ITEM_MASTERS.ITEM_CODE`。 |
| 物料UID | `MAT_UID` | LOT单位调整时的LOT UID。NULL时为物料整体调整。 |
| 调整类型 | `ADJ_TYPE` | 调整区分：`ADJUST`(一般调整)，`PHYSICAL_INV`(盘点)，`MANUAL_ADJ`(手动调整)。 |
| 调整前数量 | `BEFORE_QTY` | 调整前的系统库存数量。以`MAT_STOCKS.QTY`为基准。 |
| 调整后数量 | `AFTER_QTY` | 调整后的最终数量。 |
| 差异数量 | `DIFF_QTY` | `AFTER_QTY - BEFORE_QTY`。正数=增加，负数=减少。 |
| 审批状态 | `ADJUST_STATUS` | `PENDING` = 待审批(PDA路径)，`APPROVED` = 已审批(已反映库存)，`REJECTED` = 已驳回。PC路径默认`APPROVED`。 |
| 调整原因 | `REASON` | 调整理由。`varchar2(500)`。 |
| 审批人 | `APPROVED_BY` | 审批/驳回处理人ID。 |
| 审批时间 | `APPROVED_AT` | 审批/驳回处理时间。 |
| 创建者 | `CREATED_BY` | 调整注册人。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 公司代码(`40`)/工厂代码(`1000`)范围。 |
| 修改者 | `UPDATED_BY` | 最后修改人。 |
| 首次创建日 | `CREATED_AT` | 调整注册时间。显示于列表中。 |
| 最后修改日 | `UPDATED_AT` | 最后修改时间(自动)。 |

---

## 调整类型 (`ADJ_TYPE`)

| 代码 | 含义 | 使用处 |
|------|------|------|
| `ADJUST` | 一般调整 | PC画面直接数量调整 |
| `PHYSICAL_INV` | 盘点调整 | 库存盘点结果反映 |
| `MANUAL_ADJ` | 手动调整 | 出入库错误更正等例外情况 |

---

## 审批流程 (2路径)

| 路径 | 注册方式 | 初始状态 | 库存反映 | 使用处 |
|------|----------|-----------|----------|--------|
| PC画面 | `POST /material/adjustment` | `APPROVED` | **即时反映** | 办公室PC |
| PDA | `POST /material/adjustment/pending` | `PENDING` | 审批时反映 | 现场PDA |

**PENDING → 审批/驳回流程:**
1. PDA通过`POST /material/adjustment/pending`注册 → `ADJUST_STATUS = 'PENDING'` (库存未反映)
2. 管理员通过`PATCH /material/adjustment/:adjDate/:seq/approve` → 审批 → 更新`MAT_STOCKS.qty` + 记录`STOCK_TRANSACTIONS`
3. 或通过`PATCH /material/adjustment/:adjDate/:seq/reject` → 驳回 → 仅留历史，库存无变动

> 应用了`InventoryFreezeGuard`，在库存冻结(Freeze)状态下调整注册/审批将被阻止。

---

## 库存联动详情

**审批时执行的处理顺序:**
1. 查询`MAT_STOCKS`中该仓库+物料+LOT的当前`QTY`
2. 按`DIFF_QTY`增减`MAT_STOCKS.QTY`
3. 在`STOCK_TRANSACTIONS`中记录`ADJUST_IN`(增加)或`ADJUST_OUT`(减少)事务
4. 更新`INV_ADJ_LOGS.ADJUST_STATUS`为`'APPROVED'` + 记录审批人·审批时间

---

## 操作流程
1. **盘点或发现差异**: 仓库库存盘点后确认系统与实际数量差异
2. **调整注册**: 在PC画面输入仓库·物料·调整后数量·原因 → 即时反映
3. **PDA路径(现场)**: PDA中PENDING注册 → 管理员审批/驳回
4. **结果确认**: 在DataGrid中确认调整历史与增减明细
5. **反向调整(错误时)**: 注册错误时以反向调整恢复原状

## 权限
具有库存调整权限的用户(物料/生产管理员)。`InventoryFreezeGuard`会在库存冻结期间阻止注册·审批。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 保存按钮停用 | 仓库·物料·数量·原因中存在空值 | 填写所有必填字段 |
| "库存冻结中"错误 | 因库存盘点等导致库存冻结状态 | 解除冻结后重试 |
| 调整后数量异常 | 调整后数量应输入最终值而非增减量 | 确认调整后数量输入(最终值而非差异) |
| PDA注册项未审批 | `ADJUST_STATUS = 'PENDING'`状态滞留 | 处理审批(`/approve`)或驳回(`/reject`) |
| 数量显示为负数 | 库存不足状态下进行减少调整 | 确认库存数量后以适当值重新调整 |

## 数据·关联
- **表**: `INV_ADJ_LOGS` (调整历史), `MAT_STOCKS` (库存数量更新), `STOCK_TRANSACTIONS` (交易历史), `MAT_LOTS` (LOT信息)
- **关联**: `ITEM_MASTERS`(物料), `WAREHOUSES`(仓库)
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
- **保护机制**: `InventoryFreezeGuard` — 在库存冻结状态下阻止调整
