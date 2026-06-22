---
menuCode: CONS_MASTER
audience: operator
title: 耗材主表 — 操作指南
summary: 耗材主表(CONSUMABLE_MASTERS)全部列的DB映射, 使用处映射(CONSUMABLE_USAGE_MAP)关系, 寿命/状态逻辑, 公共代码, 权限, 故障排除, 多租户范围
tags: [耗材, 主表, 标准信息, 操作]
keywords: [CONSUMABLE_MASTERS, CONSUMABLE_USAGE_MAP, CONSUMABLE_STOCKS, CONSUMABLE_LOGS, CONSUMABLE_CATEGORY, MOLD, JIG, TOOL, 预期寿命, 警告阈值, 安全库存, 单位用量, USAGE_PER_UNIT, 使用处映射, 设备部件, 产品BOM, 多租户, COMPANY, PLANT_CD]
related: [MST_PART]
---

# 耗材主表 — 操作指南

## 系统目的·角色
管理投入生产的**耗材(模具·夹具·工具)的标准信息主表 `CONSUMABLE_MASTERS`** 的界面。耗材的单个库存实例(`CONSUMABLE_STOCKS`)，出入库记录(`CONSUMABLE_LOGS`)，产品·设备使用处映射(`CONSUMABLE_USAGE_MAP`)，以及Kiosk生产实绩中的耗材投入，均通过 `CONSUMABLE_CODE` 引用此主表。

> API参考: 列表 `GET /consumables`，单条 `GET /consumables/:id`，注册 `POST /consumables`，修改 `PUT /consumables/:id`，删除 `DELETE /consumables/:id`，图片 `POST|DELETE /consumables/:id/image`，使用映射 `GET|POST /consumables/:id/usage-maps`·`PUT|DELETE /consumables/:id/usage-maps/:productItemCode/:equipCode`。(界面表格中的 `SELECT ... FROM CONSUMABLES` 仅是显示标签，实际表名为 `CONSUMABLE_MASTERS`。)

## 数据结构
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)
   ├─ 1:N ─▶ CONSUMABLE_STOCKS   (单个实例 CON_UID, 跟踪入库·安装状态)
   ├─ 1:N ─▶ CONSUMABLE_LOGS     (出入库/次数/更换记录)
   └─ 1:N ─▶ CONSUMABLE_USAGE_MAP(产品型号 × 设备 × 耗材使用处)
                ├─ PRODUCT_ITEM_CODE ─▶ ITEM_MASTERS.ITEM_CODE (产品/型号)
                └─ EQUIP_CODE        ─▶ EQUIP_MASTERS.EQUIP_CODE (设备)
```

## 耗材的2种分类（操作含义）
主表只有一个，但使用路径分为两种。
- **设备安装用**(模具·夹具·刀片): 安装在设备上累积次数(`CURRENT_COUNT`)，达到 `EXPECTED_LIFE` 时更换。在Kiosk左下角"消耗性设备部件"部分显示。遵循 `CONSUMABLE_USAGE_MAP` 的设备×耗材映射。
- **产品BOM投入用**: 作为产品BOM的 `CONSUMABLE` 项投入，按生产数量扣减。在Kiosk左侧根据产品BOM显示。

---

## ① 基本信息 — CONSUMABLE_MASTERS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 耗材代码 | `CONSUMABLE_CODE` | PK(自然键)。连接出入库·库存·使用映射的键。不可更改(修改模式锁定)。 |
| 耗材名称 | `NAME` | 显示名称(实体属性名为 `consumableName`)。 |
| 分类 | `CATEGORY` | 公共代码 `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL)。DTO枚举为 `['MOLD','JIG','TOOL']`。未选择时存null。 |
| 图片 | `IMAGE_URL` | 上传路径(`/uploads/consumables/...`)。仅在主表保存后可上传(`POST /consumables/:id/image`)。 |

## ② 寿命 / 管理 — CONSUMABLE_MASTERS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 预期寿命 | `EXPECTED_LIFE` | 累计次数上限(INT)。`CURRENT_COUNT ≥ EXPECTED_LIFE` → `STATUS='REPLACE'`。null则无自动状态迁移。 |
| 警告阈值 | `WARNING_COUNT` | 即将更换提醒次数(INT)。`CURRENT_COUNT ≥ WARNING_COUNT` → `STATUS='WARNING'`。通常 `< EXPECTED_LIFE`。 |
| 安全库存 | `SAFETY_STOCK` | 库存不足判断标准(INT, default 0)。低于持有库存时显示不足。 |
| (自动) 当前次数 | `CURRENT_COUNT` | 累计使用次数(INT, default 0)。通过Kiosk/次数API(`POST /consumables/shot-count`)累计，更换(`/consumables/reset`)时归零。表单无直接输入栏。 |
| (自动) 状态 | `STATUS` | NORMAL/WARNING/REPLACE。次数累计时自动迁移。 |
| (自动) 运行状态 | `OPER_STATUS` | WAREHOUSE(仓库)/MOUNTED(安装)等。在安装流程中更新。 |
| (自动) 安装设备 | `MOUNTED_EQUIP_ID` | 当前安装的设备代码(属性名 `mountedEquipCode`)。 |
| (自动) 库存数量 | `STOCK_QTY` | 通过出入库记录加减的持有数量(INT, default 0)。 |
| (自动) 更换日期 | `LAST_REPLACE`, `NEXT_REPLACE` | 最近/预计更换时间(TIMESTAMP)。 |

## ③ 客户 / 位置 — CONSUMABLE_MASTERS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 存放位置 | `LOCATION` | 默认存放地点。 |
| 客户 | `VENDOR` | 供应客户/制造商。 |
| 单价 | `UNIT_PRICE` | NUMBER(12,2)。入库单价·资产评估参考。 |
| 使用与否 | `USE_YN` | 仅 `Y` 在列表/选择中显示(列表查询时固定 `useYn='Y'`)。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000` 范围(实体属性名 `company`, `plant`)。 |

## ④ 使用处映射 — CONSUMABLE_USAGE_MAP (全部列)

定义所选耗材在**哪个产品(型号)·设备**中使用。Kiosk根据工单(产品)+设备查询所需耗材的依据。

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 产品/型号 | `PRODUCT_ITEM_CODE` | PK组成。引用 `ITEM_MASTERS.ITEM_CODE`。选项仅限 `FINISHED`/`SEMI_PRODUCT` 物料。注册时验证存在·`USE_YN='Y'`。 |
| 设备 | `EQUIP_CODE` | PK组成。引用 `EQUIP_MASTERS.EQUIP_CODE`。注册时验证存在·`USE_YN='Y'`。 |
| (键) 耗材 | `CONSUMABLE_CODE` | PK组成。所选主表。 |
| 单位用量 | `USAGE_PER_UNIT` | NUMBER(default 1)。单位生产消耗次数。生产数量 × 此值 = 次数累计。 |
| 使用与否 | `USE_YN` | `Y`/`N`。列表通过 `Y` 徽标切换。 |
| 备注 | `REMARK` | 映射备注。 |
| (键) 多租户 | `COMPANY`, `PLANT_CD` | PK组成。`40` / `1000`。 |

> 复合PK: `COMPANY + PLANT_CD + PRODUCT_ITEM_CODE + EQUIP_CODE + CONSUMABLE_CODE`。同一组合重新注册为upsert(更新数量·使用与否·备注)。

## 寿命 / 状态逻辑
1. 次数累计(`POST /consumables/shot-count`, `addCount`): `CURRENT_COUNT += addCount`。
2. 存在 `EXPECTED_LIFE` 且 `CURRENT_COUNT ≥ EXPECTED_LIFE` → `STATUS='REPLACE'`。
3. 否则存在 `WARNING_COUNT` 且 `CURRENT_COUNT ≥ WARNING_COUNT` → `STATUS='WARNING'`。
4. 更换(`POST /consumables/reset`): `CURRENT_COUNT=0`, `STATUS='NORMAL'`, `LAST_REPLACE`=当前时间, `NEXT_REPLACE`=当前时间+`EXPECTED_LIFE`天。
5. 出入库(`POST /consumables/logs`·`receiving`·`issuing`): `STOCK_QTY` 加减(出库时阻止负库存)。

## 预设条件（主表·公共代码）
- 公共代码: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL)
- 使用处映射前置: 产品/型号需在[物料主表](`ITEM_MASTERS`, `FINISHED`/`SEMI_PRODUCT`)，设备需在设备主表(`EQUIP_MASTERS`)中注册为 `USE_YN='Y'` 才可选择。

## 操作流程
1. 注册 `CONSUMABLE_MASTERS`(代码·名称·分类) → 保存。
2. 上传图片(保存后) → 填写寿命/管理·客户/位置。
3. 注册使用处映射(`CONSUMABLE_USAGE_MAP`)中的产品·设备·单位用量。
4. 入库·次数累计·更换通过出入库/Kiosk/次数API自动反映。

## 权限
标准信息管理员(注册/修改/删除/映射)。普通用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 注册时图片上传按钮禁用 | 主表未保存(新建模式) | 保存基本信息后重新打开上传 |
| 保存时代码重复错误(409) | 同一 `CONSUMABLE_CODE` 已存在 | 确认代码(不可变键)或修改现有记录 |
| 使用映射保存时"产品/设备不存在"(404) | 物料/设备未注册或 `USE_YN='N'` | 在物料主表·设备主表中激活后映射 |
| 使用映射产品列表为空 | 物料类型不是 `FINISHED`/`SEMI_PRODUCT` | 以该类型注册物料 |
| 列表不显示 | `USE_YN='N'` 或分类/搜索过滤 | 确认使用与否·过滤器·搜索词 |
| 出库时库存不足错误(400) | `STOCK_QTY` 不足 | 入库后重试 |
| 累计次数但状态不变 | `EXPECTED_LIFE`/`WARNING_COUNT` 未设置(null) | 输入预期寿命·警告阈值 |
| 缩略图/图片损坏 | `IMAGE_URL` 文件不存在(404) | 重新上传(前端占位图回退) |

## 数据·关联
- 表: `CONSUMABLE_MASTERS`(主表), `CONSUMABLE_STOCKS`(单个实例), `CONSUMABLE_LOGS`(出入库/次数/更换记录), `CONSUMABLE_USAGE_MAP`(使用处映射)
- 关联: 物料主表(`ITEM_MASTERS`), 设备主表(`EQUIP_MASTERS`), Kiosk生产实绩(耗材投入), 材料综合流程(耗材入货LOT → `MAT_STOCKS` 加载·auto-issue扣减)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
