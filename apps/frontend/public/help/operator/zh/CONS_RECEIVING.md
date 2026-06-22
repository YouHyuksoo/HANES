---
menuCode: CONS_RECEIVING
audience: operator
title: 耗材入库 — 操作指南
summary: 耗材入库的两条路径(条码扫描标签确认 / 手动IN)与DB映射(CONSUMABLE_LOGS·CONSUMABLE_STOCKS·CONSUMABLE_MASTERS), 库存反映·符号逻辑, 编号, 权限, 故障排除, 多租户
tags: [耗材, 入库, 收发, 操作]
keywords: [耗材入库, 入库, 归还入库, IN, IN_RETURN, CONSUMABLE_LOGS, CONSUMABLE_STOCKS, CONSUMABLE_MASTERS, STOCK_QTY, conUid, CON_UID, PENDING, ACTIVE, SEQ_CONSUMABLE_LOGS, 编号, 库存反映, 入库区分, NEW, REPLACEMENT, 多租户, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_LABEL, CONS_STOCK]
---

# 耗材入库 — 操作指南

## 系统目的·角色
将耗材**确认为仓库持有库存**的入库处理界面。入库处理后，耗材主表(`CONSUMABLE_MASTERS.STOCK_QTY`)的持有库存将增减，并在出入库记录表(`CONSUMABLE_LOGS`)中编号·记录1笔交易。入库有以下两条路径。

> 入库路径分为两种。
> - **① 条码扫描入库**(`POST /consumables/label/confirm`): 将标签发行中编号的单个实例(`CONSUMABLE_STOCKS`, `CON_UID`)从 `PENDING → ACTIVE` 确认。UID级别跟踪。
> - **② 手动入库**(`POST /consumables/receiving`, `logType: 'IN'`): 无需UID，按耗材代码+数量增加库存。不创建 `CONSUMABLE_STOCKS` 实例。

## 数据结构
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE, STOCK_QTY = 持有库存)
   ├─ 1:N ─▶ CONSUMABLE_STOCKS (PK: CON_UID, status PENDING→ACTIVE→…) ← 扫描入库对象
   └─ 1:N ─▶ CONSUMABLE_LOGS   (复合PK: TRANS_DATE + SEQ, 出入库记录) ← 两条路径均记录
```
- 扫描入库: `CONSUMABLE_STOCKS` 状态迁移 + `CONSUMABLE_LOGS`(IN) 1条 + `STOCK_QTY +1`。
- 手动入库: `CONSUMABLE_LOGS`(IN) 1条 + `STOCK_QTY += qty`。(不创建实例)

## API
| 操作 | 方法 · 路径 | 说明 |
|------|------|------|
| 未入库待处理列表 | `GET /consumables/label/pending` | `CONSUMABLE_STOCKS.STATUS='PENDING'` 列表 |
| 扫描入库确认 | `POST /consumables/label/confirm` `{ conUid, location?, remark? }` | PENDING→ACTIVE, `STOCK_QTY +1`, IN日志 |
| 扫描归还入库 | `POST /consumables/label/return` `{ conUid, returnReason? }` | ACTIVE→RETURNED, `STOCK_QTY -1`, IN_RETURN日志 |
| 多条扫描入库 | `POST /consumables/label/confirm-bulk` `{ conUids[], location? }` | confirm顺序重复 |
| 手动入库 | `POST /consumables/receiving` `{ consumableId, qty, logType:'IN', … }` | `STOCK_QTY += qty`, IN日志 (不创建实例) |
| 入库记录列表 | `GET /consumables/logs` | `logType` / `logTypeGroup=RECEIVING` / 期间过滤 |

> 界面表格中的 `SELECT * FROM CONSUMABLE_LOGS …` 仅是显示标签，实际查询通过上述API进行。

---

## ① 条码扫描面板 ↔ DB

| 界面项目 | DB列 / 参数 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 入库/归还模式 | (请求分支) | 入库=`/label/confirm`，归还=`/label/return` 调用。 |
| UID条码 | `ConfirmConReceivingDto.conUid` → `CONSUMABLE_STOCKS.CON_UID` | 标签发行时编号的单个实例PK。Enter输入即立即处理。 |
| 存放位置(入库) | `ConfirmConReceivingDto.location` → `CONSUMABLE_STOCKS.LOCATION` | 入库确认时记录为该UID的存放位置(可选)。 |
| 退货原因(归还) | `ReturnConReceivingDto.returnReason` → `CONSUMABLE_STOCKS.REMARK`, `CONSUMABLE_LOGS.RETURN_REASON` | 归还原因。记录在实例备注和日志原因中。 |

### 未入库待处理列表 — CONSUMABLE_STOCKS (STATUS='PENDING')
| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| UID | `CON_UID` | 实例PK。 |
| 耗材代码 | `CONSUMABLE_CODE` | 主表FK。 |
| 耗材名称 | `CONSUMABLE_MASTERS.NAME` | 从主表关联(属性名 `consumableName`)。 |
| 分类 | `CONSUMABLE_MASTERS.CATEGORY` | 公共代码 `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL)。 |
| 标签打印日期 | `LABEL_PRINTED_AT` | 标签发行时间。 |
| 供应商名称 | `VENDOR_NAME` | 标签发行时输入值(也持有 `VENDOR_CODE`)。 |

## ② 入库记录表格 — CONSUMABLE_LOGS (所有显示列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 日期时间 | `CREATED_AT` | 处理时间(TIMESTAMP)。排序依据(DESC)。 |
| (键) 交易日期 | `TRANS_DATE` | 复合PK。按入库处理日午夜(`00:00`)存储。 |
| (键) 序列号 | `SEQ` | 复合PK。通过 `SEQ_CONSUMABLE_LOGS` 序列编号。 |
| 耗材代码 | `CONSUMABLE_CODE` | 主表FK。 |
| 耗材名称 | `CONSUMABLE_MASTERS.NAME` | 关联显示。 |
| UID | `CON_UID` | 仅扫描入库有值。手动入库为null → `-`。 |
| 类型 | `LOG_TYPE` | `IN`(入库)/`IN_RETURN`(入库退货)。整体收发还包括 OUT/OUT_RETURN/USAGE/REPLACE。 |
| 数量 | `QTY` | 入库/归还数量(INT, default 1)。界面以 IN `+`, IN_RETURN `-` 显示(存储值为正数)。 |
| 供应商代码 | `VENDOR_CODE` | 供应商代码。 |
| 供应商名称 | `VENDOR_NAME` | 供应商名称。 |
| 单价 | `UNIT_PRICE` | NUMBER(12,2)。入库单价。 |
| 入库区分 | `INCOMING_TYPE` | `NEW`(新规)/`REPLACEMENT`(更换)。扫描入库固定为 `NEW`。 |
| 备注 | `REMARK` | 入库/归还备注。 |
| 退货原因 | `RETURN_REASON` | 归还入库原因(IN_RETURN)。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `UPDATED_AT` | 创建/修改记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000` 范围(实体属性名 `company`, `plant`)。 |

> 出库专用列 `DEPARTMENT`/`LINE_CODE`/`EQUIP_CODE`/`ISSUE_REASON` 在同一表中，但入库界面不使用（在出库界面 `CONS_ISSUING` 中使用）。

## ③ 手动入库表单 ↔ CONSUMABLE_LOGS

`POST /consumables/receiving` 在请求体中强制填入 `logType:'IN'` 通过 `createLog` 处理。

| 界面项目 | DTO字段 → DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 耗材 | `consumableId` → `CONSUMABLE_CODE` | 验证存在(否则404)。 |
| 数量 | `qty` → `QTY` | `STOCK_QTY += qty`。默认1，最小1。 |
| 入库区分 | `incomingType` → `INCOMING_TYPE` | NEW/REPLACEMENT。 |
| 供应商代码/名称 | `vendorCode`/`vendorName` → `VENDOR_CODE`/`VENDOR_NAME` | 供应商。 |
| 单价 | `unitPrice` → `UNIT_PRICE` | 入库单价(可选)。 |
| 备注 | `remark` → `REMARK` | 备注(可选)。 |

## 入库 / 库存反映逻辑
**手动入库(`createLog`)的库存符号** — 按 `logType` 区分 `stockDelta`:
- `IN` → `+qty`, `OUT` → `-qty`, `IN_RETURN` → `-qty`, `OUT_RETURN` → `+qty`。
- `stockDelta < 0` 且 `STOCK_QTY + stockDelta < 0` 则返回**库存不足 400**。
- 事务: 保存 `CONSUMABLE_LOGS` 1条 + 更新 `CONSUMABLE_MASTERS.STOCK_QTY`(原子操作)。IN时 `LAST_REPLACE` 也更新为当前时间。

**扫描入库确认(`confirmReceiving`)**:
1. 查询 `CON_UID`。如果 `STATUS != 'PENDING'` 则返回**400**(已入库)。
2. `STATUS='ACTIVE'`, `RECV_DATE`=当前时间, 更新 `LOCATION`/`REMARK`。
3. `CONSUMABLE_MASTERS.STOCK_QTY` **+1**。
4. `CONSUMABLE_LOGS` IN日志1条(包含 `CON_UID`, `INCOMING_TYPE='NEW'`)。

**扫描归还(`returnByScan`)**: 仅允许 `STATUS='ACTIVE'`(否则返回400) → `STATUS='RETURNED'`, `STOCK_QTY -1`, IN_RETURN日志。

## 编号
- `CONSUMABLE_LOGS.SEQ`: Oracle序列 `SEQ_CONSUMABLE_LOGS.NEXTVAL`。与 `TRANS_DATE`(午夜)组成复合PK。
- `CON_UID`(实例): 在标签发行阶段(`CONS_LABEL`)通过编号服务 `CON_UID` 通道发行。入库界面不编号，仅确认现有UID。

## 预设条件
- [耗材主表](`CONSUMABLE_MASTERS`)中入库目标耗材需注册为 `USE_YN='Y'`。
- 扫描入库需在[耗材标签发行](`CONS_LABEL`)中已发行 `CON_UID` 且处于PENDING状态。
- 存放位置选项基于位置主表(`useLocationOptions`)。
- 公共代码: `CONSUMABLE_CATEGORY`(待处理列表分类徽标)。

## 操作流程
1. 通过标签发行发行 `CON_UID`(扫描入库路径) → 在未入库待处理列表中显示。
2. 在入库模式下扫描UID → 确认入库(库存 +1, IN日志)。
3. 无UID的通过**入库注册**表单手动入库(库存 += qty)。
4. 错误入库可通过**归还**模式扫描UID(ACTIVE→RETURNED, 库存 -1)。
5. 通过入库记录表格(期间·类型过滤)进行验证。

## 权限
耗材/材料负责人(入库·归还处理)。普通用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 未入库待处理列表为空 | `CON_UID` 未发行或已全部入库 | 在[耗材标签发行]中发行UID后重试 |
| 扫描时"已入库状态"(400) | `STATUS != 'PENDING'`(已是ACTIVE等) | 确认入库记录。不是重复入库 |
| 扫描时"未找到UID"(404) | 输入错误/跨工厂UID/未发行 | 确认UID·多租户(`COMPANY`/`PLANT_CD`) |
| 归还被阻止(400) | UID不是ACTIVE状态 | 仅已入库确认(激活)的UID可归还 |
| 手动入库注册按钮禁用 | 未选择耗材 | 通过搜索图标选择耗材 |
| 手动入库/归还"库存不足"(400) | `STOCK_QTY + delta < 0` | 扣减路径(归还)中确认当前库存 |
| 入库后库存未增加 | 查询的是其他工厂范围 | 确认 `COMPANY='40'`/`PLANT_CD='1000'` 范围 |

## 数据·关联
- 表: `CONSUMABLE_LOGS`(出入库记录), `CONSUMABLE_STOCKS`(单个实例/状态), `CONSUMABLE_MASTERS`(持有库存 `STOCK_QTY`)
- 关联: [耗材标签发行](`CONS_LABEL`, `CON_UID` 编号), [耗材主表](`CONSUMABLE_MASTERS`), [耗材库存](`CONS_STOCK`), 耗材出库(`CONS_ISSUING`, 相同日志表)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
