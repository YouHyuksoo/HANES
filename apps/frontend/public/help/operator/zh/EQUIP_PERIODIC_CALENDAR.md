---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: operator
title: 定期点检日历 — 运维指南
summary: 定期点检（PERIODIC）日历的全字段和数据库映射、周期（cycle）计划计算、综合判定和互锁逻辑、主数据关联与问题排查
tags: [设备, 定期点检, 运维, PERIODIC, 预防保全]
keywords: [EQUIP_INSPECT_LOGS, EQUIP_INSPECT_ITEM_POOL, EQUIP_INSPECT_ITEM_MASTERS, EQUIP_MASTERS, INSPECT_TYPE, PERIODIC, cycle, isDue, OVERALL_RESULT, INTERLOCK, OVERDUE, DETAILS, 互锁]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM, EQUIP_PERIODIC]
---

# 定期点检日历 — 运维指南

## 系统目的·作用
本画面以月度日历运营设备**定期点检（INSPECT_TYPE='PERIODIC'）**。以设备点检项目映射（`EQUIP_INSPECT_ITEM_POOL`）和项目主数据（`EQUIP_INSPECT_ITEM_MASTERS`）的**周期（cycle）**为基准，自动计算各日期的点检对象，点检结果保存至`EQUIP_INSPECT_LOGS`。与日常点检日历（`EQUIP_INSPECT_CALENDAR`）使用相同的组件（InspectCalendar / DaySchedulePanel / InspectExecuteModal），通过`inspectType`·`apiBasePath` props复用，**数据仅通过INSPECT_TYPE区分**（表共用）。

## 数据结构
```
EQUIP_INSPECT_ITEM_MASTERS（项目基准：项目名·判定标准·CYCLE·标准图片）
        │ （ITEM_CODE 参照）
        ▼
EQUIP_INSPECT_ITEM_POOL（各设备项目映射，INSPECT_TYPE='PERIODIC'，USE_YN='Y'）
        │  + EQUIP_MASTERS（设备信息）
        ▼  以 cycle 为基准 isDue() → 计算各日期点检对象
日历/日期面板 ──执行点检──▶ EQUIP_INSPECT_LOGS（每设备·日期1件，项目结果存入 DETAILS JSON）
```

---

## ① 点检结果 — EQUIP_INSPECT_LOGS（全字段）
每设备×点检类型×点检日期1件。日常/定期/作业员点检共用表。

| 画面字段 | DB 字段 | 功能 / 含义 · 运维要点 |
|------|------|------|
| （键）设备 | `EQUIP_CODE` | 复合 PK1。点检对象设备。 |
| 点检类型 | `INSPECT_TYPE` | 复合 PK2。本画面固定为**`PERIODIC`**。（DAILY=日常，WORKER=作业员点检） |
| 点检日期 | `INSPECT_DATE` | 复合 PK3。日历中选择的日期（YYYY-MM-DD）。 |
| — | `WORK_DATE` | 作业日（服务器计算）。 |
| — | `INSPECT_AT` | 实际点检保存时刻（TIMESTAMP）。 |
| — | `OP_WINDOW_START_AT` / `OP_WINDOW_END_AT` | 作业窗口开始/结束（保存时计算）。 |
| 点检人 | `INSPECTOR_NAME` | 执行点检的作业员姓名。 |
| 综合判定 | `OVERALL_RESULT` | `PASS` / `FAIL` / `CONDITIONAL`（未使用）。由项目结果自动计算。 |
| 点检项目结果 | `DETAILS`（CLOB） | 项目别结果 JSON：`{items:[{itemId,seq,itemName,result,remark}]}`。保存各项目 PASS/FAIL 及原因。 |
| 整体备注 | `REMARK` | 整体点检备注。 |
| — | `ORDER_NO` | 作业指示编号（WORKER点检用，定期点检未使用）。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000` 范围。 |
| — | `CREATED_BY/AT`, `UPDATED_BY/AT` | 审计字段。 |

---

## ② 各设备点检项目映射 — EQUIP_INSPECT_ITEM_POOL
定义哪台设备关联哪些定期点检项目。在【设备点检项目】画面中管理。

| 画面字段 | DB 字段 | 功能 / 含义 · 运维要点 |
|------|------|------|
| 公司/工厂 | `COMPANY`, `PLANT_CD` | 复合 PK1·2。 |
| 设备 | `EQUIP_CODE` | 复合 PK3。 |
| 点检项目 | `ITEM_CODE` | 复合 PK4。引用项目主数据。 |
| 点检类型 | `INSPECT_TYPE` | 复合 PK5。**本画面对象为`PERIODIC`**。 |
| 使用与否 | `USE_YN` | 仅`Y`纳入计划计算。 |
| 排列顺序 | `SORT_SEQ` | 执行点检时的项目显示顺序。 |

---

## ③ 点检项目基准主数据 — EQUIP_INSPECT_ITEM_MASTERS
项目名·判定标准·**周期（cycle）**·标准图片的来源。

| 画面字段 | DB 字段 | 功能 / 含义 · 运维要点 |
|------|------|------|
| 项目编码 | `ITEM_CODE` | PK（含公司·工厂）。 |
| 项目名 | `ITEM_NAME` | 在点检执行弹窗·标签中显示。 |
| 点检类型 | `INSPECT_TYPE` | `DAILY` / `PERIODIC`。 |
| 设备类型 | `EQUIP_TYPE` | 筛选/模板分类。 |
| 项目类型 | `ITEM_TYPE` | VISUAL/MEASUREMENT 等。 |
| 判定标准 | `CRITERIA` | 执行点检时显示为基准值/说明。 |
| **周期** | `CYCLE` | **`DAILY`/`WEEKLY`/`MONTHLY`。isDue() 计算各日期点检对象的核心。** |
| 测量单位 | `UNIT` | 测量型项目单位。 |
| 规格下/上限 | `LSL_VALUE` / `USL_VALUE` | 测量型判定范围。 |
| 作业员 QR | `WORKER_QR_CODE` | 作业员点检关联用。 |
| 标准图片 | `IMAGE_URL` | 在点检执行弹窗中显示为参考图片。 |
| 使用与否 | `USE_YN` | 仅`Y`使用。 |
| 备注 | `REMARK` | 备注。 |

---

## ④ 设备信息 — EQUIP_MASTERS（参照字段）

| 画面字段 | DB 字段 | 功能 / 含义 · 运维要点 |
|------|------|------|
| 设备编码/名称 | `EQUIP_CODE` / `EQUIP_NAME` | 卡片显示。 |
| 产线 | `LINE_CODE` | 卡片附加信息。 |
| 设备类型 | `EQUIP_TYPE` | 卡片附加信息。 |
| 工序 | `PROCESS_CODE` | **工序筛选**基准。 |
| 状态 | `STATUS` | `NORMAL` / `INTERLOCK`。**保存不合格时自动设为INTERLOCK**。 |
| 使用与否 | `USE_YN` | 仅`Y`设备纳入计划。 |

---

## 计划·判定逻辑

### 按周期计算点检对象（isDue）
以`EQUIP_INSPECT_ITEM_MASTERS.CYCLE`为基准，判断各日期是否为点检对象。
- `DAILY` → 每天对象
- `WEEKLY` → 仅**周一**（getDay()===1）
- `MONTHLY` → 仅**每月1日**（getDate()===1）
- 无值 → 视为 DAILY

### 日期状态（status）计算
`GET /calendar` 按日期计算（优先级顺序）：
1. 对象设备为0 → `NONE`
2. 完成 ≥ 全部 AND 不合格为0 → `ALL_PASS`
3. 不合格 > 0 → `HAS_FAIL`
4. 0 < 完成 < 全部 → `IN_PROGRESS`
5. 完成为0 → 过去为`OVERDUE`，未来为`NOT_STARTED`

### 综合判定（OVERALL_RESULT）
在点检执行弹窗中自动计算：**项目结果中哪怕1件`FAIL`即为`FAIL`**，全部`PASS`则为`PASS`。（仅全部项目结果录入完毕时确定）

### 互锁（INTERLOCK）自动处理
保存（POST/PUT）时，若`OVERALL_RESULT`包含FAIL，`EQUIP_MASTERS.STATUS`自动变更为`'INTERLOCK'`。处置后需将设备状态恢复为`NORMAL`方可恢复运营。

## 前置设置（主数据·公共代码）
1. 在**点检项目主数据**（`EQUIP_INSPECT_ITEM_MASTERS`）中注册`INSPECT_TYPE='PERIODIC'`项目和**CYCLE**。
2. 在**设备点检项目**（`EQUIP_INSPECT_ITEM_POOL`）中将PERIODIC项目以`USE_YN='Y'`映射到设备。
3. 点检对象设备须满足`EQUIP_MASTERS.USE_YN='Y'`。
4. 点检人选择使用作业员主数据。

## 运营流程
1. 通过工序筛选·当月/次月生成显示目标月份。
2. 选择日历日期 → 在日期面板中按设备**执行点检/编辑**。
3. 按项目输入合/不合后保存 → `EQUIP_INSPECT_LOGS` upsert，日历刷新。
4. 发生不合格的设备确认互锁状态后处置·恢复。
5. 自动排程外的设备通过**单独添加点检**（选择设备 → PERIODIC项目自动加载）进行点检。

## 权限
- 点检结果录入：作业员/设备管理者。
- 查询：所有用户。

## 问题排查（故障处理）

| 症状 | 原因 | 措施 |
|------|------|------|
| 日历中无点检对象 | PERIODIC项目未映射或`USE_YN='N'` | 确认`EQUIP_INSPECT_ITEM_POOL`中的PERIODIC项目映射 |
| 仅特定日期为空 | CYCLE条件不符（周间=周一，月间=1日） | 确认项目主数据CYCLE设置 |
| 点检保存失败 | 未选择点检人/未输入项目/FAIL原因缺失 | 补充必填信息后重新保存 |
| 保存后设备无法使用 | 因不合格INTERLOCK自动设置 | 原因处置后将`EQUIP_MASTERS.STATUS`恢复为NORMAL |
| 日常点检结果混入 | INSPECT_TYPE混淆 | 本画面仅查询PERIODIC（API base为periodic-inspect） |

## 数据·关联
- **表**：`EQUIP_INSPECT_LOGS`（INSPECT_TYPE='PERIODIC'）、`EQUIP_INSPECT_ITEM_POOL`、`EQUIP_INSPECT_ITEM_MASTERS`、`EQUIP_MASTERS`
- **API**：`GET /equipment/periodic-inspect/calendar`（月摘要）、`GET /equipment/periodic-inspect/calendar/day`（日计划）、`POST /equipment/periodic-inspect`（保存）、`PUT /equipment/periodic-inspect/{equipCode}/{inspectDate}`（修改）、`DELETE …`（删除）。单独添加时：`GET /master/equip-inspect-items?inspectType=PERIODIC`。
- **与日常点检的差异**：仅INSPECT_TYPE（`PERIODIC` vs `DAILY`）·apiBasePath不同，表·组件·逻辑共用。定期点检无日常点检的`/check`（点检完成确认）端点。
- **关联画面**：[设备点检项目](/master/equip-inspect)、[定期点检结果](/equipment/periodic-inspect)、[日常点检日历](/equipment/inspect-calendar)
- **多租户范围**：`COMPANY='40'`, `PLANT_CD='1000'`
