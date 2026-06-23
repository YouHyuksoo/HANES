---
menuCode: MST_WORK_INST
audience: operator
title: 作业指导书管理 — 操作指南
summary: 作业指导书的全部列含义、DB映射、文件上传结构、版本管理与故障排除
tags: [基础信息, 作业指导书, 操作, 设置, 版本]
keywords: [WORK_INSTRUCTIONS, ITEM_MASTERS, 版本管理, 文件上传, CLOB, 现场文档, 作业标准, 物料关联, MST_PART]
related: [MST_PART]
---

# 作业指导书管理 — 操作指南

## 系统目的·作用
按物料·工序对现场作业人员需参考的**作业指导书(Work Instruction)**以文档单位进行管理。以物料主数据的物料代码为基准进行关联，同一物料也可按工序·版本同时运营多个版本的文档。生产现场以此文档为基准确认作业方法·顺序·注意事项。

## 数据结构
```
ITEM_MASTERS.ITEM_CODE
        │ (引用·关联 — 逻辑FK，无DB约束)
        ▼
WORK_INSTRUCTIONS (复合PK: ITEM_CODE + PROCESS_CODE + REVISION)
        │
        ├── 基本信息: TITLE, CONTENT(CLOB), IMAGE_URL, USE_YN
        ├── 多租户: COMPANY, PLANT_CD
        └── 历史: CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY
```

---

## ① 作业指导书 — WORK_INSTRUCTIONS (全部列)

| 画面项目 | DB列 | 作用 / 含义 · 操作要点 |
|------|------|------|
| 物料代码 | `ITEM_CODE` | **PK (1/3)**。作业指导书的目标物料。与`ITEM_MASTERS.ITEM_CODE`逻辑连接(无DB FK约束)。注册后不可更改。 |
| 工序代码 | `PROCESS_CODE` | **PK (2/3)**。该物料内工序。注册后不可更改。 |
| 版本 | `REVISION` | **PK (3/3)**。文档修订版本。默认值`A`。注册后不可更改。新修订时以新行注册。 |
| 文档标题 | `TITLE` | 作业指导书标题。显示于列表·预览中。用于现场识别。 |
| 内容 | `CONTENT` | **CLOB类型**。作业顺序·注意事项等正文。可存储长文本。 |
| 附件URL | `IMAGE_URL` | 上传的文件路径或外部URL。`varchar2(500)`。 |
| 使用与否 | `USE_YN` | `Y` = 激活(列表显示)，`N` = 停用(软删除概念)。默认值`Y`。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 公司代码(`40`)/工厂代码(`1000`)范围。自动应用于所有查询。 |
| 创建者 | `CREATED_BY` | 首次注册用户。 |
| 修改者 | `UPDATED_BY` | 最后修改用户。 |
| 创建时间 | `CREATED_AT` | 首次注册时间(自动)。 |
| 最后修改日 | `UPDATED_AT` | 最后修改时间(自动)。显示于列表中。 |

---

## 文件上传结构

- **上传端点**: `POST /master/work-instructions/upload` (multipart/form-data)
- **存储路径**: 服务器`./uploads/work-instructions/`目录下以时间戳为基础的文件名保存
- **允许格式**: 图片(`image/*`), PDF, Office文档(`.doc/.docx/.xls/.xlsx`), 文本(`.txt`)
- **最大大小**: 10MB
- **直接输入URL**: 也可输入外部URL代替上传(图片·PDF等)
- **返回值**: `{ url, originalName, size }` — url保存至画面的`IMAGE_URL`

> 系统不会自动判断`IMAGE_URL`是上传文件路径还是外部URL。运营时请注意路径的完整性。

---

## 版本管理

- 同一`ITEM_CODE + PROCESS_CODE`可保有多个`REVISION`行。
- 版本按顺序运营，但系统不会自动递增。由操作员明确指定。
- 所有查询按`REVISION DESC`排序，因此最新版本优先显示。
- 不需要的旧版本可设置`USE_YN='N'`停用(实际DELETE为物理删除)。

---

## 操作流程
1. 在**物料主数据**中确认需要作业指导书的物料。
2. 在**作业指导书管理**画面中按相应物料代码·工序代码注册文档。
3. 上传附件(作业标准图片/PDF)并在正文中编写作业顺序。
4. 需要修订文档时，以与现有文档相同的PK添加新版本(如B)。
5. 现场参考文档时优先显示最新版本。

## 权限
具有主数据管理权限的用户(基础信息管理员)。一般用户仅可查询(按画面访问权限策略)。

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 保存按钮停用 | 物料代码·工序代码·标题中存在空值 | 填写所有必填字段 |
| "重复文档"错误 | 同一PK(物料+工序+版本)已存在 | 更改版本或修改现有文档 |
| 文件上传失败 | 超过10MB或格式不支持 | 确认文件大小·格式 |
| 预览中图片不显示 | `IMAGE_URL`路径不正确或文件已删除 | 确认URL/文件路径 |
| 是图片却显示为PDF | URL扩展名非图片格式 | 确认URL以`.jpg/.png/.gif`等结尾 |

## 数据·关联
- **表**: `WORK_INSTRUCTIONS`
- **关联**: `ITEM_MASTERS.ITEM_CODE` (逻辑引用)，文件上传存储
- **范围**: `COMPANY='40'`, `PLANT_CD='1000'`
- **文件保存**: 服务器本地`./uploads/work-instructions/` (需要时可扩展连接单独文件存储)
