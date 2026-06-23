---
menuCode: MST_WORK_INST
audience: user
title: Work Instruction Management
summary: Register, edit, view, and delete work instructions (documents/images) by item and process
tags: [master, work instruction, instruction, process document]
keywords: [work instruction, Work Instruction, work standard, work sequence, revision, process document, shop floor document, master data]
related: [MST_PART]
---

# Work Instruction Management

## Screen Purpose
Register and manage **work instructions** by item and process. Documents containing work sequence, precautions, and reference images/files that shop floor workers must follow are managed in document form. Documents are identified by a combination of item, process, and revision, and revisions can be assigned for version history.

## Screen Layout
- **Main Area — DataGrid List**: Displays the list of registered work instructions. Provides column filtering, sorting, and export functionality.
- **Right Panel (Preview)**: Clicking a row shows detailed work instruction info (title, revision, attachments, content) on the right.
- **Right Panel (Register/Edit)**: Clicking the Add or Edit button opens a form panel on the right.

---

## ① DataGrid List Columns

| Column | Role / Description |
|------|------|
| **Item Code (itemCode)** | The code of the item to which the work instruction applies. References `ITEM_MASTERS.ITEM_CODE`. |
| **Item Name (itemName)** | The name of the target item. |
| **Process Code (processCode)** | The process code the work instruction belongs to. Together with item code and revision, forms the document identifier (PK). |
| **Title (title)** | The title of the work instruction. Used to distinguish documents on the shop floor. |
| **Revision (revision)** | The document revision version. Defaults to `A` on new registration; increments to B, C, etc. on revisions. |
| **Last Updated (updatedAt)** | The date and time the document was last modified. |
| **Use Flag (useYn)** | `Y` = Active (in use), `N` = Inactive. Displayed as a green/gray circle. |

---

## ② Register/Edit Form Fields

| Field | Role / Description |
|------|------|
| **Item Code (itemCode)** | The item code for the work instruction. Cannot be changed after registration. |
| **Process Code (processCode)** | The process this work instruction belongs to within the item. Cannot be changed after registration. |
| **Title (title)** | The title of the work instruction. Required field. |
| **Revision (revision)** | Document version. If left blank, saved as `A`. Cannot be changed after registration. |
| **Attachment (imageUrl)** | Image/PDF/document file to attach to the work instruction. Upload via **drag-and-drop or file selection**, or **enter a URL directly**. |
| **Content (content)** | The body content of the work instruction, such as work sequence and precautions. |

---

## Usage Procedure
1. Click the **Add** button to register a new work instruction (right panel).
2. Enter the item code, process code, and title; optionally upload attachments and write content.
3. Click a row in the list to view details in **preview** mode.
4. Click the **Edit** button in preview or the grid's edit icon to modify content.

## Input Rules / Validation
- Item code, process code, and title are **required**. The save button is disabled if any are empty.
- The same `item code + process code + revision` combination cannot be duplicated.
- Attachments support images, PDFs, Office documents, and TXT files, **limited to a maximum of 10MB**.

## FAQ
- **Q.** How are revisions managed? **A.** Default is `A` for new registrations. When editing an existing document, you can keep the current revision or create a new one (e.g., B). Multiple revisions can exist for the same item and process simultaneously.
- **Q.** Can I change the item code or process code after registration? **A.** No, the PK (item code, process code, revision) cannot be changed after registration. You must register a new document.
- **Q.** Can I enter a URL without uploading a file? **A.** Yes, you can enter a URL for an external image/document. Choose between upload and URL.

## Related Screens
- [Part Master](/master/part) — Register and manage items that work instructions apply to
