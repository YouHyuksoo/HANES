# =============================================================================
# kill-dev.ps1  —  HANES dev 프로세스 트리 정리 (Windows)
#
# 배경:
#   Windows는 Ctrl+C(SIGINT)를 자식 프로세스 트리에 전파하지 않는다.
#   pnpm dev → turbo dev → (next dev / nest start --watch / tsc --watch) 트리에서
#   부모만 죽고 자식 node 워커가 좀비로 남아, 옛 청크 매니페스트를 계속 서빙한다.
#   → "새 chunk를 인식하지 못함 / ChunkLoadError"의 원인.
#
# 전략:
#   1) HANES 경로 + dev 명령을 가진 node 워커를 '시드'로 찾는다.
#      (turbo / next dev / nest start --watch / tsc --watch)
#   2) 각 시드에서 부모 체인을 거슬러 올라가, 여전히 dev 트리(node + turbo|pnpm dev)인
#      조상을 모두 수집한다. → pnpm dev 루트와 pnpm run dev 중간 노드까지 포함.
#   3) 수집한 PID를 taskkill /T(자식까지) /F(강제)로 트리째 종료한다.
#   chrome-devtools MCP 등 무관한 node, 터미널/셸은 절대 건드리지 않는다.
# =============================================================================

$ErrorActionPreference = 'SilentlyContinue'

# node 와 cmd(=pnpm/turbo의 spawn shim) 를 함께 조회해 부모 추적에 재사용
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'"
$all = @{}
foreach ($n in $procs) { $all[[int]$n.ProcessId] = $n }

# 'dev 트리에 속한 node'인지 판정 (터미널/셸/무관 node에서 멈추기 위함)
function Test-DevNode($proc) {
  return $proc -and $proc.Name -eq 'node.exe' -and
         $proc.CommandLine -match '\bdev\b' -and
         $proc.CommandLine -match 'turbo|pnpm\.js|next|nest|tsc'
}

# 1) 시드: HANES 경로 + dev 관련 명령
$seeds = $procs | Where-Object {
  $_.Name -eq 'node.exe' -and
  $_.CommandLine -match 'C:\\Project\\HANES' -and
  $_.CommandLine -match 'turbo|next.*dev|nest.*start|tsc.*--watch|pnpm\.js.*\bdev\b'
}

# 2) 각 시드에서 부모 체인 상향 추적.
#    node→cmd(shim)→node 구조이므로 cmd 한 단계는 '그 위가 dev node일 때만' 통과한다.
#    터미널 cmd(위가 dev node 아님)에서 멈춰 셸/터미널을 보호한다.
$killPids = @{}
foreach ($s in $seeds) {
  $killPids[[int]$s.ProcessId] = $true
  $cur = [int]$s.ProcessId
  for ($i = 0; $i -lt 16; $i++) {
    $proc = $all[$cur]
    if (-not $proc) { break }
    $parent = $all[[int]$proc.ParentProcessId]
    if (-not $parent) { break }

    if (Test-DevNode $parent) {
      $killPids[[int]$parent.ProcessId] = $true
      $cur = [int]$parent.ProcessId
      continue
    }
    if ($parent.Name -eq 'cmd.exe') {
      $grand = $all[[int]$parent.ParentProcessId]
      if (Test-DevNode $grand) {
        $killPids[[int]$parent.ProcessId] = $true   # shim cmd
        $killPids[[int]$grand.ProcessId] = $true     # 그 위 dev node(루트 방향)
        $cur = [int]$grand.ProcessId
        continue
      }
    }
    break
  }
}

if ($killPids.Count -eq 0) {
  Write-Host "[kill-dev] 정리할 HANES dev 프로세스가 없습니다."
} else {
  foreach ($p in $killPids.Keys) {
    Write-Host "[kill-dev] terminating tree PID=$p"
    # 상위를 /T로 죽이면 하위 PID가 먼저 사라져 이후 호출이 실패할 수 있다 → 에러 무시
    taskkill /PID $p /T /F 2>$null | Out-Null
  }
}

# 3) 보조: 포트 3002(frontend) / 3003(backend)에 남은 LISTEN 워커까지 정리
foreach ($port in 3002, 3003) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { taskkill /PID $_ /T /F 2>$null | Out-Null }
}

Write-Host "[kill-dev] done."
