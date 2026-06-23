---
menuCode: PROD_RESULT
audience: operator
title: 生产实绩 — 操作指南
summary: 按工序综合查询·修改·取消生产实绩 — CUT/CRIMP/ASSY/INSP/PACK, 作业者头像显示, 取消时自动恢复库存
tags: [生产, 实绩, 查询, 修改, 取消]
keywords: [PROD_RESULTS, JOB_ORDERS, RUNNING, DONE, CANCELED, goodQty, defectQty, cycleTime, prdUid, 生产实绩, 作业实绩, 实绩取消, 库存恢复]
related: [PROD_RESULT_SUMMARY, PROD_INPUT_KIOSK, PROD_ORDER]
---

# 生产实绩 — 操作指南

## 系统目的·角色
按工序(CUT/CRIMP/ASSY/INSP/PACK)综合查询·修改·取消生产实绩。显示作业者头像，取消时自动恢复投入材料和库存。

```
RUNNING → DONE (完成) / CANCELED (取消 → 库存恢复)
```

## 数据结构
```
PROD_RESULTS (PK: RESULT_NO, 自动编号)
   ├─ ORDER_NO → JOB_ORDERS (作业指示)
   ├─ EQUIP_CODE → EQUIP_MASTER (设备)
   ├─ WORKER_NO → WORKER_MASTERS (作业者)
   ├─ GOOD_QTY / DEFECT_QTY (良品/不良)
   ├─ START_TIME / END_TIME / CYCLE_TIME
   └─ STATUS: RUNNING → DONE / CANCELED
```

## 界面构成
- **头部**: 标题 + 刷新按钮
- **工具栏**: 搜索(实绩编号·作业指示·产品UID) + 工序筛选(CUT/CRIMP/ASSY/INSP/PACK) + 期间筛选(默认今天)
- **DataGrid**: `GET /production/prod-results?limit=5000`

| 列 | 说明 |
|------|------|
| 实绩编号 | `RESULT_NO` (PK) |
| 作业日 | `START_TIME`基准 |
| 工序类型 | `PROCESS_CODE` (ComCodeBadge) |
| 作业指示 | `ORDER_NO` |
| 品目名 | `JOB_ORDERS → PART_MASTERS.ITEM_NAME` |
| 生产线名 | `JOB_ORDERS.LINE_CODE` |
| 设备名 | `EQUIP_MASTER.EQUIP_NAME` |
| 作业者 | `WORKER_MASTERS` (头像+姓名) |
| 产品UID | `PRD_UID` |
| 良品 | `GOOD_QTY` (绿色) |
| 不良 | `DEFECT_QTY` (红色) |
| 不良率 | `DEFECT_QTY / (GOOD_QTY + DEFECT_QTY) × 100` |
| 作业时间 | `START_TIME ~ END_TIME` |
| 周期时间 | `CYCLE_TIME` (秒) |
| 状态 | `STATUS` (RUNNING/DONE/CANCELED) |
| 操作 | 修改·取消·删除 |

## 作业流程

### ① 查询
- 按工序类型筛选 (CUT/CRIMP/ASSY/INSP/PACK)
- 按期间搜索 (START_TIME基准)
- 按作业指示·实绩编号·产品UID搜索

### ② 修改
`PUT /production/prod-results/{resultNo} { goodQty, defectQty, remark }`
- RUNNING/DONE状态可修改
- 数量变更时自动逆转/重新发行材料 + 调整库存

### ③ 取消
`POST /production/prod-results/{resultNo}/cancel { remark }`
- RUNNING/DONE → CANCELED
- 取消时恢复库存: 材料逆转 + 产品库存逆转 + 设备释放
- 下游工序进行时不可取消 (FG_LABELS·BOX·PALLET·SHIPMENT)

### ④ 删除
`DELETE /production/prod-results/{resultNo}`
- 仅CANCELED状态可删除

## 主要规则

| 规则 | 说明 |
|------|------|
| 材料自动扣除 | 创建时BOM基础扣除(ON_CREATE), 完成时追加扣除(ON_COMPLETE) |
| 产品库存即时加载 | 良品→WIP_MAIN, 不良→DEFECT仓库 |
| 设备BOM联锁 | 设备BOM与作业指示品目不一致时阻断 |
| 作业指示自动升级 | 首个实绩→RUNNING, 计划达成→自动DONE |
| 班次自动分配 | 基于SHIFT_PATTERNS |
| 模具次数累计 | 完成时CONSUMABLE_MASTER.currentCount增加 |

## 互锁

| 条件 | 说明 |
|------|------|
| 取消时下游进行中 | FG_LABELS/BOX/PALLET/SHIPMENT存在时不可取消 |
| 已CANCELED | 仅可删除 |
| ORDER_NO变更 | 不可修改 |
| STATUS直接变更 | 必须通过complete/cancel API |

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 无实绩 | 该期间/工序无数据 | 放宽筛选条件 |
| 无法取消 | 包装/出库已进行 | 确认下游后逆序处理 |
| 无法修改 | CANCELED状态 | 取消后再作业 |
| 无法创建 | 设备BOM不一致 | 确认设备BOM |

## 数据·关联
- 表: `PROD_RESULTS`, `JOB_ORDERS`, `EQUIP_MASTER`, `WORKER_MASTERS`, `PART_MASTERS`, `DEFECT_LOGS`, `FG_LABELS`, `SG_LABELS`, `PRODUCT_TRANSACTIONS`, `MAT_ISSUES`, `STOCK_TRANSACTIONS`, `BOX_MASTERS`, `PALLET_MASTERS`, `SHIPMENT_LOGS`
- 关联: 作业指示(`/production/order`) → **生产实绩(当前)** → 实绩汇总(`/production/result-summary`)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
