---
menuCode: EQUIP_HISTORY
audience: operator
title: 点检历史查询 — 运营指南
summary: EQUIP_INSPECT_LOGS表全部点检历史(DAILY+PERIODIC)综合查询、筛选条件、后端查询结构
tags: [설비, 점검, 이력, 운영, 통합조회, DAILY, PERIODIC]
keywords: [EQUIP_INSPECT_LOGS, EQUIP_HISTORY, 점검이력조회, INSPECT_TYPE, OVERALL_RESULT, 통합조회API, 데이터그리드]
related: [EQUIP_DAILY, EQUIP_PERIODIC]
---

# 点检历史查询 — 运营指南

## 系统目的与作用
综合查询`EQUIP_INSPECT_LOGS`表中的所有记录（DAILY + PERIODIC）。只读，后端`InspectHistoryController`调用`EquipInspectService.findAll()`时不带`inspectType`条件，返回所有类型的历史记录。

## 数据结构
```
EQUIP_INSPECT_LOGS (PK: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE)
    │
    ├── INSPECT_TYPE: 'DAILY' 或 'PERIODIC'（查询时无条件 → 全部）
    ├── OVERALL_RESULT: 'PASS' / 'FAIL' / 'CONDITIONAL'
    ├── EQUIP_CODE → EQUIP_MASTERS（JOIN设备代码·名称·类型）
    └── 前端DataGrid支持列筛选·排序·导出
```

## API结构

### 查询点检历史列表
`GET /equipment/inspect-history?search={text}&inspectType={type}&equipType={type}&overallResult={result}&inspectDateFrom={date}&inspectDateTo={date}&limit=5000`

- `search`: 设备代码或设备名称部分匹配
- `inspectType`: `'DAILY'` / `'PERIODIC'`（未指定时为全部）
- `equipType`: 公共代码`EQUIP_TYPE`值
- `overallResult`: `'PASS'` / `'FAIL'` / `'CONDITIONAL'`
- `inspectDateFrom` / `inspectDateTo`: 点检日期范围

### 统计摘要
`GET /equipment/inspect-history/summary` — 点检统计数据

## 列映射

| 画面列 | DB列 | JOIN |
|---------|---------|------|
| 点检日期 | `LOG.INSPECT_DATE` | - |
| 点检类型 | `LOG.INSPECT_TYPE` | - |
| 设备代码 | `LOG.EQUIP_CODE` | - |
| 设备名称 | `EQ.EQUIP_NAME` | `EQUIP_MASTERS` |
| 设备类型 | `EQ.EQUIP_TYPE` | `EQUIP_MASTERS` |
| 点检人 | `LOG.INSPECTOR_NAME` | - |
| 结果 | `LOG.OVERALL_RESULT` | - |
| 备注 | `LOG.REMARK` | - |

## 权限
所有用户可查询。Excel导出需登录用户。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 查询结果为空 | 筛选条件过于严格 | 放宽筛选条件重新查询 |
| 日期范围筛选无效 | 日期格式不匹配 | 确认YYYY-MM-DD格式 |
| 特定设备历史不显示 | 设备已删除或EQUIP_CODE已变更 | 确认设备主数据 |
| Excel导出失败 | 数据量过大 | 缩小日期范围后导出 |

## 数据与关联
- **表**: `EQUIP_INSPECT_LOGS`（全部）、`EQUIP_MASTERS`（JOIN设备名称/类型）
- **控制器**: `InspectHistoryController`（独立控制器，调用`findAll()`时inspectType不固定）
- **范围**: `COMPANY='40'`、`PLANT_CD='1000'`
