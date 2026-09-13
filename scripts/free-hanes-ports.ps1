# =============================================================================
# free-hanes-ports.ps1  —  HANES 서비스 포트(3100/3003/443) 점유 프로세스 정리
#
# 배경:
#   pm2 delete 는 PM2 등록만 지운다. Windows 에서 PM2 가 띄운 자식 프로세스 트리는
#   그대로 남아 포트를 계속 물고 있다. 그 상태로 pm2 start 하면 새 프로세스가
#   EADDRINUSE 로 즉시 죽고 restart 카운트만 올라, 좀비가 계속 포트를 잡는다.
#   결과: TCP 연결은 되는데 HTTP 응답이 없는 장애.
#   (2026-09-11 hswbs 배포 후 실제 발생. frontend restart 3, proxy restart 4, 둘 다 0b)
#
# 전략:
#   포트를 기준으로만 종료한다. 같은 서버의 다른 프로젝트를 건드리지 않기 위해
#   기대한 실행 파일(node / caddy)일 때만 트리 종료하고, 그 외 프로세스가 잡고 있으면
#   죽이지 않고 실패시켜 원인을 드러낸다.
#
# 3002 특례 (2026-09-14):
#   운영 Next 는 3100 으로 옮겼고 3002 는 sshd 전환 포트다. 3002 를 node(구 Next 좀비)가
#   잡고 있으면 정리하되, sshd 등 다른 프로세스가 잡고 있으면 건드리지 않고 스킵한다
#   (배포를 실패시키지 않는다).
#
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/free-hanes-ports.ps1
# =============================================================================

[CmdletBinding()]
param(
  # 포트별로 종료를 허용할 실행 파일 이름. 여기 없는 프로세스가 잡고 있으면 종료하지 않는다.
  [hashtable]$PortOwners = @{ 3100 = @('node'); 3003 = @('node'); 443 = @('caddy') },
  # 선택 정리 대상: 허용 프로세스가 잡고 있으면 정리, 아니면 스킵(실패 아님).
  [hashtable]$OptionalPortOwners = @{ 3002 = @('node') }
)

$ErrorActionPreference = 'Stop'

function Get-PortListener {
  param([int]$Port)
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

function Wait-PortFree {
  param([int]$Port, [int]$TimeoutSec = 15)
  for ($i = 0; $i -lt $TimeoutSec; $i++) {
    if (-not (Get-PortListener -Port $Port)) { return $true }
    Start-Sleep -Seconds 1
  }
  return (-not (Get-PortListener -Port $Port))
}

$blocked = @()

foreach ($port in ($PortOwners.Keys | Sort-Object)) {
  $listener = Get-PortListener -Port $port
  if (-not $listener) {
    Write-Host "port $port : free"
    continue
  }

  $procId = [int]$listener.OwningProcess
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if (-not $proc) {
    # 리스너는 있는데 프로세스를 못 읽는 경우(권한/경합). 해제될 때까지만 기다린다.
    Write-Warning "port $port : listener PID $procId not readable, waiting"
    if (-not (Wait-PortFree -Port $port)) { $blocked += "port $port held by unreadable PID $procId" }
    continue
  }

  $allowed = $PortOwners[$port]
  if ($allowed -notcontains $proc.ProcessName) {
    # 다른 프로그램이 쓰는 포트는 절대 죽이지 않는다. 배포를 실패시켜 사람이 판단하게 한다.
    $blocked += "port $port is used by $($proc.ProcessName) (PID $procId), not one of: $($allowed -join ', ')"
    continue
  }

  Write-Host "port $port : killing $($proc.ProcessName) tree (PID $procId)"
  # taskkill /T 로 자식까지. PM2 의 node -> cmd shim -> node 트리가 여기서 정리된다.
  & taskkill.exe /PID $procId /T /F 2>&1 | ForEach-Object { Write-Host "  $_" }

  if (-not (Wait-PortFree -Port $port)) {
    $blocked += "port $port still held after killing PID $procId"
  } else {
    Write-Host "port $port : freed"
  }
}

if ($blocked.Count -gt 0) {
  throw ("HANES 포트를 비우지 못했습니다:`n  - " + ($blocked -join "`n  - "))
}

# 선택 정리 대상(3002): 허용 프로세스(node 좀비)면 정리, 다른 프로세스(sshd 등)면 그대로 둔다.
foreach ($port in ($OptionalPortOwners.Keys | Sort-Object)) {
  $listener = Get-PortListener -Port $port
  if (-not $listener) {
    Write-Host "port $port : free (optional)"
    continue
  }
  $procId = [int]$listener.OwningProcess
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  $name = if ($proc) { $proc.ProcessName } else { "unreadable(PID $procId)" }
  $allowed = $OptionalPortOwners[$port]
  if ($proc -and ($allowed -contains $proc.ProcessName)) {
    Write-Host "port $port : killing leftover $($proc.ProcessName) tree (PID $procId, optional)"
    & taskkill.exe /PID $procId /T /F 2>&1 | ForEach-Object { Write-Host "  $_" }
    if (Wait-PortFree -Port $port) { Write-Host "port $port : freed (optional)" }
    else { Write-Warning "port $port still held after killing PID $procId (optional, not blocking)" }
  } else {
    Write-Host "port $port : held by $name — not one of: $($allowed -join ', '). leaving as-is (sshd 전환 포트)"
  }
}

Write-Host "All HANES ports are free."
