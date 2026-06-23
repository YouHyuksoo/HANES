---
menuCode: EQUIP_INSPECT_ITEM
audience: operator
title: 设备检查项目 — 操作指南
summary: 2个表的全列DB映射(检查项目池+设备-项目分配), 4种检查类型(日常/定期/PM/作业者), 项目添加/删除流程, QR标签打印
tags: [标准信息, 设备, 检查, 操作]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, EQUIP_INSPECT_ITEM_POOL, EQUIP_CODE, ITEM_CODE, INSPECT_TYPE, DAILY, PERIODIC, PM, WORKER, ITEM_TYPE, VISUAL, MEASURE, CYCLE, 设备检查, 检查项目, 检查类型, 设备类型, 判定型, 测量型, QR标签, 多租户]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_DAILY]
---

# 设备检查项目 — 操作指南

## 系统目的·角色
管理定义设备检查标准的**2个表**。

| 表 | 角色 | PK |
|--------|------|----|
| `EQUIP_INSPECT_ITEM_MASTERS` | 检查项目池 — 按设备类型的检查项目模板 | `COMPANY + PLANT_CD + ITEM_CODE` |
| `EQUIP_INSPECT_ITEM_POOL` | 设备-项目分配 — 实际分配给特定设备的项目 | `COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE` |

左侧选择设备 → 右侧按4个检查类型选项卡查看·添加·删除分配的项目。已注册项目用于日常检查(`/equipment/daily-inspect`)·定期检查(`/equipment/periodic-inspect`)的实际检查录入。

## 数据结构
```
EQUIP_INSPECT_ITEM_MASTERS (池: PK = COMPANY + PLANT_CD + ITEM_CODE)
   按设备类型保存检查项目模板 (按EQUIP_TYPE筛选)

EQUIP_INSPECT_ITEM_POOL (分配: PK = COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE)
   ├─ EQUIP_CODE ─▶ EQUIPMENTS (设备)
   └─ ITEM_CODE ─▶ EQUIP_INSPECT_ITEM_MASTERS (检查项目主表)

EQUIP_INSPECT_LOGS (检查记录 — 参照)
   执行检查时通EQUIP_CODE + ITEM_CODE + INSPECT_TYPE关联Pool
```

## 界面布局
- **左侧面板**: 设备列表 (按设备类型分组手风琴, 搜索筛选, `GET /equipment/equips`)
- **右侧面板**: 4个检查类型选项卡 + DataGrid显示已分配项目
  - `DAILY`(日常检查) / `PERIODIC`(定期检查) / `PM`(预防保全) / `WORKER`(作业者检查)
- **侧滑面板**: `添加检查项目`按钮 → 右侧480px面板打开 → 从主表多选 → 批量注册

### 检查类型 (INSPECT_TYPE) 代码值

| 代码 | 界面显示 | 说明 |
|------|---------|------|
| `DAILY` | 设备日常检查 | 每天实施的基本检查 |
| `PERIODIC` | 定期检查 | 按周期实施的检查 |
| `PM` | 预防保全 | 按设备预防保全计划的检查 |
| `WORKER` | 作业者设备检查 | 作业者自行实施的检查 |

### 周期 (CYCLE) 代码值

| 代码 | 显示 | 含义 |
|------|------|------|
| `DAILY` | 每天 | 1天周期 |
| `WEEKLY` | 每周 | 1周周期 |
| `MONTHLY` | 每月 | 1月周期 |
| `QUARTERLY` | 季度 | 3个月周期 |
| `SEMI_ANNUAL` | 半年 | 6个月周期 |
| `ANNUAL` | 每年 | 1年周期 |

### 判定类型 (ITEM_TYPE) 代码值

| 代码 | 显示 | 说明 |
|------|------|------|
| `VISUAL` | 判定型 | 目视合格/不合格判定 (基准字符串比较) |
| `MEASURE` | 测量型 | 测量值记录 (LSL/USL范围判定) |

---

## ① 检查项目主表 — EQUIP_INSPECT_ITEM_MASTERS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 项目代码 | `ITEM_CODE` | PK。直接输入，注册后不可变。 |
| 项目名称 | `ITEM_NAME` | 显示名称。检查界面直接显示。 |
| 检查类型 | `INSPECT_TYPE` | `DAILY`/`PERIODIC`/`PM`/`WORKER`。注意：注册后变更需要同时变更Pool的PK。 |
| 设备类型 | `EQUIP_TYPE` | 公共代码`EQUIP_TYPE`。用于项目选择面板中的设备类型筛选。 |
| 判定类型 | `ITEM_TYPE` | `VISUAL`(判定型) / `MEASURE`(测量型)。默认`VISUAL`。 |
| 判定基准 | `CRITERIA` | VISUAL判定基准字符串(例："无异常"，"无裂纹")。测量型用LSL/USL判定。 |
| 周期 | `CYCLE` | `DAILY`/`WEEKLY`/`MONTHLY`/`QUARTERLY`/`SEMI_ANNUAL`/`ANNUAL`。 |
| 单位 | `UNIT` | 测量单位(mm, kgf, ℃等)。测量型中与LSL/USL配合使用。 |
| 下限值 | `LSL_VALUE` | 测量允许下限值。测量型中与USL一起用于范围判定。 |
| 上限值 | `USL_VALUE` | 测量允许上限值。测量型中与LSL一起用于范围判定。 |
| 作业者二维码 | `WORKER_QR_CODE` | 作业者检查(WORKER)中二维码扫描匹配的代码值。 |
| 图片 | `IMAGE_URL` | 检查项目图片。上传至`/uploads/equip-inspect-items/`。5MB限制，jpeg/png/gif/webp。 |
| 使用与否 | `USE_YN` | 仅`Y`在Pool选择列表中显示。 |
| 备注 | `REMARK` | 备忘录。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK的一部分。`40` / `1000`范围。 |

## ② 设备-检查项目分配 — EQUIP_INSPECT_ITEM_POOL (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 设备代码 | `EQUIP_CODE` | PK。参照`EQUIPMENTS.EQUIP_CODE`。从左侧设备列表选择。 |
| 项目代码 | `ITEM_CODE` | PK。参照`EQUIP_INSPECT_ITEM_MASTERS.ITEM_CODE`。 |
| 检查类型 | `INSPECT_TYPE` | PK。`DAILY`/`PERIODIC`/`PM`/`WORKER`。按选项卡分类。 |
| 显示顺序 | `SORT_SEQ` | 排序顺序(ASC)。数字越小越先显示。 |
| 使用与否 | `USE_YN` | 仅`Y`在检查界面中激活。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK的一部分。`40` / `1000`范围。 |

> Pool使用5重复合PK(COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE)。重复注册返回409 Conflict。同一设备的相同项目可以不同检查类型分别注册(例：DAILY + PERIODIC同时注册)。

## 检查项目注册流程

1. **注册主表**(前提): 在检查项目池中注册项目代码·名称·类型·基准 (`POST /master/equip-inspect-item-masters`)
2. **选择设备**: 在左侧设备列表中点击目标设备 (按设备类型分组，可搜索)
3. **切换选项卡**: 选择目标检查类型选项卡(DAILY/PERIODIC/PM/WORKER)
4. **添加项目**: 点击`添加检查项目`按钮 → 在右侧面板多选 → `批量注册`
5. **调整顺序**: 通过`SORT_SEQ`值控制显示顺序 (修改时在DTO中传递sortSeq)
6. **打印QR标签**: 可打印检查项目的QR代码标签 (`InspectItemLabelModal` — 60mm x 55mm)

> 已注册的项目在添加面板中显示`已注册`徽章并禁用，防止重复选择。

## 预设条件 (主表·公共代码)
- 公共代码: `EQUITY_TYPE`(设备类型)
- 设备主表(`EQUIPMENTS`): 左侧设备列表的数据来源。设备需先注册才能在界面上显示。
- 检查项目主表(`EQUIP_INSPECT_ITEM_MASTERS`): Pool分配前需先注册。

## 操作流程
1. 在检查项目主表中注册检查项目(项目代码·名称·类型·基准)。
2. 在设备检查项目画面中选择设备，按类型选项卡将所需项目添加到Pool。
3. 设备运营中检查项目有变更时，通过添加/删除反映到Pool。
4. 已停用的检查项目可从Pool删除或设置`USE_YN='N'`(建议非激活以保留记录)。

## 权限
标准信息管理员(主表注册/修改/删除，Pool分配/解除)。一般用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 左侧设备列表为空 | `EQUIPMENTS`中未注册设备 | 先在设备主表中注册设备 |
| 添加面板中无项目 | 主表中未注册该检查类型的项目 | 在主表画面(`/master/equip-inspect-item`)中注册项目 |
| 设备类型下拉框无值 | 公共代码`EQUIP_TYPE`未设置 | 在公共代码中注册设备类型代码 |
| Pool保存时409错误 | 已存在相同(设备+项目+类型)组合 | 以不同类型注册或激活现有项目 |
| 检查画面中项目不显示 | Pool的`USE_YN='N'`或检查类型不匹配 | 确认Pool使用与否·检查类型 |
| 图片上传失败 | 文件超过5MB或格式不符(仅jpeg/png/gif/webp) | 确认文件大小·格式 |
| `SORT_SEQ`未反映 | 注册时未传递`sortSeq` | 在注册DTO中包含sortSeq或另行修改 |

## 数据·关联
- 表: `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_INSPECT_LOGS`
- 关联: 设备主表(`EQUIPMENTS`), 日常检查(`/equipment/daily-inspect`), 定期检查(`/equipment/periodic-inspect`), 检查日历(`/equipment/inspect-calendar`), 检查记录(`/equipment/inspect-history`)
- 相关API: `GET /master/equip-inspect-items`, `POST /master/equip-inspect-items`, `DELETE /master/equip-inspect-items/:equipCode/:itemCode/:inspectType`
- 相关API (主表): `GET /master/equip-inspect-item-masters`, `POST /master/equip-inspect-item-masters`, `PUT /master/equip-inspect-item-masters/:itemCode`, `DELETE /master/equip-inspect-item-masters/:itemCode`
- 图片存储: `./uploads/equip-inspect-items/` (5MB, jpeg/png/gif/webp)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
