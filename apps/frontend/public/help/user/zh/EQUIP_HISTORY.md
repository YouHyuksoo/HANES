---
menuCode: EQUIP_HISTORY
audience: user
title: 点检历史查询
summary: 综合查询日常点检(DAILY)和定期点检(PERIODIC)全部历史的画面
tags: [설비, 점검, 이력, 조회, 통합]
keywords: [EQUIP_HISTORY, 점검이력, 설비점검이력, 통합조회, DAILY, PERIODIC, 검색]
related: [EQUIP_DAILY, EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR, EQUIP_PERIODIC_CALENDAR]
---

# 点检历史查询

## 画面目的
综合查询日常点检(DAILY)和定期点检(PERIODIC)的所有点检历史。为只读画面，可通过多种筛选条件搜索所需历史记录。

## 画面构成
- **筛选区域**: 搜索词 + 点检类型（日常/定期）+ 设备类型 + 结果（合格/不合格/条件合格）+ 日期范围
- **DataGrid列表**: 以表格形式显示符合条件的点检历史。提供列筛选和Excel导出功能。

## DataGrid列

| 列 | 作用 / 含义 |
|------|------|
| **点检日期** | 点检执行日期。 |
| **点检类型** | DAILY（日常点检）或 PERIODIC（定期点检）分类。 |
| **设备代码** | 点检设备的唯一代码。 |
| **设备名称** | 点检设备的名称。 |
| **设备类型** | 设备类型分类。 |
| **点检人** | 执行点检的作业人员姓名。 |
| **结果** | 点检综合结果（PASS / FAIL / CONDITIONAL）。 |
| **备注** | 点检相关附加备注。 |

## 使用步骤
1. 在顶部筛选区域设置条件（点检类型、设备类型、结果、日期范围）。
2. 点击**查询**按钮搜索历史记录。
3. 在结果列表中查看每条记录。
4. 如有需要，可通过Excel导出功能下载数据。

## 筛选条件

| 筛选项 | 说明 |
|------|------|
| **搜索词** | 按设备代码或设备名称搜索。 |
| **点检类型** | 选择全部 / 日常点检(DAILY) / 定期点检(PERIODIC)。 |
| **设备类型** | 按特定设备类型筛选。 |
| **结果** | 按合格(PASS) / 不合格(FAIL) / 条件合格(CONDITIONAL)筛选。 |
| **点检日期范围** | 选择要查询的点检日期起止日。 |

## 相关画面
- [日常点检](/equipment/daily-inspect) — 日常点检结果输入画面
- [定期点检](/equipment/periodic-inspect) — 定期点检结果输入画面
- [日常点检日历](/equipment/inspect-calendar) — 通过日历查看点检现状
