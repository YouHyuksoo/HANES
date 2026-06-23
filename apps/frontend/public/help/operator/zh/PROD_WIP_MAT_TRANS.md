---
menuCode: PROD_WIP_MAT_TRANS
audience: operator
title: 工序物料收发 — 操作指南
summary: WIP_MAT_TRANSACTIONS全列参照、工序收发类型含义、WIP库存联动结构与故障排除
tags: [生产, WIP, 工序, 收发, 操作, 设备]
keywords: [WIP_MAT_TRANSACTIONS, WIP_MAT_STOCKS, 工序收发, WIP_IN, PROD_CONSUME, CANCEL_REF_ID, 设备库存, EQUIP_CODE, ITEM_MASTERS, EQUIP_MASTERS]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# 工序物料收发 — 操作指南

## 系统目的·作用
从 `WIP_MAT_TRANSACTIONS` 表查询以设备(工序)为单位管理的所有原材料工序库存(WIP)交易记录。每当原材料进入 `WIP_MAT_STOCKS`(工序库存)或被生产消耗时自动记录，取消时通过 `CANCEL_REF_ID` 与原交易关联，实现工序库存流转的透明追踪和审计。

## 数据结构
```
WIP_MAT_TRANSACTIONS (PK: TRANS_NO — WTXYYMMDD-NNNNN)
    │
    ├── 基本信息: TRANS_TYPE, QTY, STATUS
    ├── 设备: EQUIP_CODE → EQUIP_MASTERS (equipName)
    ├── 品目/LOT: ITEM_CODE → ITEM_MASTERS, MAT_UID → MAT_LOTS
    ├── 参照: REF_TYPE + REF_ID (ORDER_NO等原始参照)
    └── 取消链: CANCEL_REF_ID → WIP_MAT_TRANSACTIONS.TRANS_NO
            │
            └── WIP_MAT_STOCKS (PK: COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + MAT_UID)
                    ├── QTY (工序库存总量)
                    ├── AVAILABLE_QTY (可用)
                    └── RESERVED_QTY (已预约)
```

---

## ① 工序收发 — WIP_MAT_TRANSACTIONS (全部列)

| 画面项目 | DB列 | 作用/含义 · 操作要点 |
|------|------|------|
| 交易编号 | `TRANS_NO` | **PK**。工序收发唯一标识。格式: `WTXYYMMDD-NNNNN`。 |
| 交易类型 | `TRANS_TYPE` | `WIP_IN` / `WIP_IN_CANCEL` / `PROD_CONSUME` / `PROD_CONSUME_CANCEL`。 |
| 设备代码 | `EQUIP_CODE` | 交易发生的设备。参照 `EQUIP_MASTERS.EQUIP_CODE`。 |
| 品目代码 | `ITEM_CODE` | 交易对象原材料。参照 `ITEM_MASTERS.ITEM_CODE`。 |
| LOT编号 | `MAT_UID` | 对象LOT序列号。参照 `MAT_LOTS.MAT_UID`。 |
| 数量 | `QTY` | 变动数量。WIP_IN(+)、PROD_CONSUME(-)、取消时反号。 |
| 出库仓库 | `FROM_WAREHOUSE_ID` | WIP_IN时供应原材料的物料仓库。 |
| 工单编号 | `ORDER_NO` | 关联的工单(ProdOrder)编号。 |
| 参照类型 | `REF_TYPE` | 原始文档类型(如 WORK_ORDER)。 |
| 参照ID | `REF_ID` | 原始文档编号。 |
| 取消参照 | `CANCEL_REF_ID` | 取消时参照的原 `TRANS_NO`。NULL = 正常交易。 |
| 状态 | `STATUS` | `DONE`(正常) / `CANCELED`(取消)。默认 `DONE`。 |
| 备注 | `REMARK` | 附加说明。 |
| 作业者 | `WORKER_NO` | 交易处理的作业者ID。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 公司代码(`40`) / 工厂代码(`1000`) 范围。 |
| 创建时间 | `CREATED_AT` | 交易登记时间。列表的时间列显示。 |
| 修改时间 | `UPDATED_AT` | 最后修改时间。 |

---

## 交易类型详情

| 类型 | 说明 | QTY符号 | WIP_MAT_STOCKS效果 |
|------|------|---------|-------------------|
| WIP_IN | 物料仓库 → 设备工序投入原材料 | + | 工序库存增加 |
| WIP_IN_CANCEL | 取消WIP_IN — 原材料退回物料仓库 | - | 工序库存减少 |
| PROD_CONSUME | 设备中原材料的实际生产消耗 | - | 工序库存减少 |
| PROD_CONSUME_CANCEL | 取消PROD_CONSUME — 消耗还原 | + | 工序库存增加 |

---

## WIP库存联动结构

服务方法及其生成的交易类型关系:

| 服务方法 | 生成的 TRANS_TYPE | WIP_MAT_STOCKS效果 |
|-------------|-------------------|----------------|
| `addStockInTx()` | WIP_IN | `QTY` +, `AVAILABLE_QTY` + |
| `deductStockInTx()` | PROD_CONSUME | FIFO扣除(可指定LOT优先顺序) |
| `restoreInTx(ADD_BACK)` | WIP_IN_CANCEL | 取消时恢复 |
| `restoreInTx(DEDUCT_BACK)` | PROD_CONSUME_CANCEL | 取消时恢复 |

> `addStockInTx`对 `WIP_MAT_STOCKS` 执行UPSERT — 若 `EQUIP_CODE + ITEM_CODE + MAT_UID` 组合不存在则新建，存在则累加。

---

## 取消链结构

```
原始 WIP_IN (TRANS_NO = 'WTX20250601-00001', QTY = +100)
    │
    ├── 取消时 → 创建 WIP_IN_CANCEL (QTY = -100, CANCEL_REF_ID = 原始.TRANS_NO)
    │              原始 STATUS = 'CANCELED'
    │
    └── WIP_MAT_STOCKS: 该LOT数量 -100
```

---

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 查询无结果 | 筛选条件过于严格(设备/类型/日期) | 重置筛选或扩大范围重新查询 |
| 特定设备的交易不显示 | 设备筛选选择了其他设备 | 确认设备选择筛选器 |
| 数量为0或NULL | 原始交易已被取消 | 通过 `CANCEL_REF_ID` 确认取消链 |
| LOT编号不显示 | 该交易的 `MAT_UID` 为NULL | 未应用LOT单位的交易(按数量处理) |
| 备注为空 | `REMARK` 无值 | 非必填项目，正常 |

## 数据·关联
- **表**: `WIP_MAT_TRANSACTIONS` (交易台账), `WIP_MAT_STOCKS` (工序库存), `EQUIP_MASTERS` (设备), `ITEM_MASTERS` (品目)
- **关联**: 工单(`PROD_ORDER`), 物料入库/出库, 生产实绩输入
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
- **编号**: `SEQ_WIP_TX.NEXTVAL` → `WTXYYMMDD-NNNNN` 格式
