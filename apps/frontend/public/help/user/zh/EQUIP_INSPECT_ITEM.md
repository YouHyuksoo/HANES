---
menuCode: EQUIP_INSPECT_ITEM
audience: user
title: 设备检查项目
summary: 通过将检查项目连接（映射）到各设备来管理每台设备的检查项目并生成QR标签的界面
tags: [equipment, inspection, mapping, items, assignment, QR]
keywords: [EQUIP_INSPECT_ITEM_POOL, equipment inspection items, inspection item mapping, per-equipment inspection, batch registration, QR label, DAILY, PERIODIC, PM, WORKER]
related: [EQUIP_INSPECT_ITEM_MASTER]
---

# 设备检查项目

## 界面目的
将[检查项目主数据]中注册的检查项目连接（映射）到各设备，以配置每台设备要执行的检查项目。按检查类型（日常/定期/PM/作业者）分页管理，并可生成QR标签供现场使用。

## 界面构成
- **左侧 — 设备列表**：按设备类型分组显示全部设备。可通过搜索筛选查找所需设备。
- **右侧 — 检查项目面板**：按检查类型标签（DAILY/PERIODIC/PM/WORKER）显示所选设备的检查项目列表。
- **抽屉 — 添加检查项目**：通过右上角按钮打开的面板，从检查项目主数据中选择项目并批量注册。
- **模态框 — 生成QR标签**：打印各检查项目的QR码标签。

---

## ① 检查项目列表列

| 列 | 作用 / 含义 |
|------|------|
| **图片 (imageUrl)** | 检查项目的参考图片。 |
| **项目代码 (itemCode)** | 检查项目主数据的项目代码。 |
| **项目名称 (itemName)** | 检查项目的名称。 |
| **判定标准 (criteria)** | OK/NG判定标准或测量范围。 |
| **周期 (cycle)** | 检查执行周期（DAILY/WEEKLY/MONTHLY等）。 |
| **排序 (sortSeq)** | 设备内检查项目的显示顺序。 |
| **使用 (useYn)** | `Y`（绿色）= 激活，`N`（红色）= 停用。 |

## 使用顺序
1. 在左侧设备列表中选择所需设备。
2. 在右上角标签中选择检查类型（DAILY/PERIODIC/PM/WORKER）。
3. 点击**添加检查项目**按钮打开抽屉面板。
4. 勾选要添加的项目，点击**批量注册**按钮将其连接到设备。
5. 已注册的项目可在列表中确认，必要时可删除。
6. 使用**生成QR标签**按钮打印各项目的QR码标签并粘贴到现场。

## 检查类型标签
| 标签 | 说明 |
|------|------|
| **DAILY** | 每天作业前执行的日常检查项目 |
| **PERIODIC** | 按月/季度/半年/年为单位的定期检查项目 |
| **PM** | 预防性维护（Preventive Maintenance）相关检查项目 |
| **WORKER** | 由作业者自行执行的检查项目 |

## 相关界面
- [检查项目主数据](/master/equip-inspect-item) — 注册和修改检查项目的标准信息界面
