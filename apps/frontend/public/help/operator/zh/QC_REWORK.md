---
menuCode: QC_REWORK
audience: operator
title: 再作业指示管理 — 操作指南
summary: IATF 16949再作业指示全过程管理 — 登记·QC批准·生产批准·工序执行·完成, DefectLog联动, 隔离/库存处理
tags: [质量, 再作业, IATF16949, 批准, 工序]
keywords: [REWORK_ORDERS, REWORK_PROCESSES, REWORK_RESULTS, DEFECT_LOG, REGISTERED, QC_PENDING, PROD_PENDING, APPROVED, IN_PROGRESS, INSPECT_PENDING, 再作业, 再作业指示, QC批准, 生产批准, 工序管理]
related: [QC_REWORK_INSPECT, QC_DEFECT]
---

# 再作业指示管理 — 操作指南

## 系统目的·角色
按IATF 16949要求管理**再作业(Rework)指示**全过程。从缺陷记录(DefectLog)登记对象，经QC·生产批准，执行工序后转为待检查状态。

```
DefectLog → REGISTERED → QC_PENDING → PROD_PENDING → APPROVED → IN_PROGRESS → INSPECT_PENDING
               ↑              ↓              ↓
          QC_REJECTED    PROD_REJECTED
```

## 数据结构
```
REWORK_ORDERS (PK: REWORK_NO, 格式: RW-YYYYMMDD-NNN)
   ├─ DEFECT_LOG_ID → DefectLog (occurAt|seq)
   ├─ ITEM_CODE / REWORK_QTY / REWORK_METHOD / STATUS
   ├─ QC_APPROVER / PROD_APPROVER (双重批准)
   └─ ISOLATION_FLAG (隔离: 1 / 正常: 0)

REWORK_PROCESSES (PK: REWORK_NO + PROCESS_CODE)
   └─ STATUS: WAITING → IN_PROGRESS → COMPLETED / SKIPPED

REWORK_RESULTS (PK: REWORK_NO + PROCESS_CODE + SEQ)
   └─ workerId / goodQty / defectQty / workDetail / workTimeMin

REWORK_INSPECTS (PK: REWORK_NO + SEQ)
   └─ 再检查结果 (PASS/FAIL/SCRAP)
```

## 界面构成

### 主要区域
- **头部**: 标题 + 刷新·再作业登记按钮
- **StatCard (5个)**: 全部·待批准·进行中·完成·待检查
- **工具栏**: 搜索·期间·状态·生产线筛选
- **DataGrid**: `GET /quality/reworks`
  - 列: 操作·再作业编号·物料代码·物料名·数量·缺陷类型·状态·作业者·创建日

### 右侧面板 (3种)
| 面板 | 调用条件 | 功能 |
|------|---------|----------|
| ReworkFormPanel | 登记/修改 | 创建或修改再作业指示 |
| ReworkApprovePanel | 批准 | QC或生产批准/驳回 |
| ReworkResultPanel | 实绩输入 | 按工序登记操作实绩 |

## 作业流程

### ① 登记
`POST /quality/reworks { defectLogId, itemCode, reworkQty, reworkMethod, processItems, ... }`
- 连接DefectLog → `DEFECT_LOG.status = 'REWORK'`
- `isolationFlag = 1`

### ② 请求批准
`PATCH /quality/reworks/{id}/request-approval`
- REGISTERED → QC_PENDING

### ③ QC批准
`PATCH /quality/reworks/{id}/qc-approve { action: APPROVE|REJECT, reason }`
- 批准: QC_PENDING → PROD_PENDING
- 驳回: QC_PENDING → QC_REJECTED (需原因)

### ④ 生产批准
`PATCH /quality/reworks/{id}/prod-approve { action: APPROVE|REJECT, reason }`
- 批准: PROD_PENDING → APPROVED
- 驳回: PROD_PENDING → PROD_REJECTED (需原因)

### ⑤ 开始作业
`PATCH /quality/reworks/{id}/start`
- APPROVED → IN_PROGRESS

### ⑥ 工序执行
`PATCH /quality/reworks/processes/{orderId}/{processCode}/start`
`PATCH /quality/reworks/processes/{orderId}/{processCode}/complete { resultQty }`
`PATCH /quality/reworks/processes/{orderId}/{processCode}/skip`
- 按工序输入作业者·数量·时间

### ⑦ 作业完成
`PATCH /quality/reworks/{id}/complete { resultQty }`
- 所有工序完成时自动转为INSPECT_PENDING
- 最终PASS/FAIL/SCRAP在再作业检查(`/quality/rework-inspect`)

## 状态代码 (REWORK_STATUS)

| 代码 | 含义 | 可执行操作 |
|------|------|---------|
| REGISTERED | 已登记 | 修改·删除·请求批准 |
| QC_PENDING | QC待批准 | QC批准/驳回 |
| QC_REJECTED | QC驳回 | 修改·重新请求 |
| PROD_PENDING | 生产待批准 | 生产批准/驳回 |
| PROD_REJECTED | 生产驳回 | 修改·重新请求 |
| APPROVED | 已批准 | 开始作业 |
| IN_PROGRESS | 作业中 | 工序·完成 |
| INSPECT_PENDING | 待检查 | 再检查 |
| PASS | 合格 | |
| FAIL | 不合格 | |
| SCRAP | 废弃 | |

## 主要规则

| 规则 | 说明 |
|------|------|
| 再作业编号 | `RW-YYYYMMDD-NNN`自动编号 |
| 批准体系 | QC→生产顺序双重批准 |
| DefectLog联动 | 登记→REWORK, PASS→DONE, SCRAP→SCRAP |
| 隔离 | 登记/FAIL→1, PASS→0 |
| 库存 | PASS:DEFECT→WIP_MAIN, SCRAP:DEFECT→SCRAP, FAIL:DEFECT |
| 删除限制 | 仅REGISTERED, 有工序/检查时禁止 |

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 无法登记 | 缺少必填项 | 确认物料·数量·方法 |
| 批准按钮不显示 | 状态不一致 | 确认当前状态 |
| 无法开始作业 | 未完成批准 | 确认QC+生产批准 |
| 无工序 | 未包含processItems | 添加工序后重试 |

## 数据·关联
- 表: `REWORK_ORDERS`, `REWORK_PROCESSES`, `REWORK_RESULTS`, `REWORK_INSPECTS`, `DEFECT_LOGS`
- 关联: 缺陷管理(`/quality/defect`) → **再作业指示(当前)** → 再作业检查(`/quality/rework-inspect`)
- 库存: `ProductInventoryService` (DEFECT→WIP_MAIN/SCRAP)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
