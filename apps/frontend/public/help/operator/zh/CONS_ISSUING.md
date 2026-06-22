---
menuCode: CONS_ISSUING
audience: operator
title: 耗材出库 — 操作指南
summary: 耗材UID扫描出库/出库取消的API·DB映射(CONSUMABLE_STOCKS状态迁移, CONSUMABLE_LOGS记录), 库存加减逻辑, 权限, 故障排除, 多租户范围
tags: [耗材, 出库, 归还, 操作, 库存扣减]
keywords: [耗材出库, 出库, 出库取消, 出库退货, OUT, OUT_RETURN, ISSUED, ACTIVE, conUid, CONSUMABLE_STOCKS, CONSUMABLE_LOGS, CONSUMABLE_MASTERS, STOCK_QTY, SEQ_CONSUMABLE_LOGS, issueByScan, issueReturnByScan, logTypeGroup, 多租户, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_RECEIVING, CONS_STOCK]
---

# 耗材出库 — 操作指南

## 系统目的·角色
处理耗材单个实例(`CONSUMABLE_STOCKS`)的**UID(`CON_UID`)级别出库/出库取消**的界面。出库时将实例状态从 `ACTIVE → ISSUED` 迁移，将主表(`CONSUMABLE_MASTERS.STOCK_QTY`)减1，并在记录(`CONSUMABLE_LOGS`)中生成1条 `OUT` 日志。出库取消则相反(`ISSUED → ACTIVE`，库存+1，`OUT_RETURN` 日志)。

> API参考：出库 `POST /consumables/label/issue`(`{ conUid, department?, issueReason?, remark? }`)，出库取消 `POST /consumables/label/issue-return`(`{ conUid, returnReason? }`)，记录查询 `GET /consumables/logs?logTypeGroup=ISSUING&startDate=&endDate=&limit=`。界面表格中的 `SELECT * FROM CONSUMABLE_LOGS ...` 是显示标签，实际查询通过上述logs API进行。

## 数据结构
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)
   ├─ STOCK_QTY  (出库 -1 / 出库取消 +1 进行加减的持有数量)
   └─ 1:N ─▶ CONSUMABLE_STOCKS (单个实例, PK: CON_UID)
                └─ STATUS: PENDING → ACTIVE → ISSUED (取消时返回 ACTIVE)

CONSUMABLE_LOGS (PK: TRANS_DATE + SEQ)  ← 出库/出库取消记录 (SEQ_CONSUMABLE_LOGS 编号)
   └─ LOG_TYPE: OUT(出库) / OUT_RETURN(出库取消)  · 查询组 logTypeGroup=ISSUING = In('OUT','OUT_RETURN')
```

## 出库/出库取消状态迁移（操作含义）
- **出库(`issueByScan`)**: 仅允许 `STATUS='ACTIVE'` 的UID。否则返回400(`出库仅允许ACTIVE状态`)。UID不存在返回404。
- **出库取消(`issueReturnByScan`)**: 仅允许 `STATUS='ISSUED'` 的UID。否则返回400(`出库取消仅允许ISSUED状态`)。
- 所有处理均按 1 UID = 数量1。多件则顺序扫描UID(事务按单件处理)。

---

## ① 扫描面板（界面输入 ↔ DTO）

| 界面项目 | 传输字段 (DTO) | 角色 / 含义 · 操作要点 |
|------|------|------|
| 出库 / 出库退货(模式切换) | (FE状态 `mode`) | `issue` → `/consumables/label/issue`, `issue-return` → `/consumables/label/issue-return` 调用分支。DB不存储。 |
| UID输入框 | `conUid` (IssueConDto / IssueReturnConDto) | 扫描/输入的 `CON_UID`。必填。`CONSUMABLE_STOCKS` 单条查询键。 |
| (自动/不显示) 出库部门 | `department` → `CONSUMABLE_LOGS.DEPARTMENT` | 出库时可选择传递。当前扫描面板不传递(null存储)。 |
| (自动/不显示) 出库原因 | `issueReason` → `CONSUMABLE_LOGS.ISSUE_REASON` | 出库原因。当前扫描面板不传递。 |
| (自动/不显示) 备注 | `remark` → `CONSUMABLE_STOCKS.REMARK` | 出库时更新实例备注。当前不传递。 |
| (取消) 取消原因 | `returnReason` → `CONSUMABLE_LOGS.RETURN_REASON` · `STOCKS.REMARK` | 出库取消时的原因。当前扫描面板不传递(null)。 |

> `department`/`issueReason`/`remark`/`returnReason` 在DTO·DB中存在，但当前扫描UI不发送，因此存储为null(未来可扩展输入)。

## ② 出库记录 — CONSUMABLE_LOGS（表列 ↔ DB）

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 日期时间 | `CREATED_AT` | 日志创建时间(TIMESTAMP, DEFAULT SYSTIMESTAMP)。查询期间过滤器按 `CREATED_AT` 基于 `Between(start,end)`。 |
| 耗材代码 | `CONSUMABLE_CODE` | 主表FK(`CONSUMABLE_MASTERS.CONSUMABLE_CODE`)。 |
| 耗材名称 | (关联) `CONSUMABLE_MASTERS.NAME` | `relations:['master']` 关联后映射为 `consumableName`。 |
| UID | `CON_UID` | 已出库的单个实例UID。可空(兼容遗留数量型日志)。 |
| 类型 | `LOG_TYPE` | `OUT`(出库)/`OUT_RETURN`(出库取消)。`logTypeGroup=ISSUING` 通过 `In('OUT','OUT_RETURN')` 过滤。 |
| 数量 | `QTY` | INT, 默认1。界面以 OUT=`-`, OUT_RETURN=`+` 符号显示(存储值为正数1)。 |
| 生产线 | `LINE_CODE` | 出库生产线(可空)。 |
| 设备 | `EQUIP_CODE` | 出库设备(可空)。 |
| 备注 | `REMARK` | 备注(可空)。 |
| (键) 交易日期 | `TRANS_DATE` | 复合PK。按当天0时截断存储(`setHours(0,0,0,0)`)。 |
| (键) 序号 | `SEQ` | 复合PK。通过 `SEQ_CONSUMABLE_LOGS.NEXTVAL` 编号。 |
| (条件性) 出库部门 | `DEPARTMENT` | 仅出库日志有。 |
| (条件性) 出库原因 | `ISSUE_REASON` | 仅出库日志有。 |
| (条件性) 归还原因 | `RETURN_REASON` | 仅出库取消日志有。 |
| 多租户 | `COMPANY` / `PLANT_CD` | `40` / `1000`(实体属性 `company`/`plant`)。 |

## ③ 实例状态 — CONSUMABLE_STOCKS（出库对象）

| DB列 | 角色 / 含义 · 操作要点 |
|------|------|
| `CON_UID` | PK(自然键)。扫描键。 |
| `CONSUMABLE_CODE` | 主表FK。 |
| `STATUS` | PENDING/ACTIVE/ISSUED/RETURNED 等。出库=ACTIVE→ISSUED，出库取消=ISSUED→ACTIVE。 |
| `REMARK` | 出库/取消时传递的 remark·returnReason 更新。 |
| `COMPANY` / `PLANT_CD` | 多租户(`40`/`1000`, 属性 `company`/`plantCd`)。 |

---

## 出库处理逻辑（库存加减）

### 出库 (`issueByScan`)
1. 通过 `CON_UID` 查询 `CONSUMABLE_STOCKS` 单条 → 不存在返回404。
2. 验证 `STATUS='ACTIVE'` → 否则返回400。
3. 事务内:
   - 保存 `STATUS='ISSUED'`, `REMARK=remark`。
   - `CONSUMABLE_MASTERS.STOCK_QTY -= 1`(`decrement`)。
   - `SEQ_CONSUMABLE_LOGS.NEXTVAL` 编号 → 在 `CONSUMABLE_LOGS` 中记录 `LOG_TYPE='OUT'`, `QTY=1`, `CON_UID`, `DEPARTMENT`, `ISSUE_REASON`。

### 出库取消 (`issueReturnByScan`)
1~2. 同样查询后验证 `STATUS='ISSUED'`(否则返回400)。
3. 事务内:
   - 保存 `STATUS='ACTIVE'`, `REMARK=returnReason`。
   - `CONSUMABLE_MASTERS.STOCK_QTY += 1`(`increment`)。
   - 在 `CONSUMABLE_LOGS` 中记录 `LOG_TYPE='OUT_RETURN'`, `QTY=1`, `RETURN_REASON`。

> 库存数量的唯一来源是 `CONSUMABLE_MASTERS.STOCK_QTY`，仅通过出库/取消进行加减。实例级别跟踪由 `CONSUMABLE_STOCKS.STATUS` 负责。

## 预设条件（主表·公共代码）
- 出库目标UID需在[耗材入库](/consumables/receiving)中已完成**入库确认(`ACTIVE`)**(未入库的PENDING状态无法出库)。
- UID发行基于[耗材主表](/consumables/master)在[耗材入库]中编号(`SEQ_CON_UID`/`F_GET_CON_UID`)。
- 类型标签(出库/出库退货)通过i18n(`consumables.issuing.typeOut`/`typeOutReturn`)显示。`LOG_TYPE` 代码值本身固定(OUT/OUT_RETURN)。

## 操作流程
1. 通过入库确认将UID设为 `ACTIVE` 状态(耗材入库界面)。
2. **出库**模式下扫描UID → 确认出库(`ACTIVE→ISSUED`, 库存-1)。
3. 错误出库时切换**出库退货**模式扫描同一UID → 确认取消(`ISSUED→ACTIVE`, 库存+1)。
4. 在记录表中通过期间·类型过滤器查看处理明细·导出。

## 权限
| 角色 | 可操作范围 |
|------|------|
| 仓库/现场负责人 | UID扫描出库·出库取消，记录查询 |
| 普通用户 | 仅记录查询 |

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 扫描时显示"未找到UID"(404) | `CON_UID` 不存在或跨公司/跨工厂范围 | 确认UID·条码，检查是否同一 COMPANY/PLANT_CD |
| 出库时显示"仅允许ACTIVE状态"(400) | UID为PENDING(未入库)·ISSUED(已出库)·RETURNED | 在耗材入库中确认入库或检查当前状态 |
| 出库取消时显示"仅允许ISSUED状态"(400) | UID并非出库状态 | 如果已是ACTIVE则无需取消。重新确认状态 |
| 记录中未显示刚处理的内容 | 查询期间默认当天/类型过滤器 | 调整日期范围·类型过滤器后刷新 |
| 库存数量不符 | 手动INSERT等非正常流程修改 | 出库/取消仅对 `STOCK_QTY` ±1 操作。与实例STATUS和日志对照 |
| 出库部门/原因为空保存 | 当前扫描面板未传递相应字段 | 正常(未来可扩展输入项)。如需记录原因可使用出入库记录注册API |

## 数据·关联
- 表: `CONSUMABLE_STOCKS`(状态迁移对象), `CONSUMABLE_LOGS`(出库/取消记录), `CONSUMABLE_MASTERS`(库存数量 `STOCK_QTY`)
- 关联界面: [耗材主表](/consumables/master), [耗材入库](/consumables/receiving), [耗材库存](/consumables/stock)
- API: `POST /consumables/label/issue`, `POST /consumables/label/issue-return`, `GET /consumables/logs?logTypeGroup=ISSUING`
- 范围: `COMPANY='40'`, `PLANT_CD='1000'` — 自动应用于查询·出库·取消
