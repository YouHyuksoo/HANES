---
menuCode: MAT_REQUEST
audience: operator
title: 出库请求管理 — 操作指南
summary: 材料出库请求(MAT_ISSUE_REQUESTS)创建·批准·驳回·实际出库关联逻辑, DB结构, 状态迁移, 权限·故障排除说明
tags: [材料, 出库请求, 操作, BOM]
keywords: [MAT_ISSUE_REQUESTS, MAT_ISSUE_REQUEST_ITEMS, REQUEST_NO, ORDER_NO, ISSUE_TYPE, REQUESTED, APPROVED, REJECTED, COMPLETED, bomReqQty, BOM_REQ_QTY, prevIssueQty, PREV_ISSUE_QTY, floorStockQty, FLOOR_STOCK_QTY, RAW_MATERIAL, 出库请求, 批准, 驳回, 实际出库, 生产投入, 试制品, 样品]
related: [MAT_ISSUE, MST_PART]
---

# 出库请求管理 — 操作指南

## 系统目的·角色

生产现场向仓库**请求**原材料，仓库负责人**批准·驳回**后关联实际出库(`MAT_ISSUES`)的批准流程界面。通过DB跟踪请求-批准-出库的三步流程，确保库存准确性和发放责任。

```
出库请求登记(REQUESTED)
  ↓ 批准(PATCH /approve)          → APPROVED
  ↓ 驳回(PATCH /reject)           → REJECTED
      ↓ 实际出库(POST /:requestNo/issue) → COMPLETED
```

多租户范围: `COMPANY='40'`, `PLANT_CD='1000'` 应用于所有查询。

---

## 数据结构

```
MAT_ISSUE_REQUESTS (头, 1条 = 1个出库请求)
  └─ MAT_ISSUE_REQUEST_ITEMS (物料, N条)
         ↓ 实际出库处理时
     MAT_ISSUES / MAT_ISSUE_ITEMS (实际出库记录)
```

- **MAT_ISSUE_REQUESTS** — 出库请求头。自然键`REQUEST_NO` PK。
- **MAT_ISSUE_REQUEST_ITEMS** — 出库请求物料明细。`REQUEST_ID + SEQ` 复合PK。
- 实际出库在单独的`MAT_ISSUES`表中记录，反映到`MatStock`库存。

---

## ① 出库请求头 — MAT_ISSUE_REQUESTS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| **请求号(requestNo)** | `REQUEST_NO VARCHAR2(50) PK` | 出库请求自然键。编号方式由服务层决定。 |
| **工单号(orderNo)** | `ORDER_NO VARCHAR2(50)` | 关联的工单号。允许NULL(手动出库请求)。与`PRODUCTION_JOB_ORDERS`逻辑关联。 |
| **请求日期时间(requestDate)** | `REQUEST_DATE TIMESTAMP` | 请求登记时间。默认值`CURRENT_TIMESTAMP`。 |
| **状态(status)** | `STATUS VARCHAR2(20)` | 默认值`REQUESTED`。允许值: `REQUESTED / APPROVED / REJECTED / COMPLETED`。 |
| **请求人(requester)** | `REQUESTER VARCHAR2(100)` | 提出出库请求的用户标识。NOT NULL。 |
| **批准人(approver)** | `APPROVER VARCHAR2(100)` | 进行批准处理的用户。批准时记录。允许NULL。 |
| **批准日期时间(approvedAt)** | `APPROVED_AT TIMESTAMP` | 批准处理时间。允许NULL。 |
| **驳回原因(rejectReason)** | `REJECT_REASON VARCHAR2(500)` | 驳回时输入的原因。允许NULL。 |
| **出库账户(issueType)** | `ISSUE_TYPE VARCHAR2(20)` | 基于公共代码`ISSUE_TYPE`的出库账户区分。允许NULL。实际出库时传递给`MAT_ISSUES.ISSUE_TYPE`。 |
| **备注(remark)** | `REMARK VARCHAR2(500)` | 请求原因/备注(生产投入·试制品·样品·其他等)。允许NULL。 |
| 多租户 | `COMPANY VARCHAR2(50)` | 公司标识。默认值`'40'`。强制应用于所有查询·登记。 |
| 多租户 | `PLANT_CD VARCHAR2(50)` | 工厂标识。默认值`'1000'`。强制应用于所有查询·登记。 |
| 审计 | `CREATED_BY VARCHAR2(50)` | 创建用户ID。允许NULL。 |
| 审计 | `UPDATED_BY VARCHAR2(50)` | 最后修改用户ID。允许NULL。 |
| 审计 | `CREATED_AT TIMESTAMP` | TypeORM `@CreateDateColumn`。自动记录。 |
| 审计 | `UPDATED_AT TIMESTAMP` | TypeORM `@UpdateDateColumn`。自动记录。 |

索引: `ORDER_NO`, `STATUS`, `REQUEST_DATE` 各自单一索引。

---

## ② 出库请求物料 — MAT_ISSUE_REQUEST_ITEMS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| — | `REQUEST_ID VARCHAR2(50) PK` | 引用头表`REQUEST_NO`值(复合PK 1/2)。与头表相同值。 |
| — | `SEQ INT PK` | 物料序号(复合PK 2/2)。从1开始顺序赋予。 |
| **物料代码(itemCode)** | `ITEM_CODE VARCHAR2(50)` | 出库请求物料。`ITEM_MASTERS` FK。有索引。 |
| **请求数量(requestQty)** | `REQUEST_QTY INT` | 向仓库请求的数量。1以上整数。NOT NULL。 |
| **出库数量(issuedQty)** | `ISSUED_QTY INT DEFAULT 0` | 实际出库处理时累计的值。实际出库完成时与requestQty相同。 |
| **单位(unit)** | `UNIT VARCHAR2(20)` | 数量单位(EA, M, KG等)。NOT NULL。 |
| **BOM需求(bomReqQty)** | `BOM_REQ_QTY NUMBER(12,3)` | 工单计划数量 × BOM单位用量计算得出。允许NULL(手动添加物料可为NULL)。 |
| **已发放(prevIssueQty)** | `PREV_ISSUE_QTY NUMBER(12,3)` | 同一工单通过此前出库请求已发放的累计数量。允许NULL。 |
| **现场库存(floorStockQty)** | `FLOOR_STOCK_QTY NUMBER(12,3)` | 现场(工序线)持有数量。请求时点快照。允许NULL。 |
| **备注(remark)** | `REMARK VARCHAR2(500)` | 按物料备注。允许NULL。 |
| 多租户 | `COMPANY VARCHAR2(50)` | 与头表相同范围。 |
| 多租户 | `PLANT_CD VARCHAR2(50)` | 与头表相同范围。 |
| 审计 | `CREATED_BY`, `UPDATED_BY` | 变更跟踪用。允许NULL。 |
| 审计 | `CREATED_AT`, `UPDATED_AT` | TypeORM自动管理。 |

---

## 状态迁移逻辑

### 各状态含义

| 状态 | 迁移API | 说明 |
|------|------|------|
| `REQUESTED` | (初始值) | 请求登记后立即。等待仓库负责人审核。 |
| `APPROVED` | `PATCH /:requestNo/approve` | 负责人批准完成。可进行实际出库处理的状态。 |
| `REJECTED` | `PATCH /:requestNo/reject` | 请求被驳回。记录`REJECT_REASON`。可重新请求。 |
| `COMPLETED` | `POST /:requestNo/issue` | 实际出库处理完成。已创建`MAT_ISSUES`记录。 |

### 可迁移路径

```
REQUESTED → APPROVED  (批准)
REQUESTED → REJECTED  (驳回)
APPROVED  → COMPLETED (实际出库完成)
```

> `COMPLETED`及`REJECTED`状态不可进一步状态迁移。驳回的请求不重复使用，而是重新登记。

---

## BOM基准需求量计算逻辑

API: `GET /material/issue-requests/job-orders/:orderNo/bom-items`

后端`IssueRequestService.buildBomRequestItems(orderNo, company, plant)`执行的计算:

1. 查询工单(`orderNo`) → 确认计划数量(`planQty`)。
2. 查询该工单物料的BOM → 单位用量(BOM quantity)。
3. 计算`bomReqQty = planQty × 单位用量`。
4. 合计同一工单已有出库请求的`ISSUED_QTY` → `prevIssueQty`。
5. 查询现场库存(`floorStockQty`)。
6. 查询当前库存(`currentStock`)(基于`MatStock`)。
7. 按原材料(RAW_MATERIAL)物料单位返回结果。

> 物料搜索(`/master/parts?itemType=RAW_MATERIAL`)也仅限原材料对象。

---

## API路径列表

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/material/issue-requests` | 创建出库请求 (状态: REQUESTED固定) |
| `GET` | `/material/issue-requests` | 列表查询 (分页, 状态·搜索词·orderNo过滤) |
| `GET` | `/material/issue-requests/:requestNo` | 详情查询 (含物料) |
| `GET` | `/material/issue-requests/job-orders/:orderNo/bom-items` | 工单BOM基准需求量计算 |
| `PATCH` | `/material/issue-requests/:requestNo/approve` | 批准 |
| `PATCH` | `/material/issue-requests/:requestNo/reject` | 驳回 (body: `reason`) |
| `POST` | `/material/issue-requests/:requestNo/issue` | 实际出库处理 (APPROVED → COMPLETED) |

---

## 预设条件 (主表·公共代码)

| 设置项 | 位置 | 影响 |
|------|------|------|
| 物料主表(itemType=RAW_MATERIAL) | `ITEM_MASTERS` | 出库请求物料搜索对象 |
| BOM登记 | `MAT_BOM` (或同类表) | BOM基准需求量计算基准 |
| 公共代码`JOB_ORDER_STATUS` | `COM_CODES` | 左侧工单状态过滤选择 |
| 公共代码`ISSUE_TYPE` | `COM_CODES` | 出库账户字段代码解析 |
| 仓库主表 | `WAREHOUSE_MASTERS` | 实际出库时仓库选择基准 |

---

## 操作流程

### 新建出库请求登记
1. 选择工单或使用手动出库请求模态框输入物料·数量。
2. 调用`POST /material/issue-requests` → 编号`REQUEST_NO`, 保存`STATUS='REQUESTED'`。

### 出库请求批准
1. 在材料出库管理(MAT_ISSUE)界面确认REQUESTED记录。
2. 审核后调用`PATCH /material/issue-requests/:requestNo/approve`。
3. 记录`STATUS='APPROVED'`, `APPROVER`, `APPROVED_AT`。

### 驳回处理
1. 确认原因后调用`PATCH /material/issue-requests/:requestNo/reject` (body: `reason`)。
2. 保存`STATUS='REJECTED'`, `REJECT_REASON`。请求人需重新请求。

### 实际出库处理
1. 对已批准(APPROVED)的记录调用`POST /material/issue-requests/:requestNo/issue`。
2. 创建`MAT_ISSUES`, `MAT_ISSUE_ITEMS`记录 → 扣减`MatStock`库存。
3. 该请求`STATUS='COMPLETED'`, 逐物料更新`ISSUED_QTY`。

---

## 权限

| 角色 | 可操作范围 |
|------|------|
| 生产/现场负责人 | 出库请求登记, 本人请求查询 |
| 仓库负责人 | 出库请求查询, 批准, 驳回, 实际出库处理 |
| 管理员 | 所有操作 |

> 当前代码中API不进行单独角色检查，仅强制应用租户范围(`COMPANY`, `PLANT_CD`)。如需角色权限需添加`@Guard`设置。

---

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| BOM基准物料显示0条 | 工单BOM未登记或计划数量为0 | 确认BOM登记情况及工单计划数量 |
| 物料搜索结果为空 | 物料类型不是RAW_MATERIAL | 在物料主表中确认itemType |
| 请求登记后状态不变 | 尚未进行批准处理(正常REQUESTED状态) | 在材料出库管理界面进行批准处理 |
| 批准后库存未减少 | 批准是许可状态。实际出库处理未完成 | 需要调用`POST /:requestNo/issue`实际出库API |
| APPROVED状态下想驳回 | 代码中未定义APPROVED → REJECTED迁移 | 不将该请求做COMPLETED处理，改用新请求代替或需DB直接处理(运营者判断) |
| `ISSUED_QTY`小于`REQUEST_QTY` | 部分出库状态。可能不是COMPLETED | 确认余量后追加实际出库处理 |
| 出库请求列表查询慢 | 有STATUS / ORDER_NO / REQUEST_DATE索引。数据累积时确认分页 | 建议使用page/limit参数，利用过滤器 |

---

## 数据·关联

- **头表**: `MAT_ISSUE_REQUESTS` — `COMPANY='40'`, `PLANT_CD='1000'` 范围固定。
- **物料表**: `MAT_ISSUE_REQUEST_ITEMS` — 相同范围。
- **实际出库关联**: 实际出库处理时创建`MAT_ISSUES` + `MAT_ISSUE_ITEMS`，扣减`MatStock`。
- **工单关联**: 与`PRODUCTION_JOB_ORDERS.ORDER_NO`逻辑关联(无外键约束，在服务层验证)。
- **物料主表关联**: 与`ITEM_MASTERS.ITEM_CODE`逻辑关联。
- **关联界面**: 材料出库管理(MAT_ISSUE) — 进行批准·实际出库处理。
