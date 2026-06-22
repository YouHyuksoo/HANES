---
menuCode: CONS_LABEL
audience: operator
title: 耗材标签发行 — 操作指南
summary: 耗材UID(conUid)编号·未入库(PENDING)实例创建, 标签打印/重新发行逻辑, CONSUMABLE_STOCKS·LABEL_PRINT_LOGS映射, 编号规则(F_GET_CON_UID), 标签模板, 入库确认关联, 权限·故障排除·多租户
tags: [耗材, 标签, 发行, 打印, 操作]
keywords: [CONSUMABLE_STOCKS, CONSUMABLE_MASTERS, LABEL_PRINT_LOGS, CON_UID, conUid, F_GET_CON_UID, CON_UID_SEQ, 耗材UID, 编号, PENDING, ACTIVE, CON_STOCK_STATUS, 标签发行, 标签模板, LABEL_TEMPLATES, 打印, 重新发行, print agent, ZPL, BROWSER, 多租户, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_RECEIVING]
---

# 耗材标签发行 — 操作指南

## 系统目的·角色
基于耗材主表(`CONSUMABLE_MASTERS`)**编号**用于**单独跟踪的UID(`CON_UID`)**，在 `CONSUMABLE_STOCKS` 中创建**未入库(PENDING)实例**，并打印·重新发行标签的界面。发行不是入库，而是**跟踪对象创建 + 标签输出**，实际入库(库存增加)在[耗材入库](`CONS_RECEIVING`)中通过条码扫描确认。

> API参考(控制器 `consumables/label`): 可发行主表 `GET /consumables/label/masters`，UID编号+PENDING创建 `POST /consumables/label/create`，未入库列表 `GET /consumables/label/pending`，单条/多条入库确认 `POST /consumables/label/confirm`·`confirm-bulk`，扫描归还/出库/出库取消 `POST /consumables/label/return`·`issue`·`issue-return`。右侧面板的实例查询通过 `GET /consumables/stocks`(参数 `consumableCode`·`status`)，打印记录补充通过 `POST /material/label-print/log`，模板通过 `GET /master/label-templates?category=jig`。
>
> 界面表格下方的 `SELECT * FROM CON_LABELS ...` 仅是显示用标签语句，实际表名为 `CONSUMABLE_STOCKS`。

## 数据结构
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)         耗材主表
   └─ 1:N ─▶ CONSUMABLE_STOCKS (PK: CON_UID)     单个实例(发行单位)
                 status: PENDING → ACTIVE → MOUNTED/ISSUED/RETURNED ...

LABEL_PRINT_LOGS (PK: PRINTED_AT + SEQ)          标签发行记录
   category='con_uid', UID_LIST=发行UID JSON数组
```
- 发行1次 = 按 `qty` 生成 `CONSUMABLE_STOCKS` 行 + `LABEL_PRINT_LOGS` 1条。
- 未入库面板仅显示同一主表中 `status='PENDING'` 的行(客户端过滤)。

## ① 发行对象列表 — CONSUMABLE_MASTERS / 聚合(CONSUMABLE_STOCKS)

`GET /consumables/label/masters` 返回 `useYn='Y'` 的主表并附加实例聚合。

| 界面项目 | DB列 / 计算方式 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 选择(复选框) | (UI状态) | 发行对象多选。表头复选框全选/取消。0条时发行按钮禁用。 |
| 图片 | `CONSUMABLE_MASTERS.IMAGE_URL` | 缩略图·标签图片。通过 `resolveBackendFileUrl` 解析后端路径，加载失败显示占位图。 |
| 耗材代码 | `CONSUMABLE_MASTERS.CONSUMABLE_CODE` | 发行UID绑定的自然键(FK对象)。 |
| 耗材名称 | `CONSUMABLE_MASTERS.NAME` (属性 `consumableName`) | 搜索·标签显示。 |
| 分类 | `CONSUMABLE_MASTERS.CATEGORY` | 公共代码 `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL)。顶部过滤器依据。通过 `ComCodeBadge` 显示。 |
| 当前库存 | `CONSUMABLE_MASTERS.STOCK_QTY` | 入库确认时+1，归还/出库时-1的持有数量。 |
| 实例数 | `COUNT(*)` of `CONSUMABLE_STOCKS` (属性 `instanceCount`) | 发行累计对象数。旁边的 `(未入库: n)` 为 `SUM(status='PENDING')`(属性 `pendingCount`)。 |
| 发行数量 | (UI状态 `qtyMap`) | 本次编号数量。UI限制1~99，DTO验证1~999(`@Min(1)@Max(999)`)。 |

## ② 标签发行工具 (右上区域)

| 界面项目 | 关联 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 状态消息 | (UI `issueStatus`) | loading/success/error 单行显示。`aria-live=polite`。 |
| 刷新 | `GET /consumables/label/masters` | 重新查询列表·聚合。 |
| 标签模板选择 | `GET /master/label-templates?category=jig` | `LABEL_TEMPLATES` 中 jig 分类。优先 `isDefault`，无则选第一项。`__default__` 为内置默认设计(`createDefaultLabelDesign('jig')`)。`designData` 为JSON(字符串则解析)。 |
| UID发行 | `POST /consumables/label/create` | 按所选主表发送 `{consumableCode, qty}` → conUid编号 → 打印。 |

## ③ 未入库实例面板 — CONSUMABLE_STOCKS

通过 `GET /consumables/stocks?consumableCode=...` 查询后仅显示 `status='PENDING'`。

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 耗材UID | `CON_UID` | PK。标签/条码跟踪键。 |
| 状态 | `STATUS` | 公共代码 `CON_STOCK_STATUS`。面板仅显示 `PENDING`。(迁移: PENDING→ACTIVE→MOUNTED/ISSUED/RETURNED/REPAIR/SCRAPPED) |
| 存放位置 | `LOCATION` | 入库确认时可指定。 |
| 使用次数 | `CURRENT_COUNT` / 主表 `EXPECTED_LIFE` | 显示 `当前次数 / 预期寿命`。未入库通常为0。 |
| 入库日期 | `RECV_DATE` | 入库确认时间。PENDING为null(`-`)。 |
| 安装设备 | `MOUNTED_EQUIP_CODE` (属性 `mountedEquipCode`) | 在安装流程中更新。 |
| 供应商 | `VENDOR_CODE`, `VENDOR_NAME` | 编号时从DTO/主表继承。 |
| 预览 | (UI) | 通过 `LabelDesignRenderer` 模态框预览(不打印)。 |
| 重新发行 | `POST /material/label-print/log` + print agent | 将标签渲染为PNG → 通过 `printAgentPng` 发送到打印机 + 记录打印日志。 |

## ④ 标签发行记录 — LABEL_PRINT_LOGS

| 界面项目(不显示) | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| (自动) 发行时间 | `PRINTED_AT` | 复合PK 1。 |
| (自动) 序号 | `SEQ` | 复合PK 2(创建时固定为1)。 |
| (自动) 分类 | `CATEGORY` | 固定为 `'con_uid'`。 |
| (自动) 打印方式 | `PRINT_MODE` | `BROWSER`(浏览器输出) / `ZPL`(直接输出)。创建·日志记录为 `BROWSER`。 |
| (自动) UID列表 | `UID_LIST` | 发行conUid JSON数组(CLOB)。 |
| (自动) 标签数 | `LABEL_COUNT` | 发行数量(创建时为 `qty`)。 |
| (自动) 状态 | `STATUS` | `SUCCESS`/`FAILED`。 |
| (键) 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000`(属性 `company`, `plant`)。 |

## UID编号规则 (CON_UID)
- 发行时 `NumberingService.nextConUid()` → 通过 `PKG_SEQ_GENERATOR`(编号类型 `CON_UID`)在事务内编号(无跳号)。
- 格式函数 `F_GET_CON_UID`: `'C' + TO_CHAR(SYSDATE,'YYMMDD') + LPAD(CON_UID_SEQ.NEXTVAL, 5, '0')`。
  - 例) 2026-06-23 发行 → `C2606230001`, `C2606230002` …
- `CON_UID_SEQ` 为 Oracle SEQUENCE。加日期前缀按日期区分，通过序列值保证唯一性。

## 发行 / 打印逻辑（浏览器输出）
1. **选择验证**: `selectedCodes` 为0条则中止。新打印窗口 `window.open` 失败(弹窗拦截)则显示错误后中止。
2. **编号**(`createConUids`): 按所选主表发送 `POST /consumables/label/create`。服务器在事务中按 `qty` 调用 `nextConUid()` → 保存 `CONSUMABLE_STOCKS`(status=`PENDING`, `LABEL_PRINTED_AT`=now, vendor·unitPrice继承) + 记录 `LABEL_PRINT_LOGS` 1条。主表不存在返回404。
3. **标签数据组成**: 为每个 conUid 绑定 `consumableCode/Name/category/imageUrl/stockQty/expectedLife/location`，通过 `LabelPrintRenderer` 绘制。
4. **渲染等待**: 等待 `data-label-barcode-pending` 标志和图片加载最多2.5秒。条码未完成则阻止输出(建议预览)。
5. **打印**: 在新窗口写入标签HTML + `@page size:{labelWidth}mm {labelHeight}mm` 后调用 `window.print()`。
6. **打印日志补充**: `POST /material/label-print/log`(category=`con_uid`, printMode=`BROWSER`, uidList, SUCCESS)。失败则忽略(silent)。
7. **收尾**: 取消选择·重置状态·刷新列表。

### 重新发行逻辑（agent直接输出）
- 右侧面板**重新发行**: 将单个conUid标签通过 `renderLabelNodeToPngBase64` 转换为PNG(缩放3倍) → 发送 `printAgentPng({ jobId: 'CON-REPRINT-{conUid}', widthMm, heightMm, copies:1, contentBase64 })` → 记录 `POST /material/label-print/log`。需要标签打印agent(本地输出服务)已启动。
- **预览**不进行编号·发送，仅显示 `LabelDesignRenderer` 模态框(用于输出前确认条码·布局)。

## 预设条件（主表·公共代码）
- 公共代码: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL), `CON_STOCK_STATUS`(PENDING/ACTIVE/MOUNTED/REPAIR/SCRAPPED 等)。
- 编号: Oracle `CON_UID_SEQ` 序列 + `F_GET_CON_UID` 函数，在 `PKG_SEQ_GENERATOR` 中注册 `CON_UID` 类型(`seed_seq_rules.sql`)。
- 标签模板: 需在 `LABEL_TEMPLATES` 中存在 `category='jig'` 的设计才可选择(没有则使用内置默认设计)。设计·模板管理在标签管理界面。
- 目标耗材需 `CONSUMABLE_MASTERS.USE_YN='Y'` 才会在列表中显示。

## 操作流程
1. 在标签管理中创建耗材(jig)标签**模板**并设置默认值(可选)。
2. 在本界面选择耗材 + 输入发行数量 → **UID发行** → 标签输出 → 贴附实物。
3. 标签丢失·损坏时在右侧面板对该UID**重新发行**。
4. 贴附后在**耗材入库**中扫描条码 → 入库确认(`POST /consumables/label/confirm`): `CONSUMABLE_STOCKS.STATUS` PENDING→ACTIVE, 设置 `RECV_DATE`, `CONSUMABLE_MASTERS.STOCK_QTY +1`, 在 `CONSUMABLE_LOGS` 中记录IN记录(`SEQ_CONSUMABLE_LOGS.NEXTVAL`)。

## 权限
耗材/材料管理员(发行·重新发行)。普通用户仅查询。标签直接输出(agent)仅在安装了输出代理的终端上运行。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| UID发行按钮禁用 | 选择0条或发行/打印进行中 | 勾选1条以上耗材，等待完成后再试 |
| "浏览器拦截了输出窗口" | 弹窗被拦截 | 允许站点弹窗后重新发行 |
| "没有已发行的UID" | 选择项·发行数量为0 | 确认发行数量(1~99) |
| "条码生成尚未完成" | 条码渲染未完成(超过2.5秒) | 通过预览确认标签后重新输出 |
| 发行时404(主表不存在) | `consumableCode` 不存在/跨租户 | 检查耗材主表注册·租户 |
| 重新发行时"agent输出错误" | 标签打印agent未启动/错误 | 检查输出代理状态·打印机连接 |
| 未入库列表为空 | 该耗材没有PENDING(已入库/不存在) | 检查发行情况·入库确认状态 |
| 标签上图片不显示 | `IMAGE_URL` 文件404 | 在耗材主表中重新上传图片 |
| 实例数增加但库存不变 | 未执行入库确认(PENDING状态) | 在耗材入库中扫描·入库确认 |

## 数据·关联
- 表: `CONSUMABLE_STOCKS`(发行实例·PK `CON_UID`), `CONSUMABLE_MASTERS`(主表·发行对象), `LABEL_PRINT_LOGS`(发行记录), `CONSUMABLE_LOGS`(入库确认时的IN记录), `LABEL_TEMPLATES`(标签设计)
- 编号: `CON_UID_SEQ` + `F_GET_CON_UID` + `PKG_SEQ_GENERATOR(CON_UID)`
- 关联界面: 耗材主表(发行对象), 耗材入库(扫描入库确认), 标签管理(模板设计)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`
