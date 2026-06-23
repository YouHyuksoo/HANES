---
menuCode: MAT_SHELF_LIFE_HISTORY
audience: operator
title: 有寿命材料检查履历 — 操作指南
summary: 有寿命材料再检查履历查询 — 检查日·LOT·品目·次数·PASS/FAIL结果·测量项目详情
tags: [材料, 有寿命, 再检查, 履历, 查询]
keywords: [SHELF_LIFE, HISTORY, REINSPECT, IQC_LOGS, RETEST, PASS, FAIL, retestRound, inspectDate, 有寿命材料, 检查履历, 再检查履历]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_REINSPECT]
---

# 有寿命材料检查履历 — 操作指南

## 系统目的·角色
查询有寿命材料再检查(`RETEST`)履历的只读画面。可确认检查日·LOT·品目·次数·PASS/FAIL结果和测量项目详情。

```
IQC_LOGS (inspectType='RETEST') → 检查履历列表 → 选择行 → 测量项目详情弹窗
```

## 数据结构
```
IQC_LOGS (PK: inspectDate + seq, inspectType='RETEST' 固定)
   ├─ matUid → MAT_LOTS (LOT)
   ├─ itemCode → PART_MASTERS (品目)
   ├─ retestRound (次数, 自动递增)
   ├─ result (PASS / FAIL)
   ├─ inspectorName / destructSampleQty
   ├─ details (CLOB) — 测量项目 JSON
   │   └─ [{ inspectItem, spec, lsl, usl, unit, measuredValue, judge }]
   └─ remark
```

## 界面构成
- **头部**: 标题 + 刷新按钮
- **工具栏**:
  - 搜索输入 (`LOT·品目搜索...` — 客户端过滤 `matUid`·`itemCode`·`itemName`·`inspectorName`)
  - 品目选择 (`PartSelect` 组件, 精确匹配)
  - 结果筛选 (`全部`/`合格(PASS)`/`不合格(FAIL)`, 触发服务器重新查询)
- **DataGrid**: `GET /material/shelf-life/reinspect?limit=2000`

| 列 | 说明 |
|------|------|
| 操作 | Eye按钮 → 测量项目详情弹窗 |
| 检查日 | `inspectDate` |
| LOT No. | `matUid` (等宽字体) |
| 品目代码 | `itemCode` (等宽字体) |
| 品目名 | `itemName` (服务器JOIN) |
| 再检查次数 | `retestRound` (1, 2, 3...) |
| 结果 | `result` (PASS=合格/FAIL=不合格 badge) |
| 检查者 | `inspectorName` |
| 备注 | `remark` |

### 测量项目详情弹窗
- **头部信息**: 品目名 · LOT No. · 次数 · 结果(badge) · 检查者 · 样品数量 · 备注
- **项目表格**:

| 列 | 说明 |
|------|------|
| # | 序号 |
| 检查项目 | `inspectItem` |
| 规格 | `spec` |
| 下限(LSL) | `lsl` |
| 上限(USL) | `usl` |
| 测量值 | `measuredValue` |
| 判定 | PASS(CheckCircle) / FAIL(XCircle) |

※ 无details或为空时: 显示 `"无测量数据 (手动判定)"`

## 作业流程

### ① 查询履历
- `GET /material/shelf-life/reinspect` — 全部 `inspectType='RETEST'` 记录
- 结果筛选(PASS/FAIL) → 服务器重新查询
- 搜索词/品目 → 客户端过滤

### ② 查看测量项目详情
- 点击行右侧 Eye 按钮
- `details` JSON解析 → 显示各检查项目的测量值和判定
- 确认PASS/FAIL原因

## 主要规则

| 规则 | 说明 |
|------|------|
| 只读 | 仅可查询 (不可修改/删除/创建) |
| RETEST专用 | 仅显示 `inspectType='RETEST'` (排除INITIAL) |
| 自动判定 | 基于LSL/USL自动PASS/FAIL (手动判定时 details=null) |

## 数据·关联
- 表: `IQC_LOGS`, `MAT_LOTS`, `PART_MASTERS`
- 关联: 有寿命材料现状(`/material/shelf-life`) → 再检查(`/material/shelf-life-reinspect`) → **再检查履历(当前)**
- 与IQC履历(`/material/iqc-history`)分开 — RETEST专用画面
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
