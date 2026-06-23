---
menuCode: EQUIP_PERIODIC
audience: operator
title: 定期点检 — 运营指南
summary: EQUIP_INSPECT_LOGS表PERIODIC类型点检、与DAILY的区别、联锁处理、周期调度
tags: [설비, 점검, 정기, 운영, PERIODIC, 결과, 인터록]
keywords: [EQUIP_INSPECT_LOGS, PERIODIC, 정기점검결과, OVERALL_RESULT, INTERLOCK, CYCLE, QUARTERLY, SEMI_ANNUAL, ANNUAL]
related: [EQUIP_PERIODIC_CALENDAR, EQUIP_DAILY]
---

# 定期点检 — 运营指南

## 系统目的与作用
登记、查看和修改存储在`EQUIP_INSPECT_LOGS`表中`INSPECT_TYPE='PERIODIC'`的定期点检结果。使用与日常点检(DAILY)相同的`EquipInspectService`，`inspectType`固定为`'PERIODIC'`。

## 与DAILY点检的区别

| 项目 | 日常点检(DAILY) | 定期点检(PERIODIC) |
|------|---------------|-------------------|
| **INSPECT_TYPE** | `'DAILY'` | `'PERIODIC'` |
| **周期** | 每天 | MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL |
| **API路径** | `/equipment/daily-inspect` | `/equipment/periodic-inspect` |
| **项目筛选** | `inspectType=DAILY` | `inspectType=PERIODIC` |
| **控制器** | `DailyInspectController` | `PeriodicInspectController` |
| **服务** | `EquipInspectService`（相同） | `EquipInspectService`（相同） |
| **页面图标** | `ClipboardCheck` | `CalendarCheck` |
| **标题** | 日常点检 | 定期点检 |

## 与日常点检相同的事项
- 复用`EquipListPanel`、`InspectEntryPanel`组件
- 点检保存逻辑：POST（新增）/ PUT（修改）
- 联锁处理：FAIL时 `EquipMaster.status = 'INTERLOCK'`
- DETAILS（CLOB）JSON结构相同

## 周期调度

`EquipInspectService`的`getCalendarSummary()`和`getDaySchedule()`根据以下条件确定目标设备：

| CYCLE值 | 点检目标日期 |
|---------|-----------|
| MONTHLY | 每月1日 |
| QUARTERLY | 季度首日（1/1、4/1、7/1、10/1） |
| SEMI_ANNUAL | 半年首日（1/1、7/1） |
| ANNUAL | 每年1月1日 |

## 数据结构
`EQUIP_INSPECT_LOGS`（INSPECT_TYPE='PERIODIC'）— 使用与DAILY完全相同的表/列。

定期点检项目从`EQUIP_INSPECT_ITEM_POOL`中以`INSPECT_TYPE='PERIODIC'`为条件筛选。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 设备列表中不显示定期点检对象 | PERIODIC项目未映射到设备 | 在设备点检项目画面 → PERIODIC选项卡 → 添加 |
| 特定设备没有点检项目 | EQUIP_INSPECT_ITEM_POOL中无PERIODIC关联 | 注册主数据后映射 |
| 保存按钮不可用 | 未选择点检人或部分项目判定缺失 | 检查所有必填项 |
| FAIL保存时未触发联锁 | 服务器异常或事务问题 | 查看日志 |

## 数据与关联
- **表**: `EQUIP_INSPECT_LOGS`（INSPECT_TYPE='PERIODIC'）、`EQUIP_INSPECT_ITEM_POOL`、`EQUIP_MASTERS`
- **共享组件**: daily-inspect/components/ 中的 EquipListPanel、InspectEntryPanel
- **范围**: `COMPANY='40'`、`PLANT_CD='1000'`
