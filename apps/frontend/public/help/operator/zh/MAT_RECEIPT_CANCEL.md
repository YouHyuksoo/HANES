---
menuCode: MAT_RECEIPT_CANCEL
audience: operator
title: 材料入库取消 — 操作指南
summary: 入库取消的DB结构(STOCK_TRANSACTIONS取消链)、服务器验证链、库存扣减逻辑与故障排除
tags: [材料, 入库, 取消, 操作, 逆向交易, 出入库]
keywords: [STOCK_TRANSACTIONS, CANCEL_REF_ID, RECEIVE, DONE, CANCELED, MatStock, 逆向交易, 取消原因, ensureNoDownstreamProgress, NotFoundException, BadRequestException, 库存扣减]
related: [MAT_RECEIVE, MAT_ARRIVAL]
---

# 材料入库取消 — 操作指南

## 系统目的·作用
取消记录在 `STOCK_TRANSACTIONS` 中的 `RECEIVE` 类型入库交易的画面。取消时将原交易 `STATUS` 更改为 `CANCELED`，并创建相反符号的逆向交易以扣减 `MatStock` 库存。用于错误入库或质量异常时恢复库存准确性。

## 数据结构
```
STOCK_TRANSACTIONS (RECEIVE, STATUS='DONE')
    │
    ├── 取消请求 ──▶ 验证(原交易存在·重复取消·transType·后续作业)
    │                    │
    │                    ├── 失败 → 返回异常
    │                    │
    │                    └── 成功 → 双重处理:
    │                             ├── 原 STATUS = 'CANCELED'
    │                             │   + CANCEL_REF_ID = 自引用
    │                             │
    │                             ├── 创建逆向交易
    │                             │   (QTY = -原QTY, REF_TYPE='CANCEL')
    │                             │   + CANCEL_REF_ID = 原.TRANS_NO
    │                             │
    │                             └── MatStock 扣减
    │                                   (该LOT数量减少)
    │
    └── 取消历史 ──▶ 以逆向交易形式保存在 STOCK_TRANSACTIONS
```

---

## ① 可取消入库记录 — STOCK_TRANSACTIONS (全部列)

| 画面项目 | DB列 | 作用/含义 · 操作要点 |
|------|------|------|
| 交易日期 | `TRANS_DATE` | 入库交易发生日期。与查询期间筛选关联。 |
| 交易编号 | `TRANS_NO` | **PK**。入库交易唯一标识号。自动编号。 |
| 交易类型 | `TRANS_TYPE` | 入库取消画面仅筛选显示 `RECEIVE`。 |
| 物料代码 | `ITEM_CODE` | 入库的物料代码。参照 `ITEM_MASTERS.ITEM_CODE`。 |
| 物料名称 | (画面JOIN) | 从 `ITEM_MASTERS.ITEM_NAME` 查询。 |
| 材料序列号 | `MAT_UID` | 入库材料LOT的UID。关联 `MAT_LOTS.MAT_UID`。 |
| 供应商 | (画面JOIN) | 客户名称。从 `PARTNERS` 表查询。 |
| 入库仓库 | `TO_WAREHOUSE_ID` | 材料入库的仓库ID。参照 `WAREHOUSES`。 |
| 数量 | `QTY` | 入库数量。取消时以此值的相反符号创建逆向交易。 |
| 状态 | `STATUS` | `DONE`(正常) / `CANCELED`(取消)。仅 `DONE` 的交易激活取消按钮。 |
| 取消引用 | `CANCEL_REF_ID` | 取消时存储原 `TRANS_NO`。NULL表示未取消。 |
| 引用类型 | `REF_TYPE` | 原交易的引用类型。取消时逆向交易以 `'CANCEL'` 创建。 |
| 引用ID | `REF_ID` | 原交易的引用ID(如到货编号、PO编号)。 |
| 摘要 | `REMARK` | 交易相关备注(取消原因在取消弹窗的单独字段)。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 公司代码(`40`) / 工厂代码(`1000`) 范围。 |
| 创建者 | `CREATED_BY` | 入库登记人。 |
| 创建时间 | `CREATED_AT` | 入库登记时间。 |
| 修改者 | `UPDATED_BY` | 最后修改者(取消处理时更新)。 |
| 修改时间 | `UPDATED_AT` | 最后修改时间(取消处理时自动更新)。 |

---

## 取消处理详情

### 服务器验证链 (按顺序执行)

| 步骤 | 验证 | 失败时 |
|------|------|--------|
| 1 | 确认原交易是否存在 (`findOne` by `TRANS_NO`) | `NotFoundException` |
| 2 | 确认是否已取消 (`STATUS = 'CANCELED'`) | `BadRequestException` — "already canceled" |
| 3 | 确认交易类型 (`TRANS_TYPE = 'RECEIVE'`) | `BadRequestException` — "not a receive transaction" |
| 4 | 确认后续作业是否已进行 (`ensureNoDownstreamProgress`) | `BadRequestException` — "cannot cancel: downstream progress exists" |

### 取消执行处理顺序
1. 从 `MatStock` 中按 **原 QTY** 扣减该仓库 + 物料 + LOT 的库存数量
2. 将原 `STOCK_TRANSACTIONS.STATUS` 更新为 `'CANCELED'` + 设置 `CANCEL_REF_ID`
3. 创建逆向交易行 (`QTY = -原QTY`, `TRANS_TYPE = 'RECEIVE'`, `REF_TYPE = 'CANCEL'`, `CANCEL_REF_ID = 原.TRANS_NO`)
4. 更新审计字段(`UPDATED_BY`, `UPDATED_AT`)

> **事务处理**: 上述1~4在单个DB事务内执行，保证原子性。中途失败时整体回滚。

---

## 取消链结构

```
原入库 (RECEIVE, DONE)
  TRANS_NO = 'R20250101-001', QTY = 100
     │
     ├── 取消处理 ──▶ STATUS → 'CANCELED'
     │                   CANCEL_REF_ID → 'R20250101-001' (自引用)
     │
     └── 创建逆向交易 ──▶ RECEIVE, STATUS = 'DONE'
                          TRANS_NO = 'R20250101-002' (新编号)
                          QTY = -100
                          REF_TYPE = 'CANCEL'
                          CANCEL_REF_ID = 'R20250101-001'
```

> 通过 `CANCEL_REF_ID` 可以追踪原交易和逆向交易。逆向交易不是单独的取消对象，不在此画面显示。

---

## 操作流程
1. **接收取消请求**: 现场发现入库错误或质量异常时提出取消请求
2. **确认可否取消**: 在画面上确认目标交易的状态及后续作业是否进行
3. **输入取消原因**: 记录具体的取消原因(用于审计追踪)
4. **确认取消**: 确认逆向交易创建及库存扣减
5. **事后处理**: 必要时重新入库(MAT_RECEIVE)或退货处理

## 权限
拥有入库取消权限的用户(材料/质量管理人)。一般用户仅可查询。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 取消按钮非激活 | 已为 `CANCELED` 状态或 `STATUS` 不是 `DONE` | 确认原交易状态，已取消的不可重复取消 |
| "找不到原交易" | `TRANS_NO` 在DB中不存在 | 直接在DB确认该交易是否存在 |
| "已取消的交易" | `STATUS` 已为 `CANCELED` | 查询取消历史判断是否需要还原 |
| "非入库交易" | `TRANS_TYPE` 不是 `RECEIVE` | 该画面仅可取消 `RECEIVE`。其他类型请使用相应功能 |
| "存在后续作业无法取消" | 该LOT已投入生产等 | 确认生产进度。完成后续作业后方可取消 |
| 取消后库存数量不符 | 逆向交易创建失败或重复扣减 | 对照确认 `STOCK_TRANSACTIONS` 与 `MatStock` 中该LOT的数量 |
| 取消处理已完成但画面未反映 | 浏览器缓存或未刷新 | 点击 **刷新(Refresh)** 按钮 |

## 数据·关联
- **表**: `STOCK_TRANSACTIONS` (原交易 + 逆向交易), `MatStock` (库存扣减)
- **关联**: `ITEM_MASTERS`(物料), `WAREHOUSES`(仓库), `PARTNERS`(客户), `MAT_LOTS`(LOT)
- **验证引用**: `ensureNoDownstreamProgress` — 阻止存在生产投入等后续作业的取消
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
- **审计**: 取消时通过 `CANCEL_REF_ID` 可追踪原交易与逆向交易的关联
