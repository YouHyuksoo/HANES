---
menuCode: PUR_PO
audience: operator
title: PO管理 — 操作指南
summary: PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS 表结构, 状态迁移逻辑, 编号规则, 多租户范围, 包括故障排除
tags: [材料管理, 采购订单, PO, 操作, 主表]
keywords: [PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, PO_NO, PARTNER_ID, PARTNER_NAME, ORDER_DATE, DUE_DATE, STATUS, USE_TYPE, TOTAL_AMOUNT, LINE_NO, REV_NO, SEQ, ORDER_QTY, RECEIVED_QTY, LINE_STATUS, REL_NO, UNIT_PRICE, DRAFT, CONFIRMED, PARTIAL, RECEIVED, CLOSED, 编号, 多租户, COMPANY, PLANT_CD, 入货, 入库检验]
related: [PUR_PO_STATUS, MAT_RECEIVE, MST_PART]
---

# PO管理 — 操作指南

## 系统目的·角色
管理采购订单(PO)完整生命周期的材料管理模块核心界面。已登记的PO在入货管理(MAT_RECEIVE)中入库处理时被引用，状态自动更新为PARTIAL/RECEIVED。没有PO则无法进行入货处理。

## 数据结构

```
PURCHASE_ORDERS (PK: PO_NO)
  ├─ PARTNER_ID ──▶ PARTNER_MASTERS (供应商)
  └─ PURCHASE_ORDER_ITEMS (PK: PO_ID + SEQ)
       └─ ITEM_CODE ──▶ ITEM_MASTERS (物料主表)
       └─ 引用: MAT_ARRIVALS (入货关联)
```

## ① PO头 — PURCHASE_ORDERS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| PO No. | `PO_NO` | PK(自然键)。编号规则: `PO-YYYYMMDD-NNN` (NumberingService)。不可变 — 创建后不可更改。 |
| 客户(ID) | `PARTNER_ID` | 引用`PARTNER_MASTERS.PARTNER_CODE`。界面显示名称(`partnerName`)。 |
| 客户名称 | `PARTNER_NAME` | 登记时基于`PARTNER_ID`从主表查询自动填写。客户名称后续更改时PO记录保留登记时的名称。 |
| 采购日期 | `ORDER_DATE` | date类型。默认值登记当天。列表过滤器基准列(`@Index`)。 |
| 交货日期 | `DUE_DATE` | date类型。nullable。用于入货交期遵守率分析。 |
| 状态 | `STATUS` | 状态流程(见下文)。默认值`DRAFT`。公共代码`PO_STATUS`。存在`@Index`。 |
| 用途类型 | `USE_TYPE` | 采购目的区分。当前默认值`PROD`(生产用)。UI不显示。 |
| 总金额 | `TOTAL_AMOUNT` | decimal(14,2)。按物料`ORDER_QTY × UNIT_PRICE`合计。单价未输入时为0。保存时由服务层计算。 |
| 备注 | `REMARK` | varchar2(500)。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 范围: `'40'` / `'1000'`。应用于所有查询/保存。 |
| 登记人 | `CREATED_BY` | 会话用户ID。 |
| 修改人 | `UPDATED_BY` | 修改时会话用户ID。 |
| 审计 | `CREATED_AT`, `UPDATED_AT` | timestamp。TypeORM `@CreateDateColumn` / `@UpdateDateColumn`。 |

## ② PO物料 — PURCHASE_ORDER_ITEMS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| (无) | `PO_ID` | PK组成(复合)。引用`PURCHASE_ORDERS.PO_NO`。实体字段名为`poNo`。 |
| (无) | `SEQ` | PK组成(复合)。物料保存顺序(0-based index + 1)。 |
| 物料代码 | `ITEM_CODE` | 引用`ITEM_MASTERS.ITEM_CODE`。存在`@Index`。 |
| 采购数量 | `ORDER_QTY` | int。1以上整数必填。 |
| 入库数量 | `RECEIVED_QTY` | int。默认值0。入货处理时自动累计。界面(PO登记)中不可修改 — 仅在入货管理中变更。 |
| 行号 | `LINE_NO` | 用户指定的采购行标识号。默认值为添加顺序。 |
| 修订号 | `REV_NO` | 同一物料的采购批次。默认值1。界面标签: "修订号"。 |
| 行状态 | `LINE_STATUS` | 默认值`OPEN`。按入库进度变更(操作参考)。界面不显示。 |
| Release No. | `REL_NO` | nullable int。ERP等外部系统release引用用。当前界面不显示。 |
| 单价 | `UNIT_PRICE` | decimal(12,4)。nullable。界面无输入UI(通过API直接或未来扩展)。用于总金额计算。 |
| 备注 | `REMARK` | varchar2(500)。按物料行备注。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 自动应用与头相同范围。 |
| 审计 | `CREATED_AT`, `UPDATED_AT` | timestamp。 |

## 状态迁移逻辑

| 迁移 | API路径 | 条件 | 备注 |
|------|------|------|------|
| DRAFT → CONFIRMED | `PATCH /material/purchase-orders/:id/confirm` | 仅当前状态`DRAFT` | 采购确认。之后可入货。 |
| CONFIRMED → PARTIAL | (入货处理时自动) | 部分物料入库完成 | MAT_ARRIVALS处理时自动变更 |
| PARTIAL → RECEIVED | (入货处理时自动) | 全部物料入库完成 | MAT_ARRIVALS处理时自动变更 |
| RECEIVED/PARTIAL → CLOSED | `PATCH /material/purchase-orders/:id/close` | 当前状态`RECEIVED`或`PARTIAL` | 手动关闭 |
| DRAFT → (删除) | `DELETE /material/purchase-orders/:id` | DRAFT + 无入货记录 | 存在入货时400错误 |

> CONFIRMED之后的状态无法通过界面UI直接恢复。如需状态恢复需直接修改DB或调用API。

## PO号编号规则

- 服务: `NumberingService.nextPoNo()`
- 格式: `PO-YYYYMMDD-NNN` (例如: `PO-20260621-001`)
- API: `GET /material/purchase-orders/next-no` — 打开登记面板时自动调用。
- PO No.是`PURCHASE_ORDERS`表的PK(`PO_NO`)，重复登记时返回409 ConflictException。

## 物料修改操作 (修改保存时)

修改保存时物料(PURCHASE_ORDER_ITEMS)按**全部删除原有 → 重新插入**方式处理(事务保护)。`SEQ`重新发行(0-based index + 1)。`RECEIVED_QTY`也可能在此过程中初始化，因此已部分入货的PO应避免修改物料。

## 总金额计算

总金额(`TOTAL_AMOUNT`)在保存时由服务层按如下方式计算。

```
TOTAL_AMOUNT = Σ (ORDER_QTY × UNIT_PRICE)
```

`UNIT_PRICE`为null时按0处理。总金额保存后记录到`PURCHASE_ORDERS.TOTAL_AMOUNT`，不实时重新计算。

## 预设条件 (主表·公共代码)

- 公共代码`PO_STATUS`: DRAFT / CONFIRMED / PARTIAL / RECEIVED / CLOSED 各代码的`attr1`(CSS类)控制列表徽标颜色
- 客户主表(`PARTNER_MASTERS`): 仅`partnerType='SUPPLIER'`类型可选
- 物料主表(`ITEM_MASTERS`): 仅`itemType='RAW_MATERIAL'`类型可在物料添加模态框中搜索

## 操作流程

1. **PO登记**: 选择客户 → 设置采购日期/交期 → 添加物料(可多选) → 输入采购数量 → 保存(DRAFT)
2. **采购确认**: 在DRAFT PO上点击确认操作 → CONFIRMED (可入货状态)
3. **入货关联**: 在入货管理界面按PO号进行入库处理 → 更新RECEIVED_QTY → 状态自动迁移
4. **关闭**: 全部入库完成后手动关闭(CLOSED)

## 权限

- **登记·修改·删除**: 材料管理负责人 (仅DRAFT状态)
- **确认·关闭**: 材料管理负责人或采购批准人
- **查询**: 全体用户

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| PO保存时"PO号已存在"错误(409) | `PO_NO`重复 | 使用自动编号的号码，或改为其他号码 |
| 采购数量为0或输入小数时保存被阻止 | `ORDER_QTY`验证(1以上整数) | 修正为1以上整数后保存 |
| PO不可删除"已进行入货的PO"错误 | `MAT_ARRIVALS`中存在该`PO_NO`的入货记录 | 先取消/删除入货记录后再删除PO |
| PO不可删除"仅DRAFT状态可删除"错误 | `STATUS != 'DRAFT'` | 通过直接操作DB或运营流程恢复状态 |
| 总金额显示为0 | `UNIT_PRICE`未输入 | 登记物料单价(通过API或DB直接) |
| 列表中物料名·规格不显示 | `ITEM_MASTERS`中不存在该`ITEM_CODE` | 确认该物料已在物料主表中登记 |
| 修改后入库数量(RECEIVED_QTY)被初始化为0 | 修改保存时物料全部删除·重新插入操作 | 已入货的PO禁止修改物料；必要时通过DB直接校正 |

## 数据·关联

- 表: `PURCHASE_ORDERS`, `PURCHASE_ORDER_ITEMS`
- 关联: `PARTNER_MASTERS`(供应商), `ITEM_MASTERS`(物料), `MAT_ARRIVALS`(入货处理)
- API路径: `GET|POST /material/purchase-orders`, `GET|PUT|DELETE /material/purchase-orders/:id`, `PATCH /material/purchase-orders/:id/confirm`, `PATCH /material/purchase-orders/:id/close`
- 范围: `COMPANY='40'`, `PLANT_CD='1000'` (自动应用于所有查询·保存)
