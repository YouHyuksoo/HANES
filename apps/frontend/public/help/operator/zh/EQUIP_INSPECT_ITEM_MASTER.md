---
menuCode: EQUIP_INSPECT_ITEM_MASTER
audience: operator
title: 检查项目主数据 — 运维指南
summary: EQUIP_INSPECT_ITEM_MASTERS 表完整列、检查项目属性、图片上传结构与故障排除
tags: [설비, 점검, 항목, 마스터, 운영, 기준정보]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, ITEM_CODE, INSPECT_TYPE, ITEM_TYPE, VISUAL, MEASURE, LSL_VALUE, USL_VALUE, CYCLE, IMAGE_URL, WORKER_QR_CODE, 설비점검, EQUIP_TYPE, COM_CODES]
related: [EQUIP_INSPECT_ITEM]
---

# 检查项目主数据 — 运维指南

## 系统目的·作用
将所有用于设备检查的检查项目标准信息存储在 `EQUIP_INSPECT_ITEM_MASTERS` 表中进行管理。每个检查项目具有检查类型（DAILY/PERIODIC/PM/WORKER）、判定区分（VISUAL/MEASURE）、周期、判定标准（LSL/USL）等属性，在[按设备检查项目]画面中通过 `EQUIP_INSPECT_ITEM_POOL` 与单个设备建立 N:M 关系。

## 数据结构
```
EQUIP_INSPECT_ITEM_MASTERS (PK: COMPANY + PLANT_CD + ITEM_CODE)
    │
    ├── 检查类型(INSPECT_TYPE): DAILY / PERIODIC / PM / WORKER
    ├── 判定区分(ITEM_TYPE): VISUAL(判定型) / MEASURE(测量型)
    ├── 周期(CYCLE): DAILY / WEEKLY / MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL
    ├── 判定标准: CRITERIA(文本) 或 LSL_VALUE + USL_VALUE + UNIT
    │
    └──▶ EQUIP_INSPECT_ITEM_POOL (N:M 映射)
            └── EQUIP_MASTERS (单个设备)
```

---

## ① 检查项目主数据 — EQUIP_INSPECT_ITEM_MASTERS（全部列）

| 画面项目 | DB列 | 作用 / 说明 · 运维要点 |
|------|------|------|
| 项目代码 | `ITEM_CODE` | **PK (3/3)**。检查项目标识符。注册后不可变更（保持映射关系）。建议命名规则：`EI-{设备类型}-{NNN}`。 |
| 检查项目名称 | `ITEM_NAME` | 检查项目的显示名称。`varchar2(200)`。 |
| 检查类型 | `INSPECT_TYPE` | `DAILY`(日常检查) / `PERIODIC`(定期检查) / `PM`(预防性维护) / `WORKER`(作业人员检查)。设备映射时仅同类型可连接。 |
| 设备类型 | `EQUIP_TYPE` | 引用公共代码 `EQUIP_TYPE` 值。指定该项目适用的设备类型范围。 |
| 判定区分 | `ITEM_TYPE` | `VISUAL`(判定型) = OK/NG 定性判断 / `MEASURE`(测量型) = 测量数值后按 LSL~USL 范围判定。默认值 `VISUAL`。 |
| 判定标准 | `CRITERIA` | VISUAL型：OK/NG判定指引文本。 / MEASURE型：辅助说明（数值标准使用 LSL/USL）。 |
| 周期 | `CYCLE` | 检查执行周期。`DAILY` / `WEEKLY` / `MONTHLY` / `QUARTERLY` / `SEMI_ANNUAL` / `ANNUAL`。 |
| 单位 | `UNIT` | 测量型（MEASURE）时测量值的单位。公共代码或自由输入。 |
| 下限值 | `LSL_VALUE` | 测量型的允许下限值（Lower Spec Limit）。 |
| 上限值 | `USL_VALUE` | 测量型的允许上限值（Upper Spec Limit）。 |
| 作业人员QR码 | `WORKER_QR_CODE` | 用于作业人员检查（WORKER）的QR码值。 |
| 图片URL | `IMAGE_URL` | 检查参考图片的服务器路径或URL。`varchar2(500)`。 |
| 使用与否 | `USE_YN` | `Y`(启用) / `N`(停用)。为 `N` 时设备映射无法选择。默认 `Y`。 |
| 备注 | `REMARK` | 管理备注。`varchar2(500)`。 |
| 多租户 | `COMPANY`, `PLANT_CD` | **PK (1,2/3)**。公司代码(`40`) / 工厂代码(`1000`) 范围。 |
| 创建人 | `CREATED_BY` | 初始注册人。 |
| 修改人 | `UPDATED_BY` | 最后修改人。 |
| 创建时间 | `CREATED_AT` | 记录创建时间。 |
| 修改时间 | `UPDATED_AT` | 记录修改时间。 |

---

## 图片上传结构

| 项目 | 详情 |
|------|------|
| 上传API | `POST /master/equip-inspect-item-masters/{itemCode}/image` (multipart) |
| 删除API | `DELETE /master/equip-inspect-item-masters/{itemCode}/image` |
| 允许格式 | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| 最大大小 | 5MB |
| 存储位置 | 服务器 `./uploads/equip-inspect-items/` 目录 |

---

## 检查类型详情

| 类型 | 代码 | 说明 | 周期示例 |
|------|------|------|---------|
| 日常检查 | DAILY | 每天开始工作前的基本状态确认 | DAILY |
| 定期检查 | PERIODIC | 按月/季度/半年/年为单位的定期检查 | MONTHLY ~ ANNUAL |
| 预防性维护 | PM | 设备预防性维护（Prescriptive Maintenance）时检查 | MONTHLY ~ ANNUAL |
| 作业人员检查 | WORKER | 作业人员自行进行的检查（可基于QR码） | DAILY ~ MONTHLY |

## 判定标准输入方式

| 判定区分 | 输入字段 | 存储 |
|---------|----------|------|
| VISUAL(判定型) | criteria 文本输入 | 存储在 `CRITERIA` 列 |
| MEASURE(测量型) | 单位(UNIT) + 下限(LSL) + 上限(USL) | 存储在 `UNIT`、`LSL_VALUE`、`USL_VALUE`，`CRITERIA` 为辅助说明 |

## 权限
拥有主数据管理权限的用户（设备/质量管理人）。一般用户仅可查看。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 项目代码重复错误 | 存在相同的PK（COMPANY+PLANT_CD+ITEM_CODE） | 使用其他代码注册 |
| 图片上传失败 | 超过5MB或格式不支持 | 确认文件大小和格式 |
| 测量型但标准值不显示 | 未输入LSL/USL | 测量型必须输入上下限 |
| 设备映射时项目不显示 | 项目的 `USE_YN='N'` 或 EQUIP_TYPE 不匹配 | 确认使用状态和设备类型 |
| 作业人员检查QR码无法使用 | WORKER_QR_CODE 未设置 | 输入QR码值后重新发行QR标签 |

## 数据·关联
- **表**：`EQUIP_INSPECT_ITEM_MASTERS`（标准信息）、`EQUIP_INSPECT_ITEM_POOL`（设备-项目映射）、`EQUIP_INSPECT_LOGS`（检查结果）
- **关联**：设备主数据（`EQUIP_MASTERS`）、公共代码（`COM_CODES.EQUIP_TYPE`）
- **范围**：`COMPANY='40'`、`PLANT_CD='1000'`
