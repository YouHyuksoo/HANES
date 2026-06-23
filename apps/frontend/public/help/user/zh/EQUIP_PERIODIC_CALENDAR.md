---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: user
title: 定期点检日历
summary: 通过月历查看定期点检(PERIODIC)现状并对各设备执行点检的画面
tags: [设备, 点检, 定期, 日历, PERIODIC, 月历]
keywords: [EQUIP_PERIODIC_CALENDAR, 定期点检日历, PERIODIC, 设备定期点检, 月度点检现状]
related: [EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM]
---

# 定期点检日历

## 画面目的
以月为单位通过日历视图查看定期点检(PERIODIC)的现状，确认各日期设备的点检项目并执行点检。使用与日常点检日历相同的UI，但显示PERIODIC类型的数据。

## 画面构成
- **上方 — 统计卡片**：汇总显示该月的点检计划总数、完成数、不合格数和未完成(延迟)数量。
- **左侧 — 日历网格**：在月度日历上以颜色区分显示各日期的点检现状。
- **右侧 — 每日设备点检面板**：显示所选日期的各设备点检对象及结果。

## 日历颜色区分

| 状态 | 颜色 | 含义 |
|------|------|------|
| **全部合格(ALL_PASS)** | 绿色 | 当日所有设备点检完成，全部项目合格 |
| **存在不合格(HAS_FAIL)** | 红色 | 当日点检结果中包含不合格(FAIL) |
| **进行中(IN_PROGRESS)** | 黄色 | 部分设备已完成点检，部分未完成 |
| **未开始(NOT_STARTED)** | 灰色 | 存在点检对象但尚未开始 |
| **已延迟(OVERDUE)** | 红色边框 | 点检期限已过但未完成 |

## 使用顺序
1. 点击日历中的日期进行选择。
2. 右侧面板显示该日各设备的点检对象列表。
3. 在各设备卡片中点击**执行点检**或**修改**按钮。
4. 在点检执行弹窗中选择点检人，输入各项目的PASS/FAIL判定及不良原因。
5. 保存后日历和面板将自动刷新。

## 相关画面
- [定期点检结果](/equipment/periodic-inspect) — 以列表形式管理定期点检结果的画面
- [日常点检日历](/equipment/inspect-calendar) — 通过日历管理日常点检(DAILY)的画面
