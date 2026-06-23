---
menuCode: MST_WORK_INST
audience: operator
title: Work Instruction Management — Operator Guide
summary: Full column meaning of work instructions, DB mapping, file upload structure, revision management and troubleshooting
tags: [master, work instruction, operations, settings, revision]
keywords: [WORK_INSTRUCTIONS, ITEM_MASTERS, revision management, file upload, CLOB, shop floor document, work standard, item linkage, MST_PART]
related: [MST_PART]
---

# Work Instruction Management — Operator Guide

## System Purpose & Role
Manages **work instructions** as document units per item and process for shop floor worker reference. Linked via the item code from the item master. Multiple document versions can be operated simultaneously for the same item depending on process and revision. On the production floor, workers reference these documents for work methods, sequence, and precautions.

## Data Structure
```
ITEM_MASTERS.ITEM_CODE
        │ (reference — logical FK, no DB constraint)
        ▼
WORK_INSTRUCTIONS (COMPOSITE PK: ITEM_CODE + PROCESS_CODE + REVISION)
        │
        ├── Basic Info: TITLE, CONTENT(CLOB), IMAGE_URL, USE_YN
        ├── Multi-tenancy: COMPANY, PLANT_CD
        └── History: CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY
```

---

## ① Work Instructions — WORK_INSTRUCTIONS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Item Code | `ITEM_CODE` | **PK (1/3)**. Target item. Logically linked to `ITEM_MASTERS.ITEM_CODE` (no DB FK constraint). Immutable after registration. |
| Process Code | `PROCESS_CODE` | **PK (2/3)**. Process within the item. Immutable after registration. |
| Revision | `REVISION` | **PK (3/3)**. Document revision version. Default `A`. Immutable after registration. Register a new row for new revisions. |
| Title | `TITLE` | Work instruction title. Displayed in list and preview. Used for shop floor identification. |
| Content | `CONTENT` | **CLOB type**. Body text such as work sequence and precautions. Supports long text storage. |
| Attachment URL | `IMAGE_URL` | Uploaded file path or external URL. `varchar2(500)`. |
| Use Flag | `USE_YN` | `Y` = Active (shown in list), `N` = Inactive (soft delete concept). Default `Y`. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Company code (`40`) / Plant code (`1000`) scope. Auto-applied to all queries. |
| Created By | `CREATED_BY` | User who initially registered. |
| Updated By | `UPDATED_BY` | User who last modified. |
| Created At | `CREATED_AT` | Initial registration time (auto). |
| Last Updated | `UPDATED_AT` | Last modification time (auto). Displayed in list. |

---

## File Upload Structure

- **Upload Endpoint**: `POST /master/work-instructions/upload` (multipart/form-data)
- **Storage Path**: Server `./uploads/work-instructions/` directory, timestamp-based filename
- **Allowed Formats**: Images (`image/*`), PDF, Office documents (`.doc/.docx/.xls/.xlsx`), Text (`.txt`)
- **Max Size**: 10MB
- **Direct URL Entry**: External URLs can also be entered instead of uploading (images, PDFs, etc.)
- **Return Value**: `{ url, originalName, size }` — `url` is stored in `IMAGE_URL`

> The system does not automatically determine whether `IMAGE_URL` is an uploaded file path or an external URL. Pay attention to path consistency during operation.

---

## Revision Management

- Multiple `REVISION` rows can exist for the same `ITEM_CODE + PROCESS_CODE`.
- Revisions should be managed sequentially, but the system does not auto-increment. Operators specify revisions explicitly.
- All queries are sorted by `REVISION DESC`, so the latest revision appears first.
- Unnecessary old revisions can be deactivated with `USE_YN='N'` (no physical DELETE).

---

## Operating Procedure
1. Check the **Part Master** for items requiring work instructions.
2. Register documents in the **Work Instruction Management** screen with the item code and process code.
3. Upload attachments (work standard images/PDFs) and write the work sequence in the content.
4. When a document revision is needed, register a new row with the same PK but a new revision (e.g., B).
5. The latest revision is displayed first when shop floor workers reference documents.

## Permissions
Users with master data management authority (master data administrator). General users can only view (subject to screen access policy).

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Save button disabled | Item code, process code, or title is empty | Fill in all required fields |
| "Duplicate document" error | Same PK (item + process + revision) already exists | Change revision or edit existing document |
| File upload failed | Exceeds 10MB or unsupported format | Check file size and format |
| Image not showing in preview | `IMAGE_URL` path is incorrect or file deleted | Verify URL/file path |
| Image displayed as PDF | URL extension is not an image format | Check URL ends with `.jpg/.png/.gif` etc. |

## Data & Integration
- **Table**: `WORK_INSTRUCTIONS`
- **Integration**: `ITEM_MASTERS.ITEM_CODE` (logical reference), file upload storage
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
- **File Storage**: Server local `./uploads/work-instructions/` (extensible for external file storage integration if needed)
