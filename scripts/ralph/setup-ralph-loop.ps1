# Setup Ralph Loop for TDD
# Usage: setup-ralph-loop.ps1 -Prompt "task" -MaxIterations 30 -CompletionPromise "TDD_COMPLETE"

param(
    [Parameter(Mandatory=$true)]
    [string]$Prompt,

    [int]$MaxIterations = 50,

    [string]$CompletionPromise = "TDD_COMPLETE"
)

$stateFile = ".claude/ralph-loop.local.md"

# Create state file with YAML frontmatter
$content = @"
---
iteration: 1
max_iterations: $MaxIterations
completion_promise: $CompletionPromise
created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
---

$Prompt
"@

# Ensure .claude directory exists
if (-not (Test-Path ".claude")) {
    New-Item -ItemType Directory -Path ".claude" -Force | Out-Null
}

# Write state file
$content | Out-File -FilePath $stateFile -Encoding UTF8

Write-Host "Ralph loop started"
Write-Host "Max iterations: $MaxIterations"
Write-Host "Completion promise: $CompletionPromise"
Write-Host "State file: $stateFile"
