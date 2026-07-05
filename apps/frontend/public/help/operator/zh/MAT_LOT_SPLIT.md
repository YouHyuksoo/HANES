---
menuCode: MAT_LOT_SPLIT
audience: operator
title: 材料分割 — 操作指南
summary: 材料分割DB结构(MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS), 入库完成门控, 原废弃→新2片段发行逻辑, origin继承跟踪, 多租户范围
tags: [材料, LOT, 分割, 操作, DB, 序列号, 收发]
keywords: [批次分割, LOT分割, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, MAT_UID, INIT_QTY, CURRENT_QTY, SPLIT, LOT_SPLIT_OUT, LOT_SPLIT_IN, 入库完成门控, RECEIVE, origin, nextMatSerial, STOCK_TX, isSplittable, InventoryFreezeGuard, 多租户, COMPANY, PLANT_CD]
related: [MAT_LOT, MAT_LOT_MERGE, MAT_ARRIVAL, MAT_ISSUE]
---

# 材料分割 — 操作指南

## 系统目的·角色
将入库完成的一个材料LOT(`MAT_LOTS`)序列号**分割为两个新序列号**的界面。分割不是简单分离原，而是**废弃原序列号(STATUS='SPLIT', 库存为0)后将分割数量片段·余量片段分别发行新序列号**。所有数量移动通过`STOCK_TRANSACTIONS`收发台账以`LOT_SPLIT_OUT`(原全部出库) / `LOT_SPLIT_IN`(新片段入库)记录，新LOT继承`ORIGIN`(首次序列号)以保持可追溯性。

> 设计依据: `docs/specs/2026-06-08-lot-split-merge-redesign-design.md`。原序列号全部废弃→结果2个片段均以新发行方式。

## 数据结构
```
MAT_LOTS (PK: MAT_UID)                ← LOT跟踪主表
  └─ MAT_STOCKS (PK: COMPANY+PLANT_CD+WAREHOUSE_CODE+ITEM_CODE+MAT_UID)
        QTY / AVAILABLE_QTY / RESERVED_QTY   ← 当前库存

分割执行时 (单个事务):
  原 MAT_UID
    STATUS NORMAL → SPLIT, CURRENT_QTY → 0
    MAT_STOCKS QTY/AVAILABLE_QTY → 0
    STOCK_TRANSACTIONS: LOT_SPLIT_OUT (QTY = -全量)
  新序列号 A(分割数量), B(余量)  ← nextMatSerial发行
    MAT_LOTS 新INSERT (继承ORIGIN)
    MAT_STOCKS 新INSERT
    STOCK_TRANSACTIONS: LOT_SPLIT_IN (QTY = +片段数量) × 2

入库完成门控:
  Σ STOCK_TRANSACTIONS.QTY (TRANS_TYPE IN RECEIVE/LOT_SPLIT_IN/LOT_MERGE_IN, STATUS<>CANCELED)
    >= MAT_LOTS.INIT_QTY
```

---

## ① 可分割LOT表格 — MAT_LOTS / MAT_STOCKS

列表查询对`MAT_LOTS`和`MAT_STOCKS`进行INNER JOIN并应用入库完成门控的结果。

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 材料序列号 | `MAT_LOTS.MAT_UID` | PK。LOT的唯一标识符(标签条码)。分割目标原序列号。 |
| 物料代码 | `MAT_LOTS.ITEM_CODE` | 引用`ITEM_MASTERS.ITEM_CODE`。物料名·单位关联键。 |
| 物料名称 | `ITEM_MASTERS.ITEM_NAME` | 通过`PartMaster`以`ITEM_CODE`关联。界面显示用。 |
| 当前数量 | `MAT_STOCKS.QTY` | 当前库存。列表条件`QTY > 1`。分割数量需小于此值。 |
| 单位 | `ITEM_MASTERS.UNIT` | 物料主表的单位。数量旁显示。 |
| 供应商 | `MAT_LOTS.VENDOR` → `PARTNER_MASTERS.PARTNER_NAME` | 以`VENDOR`(客户代码)批量关联`PartnerMaster`(避免N+1)。未映射时显示代码。 |
| (门控) | `MAT_LOTS.INIT_QTY` vs Σ收发 | 界面不显示。入库完成判定基准值。 |
| (列表过滤) | `MAT_LOTS.STATUS = 'NORMAL'` | 仅NORMAL。排除SPLIT/MERGED/HOLD/DEPLETED。 |
| (列表过滤) | `MAT_STOCKS.RESERVED_QTY = 0` | 有预约数量则排除出列表。 |

> 列表条件综合: `MAT_STOCKS.QTY > 1` AND `MAT_LOTS.STATUS = 'NORMAL'` AND `NVL(RESERVED_QTY,0) = 0` AND 通过入库完成门控。

---

## ② 材料LOT — MAT_LOTS (分割相关全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 材料UID | `MAT_UID` | PK(varchar2 50)。新片段通过`nextMatSerial`编号。 |
| 物料代码 | `ITEM_CODE` | 新片段继承原。 |
| 初始数量 | `INIT_QTY` | 发行时原始数量(不可变)。入库完成门控比较对象。新片段以片段数量INSERT。 |
| 当前数量 | `CURRENT_QTY` | 余量。原在分割时更新为`0`。新片段为片段数量。 |
| 入库日期 | `RECV_DATE` | 新片段继承原。 |
| 制造日期 | `MANUFACTURE_DATE` | 新片段继承原。 |
| 有效期 | `EXPIRE_DATE` | 新片段继承原。 |
| 入货号 | `ARRIVAL_NO` | 新片段继承原。用于标签·反向跟踪。 |
| 入货SEQ | `ARRIVAL_SEQ` | 新片段继承原。 |
| 原产地(首次序列号) | `ORIGIN` | 分割·合并跟踪键。将原的`ORIGIN`(无则原`MAT_UID`)继承给两个片段。系谱核心。 |
| 客户 | `VENDOR` | 供应商代码。新片段继承。 |
| 制造商代码 | `MFG_PARTNER_CODE` | 新片段继承。作为标签制造商输出(继承原制造商)。 |
| 发票号 | `INVOICE_NO` | 新片段继承。 |
| PO号 | `PO_NO` | 新片段继承。 |
| IQC状态 | `IQC_STATUS` | 新片段继承(保持已通过的检验结果)。 |
| 特采与否 | `SPECIAL_ACCEPT_YN` | 默认`N`。 |
| LOT状态 | `STATUS` | 原分割后为`SPLIT`。新片段为`NORMAL`。可分割状态仅`NORMAL`。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` 范围。新片段继承。 |

---

## ③ 原材料库存 — MAT_STOCKS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 多租户 | `COMPANY`, `PLANT_CD` | PK(复合)部分。 |
| 仓库代码 | `WAREHOUSE_CODE` | PK(复合)。新片段继承原仓库。 |
| 物料代码 | `ITEM_CODE` | PK(复合)。 |
| 材料UID | `MAT_UID` | PK(复合)。新片段以新序列号创建新行。 |
| 位置 | `LOCATION_CODE` | 新片段继承原。 |
| 数量 | `QTY` | 总数量。原分割时为`0`。新片段为片段数量。 |
| 预约数量 | `RESERVED_QTY` | 分割阻止条件(`> 0`则不可)。新片段为0。 |
| 可用数量 | `AVAILABLE_QTY` | 原分割时为`0`。新片段为片段数量。 |

---

## ④ 收发台账 — STOCK_TRANSACTIONS

每次分割生成`LOT_SPLIT_OUT` 1行 + `LOT_SPLIT_IN` 2行。

| DB列 | 角色 / 含义 · 操作要点 |
|------|------|
| `TRANS_NO` | PK。通过`NumberingService.next('STOCK_TX')`编号。 |
| `TRANS_TYPE` | `LOT_SPLIT_OUT`(原全部出库, QTY负数) / `LOT_SPLIT_IN`(新片段入库, QTY正数)。 |
| `TRANS_DATE` | 交易发生日期时间。 |
| `FROM_WAREHOUSE_ID` | OUT交易的出库仓库(原仓库)。 |
| `TO_WAREHOUSE_ID` | IN交易的入库仓库(继承原仓库)。 |
| `ITEM_CODE` | 物料代码(继承原)。 |
| `MAT_UID` | OUT是原序列号, IN是新片段序列号。 |
| `QTY` | OUT为`-全量`, IN为`+片段数量`。INT。 |
| `REF_TYPE` | `LOT_SPLIT`。 |
| `REF_ID` | 原`MAT_UID`(分割跟踪引用)。 |
| `REMARK` | 备注或自动生成`材料分割: {原}({全量}) → {分割数量} + {余量}`。 |
| `WORKER_ID` | 处理用户。 |
| `STATUS` | `DONE`。入库完成门控合计时使用`STATUS <> 'CANCELED'`条件。 |
| `COMPANY`, `PLANT_CD` | 多租户范围。 |

> 入库完成门控除`RECEIVE`外也认可`LOT_SPLIT_IN` / `LOT_MERGE_IN`为入库。因此分割·合并结果序列号也可再次分割·再合并。

---

## 分割执行逻辑 (split)

在单个DB事务(`TransactionService.run`)内按顺序执行。

1. 查询原LOT(租户范围) + 验证存在·租户一致。
2. 状态验证: 仅允许`STATUS = 'NORMAL'`(阻止`HOLD`/其他)。
3. **入库完成门控**: Σ`STOCK_TRANSACTIONS.QTY`(RECEIVE/LOT_SPLIT_IN/LOT_MERGE_IN, STATUS<>CANCELED) ≥ `INIT_QTY`。
4. 查询原库存(`MAT_STOCKS`): 验证`QTY > 0`, `RESERVED_QTY = 0`, `splitQty < QTY`。
5. 验证出库记录(`MAT_ISSUES`): 存在CANCELED以外的出库记录则阻止。
6. 验证物料(`PartMaster`): `IS_SPLITTABLE = 'N'`则不可分割。
7. 创建`LOT_SPLIT_OUT`收发(QTY = `-全量`)。
8. 原废弃: `MAT_LOTS.STATUS = 'SPLIT'`, `CURRENT_QTY = 0`; `MAT_STOCKS.QTY = AVAILABLE_QTY = 0`。
9. 两个片段(`[splitQty, remainQty]`)分别:
   - 通过`nextMatSerial`编号新序列号。
   - `MAT_LOTS`新INSERT(继承原属性·`ORIGIN`, `STATUS = 'NORMAL'`)。
   - `MAT_STOCKS`新INSERT。
   - 创建`LOT_SPLIT_IN`收发(QTY = `+片段数量`)。
10. 响应包含`label`(2个新序列号) → 前端显示标签预览输出。

> `remainQty = totalQty - splitQty`，通过`splitQty < QTY`验证确保始终`> 0`。

---

## 预设条件 (主表·公共代码)

- 目标LOT需**入库完成**(入库处理结束，`STOCK_TRANSACTIONS`中RECEIVE合计 ≥ INIT_QTY)状态。
- 物料主表(`ITEM_MASTERS`)的`IS_SPLITTABLE`为`N`则不可分割 — 允许分割的物料设置为`Y`。
- 编号键预先注册: 材料序列号(`nextMatSerial`, 每日序列`VH1-RM...`), 收发交易(`STOCK_TX`)。
- `InventoryFreezeGuard` — 库存封账(freeze)期间分割POST被阻止。

---

## 操作流程

1. 确认分割目标LOT为入库完成·NORMAL·无预约/出库记录状态。
2. 点击分割按钮 → 输入分割数量(小于当前数量) → 执行分割。
3. 在标签预览中输出2个新序列号标签，废弃原标签。
4. 分割后在`MAT_LOTS`中确认原`STATUS = 'SPLIT'`，新2条为`NORMAL`。

---

## 权限

| 角色 | 允许操作 |
|------|------|
| 普通用户 | 可分割LOT查询, 分割执行, 标签输出 |
| 物流/材料负责人 | 同上 |
| 运营者/管理员 | 以上 + 库存封账(freeze)设置·解除, 物料`IS_SPLITTABLE`设置 |

---

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| LOT未显示在列表中 | 入库完成前 / `QTY <= 1` / `RESERVED_QTY > 0` / `STATUS <> NORMAL` | 在[原材料LOT现状]中确认状态·数量·预约。先完成入库处理 |
| "仅入库完成的LOT可分割"错误 | 未通过门控(RECEIVE合计 < INIT_QTY) | 先完成入库确认(入库处理) |
| "非正常(NORMAL)状态的LOT"错误 | 已为SPLIT/MERGED或HOLD | 选择其他LOT。保留需解除后继续 |
| "有预约数量的LOT"错误 | `RESERVED_QTY > 0` | 先整理预约(取消/消耗) |
| "已有材料出库记录的LOT"错误 | 存在CANCELED以外的出库记录 | 先整理出库或使用其他LOT |
| "该物料不可分割"错误 | `ITEM_MASTERS.IS_SPLITTABLE = 'N'` | 在物料主表中改为允许分割 |
| "分割数量需小于当前库存"错误 | `splitQty >= QTY` | 重新输入小于当前数量的值 |
| 分割POST被阻止(freeze) | 库存封账期间 | 解除`InventoryFreezeGuard`封账后重试 |
| 标签未输出 | Print Agent未运行 | 确认本地Print Agent运行状态 |

---

## 数据·关联

| 项目 | 内容 |
|------|------|
| 主要表 | `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| 验证引用 | `MAT_ISSUES`(出库记录), `ITEM_MASTERS`(IS_SPLITTABLE·单位), `PARTNER_MASTERS`(供应商名) |
| API路径 | `GET /material/lot-split`(可分割列表), `POST /material/lot-split`(分割执行) |
| 编号 | 序列号`nextMatSerial`(SEQ_MAT_SERIAL_DAILY), 收发`STOCK_TX`(`NumberingService`) |
| 守卫 | `InventoryFreezeGuard`(POST) |
| 跟踪(系谱) | `ORIGIN`(首次序列号)继承 + `STOCK_TRANSACTIONS.REF_ID`(原MAT_UID) |
| 关联界面 | 入货管理(LOT发行), 材料合并(逆运算), 原材料LOT现状, 材料出库 |
| 多租户范围 | `COMPANY = '40'`, `PLANT_CD = '1000'` — 所有查询·保存时通用过滤 |
