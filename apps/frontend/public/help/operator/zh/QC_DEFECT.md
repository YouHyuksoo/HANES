---
menuCode: QC_DEFECT
audience: operator
title: 缺陷管理 — 操作指南
summary: 缺陷记录查询·登记·状态变更 — 扫描产品条码/作业指示, 自动显示缺陷代码·等级·范围, WAIT→REPAIR/REWORK/SCRAP/DONE状态转移
tags: [质量, 缺陷, 缺陷管理, 缺陷记录]
keywords: [DEFECT_LOGS, DEFECT_CODE_MASTERS, DEFECT_CATEGORY_MASTERS, WAIT, REPAIR, REWORK, SCRAP, DONE, CRITICAL, MAJOR, MINOR, 缺陷管理, 缺陷记录, 缺陷代码, 缺陷等级]
related: [QC_DEFECT_CODE, QC_REWORK_INSPECT]
---

# 缺陷管理 — 操作指南

## 系统目的·角色
登记·查询·管理生产过程中发生的缺陷。扫描产品条码(PROD_RESULT)或FG条码登记缺陷，通过WAIT→REPAIR/REWORK/SCRAP/DONE进行状态转移。缺陷代码使用3级分类体系，等级(CRITICAL/MAJOR/MINOR)和范围自动显示。

```
缺陷发生 → 登记(WAIT) → 修理(REPAIR) → 完成(DONE)
                       → 再作业(REWORK) → 完成(DONE)
                       → 废弃(SCRAP)
```

## 数据结构
```
DEFECT_LOGS (PK: OCCUR_TIME + SEQ, ID: "occurAtISO|seq")
   ├─ PROD_RESULT_ID → PROD_RESULTS (生产实绩)
   ├─ DEFECT_CODE → DEFECT_CODE_MASTERS
   ├─ QTY / STATUS / CAUSE
   └─ STATUS: WAIT → REPAIR / REWORK / SCRAP → DONE

DEFECT_CODE_MASTERS (PK: COMPANY + PLANT_CD + DEFECT_CODE)
   3级分类体系 + 等级(CRITICAL/MAJOR/MINOR) + 范围

REPAIR_LOGS (PK: REPAIR_DATE + SEQ)
   修理记录 (修理者·作业内容·使用材料·耗时·结果)
```

## 界面构成

### 主要区域
- **头部**: 标题 + 刷新·缺陷登记按钮
- **工具栏筛选器**:
  - 搜索 (产品条码·作业指示编号)
  - 期间 (DateRangeFilter)
  - 缺陷类型 Select (`GET /quality/defect-codes/options?defectScope=PRODUCT`)
  - 状态 Select (`DEFECT_LOG_STATUS`公共代码)
- **DataGrid**: `GET /quality/defect-logs?limit=5000`
  - 列: 操作·发生时间·作业指示编号·缺陷代码·缺陷名·数量·状态·作业者·原因
  - 行点击 → 打开右侧面板

### 右侧面板 (DefectFormPanel, 480px)
`POST /quality/defect-logs`

| 项目 | 说明 |
|------|------|
| 产品条码 | 扫描PROD_RESULT.prdUid或FG_LABELS.fgBarcode (自动对焦) |
| 作业指示编号 | 手动输入 (条码替代用) |
| 缺陷类型 | 选择缺陷代码 (PRODUCT范围) |
| 缺陷等级 | 自动显示: 🔴 CRITICAL / 🟠 MAJOR / 🟡 MINOR |
| 缺陷范围 | 自动显示: RAW_MATERIAL / PRODUCT / PROCESS / COMMON |
| 数量 | 默认1 |
| 原因 | 缺陷原因文本 |
- 保存条件: `prdUid`或`workOrderNo`两者必填其一

### 状态变更弹窗
`PATCH /quality/defect-logs/{id}/status { status }`

| 当前状态 | 可转移状态 |
|-----------|---------------|
| WAIT | REPAIR, REWORK, SCRAP |
| REPAIR | DONE, SCRAP, WAIT |
| REWORK | DONE, SCRAP, WAIT |
| SCRAP | (终止) |
| DONE | (终止) |

## 状态代码 (DEFECT_LOG_STATUS)

| 代码 | 含义 | 下一状态 |
|------|------|-----------|
| WAIT | 缺陷接收 (初始) | REPAIR / REWORK / SCRAP |
| REPAIR | 修理进行中 | DONE / SCRAP / WAIT |
| REWORK | 再作业进行中 | DONE / SCRAP / WAIT |
| SCRAP | 废弃处理 (终止) | - |
| DONE | 处理完成 (终止) | - |

## 缺陷等级

| 等级 | 颜色 | 含义 |
|------|------|------|
| CRITICAL | 🔴 红 | 致命缺陷 |
| MAJOR | 🟠 橙 | 重大缺陷 |
| MINOR | 🟡 黄 | 轻微缺陷 |

## 互锁

| 条件 | 说明 |
|------|------|
| 条码·作业指示均未输入 | 不可登记 |
| 未选择缺陷代码 | 不可登记 |
| SCRAP/DONE不可变更状态 | 终止状态 |
| 已连接再作业时不可编辑/删除 | ReworkOrder限制 |

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 条码无法识别 | PROD_RESULT或FG_LABELS不存在 | 用作业指示编号替代 |
| 缺陷代码列表为空 | 未登记PRODUCT范围代码 | 在缺陷代码主表中登记 |
| 状态变更失败 | 终止状态(SCRAP/DONE) | 无法变更 |
| 无法编辑 | 已连接再作业 | 通过再作业检查间接处理 |

## 数据·关联
- 表: `DEFECT_LOGS`, `DEFECT_CODE_MASTERS`, `DEFECT_CATEGORY_MASTERS`, `DEFECT_CODE_PRODUCT_TYPES`, `REPAIR_LOGS`, `PROD_RESULTS`, `FG_LABELS`, `REWORK_ORDERS`
- 关联: 生产实绩积算 → **缺陷登记(当前)** → 修理/再作业/废弃 → 再作业检查
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
