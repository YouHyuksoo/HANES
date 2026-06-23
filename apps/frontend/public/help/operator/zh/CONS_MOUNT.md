---
menuCode: CONS_MOUNT
audience: operator
title: 消耗品安装管理 — 操作指南
summary: 消耗品的设备安装/拆卸/维修状态转换以及 CONSUMABLE_MASTERS, CONSUMABLE_MOUNT_LOGS 数据流和故障排查
tags: [消耗品, 安装, 拆卸, 维修, 操作, 设置]
keywords: [CONSUMABLE_MASTERS, CONSUMABLE_MOUNT_LOGS, EQUIP_MASTERS, OPER_STATUS, MOUNTED, WAREHOUSE, REPAIR, MOUNT, UNMOUNT, SEQ_CONSUMABLE_MOUNT_LOGS]
related: [CONS_MASTER, CONS_STOCK, CONS_LIFE]
---

# 消耗品安装管理 — 操作指南

## 系统目的·作用
管理生产设备所用消耗品（模具·夹具·工具）的**物理状态**。更新 `CONSUMABLE_MASTERS` 的 `OPER_STATUS` 和 `MOUNTED_EQUIP_ID`，所有状态转换都会作为审计历史保留在 `CONSUMABLE_MOUNT_LOGS` 中。本画面是与出入库或寿命管理相独立的状态管理流程。

## 数据结构
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE, COMPANY, PLANT_CD)
   ├─ OPER_STATUS        : WAREHOUSE / MOUNTED / REPAIR
   ├─ MOUNTED_EQUIP_ID   : 当前安装设备（MOUNTED 状态时）
   └─ 1:N ─▶ CONSUMABLE_MOUNT_LOGS (PK: MOUNT_DATE, SEQ)
              ├─ ACTION: MOUNT / UNMOUNT
              ├─ EQUIP_CODE
              ├─ WORKER_NO
              └─ REMARK

EQUIP_MASTERS (PK: EQUIP_CODE, COMPANY, PLANT_CD)
   └─ 引用: MOUNTED_EQUIP_ID
```

## ① 主网格 — CONSUMABLE_MASTERS（全部列）

| 画面项目 | DB 列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 消耗品代码 | `CONSUMABLE_CODE` | PK。其他消耗品流程的引用键。 |
| 消耗品名称 | `NAME` | 显示名（实体属性名 `consumableName`）。 |
| 分类 | `CATEGORY` | 通用代码 `CONSUMABLE_CATEGORY`（MOLD/JIG/TOOL）。 |
| 运营状态 | `OPER_STATUS` | `WAREHOUSE`（仓库） / `MOUNTED`（安装） / `REPAIR`（维修）。画面操作按钮显示基准。 |
| 安装设备 | `MOUNTED_EQUIP_ID` | 仅在 `MOUNTED` 时有值。`WAREHOUSE`/`REPAIR` 时为 null。 |
| 寿命状态 | `STATUS` | `NORMAL`/`WARNING`/`REPLACE`。由寿命管理模块更新。 |
| 当前使用次数 | `CURRENT_COUNT` | 通过 kiosk/次数 API 累计。 |
| 预期寿命 | `EXPECTED_LIFE` | `REPLACE` 阈值基准。 |
| 保管位置 | `LOCATION` | 默认保管场所。 |
| 使用与否 | `USE_YN` | 仅 `Y` 显示在列表中。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000` 范围。 |

## ② 安装/拆卸历史 — CONSUMABLE_MOUNT_LOGS（全部列）

| 画面项目 | DB 列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 日期 | `MOUNT_DATE` | PK(1)。安装/拆卸发生的日期。 |
| 序号 | `SEQ` | PK(2)。通过 `SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL` 生成。 |
| 消耗品代码 | `CONSUMABLE_CODE` | FK 性质。引用 `CONSUMABLE_MASTERS`。 |
| 设备代码 | `EQUIP_CODE` | 当时安装/拆卸目标设备。 |
| 动作 | `ACTION` | `MOUNT` 或 `UNMOUNT`。 |
| 作业者 | `WORKER_NO` | API 请求者或 dto.workerId。 |
| 备注 | `REMARK` | 最多 500 字。 |
| CON_UID | `CON_UID` | 用于追踪单个实例（可选）。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000`。 |

## 状态转换逻辑
1. **安装** (`POST /equipment/consumables/:id/mount`)
   - `OPER_STATUS='WAREHOUSE'` 且 `MOUNTED_EQUIP_ID` 必须为 null
   - `OPER_STATUS` → `MOUNTED`, `MOUNTED_EQUIP_ID` → 请求设备
   - 在 `CONSUMABLE_MOUNT_LOGS` 中记录 `MOUNT`
2. **拆卸** (`POST /equipment/consumables/:id/unmount`)
   - 必须是 `OPER_STATUS='MOUNTED'`
   - `OPER_STATUS` → `WAREHOUSE`, `MOUNTED_EQUIP_ID` → null
   - 以前安装设备代码记录 `UNMOUNT`
3. **维修转换** (`POST /equipment/consumables/:id/repair`)
   - 如果处于安装中，先记录 `UNMOUNT`
   - `OPER_STATUS` → `REPAIR`, `MOUNTED_EQUIP_ID` → null
4. **维修完成** (`POST /equipment/consumables/:id/complete-repair`)
   - 必须是 `OPER_STATUS='REPAIR'`
   - `OPER_STATUS` → `WAREHOUSE`
   - 不记录历史（仅恢复状态）

> 因寿命超限（`STATUS='REPLACE'`）而被联锁的设备，建议在本画面中拆卸后再进行更换处理。

## 事前设置（主数据·通用代码）
- 通用代码：`CONSUMABLE_CATEGORY`（MOLD/JIG/TOOL）、`CONSUMABLE_STATUS`（NORMAL/WARNING/REPLACE）、`CONSUMABLE_OPER_STATUS`（WAREHOUSE/MOUNTED/REPAIR）
- `CONSUMABLE_MASTERS` 中必须已注册管理对象消耗品，且 `USE_YN='Y'`
- `EQUIP_MASTERS` 中必须已注册安装目标设备
- Oracle SEQUENCE: `SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL`

## 运营步骤
1. 注册消耗品主数据（[消耗品主数据]）并入库（[消耗品入库]），确保 `OPER_STATUS='WAREHOUSE'`
2. 在本画面中筛选目标消耗品后进行安装/拆卸/维修处理
3. 必要时在 [寿命状态] 中监控更换时点
4. 维修完成后在本画面中通过 `维修完成` 返回仓库

## 权限
生产/设备管理员（安装·拆卸·维修处理）。普通用户仅可查看及确认历史。

## 问题解决（故障排查）
| 症状 | 原因 | 措施 |
|------|------|------|
| 安装时提示"已安装到设备"（409） | `OPER_STATUS='MOUNTED'` | 先拆卸后再重新安装 |
| 拆卸时提示"非安装状态"（400） | `OPER_STATUS` 为 WAREHOUSE/REPAIR | 确认状态 |
| 维修完成时提示"非维修状态"（400） | `OPER_STATUS != 'REPAIR'` | 先执行维修转换 |
| 历史弹窗无记录 | `CONSUMABLE_MOUNT_LOGS` 未生成 | 确认安装/拆卸/维修 API 是否正常调用 |
| 列表中不显示消耗品 | `USE_YN='N'` 或过滤器不匹配 | 确认主数据使用与否及过滤器 |
| 无法选择目标设备 | `EQUIP_MASTERS` 未注册或 `USE_YN='N'` | 激活设备主数据 |

## 数据·联动
- 表：`CONSUMABLE_MASTERS`、`CONSUMABLE_MOUNT_LOGS`、`EQUIP_MASTERS`
- 联动：[消耗品主数据]（`CONSUMABLE_MASTERS`）、[消耗品入库]（`CONSUMABLE_LOGS`）、[寿命状态]（`CURRENT_COUNT`/`EXPECTED_LIFE`）、设备主数据（`EQUIP_MASTERS`）
- 范围：`COMPANY='40'`, `PLANT_CD='1000'`
