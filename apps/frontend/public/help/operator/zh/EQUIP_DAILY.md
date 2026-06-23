---
menuCode: EQUIP_DAILY
audience: operator
title: 日常点检 — 运营指南
summary: EQUIP_INSPECT_LOGS 表 DAILY 类型点检、互锁(INTERLOCK)机制、测量型自动判定逻辑与故障排查
tags: [设备, 点检, 日常, 运营, DAILY, 结果, 互锁]
keywords: [EQUIP_INSPECT_LOGS, DAILY, 日常点检结果, OVERALL_RESULT, INTERLOCK, VISUAL, MEASURE, LSL, USL, DETAILS, CLOB]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM]
---

# 日常点检 — 运营指南

## 系统目的·作用
在 `EQUIP_INSPECT_LOGS` 表中以 `INSPECT_TYPE='DAILY'` 存储的日常点检结果进行登记、查询和修改。若点检结果为 FAIL，则关联设备的状态自动变更为 **INTERLOCK（互锁）**，限制设备运行。

## 数据结构
```
EQUIP_INSPECT_LOGS (PK: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE)
    │
    ├── INSPECT_TYPE = 'DAILY' (固定)
    ├── OVERALL_RESULT = 'PASS' | 'FAIL' | 'CONDITIONAL'
    ├── DETAILS (CLOB): 各项目结果的 JSON 数组
    ├── INSPECTOR_NAME & INSPECT_AT
    │
    ├──▶ EquipMaster.status = 'INTERLOCK' (FAIL 时自动)
    │
    └── 关联: EQUIP_INSPECT_ITEM_POOL → EQUIP_INSPECT_ITEM_MASTERS
              (该设备的 DAILY 点检项目)
```

---

## ① 点检日志 — EQUIP_INSPECT_LOGS (全部列 — DAILY)

| 画面项目 | DB 列 | 作用/含义 · 运营要点 |
|------|------|------|
| 设备代码 | `EQUIP_CODE` | **PK (1/6)**。单个设备。 |
| 点检类型 | `INSPECT_TYPE` | **PK (2/6)**。固定为 `'DAILY'`。 |
| 点检日期 | `INSPECT_DATE` | **PK (3/6)**。点检执行日期。 |
| 工单编号 | `ORDER_NO` | 用于 WORKER 点检(DAILY 通常为 null)。 |
| 作业日期 | `WORK_DATE` | DAILY 点检的业务键(以作业日为基准)。 |
| 点检时间 | `INSPECT_AT` | 实际点检完成时间(TIMESTAMP)。 |
| 作业开始时间 | `OP_WINDOW_START_AT` | 当日作业开始时间(关联 WorkCalendar)。 |
| 作业结束时间 | `OP_WINDOW_END_AT` | 当日作业结束时间(关联 WorkCalendar)。 |
| 点检人姓名 | `INSPECTOR_NAME` | 点检执行人姓名。 |
| 综合结果 | `OVERALL_RESULT` | `PASS`(合格) / `FAIL`(不合格) / `CONDITIONAL`(有条件)。 |
| 各项目结果 | `DETAILS` | CLOB — 各项目判定 JSON 数组。 |
| 备注 | `REMARK` | 点检相关备注。 |
| 多租户 | `COMPANY`, `PLANT_CD` | **PK (4,5,6/6)**。公司代码(`40`) / 工厂代码(`1000`)。 |
| 创建人 | `CREATED_BY` | 初始登记人。 |
| 修改人 | `UPDATED_BY` | 最终修改人。 |
| 创建时间 | `CREATED_AT` | 记录创建时间。 |
| 修改时间 | `UPDATED_AT` | 记录修改时间。 |

---

## DETAILS(CLOB) JSON 结构

各项目的点检结果以 JSON 数组形式存储在 CLOB 列中：

```json
[
  {
    "itemCode": "EI-DAILY-001",
    "itemName": "紧急停止按钮操作",
    "itemType": "VISUAL",
    "result": "PASS",
    "criteria": "确认正常操作",
    "remark": "",
    "measureValue": null,
    "lsl": null,
    "usl": null
  },
  {
    "itemCode": "EI-DAILY-002",
    "itemName": "主压力表",
    "itemType": "MEASURE",
    "result": "FAIL",
    "criteria": "5.0 ~ 7.0 kgf/cm²",
    "remark": "压力 4.2，低于下限",
    "measureValue": 4.2,
    "lsl": 5.0,
    "usl": 7.0
  }
]
```

---

## 互锁(INTERLOCK)机制

| 条件 | 动作 | 解除方法 |
|------|------|----------|
| `OVERALL_RESULT = 'FAIL'` | `EquipMaster.status` → `'INTERLOCK'` 自动变更 | 需要单独的解除流程 |
| `OVERALL_RESULT = 'PASS'` | `EquipMaster.status` → `'NORMAL'` 自动变更(若之前状态为 INTERLOCK) | 自动 |
| `OVERALL_RESULT = 'CONDITIONAL'` | 设备状态不变更 | - |

---

## 自动判定逻辑

### 测量型(MEASURE)自动判定
```
if measureValue < LSL → FAIL (低于下限)
if measureValue > USL → FAIL (超过上限)
if LSL <= measureValue <= USL → PASS (正常范围)
```
- 用户也可手动选择 OK/NG

### 判定型(VISUAL)
- 用户直接选择 OK 或 NG

---

## 权限
设备点检结果输入权限(作业员/设备管理者)。查询权限为所有用户。

## 问题排查（故障处理）

| 症状 | 原因 | 措施 |
|------|------|------|
| 左侧设备列表为空 | 该设备未连接 DAILY 点检项目 | 在设备点检项目画面中添加项目 |
| 点检保存失败 | 未选择点检人或未输入项目判定 | 确认所有必填项已输入 |
| 保存 FAIL 但设备未互锁 | 服务逻辑异常或事务失败 | 检查日志后手动处理互锁 |
| 输入测量值时自动判定不生效 | LSL/USL 在主数据中未设置 | 在点检项目主数据中设置 LSL/USL |
| 保存按钮被禁用 | 未选择点检人或部分项目判定缺失 | 确认所有字段输入完成 |
| 同一设备·日期重复保存 | 已存在点检完成的记录 | 以修改(PUT)方式处理 |

## 数据·关联
- **表**: `EQUIP_INSPECT_LOGS` (点检结果), `EQUIP_INSPECT_ITEM_POOL` (映射), `EQUIP_INSPECT_ITEM_MASTERS` (项目基准), `EQUIP_MASTERS` (设备状态)
- **关联**: 与作业实绩画面弹窗共享数据，设备互锁(INTERLOCK)状态变更
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
