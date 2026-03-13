# HANES MES CLI — Test Plan & Results

## Test Inventory Plan

- `test_core.py`: ~25 unit tests planned
- `test_full_e2e.py`: ~12 E2E tests planned

## Unit Test Plan (`test_core.py`)

### Session Module (`core/session.py`)
- `test_session_defaults`: Default values on fresh session
- `test_session_save_load`: Save and reload from disk
- `test_session_clear`: Clear session removes file and resets state
- `test_session_login_stores_token`: Login stores email as token
- `test_session_set_context`: Company/plant context update
- `test_session_to_dict`: Serialization format
- `test_session_is_authenticated`: Auth flag logic
- Edge: Invalid session file, missing directory

### Backend Module (`utils/hanes_backend.py`)
- `test_backend_headers`: Header construction with/without auth
- `test_backend_headers_with_tenant`: Tenant headers included
- `test_backend_url_params`: Query parameter encoding
- `test_backend_ping_unreachable`: Connection error handling
- `test_backend_api_error`: HTTP error parsing
- Edge: Empty response, malformed JSON, timeout

### Master Commands (`core/master.py`)
- `test_parts_command_exists`: Command registration
- `test_processes_command_exists`: Command registration
- `test_boms_command_exists`: Command registration

### Material Commands (`core/material.py`)
- `test_arrivals_command_exists`: Command registration
- `test_lots_command_exists`: Command registration
- `test_stocks_command_exists`: Command registration

### Production Commands (`core/production.py`)
- `test_orders_command_exists`: Command registration
- `test_results_command_exists`: Command registration

### CLI Entry Point (`hanes_cli.py`)
- `test_cli_help`: Help text rendered
- `test_cli_version`: Version shown
- `test_cli_json_flag`: JSON mode propagated

## E2E Test Plan (`test_full_e2e.py`)

### Prerequisites
- HANES MES backend running on localhost:3003
- Valid test user credentials

### Scenarios
1. **Login workflow**: Login -> verify session file -> me -> logout
2. **Master data query**: Login -> list parts -> list processes -> list com-codes
3. **Production query**: Login -> list job orders -> get order detail
4. **Material query**: Login -> list stocks -> list lots
5. **Quality query**: Login -> list reworks -> list defects
6. **Inventory query**: Login -> list warehouses -> list product stocks
7. **Dashboard query**: Login -> get KPI
8. **JSON mode**: All queries with --json flag produce valid JSON
9. **Context switch**: Set company/plant -> verify in subsequent requests
10. **Error handling**: Invalid credentials -> clear error message
11. **CLI subprocess help**: `cli-anything-hanes --help` via subprocess
12. **CLI subprocess version**: `cli-anything-hanes --version` via subprocess

## Realistic Workflow Scenarios

### Workflow 1: Material Receiving Pipeline
**Simulates**: Warehouse operator checking incoming materials
**Operations**: login -> material arrivals -> material lots -> material stocks
**Verified**: Data returned, table formatted, JSON valid

### Workflow 2: Production Monitoring
**Simulates**: Production manager reviewing job orders
**Operations**: login -> production orders --status RUNNING -> production results
**Verified**: Filter works, status column correct

### Workflow 3: Quality Dashboard
**Simulates**: QC engineer checking defect status
**Operations**: login -> quality defects -> quality reworks -> dashboard kpi
**Verified**: Aggregate data returned

---

## Test Results

### Run Date: 2026-03-13

```
platform win32 -- Python 3.14.2, pytest-9.0.2

test_core.py::TestSession::test_session_defaults PASSED
test_core.py::TestSession::test_session_save_load PASSED
test_core.py::TestSession::test_session_clear PASSED
test_core.py::TestSession::test_session_is_authenticated PASSED
test_core.py::TestSession::test_session_set_context PASSED
test_core.py::TestSession::test_session_set_context_partial PASSED
test_core.py::TestSession::test_session_to_dict PASSED
test_core.py::TestSession::test_session_invalid_file PASSED
test_core.py::TestSession::test_session_backend_property PASSED
test_core.py::TestHanesBackend::test_headers_no_auth PASSED
test_core.py::TestHanesBackend::test_headers_with_auth PASSED
test_core.py::TestHanesBackend::test_headers_with_tenant PASSED
test_core.py::TestHanesBackend::test_headers_no_tenant PASSED
test_core.py::TestHanesBackend::test_default_base_url PASSED
test_core.py::TestHanesBackend::test_custom_base_url PASSED
test_core.py::TestHanesBackend::test_base_url_strip_trailing_slash PASSED
test_core.py::TestHanesBackend::test_api_error_class PASSED
test_core.py::TestHanesBackend::test_ping_unreachable PASSED
test_core.py::TestCLICommands::test_cli_group_exists PASSED
test_core.py::TestCLICommands::test_auth_group_exists PASSED
test_core.py::TestCLICommands::test_master_group_exists PASSED
test_core.py::TestCLICommands::test_material_group_exists PASSED
test_core.py::TestCLICommands::test_production_group_exists PASSED
test_core.py::TestCLICommands::test_quality_group_exists PASSED
test_core.py::TestCLICommands::test_inventory_group_exists PASSED
test_core.py::TestCLIRunner::test_cli_help PASSED
test_core.py::TestCLIRunner::test_cli_version PASSED
test_core.py::TestCLIRunner::test_auth_status_no_session PASSED
test_core.py::TestCLIRunner::test_auth_logout PASSED
test_core.py::TestCLIRunner::test_json_mode_auth_status PASSED
test_full_e2e.py::TestBackendConnectivity::test_ping SKIPPED (backend not running)
test_full_e2e.py::TestBackendConnectivity::test_login SKIPPED
test_full_e2e.py::TestBackendConnectivity::test_me SKIPPED
test_full_e2e.py::TestMasterE2E::test_list_parts SKIPPED
test_full_e2e.py::TestMasterE2E::test_list_processes SKIPPED
test_full_e2e.py::TestMasterE2E::test_list_com_codes SKIPPED
test_full_e2e.py::TestMaterialE2E::test_list_mat_stocks SKIPPED
test_full_e2e.py::TestMaterialE2E::test_list_mat_lots SKIPPED
test_full_e2e.py::TestProductionE2E::test_list_job_orders SKIPPED
test_full_e2e.py::TestProductionE2E::test_list_prod_results SKIPPED
test_full_e2e.py::TestQualityE2E::test_list_reworks SKIPPED
test_full_e2e.py::TestQualityE2E::test_list_defect_logs SKIPPED
test_full_e2e.py::TestCLISubprocess::test_help PASSED
test_full_e2e.py::TestCLISubprocess::test_version PASSED
test_full_e2e.py::TestCLISubprocess::test_auth_status_json PASSED
test_full_e2e.py::TestCLISubprocess::test_master_parts_json SKIPPED

33 passed, 13 skipped in 6.78s
```

### Summary Statistics

| Metric        | Value           |
|---------------|-----------------|
| Total tests   | 46              |
| Passed        | 33 (100% of runnable) |
| Skipped       | 13 (backend not running) |
| Failed        | 0               |
| Execution time| 6.78s           |

### Coverage Notes

- **Unit tests** (30/30 passed): Session, Backend, CLI commands, Click runner
- **Subprocess tests** (3/3 passed): help, version, JSON auth status
- **E2E tests** (0/13 runnable): Require HANES MES backend on localhost:3003
- Windows `console_scripts` blocked by app control policy; subprocess tests use `python -m` fallback
