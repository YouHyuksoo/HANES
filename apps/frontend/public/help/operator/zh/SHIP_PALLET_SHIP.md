---
menuCode: SHIP_PALLET_SHIP
audience: operator
title: 托盘出货 — 操作指南
summary: PALLET_MASTERS·SHIPMENT_LOGS的出货确认流程、库存扣减逻辑、事务结构与故障排除
tags: [出货, 托盘, 出货确认, 操作, SHIPPED, 库存]
keywords: [SHIP_PALLET_SHIP, PALLET_MASTERS, SHIPMENT_LOGS, SHIPMENT_ORDER, PALLET_NO, CLOSED, SHIPPED, 出货确认, FG库存扣减, FIFO]
related: [SHIP_ORDER, SHIP_PALLET]
---

# 托盘出货 — 操作指南

## 系统目的·作用
将装载完成(CLOSED)状态的托盘处理为出货确认(SHIPPED)状态。**出货编号自动生成** → 创建`ShipmentLog` → `PalletMaster.STATUS='SHIPPED'` → `BoxMaster.STATUS='SHIPPED'` → `FgLabel.STATUS='SHIPPED'` → **FG库存扣减(FIFO)** → `ShipmentOrderItem.shippedQty`增加 → 全部品目完货时 `ShipmentOrder.STATUS='CLOSED'`，以上全部在一个事务中处理。

## 数据结构
```
ShipmentOrder (出货指令, STATUS=CONFIRMED)
    │
    ├── ShipmentOrderItem (品目别出货数量)
    │
    └── PALLET_MASTERS (PK: COMPANY + PLANT_CD + PALLET_NO)
            │   STATUS: OPEN → CLOSED → SHIPPED
            │   BOX_COUNT, TOTAL_QTY
            │   SHIP_ORDER_NO (→ ShipmentOrder)
            │   SHIPMENT_ID (→ ShipmentLog.SHIP_NO)
            │
            ├── BOX_MASTERS (PK: COMPANY + PLANT_CD + BOX_NO)
            │       STATUS: OPEN → CLOSED → SHIPPED
            │       PART_CODE, QTY
            │
            └── FG_LABELS (存在序列号时)
                    STATUS: SHIPPED
```

---

## ① 托盘主表 — PALLET_MASTERS (全部列)

| 画面项目 | DB列 | 作用/说明 · 运营要点 |
|------|------|------|
| 托盘编号 | `PALLET_NO` | **PK (3/3)**。托盘唯一标识符。 |
| 箱数 | `BOX_COUNT` | 托盘装载的箱数。 |
| 总数量 | `TOTAL_QTY` | 全部产品数量(箱子QTY合计)。 |
| 状态 | `STATUS` | `OPEN` / `CLOSED` / `LOADED` / `SHIPPED`。仅CLOSED可出货。 |
| 装载完成时间 | `CLOSE_TIME` | 托盘CLOSED时间。 |
| 出货时间 | `SHIPPED_TIME` | SHIPPED时间。 |
| 出货编号 | `SHIPMENT_ID` | 引用`ShipmentLog.SHIP_NO`(出货确认时设定)。 |
| 出货指令编号 | `SHIP_ORDER_NO` | 引用`ShipmentOrder.SHIP_ORDER_NO`。 |
| 装载作业者 | `LOADED_BY` | 装载完成作业者。 |
| 多租户 | `COMPANY`, `PLANT_CD` | **PK (1,2/3)**。公司代码(`40`)/工厂代码(`1000`)。 |
| 创建者 | `CREATED_BY` | 托盘创建者。 |
| 修改者 | `UPDATED_BY` | 最后修改者。 |

---

## ② 出货日志 — SHIPMENT_LOGS (全部列)

| DB列 | 作用/说明 |
|---------|------|
| `SHIP_NO` | **PK (3/3)**。出货编号(序列自动生成)。 |
| `SHIP_DATE` | 出货日期。 |
| `SHIP_TIME` | 出货时间(事务时间点)。 |
| `DESTINATION` | 目的地(引用出货指令)。 |
| `CUSTOMER` | 客户(引用出货指令)。 |
| `SHIP_ORDER_NO` | 出货指令编号。 |
| `PALLET_COUNT` | 出货托盘数。 |
| `BOX_COUNT` | 出货箱数。 |
| `TOTAL_QTY` | 总出货数量。 |
| `STATUS` | `LOADED`(装载出货) / `SHIPPED`(出货确认) |
| `ERP_SYNC_YN` | ERP联动与否(`Y`/`N`)。 |
| `COMPANY`, `PLANT_CD` | **PK (1,2/3)**。 |

---

## 出货确认事务详情

调用`POST /shipping/orders/:id/ship-pallets`时执行`ShipOrderService.shipOrderPallets()`:

1. **验证阶段**:
   - 确认出货指令 `status === 'CONFIRMED'`
   - 确认请求品目与出货指令品目一致
   - 确认每个`PALLET_NO`的 `status === 'CLOSED'`
   - 确认`shipmentId === null`(未出货)
   - 确认托盘下所有箱子均为`CLOSED` + OQC PASS状态
   - 确认序列号列表与箱子qty一致

2. **事务内执行**:
   - 生成出货编号 → 创建`ShipmentLog` (status=`LOADED`)
   - 更新`PalletMaster`: `shipmentId=shipNo, status='SHIPPED', shippedTime=now`
   - 更新`BoxMaster`: `status='SHIPPED', shippedAt=now`
   - 更新`FgLabel`: `status='SHIPPED'` (存在序列号时)
   - `ProductInventory.issueStockByItemFifoInTx()` — 基于FIFO的FG库存扣减
   - `ShipmentOrderItem.shippedQty += box.qty`
   - 全部品目完货时 `ShipmentOrder.status = 'CLOSED'`

---

## 状态流程

```
OPEN (托盘创建)
  │
  ▼
CLOSED (装载完成 = 可出货)
  │
  ▼ [在托盘出货画面扫描 + 出货确认]
SHIPPED (出货确认)
  ├── 库存扣减完成
  ├── BoxMaster.STATUS → SHIPPED
  └── 出货指令全部品目出货完成时 → ShipmentOrder.CLOSED
```

---

## 权限
出货处理权限(出货/仓库负责人)。查询权限为全体用户。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 出货指令列表为空 | 无CONFIRMED状态的指令 | 注册出货指令 → 确认(审批)处理 |
| 无法扫描托盘 | 托盘非CLOSED状态 | 在托盘装载画面完成装载处理 |
| "已出货的托盘"错误 | 托盘已为SHIPPED状态 | 查看出货历史 |
| 出货确认按钮未激活 | 未输入有效托盘 | 扫描或输入托盘编号 |
| 库存扣减失败 | 库存不足 | 确认FG库存后补充 |
| 序列号不一致错误 | 序列号列表与箱子qty不一致 | 确认序列号扫描记录 |

## 数据·关联
- **表**: `PALLET_MASTERS`, `BOX_MASTERS`, `SHIPMENT_LOGS`, `SHIPMENT_ORDER`, `SHIPMENT_ORDER_ITEM`, `FG_LABEL`
- **关联**: FG库存(FIFO扣减), ERP联动(`ERP_SYNC_YN`)
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
