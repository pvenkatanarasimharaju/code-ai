# Kill processes listening on the given TCP ports (Windows).
# Usage:
#   .\kill-ports.ps1
#   .\kill-ports.ps1 3000 4200
# From CMD:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\kill-ports.ps1 3000 4200

param(
    [int[]]$Ports = @(3000, 4200)
)

$seen = @{}
foreach ($port in $Ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "Get-NetTCPConnection failed (need admin or older Windows?): $_"
        continue
    }
    foreach ($c in $conns) {
        $procId = $c.OwningProcess
        if (-not $procId) { continue }
        if ($seen.ContainsKey($procId)) { continue }
        $seen[$procId] = $true
        try {
            $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
            $name = if ($p) { $p.ProcessName } else { "?" }
            Write-Host "Port $port : stopping PID $procId ($name)"
            Stop-Process -Id $procId -Force -ErrorAction Stop
        } catch {
            Write-Warning "Could not stop PID ${procId}: $_"
        }
    }
}

if ($seen.Count -eq 0) {
    Write-Host "No LISTENING processes found on ports: $($Ports -join ', ')"
}
