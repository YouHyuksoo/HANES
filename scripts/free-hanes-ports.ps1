# =============================================================================
# free-hanes-ports.ps1  —  HANES 서비스 포트(3002/3003/443) 점유 프로세스 정리
#
# 배경:
#   pm2 delete 는 PM2 등록만 지운다. Windows 에서 PM2 가 띄운 자식 프로세스 트리는
#   그대로 남아 포트를 계속 물고 있다. 그 상태로 pm2 start 하면 새 프로세스가
#   EADDRINUSE 로 즉시 죽고 restart 카운트만 오르며, 좀비가 계속 포트를 잡는다.
#   결과: TCP 연결은 되는데 HTTP 응답이 없는 장애.
#   (2026-09-11 hswbs 배포 후 실제 발생. frontend restart 3, proxy restart 4, 둘 다 0b)
#
# 전략:
#   포트를 기준으로만 종료한다. 같은 서버의 다른 프로젝트를 건드리지 않기 위해
#   기대한 실행 파일(node / caddy)일 때만 트리 종료하고, 그 외 프로세스가 잡고 있으면
#   죽이지 않고 실패시켜 원인을 드러낸다.
#
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/free-hanes-ports.ps1
# =============================================================================

[CmdletBinding()]
param(
  # 포트별로 종료를 허용할 실행 파일 이름. 여기 없는 프로세스가 잡고 있으면 종료하지 않는다.
  [hashtable]$PortOwners = @{ 3002 = @('node'); 3003 = @('node'); 443 = @('caddy') }
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

Write-Host "All HANES ports are free."
