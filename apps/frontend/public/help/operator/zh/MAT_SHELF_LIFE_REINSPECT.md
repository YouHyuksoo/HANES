---
menuCode: MAT_SHELF_LIFE_REINSPECT
audience: operator
title: 有寿命材料再检查 — 操作指南
summary: 有效期临近/过期LOT再检查 — IQC检查项目测量·PASS/FAIL判定·延长天数设定·FAIL时自动隔离/废弃
tags: [材料, 有寿命, 再检查, IQC, LOT, 有效期]
keywords: [SHELF_LIFE, REINSPECT, MAT_LOTS, IQC_LOGS, RETEST, EXPIRED, NEAR_EXPIRY, VALID, DISCARDED, expireDate, extendDays, 有寿命材料, 再检查, 有效期, LOT延长]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_HISTORY, QC_IQC]
---

# 有寿命材料再检查 — 操作指南

## 系统目的·角色
对有效期临近(`NEAR_EXPIRY`)或已过期(`EXPIRED`)的材料LOT进行再检查以延长或废弃处理。基于IQC检查项目(IQC_PART_SPEC)输入测量值并判断PASS/FAIL。PASS时延长有效期，FAIL时自动将LOT隔离至DEFECT仓库并标记为DISCARDED。

```
对象LOT列表 → IQC检查项目测量 → PASS: 延长有效期 / FAIL: DEFECT隔离+DISCARDED
```

## 数据结构
```
MAT_LOTS (PK: matUid)
   ├─ itemCode → ITEM_MASTERS (expiryExtDays: 最大延长天数)
   ├─ expireDate (有效期)
   └─ status: NORMAL / DISCARDED

IQC_LOGS (inspectType='RETEST')
   ├─ matUid / retestRound (自动增加)
   ├─ result (PASS/FAIL) / extendDays
   └─ details (测量项目JSON)
```

## 界面构成

### 主要区域
- **头部**: 标题 + 链接(有寿命材料到期现状·再检查记录)
- **DataGrid**: `GET /material/shelf-life?limit=5000`
  - 客户端筛选: 仅显示`EXPIRED` + `NEAR_EXPIRY`
  - 列: 操作·LOT No.·物料代码·物料名·当前数量·有效期·剩余天数·到期状态
  - 搜索: LOT编号·物料代码·物料名, 状态筛选
  - 行右侧`检查`按钮 → 打开ReinspectModal
  - URL `?matUid=XXX`自动打开支持

### 再检查弹窗 (ReinspectModal)
| 区域 | 说明 |
|------|------|
| 对象信息 | LOT·物料·数量·当前有效期·剩余天数 |
| IQC检查项目 | `GET /master/iqc-part-specs/{itemCode}/resolve-items` |
| 测量值输入 | 有LSL/USL项目 → 数字输入 (自动PASS/FAIL判定) |
| | 无LSL/USL项目 → PASS/FAIL切换 |
| 综合判定 | 全部PASS→自动PASS / 任一FAIL→FAIL |
| 检查员 | 可选输入 |
| 样品数量 | 破坏性检查消耗数量 |
| 延长天数 | PASS时延长天数 (空=expiryExtDays最大值) |
| 备注 | |

## 再检查流程

### ① 选择对象LOT
`GET /material/shelf-life?limit=5000`
- 仅显示EXPIRED + NEAR_EXPIRY的LOT
- 也可从有寿命材料到期现状页面(`/material/shelf-life`)进入

### ② 加载IQC项目
`GET /master/iqc-part-specs/{itemCode}/resolve-items`
- 该物料已注册的IQC检查项目
- 根据LSL/USL范围自动判定

### ③ 输入测量值
- 数字项目: 输入实际测量值 → 在范围内则PASS
- 切换项目: 直接选择PASS/FAIL

### ④ 提交再检查
`POST /material/shelf-life/reinspect { matUid, result, inspectorName, extendDays, destructSampleQty, details, remark }`

| 结果 | 处理 |
|------|------|
| **PASS** | `MatLot.expireDate` = 检查日 + `extendDays` (最大`expiryExtDays`) |
| **FAIL** | 良品库存 → DEFECT仓库转移, `MatLot.status = 'DISCARDED'` |

## 到期状态标准

| 状态 | 条件 |
|------|------|
| EXPIRED | `expireDate < 今天` |
| NEAR_EXPIRY | `expireDate <= 今天 + nearExpiryDays(默认10天)` |
| VALID | 其他 |
| DISCARDED | `MatLot.status = 'DISCARDED'` |

## 互锁

| 条件 | 说明 |
|------|------|
| 已DISCARDED | 不可再检查 |
| 延长日 > expiryExtDays | 超过最大延长日限制 |
| FAIL时存在预约数量 | 不可DEFECT转移 |

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 无对象LOT | 无EXPIRED/NEAR_EXPIRY | 确认有寿命材料现状 |
| 无IQC项目 | 未注册IQC_PART_SPEC | 需注册物料检查项目 |
| 无法延长 | expiryExtDays=0 | 确认物料主表最大延长日 |
| FAIL时报错 | 无DEFECT仓库代码 | 确认WAREHOUSES中DEFECT注册 |

## 数据·关联
- 表: `MAT_LOTS`, `IQC_LOGS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `ITEM_MASTERS`
- 关联: 有寿命材料到期现状(`/material/shelf-life`) → **再检查(当前)** → 再检查记录(`/material/shelf-life-history`)
- IQC: 基于`IQC_PART_SPEC`检查项目
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
