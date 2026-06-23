---
menuCode: QC_REWORK_INSPECT
audience: operator
title: 再作业检查 — 操作指南
summary: IATF 16949 再作业完成品再验证检查 — 待检查列表查询·PASS/FAIL/SCRAP判定·数量输入·库存自动转换
tags: [质量, 再作业, 再检查, IATF16949]
keywords: [REWORK_ORDERS, REWORK_INSPECTS, INSPECT_PENDING, INSPECT_METHOD, PASS, FAIL, SCRAP, DEFECT_LOG, 再作业检查, 再检查, 再作业, 缺陷处理]
related: [QC_INSPECT, INSP_RESULT]
---

# 再作业检查 — 操作指南

## 系统目的·角色
根据IATF 16949要求执行**再作业(Rework)完成品再验证检查**。查询`INSPECT_PENDING`状态的订单，判断PASS/FAIL/SCRAP并登记检查实绩。根据检查结果**自动转换库存**，同时同步关联的缺陷记录(DefectLog)状态。

```
缺陷发生 → DefectLog → ReworkOrder(REGISTERED) → 批准 → 再作业 → INSPECT_PENDING
    → 检查(PASS/FAIL/SCRAP) → 库存转换 + DefectLog状态同步
```

## 状态流程 (REWORK_ORDERS)
```
REGISTERED → QC_PENDING → PROD_PENDING → APPROVED
    → IN_PROGRESS → INSPECT_PENDING → PASS / FAIL / SCRAP
```

## 数据结构
```
REWORK_ORDERS (PK: REWORK_NO, 格式: RW-YYYYMMDD-NNN)
   ├─ DEFECT_LOG_ID → DefectLog (缺陷记录)
   ├─ ITEM_CODE → PartMaster
   ├─ REWORK_QTY / RESULT_QTY / PASS_QTY / FAIL_QTY
   └─ STATUS: INSPECT_PENDING (待检查)

REWORK_INSPECTS (PK: REWORK_ORDER_ID + SEQ)
   检查实绩 (SEQ在订单内自动递增)
```

## 界面构成

### 主要区域
- **头部**: 标题 + 刷新按钮
- **StatCard (3个)**:
  - 🔵 待检查数量 (列表计数)
  - 🟢 合格数量 (PASS统计)
  - 🔴 不合格数量 (FAIL统计)
- **DataGrid**: `GET /quality/reworks?status=INSPECT_PENDING&limit=5000`
  - 列: 再作业编号·物料代码·物料名·再作业数量·实绩数量·作业者·完成时间·状态
  - 状态以`REWORK_STATUS`公共代码徽章显示
  - 搜索: 再作业编号·物料代码·物料名 (300ms防抖)
  - 点击行右侧`FileSearch`图标 → 打开右侧面板

### 右侧面板 (480px, InspectFormPanel)
`POST /quality/reworks/inspects`

| 项目 | 组件 | 说明 |
|------|----------|------|
| 对象摘要 | 卡片 | 显示再作业编号·物料代码·再作业数量·实绩数量 |
| 检查员 | `WorkerSelect` | 必填。未选择时注册按钮禁用 |
| 检查方法 | `ComCodeSelect` | 公共代码`INSPECT_METHOD` |
| 检查结果 | 单选按钮(3) | PASS / FAIL / SCRAP (默认: PASS) |
| 合格数量 | `QtyInput` | PASS时的良品数量 (默认: resultQty) |
| 不合格数量 | `QtyInput` | FAIL/SCRAP时的不合格数量 |
| 缺陷详情 | textarea | FAIL/SCRAP原因 |
| 备注 | `Input` | |

## 检查流程

### ① 确认待检查列表
`GET /quality/reworks?status=INSPECT_PENDING`
- 所有再作业工序完成时自动转为`INSPECT_PENDING`
- 使用搜索筛选目标订单

### ② 输入检查信息
- 选择检查员 (必填)
- 选择检查方法 (如全数检查、抽样等)
- 选择检查结果: **PASS** / **FAIL** / **SCRAP**
  - **PASS**: 判定为良品 → 库存从`DEFECT`仓库移至`WIP_MAIN`仓库
  - **FAIL**: 再作业不合格 → 留在`DEFECT`仓库 (可再次再作业)
  - **SCRAP**: 废品处理 → 从`DEFECT`仓库移至`SCRAP`仓库

### ③ 登记检查 (POST /quality/reworks/inspects)
服务端处理顺序:
1. 状态验证: 非`INSPECT_PENDING`则抛出`BadRequestException`
2. SEQ自动编号: 订单内已有检查数 + 1
3. 更新REWORK_ORDERS状态/数量:
   - `status` = 检查结果 (PASS/FAIL/SCRAP)
   - `passQty`, `failQty`更新
   - `isolationFlag`: PASS=0(解除隔离), FAIL/SCRAP=1(保持隔离)
4. DefectLog状态同步 (如有连接):
   - PASS → `DONE`, SCRAP → `SCRAP`, FAIL → `REWORK` (保持不变)
5. 库存处理 (FAIL除外):
   - PASS: passQty → DEFECT→WIP_MAIN良品恢复 (不足时自动生成补充入库)
   - SCRAP: failQty → DEFECT→SCRAP废品处理
   - FAIL: 不移动库存，留在DEFECT仓库

## 互锁 (登记阻断条件)

| 条件 | 消息 | 解决 |
|------|--------|------|
| 检查员未选择 | 请选择检查员 | 从WorkerSelect选择检查员 |
| 状态不是INSPECT_PENDING | 不是待检查状态 | 刷新后重试 |

## 再作业状态代码 (REWORK_STATUS)

| 代码 | 含义 | 备注 |
|------|------|------|
| REGISTERED | 已登记 | 从DefectLog创建 |
| QC_PENDING | QC待批准 | |
| PROD_PENDING | 生产待批准 | |
| APPROVED | 已批准 | QC+生产批准 |
| IN_PROGRESS | 再作业进行中 | 按工序作业 |
| INSPECT_PENDING | **待检查** | **此画面查询的状态** |
| PASS | 合格 | 库存良品恢复 |
| FAIL | 不合格 | 需要再再作业 |
| SCRAP | 废弃 | 废品处理 |

## 全部列 — REWORK_ORDERS

| 项目 | DB列 | 角色 |
|------|---------|------|
| 再作业编号 | `REWORK_NO` | PK. 格式`RW-YYYYMMDD-NNN` |
| 缺陷记录ID | `DEFECT_LOG_ID` | 连接的DefectLog |
| 物料代码 | `ITEM_CODE` | FK → PartMaster |
| 物料名 | `ITEM_NAME` | |
| 再作业数量 | `REWORK_QTY` | 总再作业对象数量 |
| 实绩数量 | `RESULT_QTY` | 实际完成数量 |
| 状态 | `STATUS` | `REWORK_STATUS`公共代码 |
| 再作业方法 | `REWORK_METHOD` | IATF: 批准的方法 |
| 隔离标志 | `ISOLATION_FLAG` | 1=隔离, 0=解除 |
| 合格数量 | `PASS_QTY` | 检查时设定 |
| 不合格数量 | `FAIL_QTY` | 检查时设定 |
| 作业者 | `WORKER_CODE` | |
| 生产线 | `LINE_CODE` | FK → ProdLineMaster |
| 设备 | `EQUIP_CODE` | FK → EquipMaster |
| 开始 | `START_AT` | |
| 完成 | `END_AT` | |
| 备注 | `REMARK` | |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000` |

## 全部列 — REWORK_INSPECTS

| 项目 | DB列 | 角色 |
|------|---------|------|
| 再作业编号 | `REWORK_ORDER_ID` | PK (FK → REWORK_ORDERS) |
| 序号 | `SEQ` | PK (订单内自动递增) |
| 检查员 | `INSPECTOR_CODE` | |
| 检查时间 | `INSPECT_AT` | |
| 检查方法 | `INSPECT_METHOD` | 公共代码`INSPECT_METHOD` |
| 检查结果 | `INSPECT_RESULT` | PASS / FAIL / SCRAP |
| 合格数量 | `PASS_QTY` | |
| 不合格数量 | `FAIL_QTY` | |
| 缺陷详情 | `DEFECT_DETAIL` | 最多1000字 |
| 备注 | `REMARK` | |

## 预设条件
- 公共代码: `REWORK_STATUS`, `INSPECT_METHOD`
- 再作业订单必须处于`INSPECT_PENDING`状态
- 库存: 需要预先注册DEFECT/WIP_MAIN/SCRAP仓库代码
- 权限: 质量检查员(登记检查), 管理员(修改记录)

## DefectLog关联规则
- 与再作业连接的DefectLog不能直接删除/修改
- 检查登记时自动同步，无需单独处理DefectLog
- 删除连接的DefectLog时会显示`无法直接处理与再作业连接的缺陷`

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 列表为空 | 没有`INSPECT_PENDING`状态订单 | 确认再作业工序完成 |
| 注册按钮禁用 | 检查员未选择 | 从WorkerSelect选择检查员 |
| "不是待检查状态"错误 | 状态错误 | 刷新后重试 |
| SCRAP时库存不足 | DEFECT仓库库存不足 | 确认库存后调整数量 |
| 无法修改DefectLog | 连接了ReworkOrder | 通过检查间接处理 |

## 数据·关联
- 表: `REWORK_ORDERS`, `REWORK_INSPECTS`, `REWORK_PROCESSES`, `REWORK_RESULTS`, `DEFECT_LOGS`, `PartMaster`
- 关联: DefectLog缺陷记录 → 再作业登记 → 再作业工序 → **再作业检查(当前画面)** → 库存转换
- 再作业编号格式: `RW-YYYYMMDD-NNN` (服务器自动生成)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
