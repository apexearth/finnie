# Makes a "Finnie (dev)" shortcut in your Start Menu that runs scripts/launch.ps1 with no console.
# Windows lets only you pin to the taskbar: find it in Start, right-click, "Pin to taskbar".
# Run again after moving the repo; it overwrites the old shortcut.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$lnk = Join-Path ([Environment]::GetFolderPath('Programs')) 'Finnie (dev).lnk'

$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath = (Get-Command powershell.exe).Source
$s.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\scripts\launch.ps1`""
$s.WorkingDirectory = $root
$s.IconLocation = "$root\src-tauri\icons\icon.ico"
# Minimized, so the moment before PowerShell hides itself shows no console.
$s.WindowStyle = 7
$s.Description = 'Finnie in dev mode (bun run dev), hot-reloading'
$s.Save()
"Created $lnk"
"Pin it: open Start, find 'Finnie (dev)', right-click, Pin to taskbar."
