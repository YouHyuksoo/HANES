---
menuCode: MST_PART
audience: operator
title: 物料主表 — 操作指南
summary: 物料主表全部列的DB映射, ERP同步(IF_ITEM_MASTER), IQC/AQL关联, 权限, 故障排除
tags: [标准信息, 物料, 主表, 操作, ERP]
keywords: [ITEM_MASTERS, IF_ITEM_MASTER, ERP-IF, IQC_AQL_POLICY_CODE, PRODUCT_TYPE, IQC_INSPECT_METHOD, UNIT_TYPE, 物料类型, 同步, 多租户]
related: [QC_AQL]
---

# 物料主表 — 操作指南

## 系统目的·角色
持有所有物料标准信息的**主表 `ITEM_MASTERS`** 管理界面。BOM·生产实绩·材料收发·入库检验(IQC)·库存均通过 `ITEM_CODE` 引用此主表。

## 数据结构
```
ITEM_MASTERS (PK: COMPANY, PLANT_CD, ITEM_CODE)
   ├─ IQC_AQL_POLICY_CODE ──▶ IQC_AQL_POLICIES (入库检验AQL策略)
   └─ 引用: BOM / 生产 / 材料收发 / 库存 / 标签
```

## 全部列 — ITEM_MASTERS

| 界面项目 | DB列 | 含义 · 操作要点 |
|------|------|------|
| 物料代码 | `ITEM_CODE` | PK组成。建议不变(连接完整性)。 |
| 品号 | `PART_NO` | 图纸/ERP/客户品号。 |
| 物料名称 | `ITEM_NAME` | 显示名称。 |
| 客户品号 | `CUST_PART_NO` | 客户品号(出货/标签匹配)。 |
| Rev | `REV` | 图纸/规格修订号。 |
| 标记文本 | `MARKING_TEXT` | 标签·打标设备传递文本。 |
| 物料类型 | `ITEM_TYPE` | RAW_MATERIAL/SEMI_PRODUCT/FINISHED/CONSUMABLE。材料·生产处理分支。 |
| 物料组 | `PRODUCT_TYPE` | 公共代码PRODUCT_TYPE。 |
| 车型/型号 | `MODEL_NAME` | 管理特性。 |
| 规格 | `SPEC` | 规格/尺寸。 |
| 颜色 | `COLOR` | 线色等。 |
| 单位 | `UNIT` | 公共代码UNIT_TYPE。库存·发放基准单位。 |
| IQC与否 | `IQC_FLAG` | Y=入库检验对象。 |
| 检验方式 | `INSPECT_METHOD` | 公共代码IQC_INSPECT_METHOD。 |
| 基本样本数 | `SAMPLE_QTY` | IQC基本样本数(与AQL样本数不同)。 |
| AQL策略 | `IQC_AQL_POLICY_CODE` | 引用`IQC_AQL_POLICIES.POLICY_CODE`。入库LOT判定基准。 |
| 箱数量 | `BOX_QTY` | 装箱基准。 |
| 最小包装数量 | `MIN_PACK_QTY` | 最小发放单位。 |
| LOT组成单位 | `LOT_UNIT_QTY` | 工序品捆包单位。 |
| 托盘组成单位 | `PACK_UNIT` | 上层包装单位。 |
| 安全库存 | `SAFETY_STOCK` | 不足判断基准。 |
| 有效期 | `EXPIRY_DATE` | 有效期限天数。 |
| 有效期延长 | `EXPIRY_EXT_DAYS` | 可延长最大天数。 |
| 存放位置 | `STORAGE_LOCATION` | 默认存放位置。 |
| 图片 | `IMAGE_URL` | 上传文件路径(`/uploads/parts/...`)。 |
| 使用与否 | `USE_YN` | 仅Y为激活。 |
| 备注 | `REMARK` | 备注。 |
| 审计 | `CREATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。ERP同步部分`CREATED_BY='ERP-IF'`。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000` 范围。 |

## ERP同步 (IF_ITEM_MASTER)
- 上方**ERP同步**按钮 → `POST /interface/inbound/item-master` → 执行Oracle存储过程**`IF_ITEM_MASTER`**(确认模态框后)。
- 操作: 将ERP `MTL_SYSTEM_ITEMS`**MERGE**到`ITEM_MASTERS`。新增INSERT(`CREATED_BY='ERP-IF'`)，已有用ERP最新值UPDATE。
- 结果: 返回`{ insert, update }`数量。
- **误操作恢复**: ERP误添加的新物料可通过`CREATED_BY='ERP-IF'` + 对应`CREATED_AT`批次识别后删除(删除前确认PROD_PLANS等子引用)。一次可能进入数万条，执行前务必确认对话框。

## IQC / AQL关联
- 仅`IQC_FLAG='Y'`的物料在入库时为入库检验对象。
- `IQC_AQL_POLICY_CODE`引用`IQC_AQL_POLICIES` → 入库LOT检验中自动计算样本数·Ac·Re。未设置时不应用自动判定。

## 预设条件 (主表·公共代码)
- 公共代码: `PRODUCT_TYPE`, `IQC_INSPECT_METHOD`, `UNIT_TYPE`, `USE_YN`
- AQL策略([AQL基准管理])需先设置才能关联到物料。

## 权限
标准信息管理员(登记/修改/ERP同步)。普通用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| ERP同步批量误添物料 | ERP同步误执行 | 识别`CREATED_BY='ERP-IF'`批次后删除(确认子引用) |
| 列表图片显示异常 | `IMAGE_URL`路径文件不存在(404) | 重新上传图片或整理路径(前端占位图回退) |
| 入库检验中AQL自动判定不生效 | `IQC_AQL_POLICY_CODE`未设置 | 为物料关联AQL策略 |
| 物料在选择列表中不显示 | `USE_YN='N'` | 将使用与否设为Y激活 |
| 保存时代码重复错误 | 同一`ITEM_CODE`已存在 | 确认代码(不可变键) |

## 数据·关联
- 表: `ITEM_MASTERS`
- 关联: BOM, 生产实绩, 材料收发, 库存, 标签, 入库检验(IQC)·AQL(`IQC_AQL_POLICIES`)
- 外部: ERP `MTL_SYSTEM_ITEMS`(IF_ITEM_MASTER MERGE)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
