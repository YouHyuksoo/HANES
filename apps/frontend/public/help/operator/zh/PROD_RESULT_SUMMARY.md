---
menuCode: PROD_RESULT_SUMMARY
audience: operator
title: 作业实绩综合查询 — 操作指南
summary: 成品基准生产实绩汇总 — 按品目统计计划数量·良品·不良·达成率·良率·不良率
tags: [生产, 实绩, 汇总, 查询]
keywords: [PROD_RESULTS, JOB_ORDERS, PART_MASTERS, totalPlanQty, totalGoodQty, totalDefectQty, achieveRate, yieldRate, defectRate, 作业实绩, 生产实绩, 综合查询, 良率, 达成率]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# 作业实绩综合查询 — 操作指南

## 系统目的·角色
按成品品目汇总生产实绩。一目了然地查看计划达成率、良率、不良率。

```
JOB_ORDERS(计划) + PROD_RESULTS(实绩) → 按品目汇总 → 达成率·良率·不良率
```

## 数据结构
```
PROD_RESULTS ← JOB_ORDERS → PART_MASTERS (ITEM_MASTERS)
```

## 界面构成
- **头部**: 标题 + 刷新按钮
- **工具栏**: 搜索(品目代码·名称) + 期间筛选(DateRangeFilter, 默认今天)
- **DataGrid**: `GET /production/prod-results/summary/by-product`

| 列 | 说明 | 计算 |
|------|------|------|
| 品目代码 | `PART_MASTERS.ITEM_CODE` | |
| 品目名称 | `PART_MASTERS.ITEM_NAME` | |
| 品目类型 | `PART_MASTERS.ITEM_TYPE` | |
| 生产线 | `JOB_ORDERS.LINE_CODE` | |
| 计划数量 | `SUM(JOB_ORDERS.PLAN_QTY)` | |
| 良品数量 | `SUM(PROD_RESULTS.GOOD_QTY)` | |
| 不良数量 | `SUM(PROD_RESULTS.DEFECT_QTY)` | |
| 总生产数量 | `良品 + 不良` | |
| 达成率 | `良品 / 计划 × 100` | |
| 良率 | `良品 / (良品 + 不良) × 100` | |
| 不良率 | `不良 / (良品 + 不良) × 100` | |
| 作业指示数 | `COUNT(DISTINCT JOB_ORDERS.ORDER_NO)` | |
| 实绩数 | `COUNT(PROD_RESULTS.RESULT_NO)` | |

## 查询条件
- **期间**: `PROD_RESULTS.START_TIME`基准, 默认今天
- **排除**: `PROD_RESULTS.STATUS = 'CANCELED'`
- **排序**: 良品数量降序

## 主要指标解读
| 指标 | 含义 | 良好方向 |
|------|------|---------|
| 达成率 | 计划 vs 实际 | 100% ↑ |
| 良率 | 良品比例 | 100% ↑ |
| 不良率 | 不良比例 | 0% ↓ |

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 无数据 | 该期间无实绩 | 扩大期间范围 |
| 达成率0% | 计划数量为0 | 确认作业指示计划 |
| 良率100% | 未登记不良 | 确认DefectLog登记 |

## 数据·关联
- 表: `PROD_RESULTS`, `JOB_ORDERS`, `PART_MASTERS`
- 关联: 作业指示(`/production/order`) → 实绩输入(`/production/input-kiosk`) → **实绩查询(当前)**
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
