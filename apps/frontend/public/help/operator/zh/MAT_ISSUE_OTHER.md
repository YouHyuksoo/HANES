---
menuCode: MAT_ISSUE_OTHER
audience: operator
title: 其他出库 — 操作指南
summary: 非量产材料出库 — LOT条码扫描全量出库, 出库记录查询·取消, 不良/样品/外包/废弃/退货/其他出库账户
tags: [材料, 出库, 其他出库, LOT, 条码]
keywords: [MAT_ISSUES, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, ISSUE_TYPE, DONE, CANCELED, MAT_OUT, WIP_MOVE, 其他出库, LOT出库, 条码扫描, 出库取消]
related: [MAT_ISSUE, MAT_RECEIVE]
---

# 其他出库 — 操作指南

## 系统目的·角色
处理非量产材料出库(不良/样品/外包/废弃/退货/其他)。扫描LOT条码一次性出库全部库存，或查询/取消出库记录。

```
条码扫描标签: LOT扫描 → 全量出库
出库记录标签: 查询 → 取消(输入原因)
```

## 数据结构
```
MAT_LOTS (PK: matUid)
   ├─ ITEM_CODE → ITEM_MASTERS
   ├─ currentQty / iqcStatus / status(NORMAL/HOLD/DEPLETED)
   └─ MAT_STOCKS (qty / availableQty / reservedQty)

MAT_ISSUES (PK: issueNo + seq)
   ├─ matUid / issueQty / issueType / status(DONE/CANCELED)
   └─ STOCK_TRANSACTIONS (transType=MAT_OUT/WIP_MOVE)
```

## 界面构成

### 条码扫描标签
- **出库账户选择**: `ISSUE_TYPE`公共代码(排除PRODUCTION)
- **LOT条码输入**: 自动对焦, Enter → `GET /material/lots/by-uid/{matUid}`
- **扫描结果卡片**:
  - 物料代码·物料名·LOT·库存数量·单位
  - IQC状态(需PASS)
  - 入库日·供应商
- **全量出库按钮**: `POST /material/issues/scan { matUid, issueType }`
- **今日出库记录**: 本地DataGrid

### 出库记录标签
- **筛选条件**: 状态·出库账户·期间
- **DataGrid**: `GET /material/issues?limit=200`
  - 列: 出库编号·出库日·物料代码·物料名·LOT·数量·出库账户·作业指示·状态
  - 取消按钮(仅DONE)
- **取消弹窗**:
  - 显示出库详情
  - 必须输入取消原因
  - `POST /material/issues/{issueNo}/{seq}/cancel { reason }`

## 作业流程

### ① 条码扫描出库
1. 选择出库账户(如不良/样品/外包)
2. 扫描LOT条码或手动输入
3. 确认扫描结果(IQC PASS必须)
4. 点击`全量出库`
5. 库存扣减 + STOCK_TRANSACTIONS记录

### ② 出库记录查询
- 按期间·状态·出库账户筛选
- 出库账户以`ISSUE_TYPE`公共代码徽章显示
- DONE/CANCELED状态区分

### ③ 出库取消
- 仅DONE状态可取消
- 必须输入取消原因
- 库存恢复 + 反向交易记录
- 下游生产进行中时无法取消

## 互锁

| 条件 | 说明 |
|------|------|
| IQC未PASS | 不可出库 |
| HOLD/DEPLETED状态 | 不可出库 |
| 库存不足 | 不可出库 |
| 生产实绩进行中 | 不可取消 |
| 已取消 | 不可取消 |

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| LOT查询不到 | 条码错误 | 确认LOT条码 |
| 无出库账户 | 排除PRODUCTION | 选择其他账户 |
| 出库失败 | IQC或库存问题 | 确认材料状态和库存 |
| 取消失败 | 连接生产实绩 | 先完成下游工序 |

## 数据·关联
- 表: `MAT_ISSUES`, `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `WIP_MAT_STOCKS`
- 关联: 入库管理(`/material/receive`) → **其他出库(当前)** → 生产投入
- 公共代码: `ISSUE_TYPE` (PRODUCTION/SCRAP/SAMPLE/OUTSOURCING/RETURN/DEFECT/OTHER)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
