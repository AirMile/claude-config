# Cancel active Ralph loop

$stateFile = ".claude/ralph-loop.local.md"

if (-not (Test-Path $stateFile)) {
    Write-Host "No active Ralph loop found"
    exit 0
}

# Get iteration count before removing
$content = Get-Content $stateFile -Raw
$iteration = 1
if ($content -match "iteration:\s*(\d+)") {
    $iteration = [int]$matches[1]
}

Remove-Item $stateFile -Force
Write-Host "Cancelled Ralph loop (was at iteration $iteration)"
