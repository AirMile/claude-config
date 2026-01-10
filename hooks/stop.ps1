# Ralph Wiggum Stop Hook
# Intercepts exit, checks completion, feeds prompt back if not done

$stateFile = ".claude/ralph-loop.local.md"

# If no ralph loop active, allow exit
if (-not (Test-Path $stateFile)) {
    exit 0
}

# Read state file
$content = Get-Content $stateFile -Raw

# Parse YAML frontmatter
$lines = $content -split "`n"
$inFrontmatter = $false
$iteration = 1
$maxIterations = 50
$completionPromise = "TDD_COMPLETE"
$promptStart = 0

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i].Trim()

    if ($line -eq "---" -and -not $inFrontmatter) {
        $inFrontmatter = $true
        continue
    }

    if ($line -eq "---" -and $inFrontmatter) {
        $promptStart = $i + 1
        break
    }

    if ($inFrontmatter) {
        if ($line -match "^iteration:\s*(\d+)") {
            $iteration = [int]$matches[1]
        }
        if ($line -match "^max_iterations:\s*(\d+)") {
            $maxIterations = [int]$matches[1]
        }
        if ($line -match "^completion_promise:\s*(.+)") {
            $completionPromise = $matches[1].Trim()
        }
    }
}

# Extract prompt (everything after frontmatter)
$prompt = ($lines[$promptStart..($lines.Count-1)] -join "`n").Trim()

# Check if max iterations reached
if ($iteration -ge $maxIterations) {
    Remove-Item $stateFile -Force
    Write-Host "Ralph loop ended: max iterations ($maxIterations) reached"
    exit 0
}

# Check for completion promise in transcript (simplified - check last output)
# In real implementation, would parse transcript JSONL
$transcriptFile = $env:CLAUDE_TRANSCRIPT_FILE
if ($transcriptFile -and (Test-Path $transcriptFile)) {
    $transcriptContent = Get-Content $transcriptFile -Raw
    if ($transcriptContent -match "<promise>$completionPromise</promise>") {
        Remove-Item $stateFile -Force
        Write-Host "Ralph loop completed: promise '$completionPromise' found"
        exit 0
    }
}

# Update iteration count
$newContent = $content -replace "iteration:\s*\d+", "iteration: $($iteration + 1)"
$newContent | Out-File -FilePath $stateFile -Encoding UTF8

# Output JSON to block exit and feed prompt
$output = @{
    decision = "block"
    reason = $prompt
    systemMessage = "[Ralph iteration $($iteration + 1)/$maxIterations]"
} | ConvertTo-Json -Compress

Write-Output $output
exit 1
