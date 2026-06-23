---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: operator
title: 定期点检日历 — 运营指南
summary: PERIODIC 点检的日历查询与执行画面、与 DAILY 的差异、API 结构、互锁处理
tags: [设备, 点检, 定期, 日历, 运营, PERIODIC]
keywords: [EQUIP_PERIODIC_CALENDAR, 定期点检日历, PERIODIC, INSPECT_TYPE, CALENDAR_DAY_SUMMARY, 设备互锁]
related: [EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR]
---

# 定期点检日历 — 运营指南

## 系统目的·作用
复用与日常点检日历(`EQUIP_INSPECT_CALENDAR`)相同的 3 个组件(InspectCalendar、DaySchedulePanel、InspectExecuteModal)，以日历形式查询 `INSPECT_TYPE='PERIODIC'` 数据并执行点检。

## 与 DAILY 日历的差异

| 项目 | 日常点检日历 | 定期点检日历 |
|------|---------------|----------------|
| **INSPECT_TYPE** | `'DAILY'` | `'PERIODIC'` |
| **API 路径** | `/equipment/daily-inspect/calendar` | `/equipment/periodic-inspect/calendar` |
| **每日 API** | `/equipment/daily-inspect/calendar/day` | `/equipment/periodic-inspect/calendar/day` |
| **点检执行 API** | POST/PUT `/equipment/daily-inspect` | POST/PUT `/equipment/periodic-inspect` |
| **标题** | 日常点检日历 | 定期点检日历 |
| **当月/次月生成按钮** | 有 | 无 |

## API 结构

### 月度日历摘要
`GET /equipment/periodic-inspect/calendar?year={yyyy}&month={MM}[&processCode={code}]`

响应: `CalendarDaySummary[]` — 各日期的 total、completed、pass、fail、status

### 每日设备计划
`GET /equipment/periodic-inspect/calendar/day?date={yyyy-MM-dd}[&processCode={code}]`

响应: `DayScheduleEquip[]` — 各设备的 equipCode、equipName、inspected、overallResult、items[]

## 点检执行弹窗共享
`InspectExecuteModal` 通过 `inspectType` prop 接收 `'PERIODIC'`，以相同 UI 执行点检：
- 选择点检人(作业员主数据 API)
- 各项目 PASS/FAIL 切换
- FAIL 时必填原因/备注
- 综合结果自动计算
- 保存时 POST(新增)或 PUT(修改)

## 互锁处理
保存 FAIL 结果时，`EquipMaster.status` 自动变更为 `'INTERLOCK'`（与 DAILY 相同）。

## 权限
点检结果输入权限(作业员/设备管理者)。查询权限为所有用户。

## 问题排查（故障处理）

| 症状 | 原因 | 措施 |
|------|------|------|
| 日历中无数据 | 该月无 PERIODIC 点检对象设备 | 确认定期点检对象设备 |
| 选择日期后右侧面板为空 | 该日无计划数据 | 检查点检项目映射及周期设置 |
| 点检保存失败 | 未选择点检人或未输入 FAIL 原因 | 确认必填项已输入 |

## 数据·关联
- **表**: `EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC')
- **共享组件**: inspect-calendar/components/ 的 3 个组件
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
