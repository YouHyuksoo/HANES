# HANES MES — CLI Harness SOP

## Overview

HANES MES (HARNESS Manufacturing Execution System) is a web-based MES for wire
harness manufacturing, built with NestJS (backend) + Next.js (frontend) on Oracle DB.

The CLI harness wraps the REST API (`http://localhost:3003/api/v1`) so that AI agents
and power users can operate the MES without a browser.

## Software Dependency

- **HANES MES Backend** must be running on `localhost:3003` (or configured URL)
- Start with: `cd apps/backend && pnpm dev` or `pm2 start ecosystem.config.js`
- API docs available at: `http://localhost:3003/api/docs` (Swagger)

## Architecture

```
CLI (Click + REPL)
  └── hanes_backend.py (HTTP client)
        └── HANES MES Backend API (NestJS, port 3003)
              └── Oracle Database
```

## Authentication

- Bearer Token = user email
- Headers: `Authorization: Bearer <email>`, `X-Company: <code>`, `X-Plant: <code>`
- Login: `POST /api/v1/auth/login { email, password }`

## Command Groups

| Group       | API Prefix            | Operations                        |
|-------------|-----------------------|-----------------------------------|
| auth        | /auth                 | login, me, register               |
| master      | /master               | parts, processes, bom, routing    |
| material    | /material             | arrivals, lots, stocks, receiving |
| production  | /production           | job-orders, results, plans        |
| quality     | /quality              | inspects, reworks, defects        |
| inventory   | /inventory            | stocks, transactions, warehouses  |
| equipment   | /equipment            | equips, inspects, pm-plans        |
| consumables | /consumables          | stocks, issuing, receiving        |
| shipping    | /shipping             | orders, shipments, returns        |
| dashboard   | /dashboard            | kpi, summaries                    |

## State Model

Session state (persisted as JSON):
- `base_url`: API endpoint (default: http://localhost:3003/api/v1)
- `token`: Bearer token (email)
- `company`: Active company code
- `plant`: Active plant code
- `last_login`: Timestamp

## Output Modes

- **Human**: Formatted tables with colors (default)
- **JSON**: Raw API responses (`--json` flag)
