---
menuCode: MST_WAREHOUSE
audience: operator
title: 仓库/位置管理 — 操作指南
summary: 仓库·位置·移动规则3个表的全部列DB映射, 仓库类型代码值, 自动创建仓库, 权限, 故障排除, 多租户范围
tags: [标准信息, 仓库, 位置, 移动规则, 操作]
keywords: [WAREHOUSES, WAREHOUSE_LOCATIONS, WAREHOUSE_TRANSFER_RULES, WAREHOUSE_TYPE, WAREHOUSE_GROUP, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID, ALLOW_YN, IS_DEFAULT, 仓库类型, FLOOR, SUBCON, 自然键, 复合键, 多租户, COMPANY, PLANT_CD]
related: [MST_PART]
---

# 仓库/位置管理 — 操作指南

## 系统目的·角色
管理库存保管·移动的物理/逻辑单位——**仓库**及其内部的**位置**，以及仓库间的**移动规则**的主表界面。入库·发放·库存(`MAT_STOCK`/`PRODUCT_STOCKS`)·生产实绩·库存移动均通过`WAREHOUSE_CODE`引用此主表。

## 数据结构
```
WAREHOUSES (PK: COMPANY, PLANT_CD, WAREHOUSE_CODE)
   ├─ WAREHOUSE_LOCATIONS (PK: COMPANY, PLANT_CD, WAREHOUSE_CODE, LOCATION_CODE)
   │       仓库 1 : N 位置 (通过WAREHOUSE_CODE连接)
   └─ WAREHOUSE_TRANSFER_RULES (PK: COMPANY, PLANT_CD, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID)
            FROM/TO_WAREHOUSE_ID值 = WAREHOUSES.WAREHOUSE_CODE (存储代码，列名仅为_ID)
```
> **注意**: `WAREHOUSE_TRANSFER_RULES`的`FROM_WAREHOUSE_ID`/`TO_WAREHOUSE_ID`名称虽为`_ID`，实际存储值为**仓库代码(WAREHOUSE_CODE)**。服务通过`fw.WAREHOUSE_CODE = rule.FROM_WAREHOUSE_ID` JOIN获取出发/到达仓库名。不是外键约束(FK)列，而是自然键JOIN。

各区域的CRUD API:
- 仓库: `GET/POST/PUT/DELETE /inventory/warehouses[/{code}]`
- 位置: `GET/POST/PUT/DELETE /inventory/warehouse-locations[/{warehouseCode}::{locationCode}]`
- 移动规则: `GET/POST/PUT/DELETE /master/transfer-rules[/{fromId}/{toId}]`

---

## ① 仓库管理 — WAREHOUSES (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 仓库代码 | `WAREHOUSE_CODE` | PK组成。自然键，不可变(连接完整性)。 |
| 仓库名称 | `WAREHOUSE_NAME` | 显示名称。 |
| 仓库类型 | `WAREHOUSE_TYPE` | 用途分类。DTO `@IsIn`验证值: `RAW`(原材料)/`WIP`(半成品)/`FG`(成品)/`FLOOR`(工序在制)/`DEFECT`(不良)/`SCRAP`(废弃)/`SUBCON`(外协)。公共代码`WAREHOUSE_TYPE`。 |
| (界面不显示) 仓库组 | `WAREHOUSE_GROUP` | 设计为同组内移动即时、不同组移动需经理批准的列。当前界面无输入UI(nullable)。 |
| 生产线 | `LINE_CODE` | FLOOR仓库所属生产时。仅类型为FLOOR时在表单中显示。 |
| 工序 | `PROCESS_CODE` | FLOOR仓库所属工序。仅类型为FLOOR时在表单中显示。 |
| (界面不显示) 工厂代码 | `PLANT_CODE` | 辅助plant代码列(与多租户`PLANT_CD`不同，nullable)。 |
| (界面不显示) 设备代码 | `EQUIP_CODE` | 设备关联WIP仓库用列(nullable)。 |
| (界面不显示) 客户ID | `VENDOR_ID` | 外协(SUBCON)仓库自动创建时填入客户标识值(nullable)。 |
| 默认 | `IS_DEFAULT` | `'Y'`/`'N'`。同类型默认仓库。`getDefaultWarehouse(type)`通过`IS_DEFAULT='Y' AND USE_YN='Y'`选择自动放置对象。 |
| 使用 | `USE_YN` | 仅`'Y'`为激活。删除建议软禁用操作。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。CREATED_AT/UPDATED_AT为DEFAULT SYSTIMESTAMP。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK部分。`40` / `1000` 范围。 |

## ② 位置 — WAREHOUSE_LOCATIONS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 仓库 | `WAREHOUSE_CODE` | PK组成 + 上级仓库引用。登记后不可变。 |
| 位置代码 | `LOCATION_CODE` | PK组成。(仓库+位置)组合唯一。不可变。 |
| 位置名称 | `LOCATION_NAME` | 显示名称。 |
| 区域 | `ZONE` | 仓库内区域区分(nullable)。 |
| 行 | `ROW_NO` | 货架/架行号(nullable, varchar)。 |
| 列 | `COL_NO` | 货架/架列号(nullable, varchar)。 |
| 层 | `LEVEL_NO` | 货架/架层号(nullable, varchar)。 |
| 使用 | `USE_YN` | 仅`'Y'`为激活。列表中用●点显示。 |
| 备注 | `REMARK` | 备注(nullable)。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK部分。`40` / `1000` 范围。 |

> 修改/删除API通过`{WAREHOUSE_CODE}::{LOCATION_CODE}`形式(`::`分隔符)传递复合键。

## ③ 仓库移动规则 — WAREHOUSE_TRANSFER_RULES (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 出发仓库(代码/名称) | `FROM_WAREHOUSE_ID` | PK组成。**值=出发仓库代码**。与`WAREHOUSES.WAREHOUSE_CODE` JOIN显示代码·名称。 |
| 到达仓库(代码/名称) | `TO_WAREHOUSE_ID` | PK组成。**值=到达仓库代码**。相同方式JOIN。 |
| 允许与否 | `ALLOW_YN` | `'Y'`=允许移动, `'N'`=禁止。默认`'Y'`。 |
| 备注 | `REMARK` | 备注(nullable)。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK部分。`40` / `1000` 范围。 |

> (出发→到达)配对唯一。重复登记时报409 Conflict。修改/删除API通过`/{fromWarehouseId}/{toWarehouseId}`路径传递复合键。

---

## 仓库自动创建 (基于代码的操作)
部分仓库在运营中由系统自动创建(与界面登记无关)。
- **工序在制(FLOOR/WIP)**: `getOrCreateFloorWarehouse(lineCode, processCode)` → 代码`FLOOR_{线}_{工序}`, 类型`WIP`，填入线·工序。
- **外协(SUBCON)**: `getOrCreateSubconWarehouse(vendorId, vendorName)` → 代码`SUBCON_{客户ID}`, 类型`SUBCON`，填入`VENDOR_ID`。
- **默认仓库初始化**: `initDefaultWarehouses()`创建`RM_MAIN/RM_SUB/WIP_MAIN/FG_MAIN/FG_SHIP/DEFECT/SCRAP/SUBCON_MAIN`等。(此种子中的部分类型值可能以`RM`形式存在，与界面过滤器代码值`RAW`可能不同，数据检查时需注意。)

## 预设条件 (主表·公共代码)
- 公共代码: `WAREHOUSE_TYPE`(仓库类型), `USE_YN`
- 线·工序代码(FLOOR仓库): 需先有线/工序主表才可选择。

## 操作流程
1. 在仓库管理中登记运营仓库(指定类型·默认仓库)。
2. 为需要的仓库登记位置(区域/行/列/层)。
3. 为需要控制的仓库对登记移动规则(允许/禁止)。
4. 停用仓库时建议以`USE_YN='N'`禁用而非删除(保留库存/记录)。

## 权限
标准信息管理员(登记/修改/删除)。普通用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 仓库删除失败 | 该仓库存在库存余量(`有库存的仓库不可删除`) | 转移/清空库存后删除，或以`USE_YN='N'`禁用 |
| 表单中不显示线·工序栏 | 仓库类型不是FLOOR | 将类型改为`FLOOR`(工序在制) |
| 自动放置到错误仓库 | 该类型缺少`IS_DEFAULT='Y'`仓库/存在多个 | 每种类型仅保留1个默认仓库为`IS_DEFAULT='Y'` |
| 移动规则保存时409 | 同一(出发→到达)配对已存在 | 通过修改已有规则处理 |
| 移动规则出发/到达名称为空 | `FROM/TO_WAREHOUSE_ID`指向的仓库代码不在WAREHOUSES中 | 确认仓库代码一致性(修正为有效仓库代码) |
| 仓库/位置在选择列表中不存在 | `USE_YN='N'` | 将使用与否设为`Y`激活 |

## 数据·关联
- 表: `WAREHOUSES`, `WAREHOUSE_LOCATIONS`, `WAREHOUSE_TRANSFER_RULES`
- 关联: 入库/发放, 库存(`MAT_STOCK`, `PRODUCT_STOCKS`), 生产实绩, 库存移动, 物料主表(默认存放位置)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
