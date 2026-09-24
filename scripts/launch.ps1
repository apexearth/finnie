# Opens Finnie in dev mode (`bun run dev`: the native window, hot-reloading) with no console,
# for the Start Menu / taskbar shortcut that `bun run shortcut` makes. Output goes to dev.log at
# the repo root. If Finnie is already open, its window is brought forward instead.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$open = Get-Process finnie -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($open) {
  (New-Object -ComObject WScript.Shell).AppActivate($open.Id) | Out-Null
  exit
}

# A shortcut starts with Explorer's environment, which may predate bun's install; look in its
# default home too.
$bun = (Get-Command bun -ErrorAction SilentlyContinue).Source
if (-not $bun) { $bun = Join-Path $HOME '.bun\bin\bun.exe' }

Set-Location $root
# cmd does the redirect: Windows PowerShell would wrap every stderr line (tauri's progress goes
# there) in an error record, stop on the first under 'Stop', and write the log as UTF-16.
# Runs until the window is closed, which ends tauri dev and its Vite server with it.
cmd /c "`"$bun`" run dev > dev.log 2>&1"
