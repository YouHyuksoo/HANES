---
menuCode: INV_TRANSACTION
audience: operator
title: 物料收发历史查询 — 操作指南
summary: STOCK_TRANSACTIONS全部列、各交易类型含义、取消链结构与故障排除
tags: [库存, 收发, 操作, 查询, 事务]
keywords: [STOCK_TRANSACTIONS, TRANS_TYPE, TRANS_NO, CANCEL_REF_ID, 收发历史, RECEIVE, MAT_OUT, ADJUST, TRANSFER, SCRAP]
related: [INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# 物料收发历史查询 — 操作指南

## 系统目的·作用
查询记录在`STOCK_TRANSACTIONS`表中的所有物料库存变动明细。可按类型·日期追踪入库·出库·移动·调整·废弃等所有收发明细，取消时原事务与取消事务通过`CANCEL_REF_ID`连接。

## 数据结构
```
STOCK_TRANSACTIONS (PK: TRANS_NO)
    │
    ├── 基本信息: TRANS_TYPE, TRANS_DATE, QTY, STATUS
    ├── 仓库: FROM_WAREHOUSE_ID → WAREHOUSES, TO_WAREHOUSE_ID → WAREHOUSES
    ├── 物料/LOT: ITEM_CODE → ITEM_MASTERS, MAT_UID → MAT_LOTS
    ├── 引用: REF_TYPE + REF_ID (采购单/工单等原引用)
    └── 取消链: CANCEL_REF_ID → STOCK_TRANSACTIONS.TRANS_NO (自引用)
        └── 查找取消原时通过CANCEL_REF_ID反向追踪
```

---

## ① 收发历史 — STOCK_TRANSACTIONS (全部列)

| 画面项目 | DB列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 事务编号 | `TRANS_NO` | **PK**。自然键。按编号规则生成。 |
| 交易类型 | `TRANS_TYPE` | 收发区分。`RECEIVE`, `MAT_OUT`, `ADJUST_IN`, `TRANSFER`等。画面中以色彩标识显示。 |
| 交易时间 | `TRANS_DATE` | 事务处理时间。默认值`CURRENT_TIMESTAMP`。 |
| 出库仓库 | `FROM_WAREHOUSE_ID` | 库存减少的仓库(出库·移动时)。NULL时为单纯入库。 |
| 入库仓库 | `TO_WAREHOUSE_ID` | 库存增加的仓库(入库·移动时)。NULL时为单纯出库。 |
| 物料代码 | `ITEM_CODE` | 变动物料。引用`ITEM_MASTERS.ITEM_CODE`。 |
| LOT编号 | `MAT_UID` | LOT单位事务时的序列号。NULL时为按数量处理。 |
| 数量 | `QTY` | 变动数量。正数=库存增加(入库)，负数=库存减少(出库)。 |
| 单价 | `UNIT_PRICE` | 物料单价(入库时)。 |
| 金额 | `TOTAL_AMOUNT` | 总金额(= QTY × UNIT_PRICE)。 |
| 引用类型 | `REF_TYPE` | 原文档类型。`JOB_ORDER`, `SUBCON_ORDER`, `PO`等。 |
| 引用ID | `REF_ID` | 原文档编号。 |
| 取消引用 | `CANCEL_REF_ID` | 若该事务为取消则记录原`TRANS_NO`。NULL时为正常事务。 |
| 作业者 | `WORKER_NO` | 作业者ID。 |
| 备注 | `REMARK` | 附加备注。 |
| 状态 | `STATUS` | `DONE`(正常) / `CANCELED`(已取消)。默认`DONE`。 |
| 库存科目 | `ACCOUNT` | 基于公共代码的库存科目区分。 |
| 审批人 | `APPROVER_ID` | 其他出库等需要审批的事务的审批人。 |
| 审批时间 | `APPROVED_AT` | 审批处理时间。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 公司代码(`40`)/工厂代码(`1000`)范围。 |
| 创建者 | `CREATED_BY` | 注册人。 |
| 修改者 | `UPDATED_BY` | 修改人。 |
| 创建时间 | `CREATED_AT` | 记录创建时间。 |
| 修改时间 | `UPDATED_AT` | 记录修改时间。 |

---

## 交易类型(`TRANS_TYPE`)详情

| 类型 | 说明 | QTY符号 | 库存效果 |
|------|------|---------|----------|
| RECEIVE | 物料入库(采购·退货) | + | 入库仓库库存增加 |
| MAT_OUT | 物料出库(生产·维修) | - | 出库仓库库存减少 |
| MAT_OUT_CANCEL | 出库取消 | + | 出库仓库库存恢复 |
| ADJUST_IN | 调整增加 | + | 相应仓库库存增加 |
| ADJUST_OUT | 调整减少 | - | 相应仓库库存减少 |
| TRANSFER | 仓库间移动 | N/A | 出库仓库 -, 入库仓库 + |
| LOT_SPLIT_IN | LOT分割(输入) | + | 分割的新LOT库存增加 |
| LOT_SPLIT_OUT | LOT分割(输出) | - | 原LOT库存减少 |
| SCRAP | 废弃 | - | 库存减少(废弃) |
| MISC_IN | 其他入库 | + | 入库仓库库存增加 |
| PROD_CONSUME | 生产消耗 | - | 出库仓库库存减少 |
| PROD_CONSUME_CANCEL | 生产消耗取消 | + | 出库仓库库存恢复 |

---

## 取消链结构

取消交易作为**新事务**生成，并在`CANCEL_REF_ID`中记录原`TRANS_NO`:

```
原事务 (TRANS_NO = 'RCP-20250101-001', QTY = +100, STATUS = 'DONE')
    ↓ 取消时
取消事务 (TRANS_NO = 'CCL-20250101-001', QTY = -100, STATUS = 'DONE',
          CANCEL_REF_ID = 'RCP-20250101-001')
    ↓ 并且
原更新 (STATUS = 'CANCELED')
```

在画面中查看取消项时，`原交易`列显示原`TRANS_NO`以资追踪。

---

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 特定事务不显示 | 应用了日期范围或交易类型筛选 | 解除筛选条件后重新查询 |
| 数量显示为0 | 取消后原状态变更为CANCELED | 通过`CANCEL_REF_ID`确认取消链 |
| 仓库名不显示 | `FROM_WAREHOUSE_ID`或`TO_WAREHOUSE_ID`为NULL | 单纯入库/出库时仅有一个出入库仓库 |
| RECEIVE但数量为负 | 取消事务以RECEIVE类型生成 | 通过`CANCEL_REF_ID`确认原事务 |

## 数据·关联
- **表**: `STOCK_TRANSACTIONS` (收发历史), `MAT_STOCKS` (库存), `MAT_LOTS` (LOT)
- **关联**: `ITEM_MASTERS`, `WAREHOUSES`, 采购单/工单等原文档
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
