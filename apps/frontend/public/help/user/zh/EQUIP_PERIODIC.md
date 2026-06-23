---
menuCode: EQUIP_PERIODIC
audience: user
title: 定期点检
summary: 按周期（月/季/半年/年）进行设备定期点检(PERIODIC)结果登记和管理的画面
tags: [설비, 점검, 정기, PERIODIC, 결과, 관리]
keywords: [EQUIP_PERIODIC, 정기점검, 설비정기점검, PERIODIC, 점검결과, PASS, FAIL]
related: [EQUIP_PERIODIC_CALENDAR, EQUIP_DAILY, EQUIP_INSPECT_ITEM]
---

# 定期点检

## 画面目的
登记和管理按周期（月/季/半年/年）进行的设备定期点检(PERIODIC)结果。采用与日常点检相同的左右分栏布局，处理PERIODIC类型的点检数据。

## 画面构成
- **左侧 — 设备列表**: 按设备类型分组显示需要进行定期点检的设备。
- **右侧 — 点检输入面板**: 显示所选设备的PERIODIC点检项目列表和判定输入表单。

## 点检输入面板字段

| 字段 | 作用 / 含义 |
|------|------|
| **点检日期** | 定期点检的执行日期。 |
| **点检人（必填）** | 从作业人员主数据中选择点检执行人。 |
| **开始时间** | 点检开始时间。 |
| **点检项目列表** | 与该设备关联的PERIODIC点检项目。 |
| **判定输入** | 输入每个项目的OK（合格）/ NG（不合格）判定或测量值。 |
| **综合判定** | 汇总所有项目的判定结果后自动显示。 |

## 使用步骤
1. 在左侧设备列表中选择要进行定期点检的设备。
2. 在右侧面板中确认/选择点检日期和点检人。
3. 输入每个点检项目的判定结果（判定型OK/NG，测量型输入数值）。
4. 如有不合格(NG)项目，请输入不良内容。
5. 点击**保存（PASS）** 或**保存（NG）** 按钮保存。

## 相关画面
- [定期点检日历](/equipment/periodic-inspect-calendar) — 通过月历查看定期点检现状
- [日常点检](/equipment/daily-inspect) — 每日执行的日常点检画面
- [点检项目主数据](/master/equip-inspect-item) — 登记点检项目
