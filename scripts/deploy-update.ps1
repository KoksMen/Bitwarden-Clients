# Stop running processes
Get-Process -Name Bitwarden, AutotypeHelper -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$installDir = "C:\Users\rinsh\AppData\Local\Programs\Bitwarden"
$unpackedDir = Join-Path $PSScriptRoot "..\apps\desktop\dist\win-unpacked"
$helperSource = Join-Path $PSScriptRoot "..\apps\desktop\resources\autotype-helper\AutotypeHelper.exe"

Copy-Item -Path "$unpackedDir\*" -Destination $installDir -Recurse -Force
Copy-Item $helperSource (Join-Path $installDir "resources\AutotypeHelper.exe") -Force -ErrorAction SilentlyContinue
Copy-Item $helperSource (Join-Path $installDir "AutotypeHelper.exe") -Force -ErrorAction SilentlyContinue

Write-Host "Updated successfully! Starting Bitwarden..."
Start-Process (Join-Path $installDir "Bitwarden.exe")

