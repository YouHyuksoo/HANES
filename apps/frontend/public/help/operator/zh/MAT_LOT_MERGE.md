---
menuCode: MAT_LOT_MERGE
audience: operator
title: 材料合并 — 操作指南
summary: 材料LOT合并DB结构(MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS), 合并逻辑(原废弃后新序列号重发), 门控条件, API, 多租户范围
tags: [材料, LOT, 合并, 操作, DB, 序列号, 收发]
keywords: [批次合并, LOT合并, 材料合并, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, MAT_UID, INIT_QTY, CURRENT_QTY, ARRIVAL_NO, ORIGIN, STATUS, MERGED, LOT_MERGE_IN, LOT_MERGE_OUT, 入库完成门控, 编号, SEQ_MAT_SERIAL_DAILY, STOCK_TX, 多租户, COMPANY, PLANT_CD, lot-split]
related: [MAT_LOT_SPLIT, MAT_ARRIVAL, QC_IQC]
---

# 材料合并 — 操作指南

## 系统目的·角色
将同一物料·同一入货批次的多个材料LOT(`MAT_LOTS`)**合并为一个新的统一序列号**的界面。合并时原LOT全部废弃(`STATUS='MERGED'`, 库存为0)，发行合计数量的**1个新`MAT_UID`**。库存(`MAT_STOCKS`)和收发台账(`STOCK_TRANSACTIONS`)按事务单位一致更新。与材料分割(LOT分割)对称操作，支持分割/合并再加工(分割结果再次合并，合并结果再次分割)。

设计依据: `docs/specs/2026-06-08-lot-split-merge-redesign-design.md`。

## 数据结构
```
MAT_LOTS (PK: MAT_UID)                      ← LOT跟踪·状态
  STATUS: NORMAL → MERGED(原废弃)
  ORIGIN: 分割·合并跟踪用首次序列号继承
       │
       ├─ MAT_STOCKS (PK: COMPANY+PLANT_CD+WAREHOUSE_CODE+ITEM_CODE+MAT_UID)
       │     QTY / AVAILABLE_QTY / RESERVED_QTY  ← 当前库存 (合并基准数量)
       │
       └─ STOCK_TRANSACTIONS (PK: TRANS_NO)      ← 收发台账
             TRANS_TYPE: LOT_MERGE_OUT(原出库) / LOT_MERGE_IN(新入库)
             REF_TYPE='LOT_MERGE', REF_ID=ORIGIN

验证参考: MAT_ISSUE(出库记录), PART_MASTER(物料), PARTNER_MASTER(客户)
```

> 合并可用数量的基准是`MAT_STOCKS.QTY`(当前库存)。合并的是实际当前库存而非`MAT_LOTS.CURRENT_QTY`。

---

## ① 可合并LOT列表 — MAT_LOTS + MAT_STOCKS (表格)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 材料序列号 | `MAT_LOTS.MAT_UID` | PK。合并对象标识键(标签条码)。 |
| 物料代码 | `MAT_LOTS.ITEM_CODE` | 引用`PART_MASTER.ITEM_CODE`。仅允许同一`ITEM_CODE`合并。 |
| 物料名称 | `PART_MASTER.ITEM_NAME` | 通过`attachMeta`关联附加(非列)。 |
| 数量 | `MAT_STOCKS.QTY` | 当前库存数量。合并合计的基准值。通过`attachMeta`附加。 |
| 入货号 | `MAT_LOTS.ARRIVAL_NO` | 仅同一入货号的LOT可合并(继承入货标签/信息)。NULL则不可合并。 |
| 供应商 | `MAT_LOTS.VENDOR` | 客户代码。关联`PARTNER_MASTER.PARTNER_NAME`显示为`vendorName`。 |
| 首次序列号(内部) | `MAT_LOTS.ORIGIN` | 分割·合并跟踪用。新LOT继承(`base.origin || base.matUid`)。表格排序键。 |
| 单位(内部) | `PART_MASTER.UNIT` | 数量显示单位。通过`attachMeta`附加。 |

> 列表门控条件(`findMergeableLots`): `MAT_STOCKS.QTY > 0` AND `MAT_LOTS.STATUS='NORMAL'` AND `NVL(RESERVED_QTY,0)=0` AND **入库完成**(见下方逻辑)。

---

## ② 材料LOT — MAT_LOTS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 材料UID | `MAT_UID` (varchar2 50) | PK。序列号。新合并LOT通过`SEQ_MAT_SERIAL_DAILY`编号(`VH1-RM...`)。 |
| 物料代码 | `ITEM_CODE` (varchar2 50) | 物料。新LOT继承原物料。 |
| 初始数量 | `INIT_QTY` (int) | 不可变原始数量。新LOT以`totalQty`(合计数量)创建。入库完成门控比较基准。 |
| 当前数量 | `CURRENT_QTY` (int) | 当前余量。原在合并时更新为0，新为`totalQty`。 |
| 入库日期 | `RECV_DATE` (date) | 新LOT继承首个扫描(base)LOT的值。 |
| 制造日期 | `MANUFACTURE_DATE` (date) | 新LOT继承base。 |
| 有效期 | `EXPIRE_DATE` (date) | 新LOT继承原中**最早日期**(保守继承)。 |
| 入货号 | `ARRIVAL_NO` (varchar2 50) | 合并核心键。所有原必须相同。新LOT继承。 |
| 入货SEQ | `ARRIVAL_SEQ` (number) | 继承base。用于标签发行。 |
| 原产地/跟踪 | `ORIGIN` (varchar2 50) | 新LOT = `base.origin || base.matUid`。也记录为收发`REF_ID`。 |
| 客户 | `VENDOR` (varchar2 50) | 继承base。 |
| 制造商代码 | `MFG_PARTNER_CODE` (varchar2 50) | 继承base。同一入货件，制造商应一致。标签打印。 |
| 发票号 | `INVOICE_NO` (varchar2 50) | 继承base。 |
| PO号 | `PO_NO` (varchar2 50) | 继承base。 |
| IQC状态 | `IQC_STATUS` (varchar2 20) | 继承base。 |
| 特采与否 | `SPECIAL_ACCEPT_YN` (char 1) | 默认N。 |
| LOT状态 | `STATUS` (varchar2 20) | `NORMAL`/`HOLD`/`DEPLETED`/`SPLIT`/`MERGED`。原→`MERGED`, 新→`NORMAL`。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` 范围。所有查询·保存过滤。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改用户·时间。 |

---

## ③ 材料库存 — MAT_STOCKS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 仓库代码 | `WAREHOUSE_CODE` | PK(复合)。新LOT继承base LOT的仓库。 |
| 位置代码 | `LOCATION_CODE` | 继承base。 |
| 物料代码 | `ITEM_CODE` | PK(复合)。 |
| 材料UID | `MAT_UID` | PK(复合)。 |
| 数量 | `QTY` | 合并合计基准。原更新为0，新为`totalQty`。 |
| 可用数量 | `AVAILABLE_QTY` | 原为0，新为`totalQty`。 |
| 预约数量 | `RESERVED_QTY` | 大于0则不可合并(门控·验证)。新为0。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK(复合)范围。 |

---

## ④ 收发台账 — STOCK_TRANSACTIONS

每次合并按原数量记录`LOT_MERGE_OUT` + 1条新`LOT_MERGE_IN`。

| DB列 | 角色 / 含义 · 操作要点 |
|------|------|
| `TRANS_NO` | PK。通过`NumberingService.next('STOCK_TX')`编号。 |
| `TRANS_TYPE` | `LOT_MERGE_OUT`(原出库, 负数) / `LOT_MERGE_IN`(新入库, 正数)。 |
| `TRANS_DATE` | 交易日期时间。 |
| `FROM_WAREHOUSE_ID` | OUT: 原LOT仓库。 |
| `TO_WAREHOUSE_ID` | IN: 新LOT仓库。 |
| `ITEM_CODE` | 物料代码。 |
| `MAT_UID` | OUT: 原序列号 / IN: 新序列号。 |
| `QTY` | OUT: `-原库存` / IN: `+合计数量`。 |
| `REF_TYPE` | `'LOT_MERGE'`。 |
| `REF_ID` | OUT: 原`MAT_UID` / IN: `ORIGIN`(原列表因长度限制记录于REMARK)。 |
| `REMARK` | `材料合并: [原序列号] → 新 (合计数量)` 格式。 |
| `STATUS` | `'DONE'`。入库完成门控SQL仅统计`STATUS <> 'CANCELED'`。 |
| `WORKER_ID`, `CREATED_BY` | 处理用户。 |
| `COMPANY`, `PLANT_CD` | 多租户范围。 |

---

## 合并逻辑 (操作顺序)

`POST /material/lot-merge` (`LotMergeService.merge`), 单个DB事务(`TransactionService.run`):

1. `sourceLotIds` 去重后验证**2个以上**。
2. 从`MAT_LOTS`查询所有`MAT_UID` — 缺失返回404。验证租户一致。
3. 验证**同一物料**(`ITEM_CODE`单一)。
4. 验证**同一入货号**(`ARRIVAL_NO`单一, 不可NULL)。
5. 查询`MAT_STOCKS` → 按序列号构建库存映射。
6. 逐LOT验证状态/库存/预约/入库完成:
   - `STATUS='HOLD'`不可, `STATUS<>'NORMAL'`不可。
   - `QTY<=0`不可, `RESERVED_QTY>0`不可。
   - **入库完成门控**: `SUM(STOCK_TRANSACTIONS.QTY WHERE TRANS_TYPE IN ('RECEIVE','LOT_SPLIT_IN','LOT_MERGE_IN') AND STATUS<>'CANCELED') >= MAT_LOTS.INIT_QTY`。
7. 验证**出库记录**(`MAT_ISSUE`中存在`STATUS<>'CANCELED'`时不可)。
8. 查询物料(`PART_MASTER`)·验证租户。
9. 计算合计值: `totalQty=Σ库存`, `origin=base.origin||base.matUid`, `expireDate=MIN(原有效期)`。
10. **原废弃**: 对每个原记录`LOT_MERGE_OUT`(−库存)收发 → `MAT_LOTS.STATUS='MERGED', CURRENT_QTY=0` → `MAT_STOCKS.QTY=0, AVAILABLE_QTY=0`。
11. **新序列号发行**: 通过`numbering.nextMatSerial`生成`MAT_UID`，创建`MAT_LOTS`(`STATUS='NORMAL'`, 继承base信息) + `MAT_STOCKS`(`QTY=AVAILABLE_QTY=totalQty`, `RESERVED_QTY=0`)。
12. **新入库**`LOT_MERGE_IN`(+合计数量)收发记录。
13. 响应: `newLotNo`, `mergedLotNos`, `totalQty`, `itemCode`, `itemName`, `arrivalNo`, 标签数据(`MatLabelPreviewModal`复用)。

> `by-barcode/:matUid`(`findByBarcode`)预先验证单条扫描的合并资格(状态/库存/预约/入库完成/出库记录)，供前端累计使用。

---

## API路径

| 目的 | 路径 |
|------|------|
| 可合并LOT列表 | `GET /material/lot-merge` (`search`, `itemCode`, `limit`) |
| 条码单条资格验证 | `GET /material/lot-merge/by-barcode/:matUid` |
| LOT合并执行 | `POST /material/lot-merge` (`sourceLotIds[]`, `remark?`) — 应用`InventoryFreezeGuard` |

---

## 预设条件 (主表·公共代码)

- 合并目标LOT需**入库完成**(IQC合格后入库反映到`MAT_STOCKS`)才在列表中显示。
- 新序列号编号序列(`SEQ_MAT_SERIAL_DAILY`)·收发编号键(`STOCK_TX`)需正常运行。
- 制造商(`PARTNER_MASTER`, `PARTNER_TYPE='MFG'`)需已注册，标签制造商名才可显示。
- 建议设置用于标签输出的`mat_lot`分类标签模板(`/master/label-templates`)。
- 库存封账(`InventoryFreezeGuard`)期间可能阻止合并执行。

---

## 操作流程

1. 在列表/搜索中确认要合并的LOT或通过条码扫描累计(2个以上, 同一物料·同一入货号)。
2. **选择合并** → 在确认模态框中确认合计数量 → **执行合并**。
3. 原废弃·新发行在单个事务中处理(部分失败时整体回滚)。
4. 输出新序列号标签并贴附到合并箱上。

---

## 权限

| 角色 | 允许操作 |
|------|------|
| 普通用户 | 可合并LOT查询, 条码累计, 合并执行, 标签输出 |
| 物流/材料负责人 | 同上 |
| 运营者/管理员 | 以上 + 库存封账/例外处理判断 |

---

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 列表中无LOT | 库存为0 / 有预约 / 入库未完成 / 状态异常 | 确认入库确认·解除预约·确认状态 |
| "仅入库完成的LOT可合并"错误 | `SUM(入库收发) < INIT_QTY` | IQC合格后完成入库确认 |
| "不同物料"错误 | 累计LOT的`ITEM_CODE`不一致 | 仅选择同一物料LOT |
| "仅入货号相同的LOT"错误 | `ARRIVAL_NO`不一致或NULL | 仅合并同一入货件的LOT |
| "有预约数量的LOT"错误 | `RESERVED_QTY > 0` | 解除预约/分配后重试 |
| "已有材料出库记录"错误 | `MAT_ISSUE`中存在活跃出库 | 整理该LOT出库后重试 |
| 新序列号编号失败 | 序列/编号键异常 | 检查`SEQ_MAT_SERIAL_DAILY`·`STOCK_TX`状态 |
| 合并按钮禁用 | 累计不足2个 | 累计2个以上序列号 |
| 标签未输出 | Print Agent未运行 | 确认本地Print Agent状态 |

---

## 数据·关联

| 项目 | 内容 |
|------|------|
| 主要表 | `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| 引用表 | `MAT_ISSUE`(出库记录验证), `PART_MASTER`(物料), `PARTNER_MASTER`(客户/制造商) |
| 收发类型 | `LOT_MERGE_OUT`(原废弃), `LOT_MERGE_IN`(新入库) — `REF_TYPE='LOT_MERGE'` |
| 编号 | 新序列号`SEQ_MAT_SERIAL_DAILY`(`VH1-RM...`), 收发`STOCK_TX` |
| 关联界面 | 材料分割(对称), 入货管理(LOT发行), 入库检验(IQC门控) |
| 多租户范围 | `COMPANY = '40'`, `PLANT_CD = '1000'` — 所有查询·保存时通用过滤 |
