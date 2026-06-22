---
menuCode: MAT_ARRIVAL
audience: operator
title: 入货管理 — 操作指南
summary: 入货管理DB结构(MAT_ARRIVALS, MAT_LOTS, MAT_ARRIVAL_STOCKS, PURCHASE_ORDER_ITEMS), PO行入货逻辑, 反向分录取消, IQC关联, 多租户范围
tags: [材料, 入货, 操作, DB, LOT, IQC, 反向分录]
keywords: [MAT_ARRIVALS, MAT_LOTS, MAT_ARRIVAL_STOCKS, MAT_ARRIVAL_TRANSACTIONS, PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, ARRIVAL_NO, MAT_UID, IQC_STATUS, LINE_STATUS, ARRIVAL_TYPE, MFG_PARTNER_CODE, 反向分录, 多租户, COMPANY, PLANT_CD, 入货取消, LOT编号, 序列号]
related: [PUR_PO, QC_IQC, MAT_ARRIVAL_RESULT, MAT_ARRIVAL_TRANSACTION, INV_ARRIVAL_STOCK]
---

# 入货管理 — 操作指南

## 系统目的·角色
供应商交付的材料**按采购订单(PO)行单位进行入货登记**，并编号材料LOT(MAT_LOTS)序列号的界面。入货时同时创建 `MAT_ARRIVALS`(业务记录) + `MAT_LOTS`(LOT跟踪) + `MAT_ARRIVAL_STOCKS`(入货待处理库存) 三张表。入库(原材料当前库存 `MAT_STOCKS` 反映)在IQC合格后另行处理。

## 数据结构
```
PURCHASE_ORDERS (PK: PO_NO)
  └─ PURCHASE_ORDER_ITEMS (PK: PO_ID + SEQ)
       │   LINE_STATUS: OPEN → PARTIAL → CLOSE
       │   RECEIVED_QTY 累计更新
       ↓ 入货登记
MAT_ARRIVALS (PK: ARRIVAL_NO + SEQ)
  ├─ MAT_LOTS (PK: MAT_UID)   ← LOT跟踪·IQC
  │     IQC_STATUS: PENDING → PASS/FAIL/HOLD
  └─ MAT_ARRIVAL_STOCKS (PK: COMPANY + PLANT_CD + MAT_UID)
         STATUS: AVAILABLE   ← IQC待处理入货库存

MAT_ARRIVAL_TRANSACTIONS (PK: TRANS_NO)
       ← 入货·取消台账 (ARRIVAL_IN / ARRIVAL_CANCEL)
```

---

## ① PO行 — PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 采购单号 | `PURCHASE_ORDERS.PO_NO` | PK。可入货条件: `STATUS IN ('CONFIRMED', 'PARTIAL')`。 |
| 客户 | `PURCHASE_ORDERS.PARTNER_ID / PARTNER_NAME` | 供应商。复制到 `MAT_ARRIVALS.VENDOR_ID/VENDOR_NAME`。 |
| 采购日期 | `PURCHASE_ORDERS.ORDER_DATE` | DATE类型。 |
| 交货日期 | `PURCHASE_ORDERS.DUE_DATE` | DATE类型。界面当前不显示。 |
| 使用区分 | `PURCHASE_ORDERS.USE_TYPE` | 公共代码 `PO_USE_TYPE`(例如: PROD)。表格显示。 |
| 行号 | `PURCHASE_ORDER_ITEMS.LINE_NO` | 采购单内序号(L/N)。 |
| 修订号 | `PURCHASE_ORDER_ITEMS.REV_NO` | 行修订号(R/N)。默认值1。 |
| 物料代码 | `PURCHASE_ORDER_ITEMS.ITEM_CODE` | 引用 `ITEM_MASTERS.ITEM_CODE`。 |
| 采购数量 | `PURCHASE_ORDER_ITEMS.ORDER_QTY` | INT。 |
| 累计入货 | `PURCHASE_ORDER_ITEMS.RECEIVED_QTY` | 每次入货登记时增加。余量 = ORDER_QTY − RECEIVED_QTY。 |
| 行状态 | `PURCHASE_ORDER_ITEMS.LINE_STATUS` | `OPEN`(未入货) / `PARTIAL`(部分入货) / `CLOSE`(完成)。服务器自动重新计算。 |

---

## ② 入货头 — MAT_ARRIVALS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 入货号 | `ARRIVAL_NO` | PK(复合)。Oracle Sequence `ARRIVAL` 编号。同一批次的多项物料共享同一 `ARRIVAL_NO`。 |
| SEQ | `SEQ` | PK(复合)。同一 `ARRIVAL_NO` 内的序号。从1开始。 |
| PO号 | `PO_NO` | 关联的采购单号。手动入货为NULL。 |
| PO_ID | `PO_ID` | 引用 `PURCHASE_ORDERS.PO_NO`。 |
| PO_ITEM_ID | `PO_ITEM_ID` | 引用 `PURCHASE_ORDER_ITEMS.SEQ`。 |
| 发票号 | `INVOICE_NO` | 供应商发票号(交易跟踪用)。当前PO入货模态框中无输入UI(仅手动入货可输入)。 |
| 客户ID | `VENDOR_ID` | 从PO的 `PARTNER_ID` 复制。 |
| 客户名称 | `VENDOR_NAME` | 从PO的 `PARTNER_NAME` 复制。 |
| 供应商UID | `SUP_UID` | 交付企业自行赋予的材料序列号(可选)。 |
| 物料代码 | `ITEM_CODE` | 引用 `ITEM_MASTERS.ITEM_CODE`。 |
| 入货数量 | `QTY` | INT。本次入货登记的数量。 |
| 仓库代码 | `WAREHOUSE_CODE` | 入货放置仓库。 |
| 入货日期时间 | `ARRIVAL_DATE` | TIMESTAMP。按用户输入的入货日期存储。 |
| 入货类型 | `ARRIVAL_TYPE` | `PO`(基于采购单) / `MANUAL`(手动)。 |
| 操作员 | `WORKER_ID` | 注册用户ID。 |
| IQC状态 | `IQC_STATUS` | 入货后立即为 `PENDING`。根据入库检验结果变更。 |
| 状态 | `STATUS` | `DONE` / `CANCELED`。取消时转为反向分录。 |
| 备注 | `REMARK` | 备注。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` 范围。 |

---

## ③ 材料LOT — MAT_LOTS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 材料UID | `MAT_UID` | PK。Oracle Sequence `VH1-RM...` 格式编号。LOT的唯一标识符(标签条码)。 |
| 物料代码 | `ITEM_CODE` | 引用 `ITEM_MASTERS.ITEM_CODE`。 |
| 初始数量 | `INIT_QTY` | 入货时发行的原始数量。不可变值。即使发生收发也不改变。 |
| 当前数量 | `CURRENT_QTY` | 当前余量。出库时减少。新LOT与INIT_QTY相同。 |
| 入库日期 | `RECV_DATE` | 入货登记时间的日期(TIMESTAMP)。 |
| 制造日期 | `MANUFACTURE_DATE` | 材料制造日期(可选)。可在手动入货中输入。 |
| 有效期 | `EXPIRE_DATE` | 有效期限日期。当前不自动计算(NULL)。 |
| 入货号 | `ARRIVAL_NO` | 引用 `MAT_ARRIVALS.ARRIVAL_NO`。用于LOT反向跟踪。 |
| 入货SEQ | `ARRIVAL_SEQ` | 与 `MAT_ARRIVALS.SEQ` 关联。 |
| 原产地 | `ORIGIN` | 用于LOT分割·合并跟踪。首次入货时与 `MAT_UID` 值相同。 |
| 客户 | `VENDOR` | PO的 `PARTNER_ID`。 |
| 制造商代码 | `MFG_PARTNER_CODE` | 实际制造商(`PARTNER_MASTERS` MFG类型)。在入货模态框中必须选择。用于标签输出。 |
| 发票号 | `INVOICE_NO` | 交易跟踪用。 |
| PO号 | `PO_NO` | 关联采购单号。 |
| IQC状态 | `IQC_STATUS` | `PENDING`(待检) / `PASS` / `FAIL` / `HOLD`。在入库检验(IQC)界面中更新。 |
| 特采与否 | `SPECIAL_ACCEPT_YN` | `Y`=将不合格材料作为良品特别采用。默认 `N`。 |
| LOT状态 | `STATUS` | `NORMAL`(正常) / `HOLD`(保留) / `DEPLETED`(耗尽) / `SPLIT`(分割) / `MERGED`(合并)。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` 范围。 |

---

## ④ 入货库存 — MAT_ARRIVAL_STOCKS

IQC通过前的待处理库存。合格后转移到 `MAT_STOCKS`(原材料当前库存)。

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 材料UID | `MAT_UID` | PK(复合)。LOT单位库存行。 |
| 入货号 | `ARRIVAL_NO` | 关联入货号。 |
| 入货SEQ | `ARRIVAL_SEQ` | 关联入货序号。 |
| 仓库代码 | `WAREHOUSE_CODE` | 放置仓库。 |
| 物料代码 | `ITEM_CODE` | 材料物料代码。 |
| 数量 | `QTY` | 总持有数量。 |
| 可用数量 | `AVAILABLE_QTY` | 可出库数量。IQC HOLD时为0。 |
| 状态 | `STATUS` | `AVAILABLE`(可用) / `HOLD`(IQC保留等)。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK(复合)。 |

---

## ⑤ 入货台账 — MAT_ARRIVAL_TRANSACTIONS

| DB列 | 角色 / 含义 · 操作要点 |
|------|------|
| `TRANS_NO` | PK。交易号。 |
| `TRANS_TYPE` | `ARRIVAL_IN`(入货) / `ARRIVAL_CANCEL`(取消反向分录)。 |
| `TRANS_DATE` | 交易发生日期时间(TIMESTAMP)。 |
| `ARRIVAL_NO` | 关联入货号。 |
| `ARRIVAL_SEQ` | 关联入货序号。 |
| `WAREHOUSE_CODE` | 仓库。 |
| `ITEM_CODE` | 物料代码。 |
| `MAT_UID` | LOT序列号。 |
| `QTY` | 数量(取消时为负数)。 |
| `UNIT_PRICE` | 单价(DECIMAL 12,4)。 |
| `TOTAL_AMOUNT` | 金额(DECIMAL 14,2)。 |
| `REF_TYPE` | 引用类型(取消关联等)。 |
| `REF_ID` | 引用ID。 |
| `CANCEL_REF_ID` | 反向分录时的原始交易ID。 |
| `WORKER_ID` | 处理用户。 |
| `STATUS` | `DONE` / `CANCELED`。 |
| `COMPANY`, `PLANT_CD` | 多租户范围。 |

---

## 入货登记逻辑（基于PO）

1. 验证 `PURCHASE_ORDERS.STATUS IN ('CONFIRMED', 'PARTIAL')`。
2. 验证是否超过余量(= `ORDER_QTY - RECEIVED_QTY`)。
3. 通过Oracle Sequence编号 `ARRIVAL_NO`(`ARRIVAL` 编号键)。
4. 通过Oracle Sequence编号 `MAT_UID`(材料序列号)(`VH1-RM...` 格式)。
5. 创建 `MAT_ARRIVALS` 记录(`IQC_STATUS = 'PENDING'`, `STATUS = 'DONE'`)。
6. 创建 `MAT_LOTS` 记录(`INIT_QTY = CURRENT_QTY = 入货数量`, `IQC_STATUS = 'PENDING'`)。
7. 创建 `MAT_ARRIVAL_STOCKS` 记录(`STATUS = 'AVAILABLE'`)。
8. 创建 `MAT_ARRIVAL_TRANSACTIONS` 记录(`TRANS_TYPE = 'ARRIVAL_IN'`)。
9. 增加 `PURCHASE_ORDER_ITEMS.RECEIVED_QTY`。
10. 重新计算 `PURCHASE_ORDER_ITEMS.LINE_STATUS`(OPEN → PARTIAL → CLOSE)。
11. 重新计算 `PURCHASE_ORDERS.STATUS`(CONFIRMED → PARTIAL → CLOSED)。

> 原材料当前库存(`MAT_STOCKS`)仅在IQC合格后的**入库**时点增加。入货阶段仅累积在 `MAT_ARRIVAL_STOCKS`。

## 入货取消逻辑（反向分录）

- API: `POST /material/arrivals/cancel` (`transactionId`, `reason`)
- 非删除而是反向分录: 将原始 `MAT_ARRIVAL_TRANSACTIONS.STATUS = 'CANCELED'`，新增相反数量的 `ARRIVAL_CANCEL` 交易。
- `MAT_ARRIVALS.STATUS = 'CANCELED'`，扣减 `MAT_ARRIVAL_STOCKS` 库存。
- 取消原因为必填，仅当原始交易为 `DONE` + `ARRIVAL_IN` 状态时才可操作。

---

## API路径

| 目的 | 路径 |
|------|------|
| PO行列表查询 | `GET /material/arrivals/po-lines` |
| PO行入货登记 | `POST /material/arrivals/po-line` |
| 手动入货登记 | `POST /material/arrivals/manual` |
| 入货取消 | `POST /material/arrivals/cancel` |

---

## 预设条件（主表·公共代码）

- 采购单(PO)需为 `CONFIRMED` 状态以上才会在入货列表中显示。
- 物料主表(`ITEM_MASTERS`)需设置 `LOT_UNIT_QTY`(序列号组成单位) — 未设置时入货全部数量将作为1个LOT发行。
- 需预先注册原材料仓库(`WAREHOUSES`, `WAREHOUSE_TYPE = 'RAW'`)。
- 需预先注册制造商(`PARTNER_MASTERS`, `PARTNER_TYPE = 'MFG'`)。
- 公共代码: `PO_LINE_STATUS`(OPEN/PARTIAL/CLOSE), `PO_USE_TYPE`, `PO_STATUS`。
- 建议设置用于标签输出的 `mat_lot` 分类标签模板(`/master/label-templates`)。

---

## 权限

| 角色 | 允许操作 |
|------|------|
| 普通用户 | PO行查询，基于PO的入货登记，标签输出 |
| 物流/材料负责人 | 以上 + 手动入货 |
| 运营者/管理员 | 以上 + 入货取消(反向分录) |

---

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| PO行在列表中不显示 | `PURCHASE_ORDERS.STATUS` 为 `DRAFT` 或 `CLOSED` | 在采购单管理中将PO进行CONFIRM处理或确认状态 |
| 材料入货按钮禁用 | `LINE_STATUS = 'CLOSE'` 或 `REMAINING_QTY <= 0` | 确认余量。必要时修改采购数量后重新处理 |
| 入货数量超过余量错误 | `receivedQty > remainingQty` | 确认输入数量在余量范围内 |
| 序列号数量超出预期 | `LOT_UNIT_QTY` 设置过小 | 在物料主表中修改 `LOT_UNIT_QTY` |
| 标签未输出 | Print Agent未运行或端口连接错误 | 确认本地Print Agent运行状态 |
| IQC待处理状态不变 | IQC界面未登记检验 | 在入库检验(IQC)界面对该LOT进行检验 |
| 入货取消按钮不显示 | 交易状态为 `CANCELED` 或类型为 `ARRIVAL_CANCEL` | 该记录已取消。需查询原始交易 |
| 入货后 `MAT_STOCKS` 数量无变化 | 正常操作。入库在IQC合格后另行处理 | 在[入货库存]界面确认IQC待处理数量 |

---

## 数据·关联

| 项目 | 内容 |
|------|------|
| 主要表 | `MAT_ARRIVALS`, `MAT_LOTS`, `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS`, `PURCHASE_ORDERS`, `PURCHASE_ORDER_ITEMS` |
| 引用主表 | `ITEM_MASTERS`, `PARTNER_MASTERS`, `WAREHOUSES` |
| 关联界面 | 采购单管理(PO状态), 入库检验(IQC结果), 入货结果(记录·取消), 入货库存(待处理库存) |
| 多租户范围 | `COMPANY = '40'`, `PLANT_CD = '1000'` — 所有查询·保存时通用过滤 |
