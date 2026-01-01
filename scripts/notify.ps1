# Windows Balloon Notification Script
# Usage: powershell -ExecutionPolicy Bypass -File notify.ps1 [-Title "title"] [-Message "message"]

param(
    [string]$Title = "Claude Code",
    [string]$Message = "Done"
)

Add-Type -AssemblyName System.Windows.Forms

$notification = New-Object System.Windows.Forms.NotifyIcon
$notification.Icon = [System.Drawing.SystemIcons]::Information
$notification.Visible = $true
$notification.ShowBalloonTip(5000, $Title, $Message, 'Info')

# Clean up after a short delay
Start-Sleep -Milliseconds 100
