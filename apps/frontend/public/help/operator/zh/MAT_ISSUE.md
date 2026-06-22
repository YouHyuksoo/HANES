---
menuCode: MAT_ISSUE
audience: operator
title: 材料出库管理(量产) — 操作指南
summary: 量产材料出库请求批准·处理及条码扫描出库的DB结构, 库存扣减逻辑, 状态迁移, 取消·反向分录机制与故障排除
tags: [材料, 出库, 量产, 操作, 库存扣减]
keywords: [材料出库, 量产出库, MAT_ISSUES, MAT_ISSUE_REQUESTS, MAT_ISSUE_REQUEST_ITEMS, MAT_STOCKS, STOCK_TRANSACTIONS, 出库账户, ISSUE_TYPE, PRODUCTION, 库存扣减, 反向分录, 出库取消, WIP_MAT_STOCKS, 工序移动, WIP_MOVE, MAT_OUT, 出库号, 请求号, matUid, 材料序列号, IQC合格, HOLD, DEPLETED, 多租户, COMPANY, PLANT_CD]
related: [MAT_REQUEST, MAT_ISSUE_OTHER, MST_PART]
---

# 材料出库管理(量产) — 操作指南

## 系统目的·角色
以量产(PRODUCTION)账户将材料从仓库发放到生产现场的界面。出库确认时扣减**MAT_STOCKS(原材料库存)**并创建**MAT_ISSUES(出库记录)**及**STOCK_TRANSACTIONS(库存交易)**记录。当工单已分配设备时，在扣减原材料仓库的同时**增加WIP_MAT_STOCKS(工序库存)**。

## 处理流程
```
创建出库请求(MAT_ISSUE_REQUESTS: REQUESTED)
  → 批准(APPROVED)
  → 出库处理(MatIssueService.createInTx)
      → 创建MAT_ISSUES(DONE)
      → 扣减MAT_STOCKS (availableQty/qty减少)
      → 记录STOCK_TRANSACTIONS (MAT_OUT或WIP_MOVE)
      → [分配设备时] 增加WIP_MAT_STOCKS
      → 剩余库存为0时MAT_LOTS.status → DEPLETED
  → 全部物料完全出库时请求状态 → COMPLETED
```

---

## 数据结构
```
MAT_ISSUE_REQUESTS (出库请求头)
  └─ MAT_ISSUE_REQUEST_ITEMS (请求物料明细, PK: REQUEST_ID + SEQ)

MAT_ISSUES (出库实绩, PK: ISSUE_NO + SEQ)
  ├─ MAT_LOTS (材料LOT, 引用matUid)
  ├─ MAT_STOCKS (按仓库库存 — 扣减对象)
  └─ STOCK_TRANSACTIONS (库存交易记录)

MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
  └─ WIP_MAT_STOCKS (工序库存, 按设备 — 工序移动时增加)
```

---

## ① 出库请求 — MAT_ISSUE_REQUESTS / MAT_ISSUE_REQUEST_ITEMS (全部列)

### MAT_ISSUE_REQUESTS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|---|---|---|
| **请求号(requestNo)** | `REQUEST_NO` VARCHAR2(50) PK | 自然键。通过`MAT_REQ`编号序列自动生成(`REQ-YYYYMMDD-NNN`格式)。 |
| **工单(workOrderNo / orderNo)** | `ORDER_NO` VARCHAR2(50) | 关联工单。存在时基于BOM的物料自动计算并填入请求物料。 |
| **请求日期(requestDate)** | `REQUEST_DATE` TIMESTAMP | 请求登记日期时间。DEFAULT CURRENT_TIMESTAMP。 |
| **状态(status)** | `STATUS` VARCHAR2(20) | REQUESTED → APPROVED → COMPLETED (或REJECTED)。DEFAULT 'REQUESTED'。 |
| **请求人(requester)** | `REQUESTER` VARCHAR2(100) | 提出出库请求的负责人。当前固定为SYSTEM。 |
| **批准人(approver)** | `APPROVER` VARCHAR2(100) | 进行批准处理的负责人。 |
| **批准日期时间(approvedAt)** | `APPROVED_AT` TIMESTAMP | 批准处理日期时间。 |
| **驳回原因(rejectReason)** | `REJECT_REASON` VARCHAR2(500) | 驳回时输入的原因。 |
| **出库账户(issueType)** | `ISSUE_TYPE` VARCHAR2(20) | 基于公共代码`ISSUE_TYPE`。本界面中为PRODUCTION。 |
| **备注(remark)** | `REMARK` VARCHAR2(500) | 自由填写的备注。 |
| **多租户范围** | `COMPANY` / `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'`。自动应用于所有查询·处理。 |

### MAT_ISSUE_REQUEST_ITEMS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|---|---|---|
| **请求号(requestId)** | `REQUEST_ID` VARCHAR2(50) PK | 引用头表`REQUEST_NO`的FK角色。 |
| **序号(seq)** | `SEQ` INT PK | 请求内物料序号。复合PK的一部分。 |
| **物料代码(itemCode)** | `ITEM_CODE` VARCHAR2(50) | 出库请求物料。仅包含原材料(RAW)，不含产品·耗材(MRO)。 |
| **请求数量(requestQty)** | `REQUEST_QTY` INT | 现场请求的数量。 |
| **已出库数量(issuedQty)** | `ISSUED_QTY` INT | 实际出库累计数量。DEFAULT 0。部分出库时递增。 |
| **单位(unit)** | `UNIT` VARCHAR2(20) | 数量单位。 |
| **BOM需求量(bomReqQty)** | `BOM_REQ_QTY` NUMBER(12,3) | BOM qtyPer × 生产数量。基于工单请求时自动计算。 |
| **已发放数量(prevIssueQty)** | `PREV_ISSUE_QTY` NUMBER(12,3) | 该工单已出库的数量。 |
| **现场库存(floorStockQty)** | `FLOOR_STOCK_QTY` NUMBER(12,3) | 基于现场(FLOOR类型仓库)的可用库存。 |
| **备注** | `REMARK` VARCHAR2(500) | 按物料备注。 |
| **多租户** | `COMPANY` / `PLANT_CD` | 与头表相同范围。 |

---

## ② 出库实绩 — MAT_ISSUES (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|---|---|---|
| **出库号(issueNo)** | `ISSUE_NO` VARCHAR2(50) PK | `MAT_ISSUE`编号序列。单次出库交易包含多个SEQ。 |
| **序号(seq)** | `SEQ` INT PK | 物料行序号。DEFAULT 1。 |
| **工单(orderNo)** | `ORDER_NO` VARCHAR2(50) | 关联工单。不存在时为NULL。 |
| **生产实绩号(prodResultNo)** | `PROD_RESULT_ID` VARCHAR2(50) | 与生产实绩的关联。取消时用于确认后工序是否已进行。 |
| **材料序列号(matUid)** | `MAT_UID` VARCHAR2(50) | 已出库的LOT序列号。引用`MAT_LOTS.MAT_UID`。 |
| **出库数量(issueQty)** | `ISSUE_QTY` INT | 实际出库数量。 |
| **出库日期(issueDate)** | `ISSUE_DATE` TIMESTAMP | 出库处理日期时间。DEFAULT CURRENT_TIMESTAMP。 |
| **出库账户(issueType)** | `ISSUE_TYPE` VARCHAR2(20) | 公共代码`ISSUE_TYPE`。DEFAULT 'PROD'。本界面以PRODUCTION创建。 |
| **操作员(workerId)** | `WORKER_ID` VARCHAR2(50) | 处理操作员ID。 |
| **发放人(issuerId / issuerName)** | `ISSUER_ID` / `ISSUER_NAME` | 实际发放材料的负责人工号·姓名(计划支持条码扫描)。 |
| **接收人(receiverId / receiverName)** | `RECEIVER_ID` / `RECEIVER_NAME` | 接收材料的负责人工号·姓名(计划支持条码扫描)。 |
| **备注(remark)** | `REMARK` VARCHAR2(500) | 出库原因或自动生成消息。 |
| **状态(status)** | `STATUS` VARCHAR2(20) | DONE(完成) / CANCELED(取消)。DEFAULT 'DONE'。 |
| **多租户** | `COMPANY` / `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'`。 |

---

## ③ 库存 — MAT_STOCKS (出库扣减对象)

| DB列 | 角色 / 含义 · 操作要点 |
|---|---|
| `COMPANY` + `PLANT_CD` + `WAREHOUSE_CODE` + `ITEM_CODE` + `MAT_UID` | 复合PK。按仓库·物料·LOT单位管理库存。 |
| `QTY` | 总数量。出库时减少。 |
| `RESERVED_QTY` | 预约(抢占)数量。 |
| `AVAILABLE_QTY` | 可用数量 (= QTY − RESERVED_QTY)。出库时实际减少基准。 |
| `LOCATION_CODE` | 仓库内位置代码。 |

> 出库处理时`QTY`和`AVAILABLE_QTY`同时扣减。库存分散在多个仓库时，优先指定仓库，其余按仓库代码升序依次扣减。

---

## 出库处理逻辑 (库存扣减)

### 普通出库 (简单MAT_OUT)
1. 查询LOT(`matUid`) → 验证IQC合格(PASS)·非保留(not HOLD)。
2. 从`MAT_STOCKS`查询可用数量 → 验证是否满足出库请求量。
3. 创建`MAT_ISSUES`行(status=DONE)。
4. 扣减`MAT_STOCKS.QTY`及`AVAILABLE_QTY`。
5. 记录`STOCK_TRANSACTIONS` (`transType='MAT_OUT'`, `qty=−出库量`)。
6. 扣减后LOT全部剩余库存=0则`MAT_LOTS.status → 'DEPLETED'`。

### 工序移动出库 (工单+分配设备时, WIP_MOVE)
- 上述1~5过程与MAT_STOCKS扣减相同。
- 额外`WIP_MAT_STOCKS`(工序库存)**增加**同量 (`transType='WIP_MOVE'`, `transType='WIP_IN'`)。
- 在生产实绩输入时从工序库存中消耗。

### 条码扫描出库 (scan)
- 调用`POST /material/issues/scan`。传递`{ matUid, issueType }`。
- LOT的可用库存**全部**批量出库。不可调整数量。
- 内部复用上述普通出库逻辑。

---

## 出库取消逻辑 (反向分录)

1. 更新`MAT_ISSUES.status → 'CANCELED'`。
2. 查询原始`STOCK_TRANSACTIONS` (refType='MAT_ISSUE', refId='issueNo-seq')。
3. 对每个原始交易创建**反向分录交易**:
   - 普通出库(MAT_OUT) → `MAT_OUT_CANCEL`交易 + 恢复`MAT_STOCKS`(增加)。
   - 工序移动(WIP_MOVE) → `WIP_MOVE_CANCEL`交易 + 恢复`MAT_STOCKS` + 恢复扣减`WIP_MAT_STOCKS`(`WIP_IN_CANCEL`)。
4. 恢复`MAT_LOTS.status → 'NORMAL'`(若为DEPLETED则解除)。

> **不可取消条件**: 该出库的后工序(生产实绩RUNNING/DONE, FG标签)存在时，取消被阻止。请按出货→托盘→箱/OQC→FG标签→生产实绩顺序逆向处理后重试。

---

## 出库请求状态迁移

```
REQUESTED  → (批准) →  APPROVED
           → (驳回) →  REJECTED

APPROVED   → (全部物料完全出库) →  COMPLETED
           → (部分出库)         →  APPROVED (保持)
```

- 仅`REQUESTED`状态可批准·驳回。
- 仅`APPROVED`状态可出库处理。
- 剩余数量未清零时，部分出库后仍保持`APPROVED`状态。

---

## 出库可用条件 (操作员确认要点)

LOT出库需**全部满足**:

- `MAT_LOTS.iqcStatus = 'PASS'` (IQC合格)
- `MAT_LOTS.status != 'HOLD'` (非保留)
- `MAT_STOCKS.availableQty >= 出库请求量` (库存充足)
- `MAT_LOTS.status != 'DEPLETED'` (未耗尽, 扫描出库时)
- 基于出库请求的出库: `MAT_ISSUE_REQUESTS.status = 'APPROVED'`
- 基于出库请求的出库: LOT物料代码 = 请求物料代码一致

---

## 预设条件 (主表·公共代码)

| 设置项 | 位置 | 内容 |
|---|---|---|
| 物料主表 | `MST_PART` | itemType需为原材料系列才作为出库请求物料包含 |
| 公共代码 ISSUE_TYPE | 公共代码管理 | PRODUCTION, MANUAL, SCRAP 等出库类型定义 |
| 仓库主表 | 仓库管理 | 原材料仓库·FLOOR类型仓库注册 |
| BOM主表 | `MST_BOM` | 用于基于工单的自动物料计算 |
| 工单·设备分配 | `PRD_JOB_ORDERS` | 设备分配与否决定MAT_OUT vs WIP_MOVE分支 |

---

## 操作流程

1. 现场登记出库请求 → 创建`MAT_ISSUE_REQUESTS`(REQUESTED)。
2. 仓库/管理员在**出库请求处理**标签页审核请求后批准或驳回。
3. 批准后通过**出库处理**按钮选择LOT·确认数量·执行出库。
4. 可部分出库 — 剩余数量保留APPROVED，可追加出库。
5. 紧急出库通过**条码扫描**标签页扫描LOT条码 → 全部立即出库。
6. 错误出库时在**出库记录**标签页找到该记录进行取消处理(必须输入原因)。

---

## 权限

| 角色 | 可操作范围 |
|---|---|
| 仓库负责人 | 出库处理(条码扫描), 记录查询 |
| 管理员 / 材料负责人 | 出库请求批准·驳回·出库处理, 取消, 记录查询 |
| 普通用户 | 仅记录查询 |

---

## 故障排除

| 症状 | 原因 | 措施 |
|---|---|---|
| 出库处理模态框中LOT列表为空 | 该物料无IQC合格+可用数量>0的库存 | 确认材料入库现状及IQC结果 |
| 条码扫描时"IQC不合格"错误 | `MAT_LOTS.iqcStatus != 'PASS'` | 请IQC负责人完成检验 |
| 条码扫描时"保留LOT"错误 | `MAT_LOTS.status = 'HOLD'` | 解除保留后出库 |
| 条码扫描时"已耗尽LOT"错误 | `MAT_LOTS.status = 'DEPLETED'`或可用数量=0 | 使用其他LOT或确认库存调整 |
| "LOT库存不足"错误 | `MAT_STOCKS.availableQty < issueQty` | 查询库存现状后重新确认数量 |
| 出库取消被阻止 | 后工序(生产实绩RUNNING/DONE, FG标签)存在 | 按出货→托盘→箱/OQC→FG标签→生产实绩顺序逆向处理后重试 |
| "已取消的出库"错误 | `MAT_ISSUES.status = 'CANCELED'` | 已取消处理。防止重复请求 |
| 物料代码不一致错误 | 所选LOT的物料代码与请求物料代码不同 | 选择正确的LOT或重新确认请求物料 |
| 批准后无法出库 | `MAT_ISSUE_REQUESTS.status != 'APPROVED'` | 确认状态; REQUESTED则先进行批准 |

---

## 数据·关联

| 项目 | 内容 |
|---|---|
| **核心表** | `MAT_ISSUES`, `MAT_ISSUE_REQUESTS`, `MAT_ISSUE_REQUEST_ITEMS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| **关联表** | `MAT_LOTS`(LOT信息), `PART_MASTERS`(物料名·单位), `JOB_ORDERS`(工单·设备), `WIP_MAT_STOCKS`(工序库存), `MAT_LOTS.status`(DEPLETED自动设置) |
| **关联界面** | 出库请求管理(MAT_REQUEST), 其他出库管理(MAT_ISSUE_OTHER), 材料库存现状(MAT_STOCK), 生产实绩 |
| **API** | `GET /material/issue-requests`, `PATCH /material/issue-requests/:id/approve·reject`, `POST /material/issue-requests/:id/issue`, `POST /material/issues/scan`, `GET /material/issues`, `POST /material/issues/:no/:seq/cancel` |
| **多租户范围** | `COMPANY='40'`, `PLANT_CD='1000'` — 自动应用于所有查询·创建·取消 |
