---
menuCode: EQUIP_INSPECT_ITEM
audience: operator
title: 设备检查项目 — 操作指南
summary: EQUIP_INSPECT_ITEM_POOL 表的所有列、设备-项目映射流程、QR 标签与故障排除
tags: [equipment, inspection, mapping, operator, assignment, QR]
keywords: [EQUIP_INSPECT_ITEM_POOL, EQUIP_INSPECT_ITEM_MASTERS, EQUIP_MASTERS, equipment inspection item mapping, batch registration, SORT_SEQ, QR label, inspection type tabs]
related: [EQUIP_INSPECT_ITEM_MASTER]
---

# 设备检查项目 — 操作指南

## 系统目的与作用
通过 `EQUIP_INSPECT_ITEM_POOL` 表将各设备（`EQUIP_MASTERS`）与检查项目（`EQUIP_INSPECT_ITEM_MASTERS`）以 N:M 关系连接。即使是相同的检查项目，也可按设备分别连接/断开，并按检查类型标签分类管理。现场粘贴 QR 标签后，通过 PDA 输入检查结果。

## 数据结构
```
EQUIP_MASTERS（各设备）
    │
    └──▶ EQUIP_INSPECT_ITEM_POOL（PK：COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE）
              │
              ├── SORT_SEQ（显示顺序）
              └── USE_YN（连接激活/停用）
                    │
                    └──▶ EQUIP_INSPECT_ITEM_MASTERS（检查项目标准信息）
                              ├── ITEM_NAME, CRITERIA, CYCLE
                              ├── ITEM_TYPE(VISUAL/MEASURE), UNIT, LSL_VALUE, USL_VALUE
                              ├── IMAGE_URL
                              └── INSPECT_TYPE（DAILY/PERIODIC/PM/WORKER）
```

---

## ① 设备-项目映射 — EQUIP_INSPECT_ITEM_POOL（全部列）

| 画面项目 | DB 列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 设备代码 | `EQUIP_CODE` | **PK (1/5)**。各设备。引用 `EQUIP_MASTERS.EQUIP_CODE`。 |
| 项目代码 | `ITEM_CODE` | **PK (2/5)**。检查项目。引用 `EQUIP_INSPECT_ITEM_MASTERS.ITEM_CODE`。 |
| 检查类型 | `INSPECT_TYPE` | **PK (3/5)**。`DAILY` / `PERIODIC` / `PM` / `WORKER`。须与主数据的 INSPECT_TYPE 一致。 |
| 使用与否 | `USE_YN` | `Y`（激活）/ `N`（停用）。保持连接但临时除外时使用。默认为 `Y`。 |
| 显示顺序 | `SORT_SEQ` | 设备内检查项目的显示顺序。数字越小越靠前。 |
| 多租户 | `COMPANY`, `PLANT_CD` | **PK (4,5/5)**。公司代码（`40`）/ 工厂代码（`1000`）。 |
| 创建者 | `CREATED_BY` | 映射注册人。 |
| 修改者 | `UPDATED_BY` | 最后修改人。 |
| 创建时间 | `CREATED_AT` | 映射注册时间。 |
| 修改时间 | `UPDATED_AT` | 映射修改时间。 |

---

## 检查类型标签结构

画面右上角的 4 个标签按各检查类型过滤 `EQUIP_INSPECT_ITEM_POOL`：

| 标签 | INSPECT_TYPE | Pool 过滤条件 |
|-----|-------------|---------------|
| 日常检查 | DAILY | `POOL.INSPECT_TYPE = 'DAILY'` |
| 定期检查 | PERIODIC | `POOL.INSPECT_TYPE = 'PERIODIC'` |
| 预防性维护 | PM | `POOL.INSPECT_TYPE = 'PM'` |
| 作业者检查 | WORKER | `POOL.INSPECT_TYPE = 'WORKER'` |

每次切换标签时，按所选设备 + 检查类型重新调用 API：
`GET /master/equip-inspect-items?equipCode={code}&inspectType={type}`

---

## 项目添加（映射）流程

1. 在 `InspectItemSelectPanel` 抽屉中调用 `GET /master/equip-inspect-item-masters?useYn=Y&inspectType={type}`
2. 以复选框形式显示主数据列表（已映射的项目禁用并显示"已注册"）
3. 依次对所选项目调用 `POST /master/equip-inspect-items`
4. 每个 POST 的 body：`{ equipCode, itemCode, inspectType }`

---

## QR 标签生成

在 `InspectItemLabelModal` 中使用 `react-qr-code` 将 `itemCode` 编码为 QR 码并打印标签：
- 标签尺寸：60mm × 55mm（打印 CSS）
- 组成：标题（"设备检查项目"）+ QR 码（128px）+ 项目代码 + 项目名称 + 检查类型 + 周期 + 标准
- 调用 `window.print()` 打开打印对话框

---

## 权限
具有设备检查项目管理权限的用户（设备/质量管理员）。一般用户只能查看。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 左侧设备列表不显示 | 设备主数据中无数据 | 注册设备后重新查询 |
| 特定检查类型标签中无项目 | 该类型下无映射项目 | 在相应类型标签中添加项目 |
| 添加抽屉中项目不显示 | 主数据中 `USE_YN='N'` 或 INSPECT_TYPE 不匹配 | 检查主数据中的使用状态和检查类型 |
| 显示"已注册" | 相同的设备+项目+类型组合已存在于 Pool 中 | 不允许重复映射 |
| QR 标签无法打印 | 浏览器弹窗被阻止 | 允许弹窗后重试 |
| QR 标签尺寸不符 | 打印设置与标签尺寸不一致 | 在打印设置中调整纸张大小和边距 |

## 数据与关联
- **表**：`EQUIP_INSPECT_ITEM_POOL`（映射）、`EQUIP_INSPECT_ITEM_MASTERS`（项目标准信息）、`EQUIP_MASTERS`（设备）
- **关联**：设备检查（Equip Inspect）结果输入界面、QR 标签生成
- **范围**：`COMPANY='40'`、`PLANT_CD='1000'`
