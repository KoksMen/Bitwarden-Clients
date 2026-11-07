# Stop running processes
Get-Process -Name Bitwarden, AutotypeHelper, bitwarden_plugin_authenticator -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$installDir = "C:\Users\rinsh\AppData\Local\Programs\Bitwarden"
$unpackedDir = Join-Path $PSScriptRoot "..\apps\desktop\dist\win-unpacked"
$helperSource = Join-Path $PSScriptRoot "..\apps\desktop\resources\autotype-helper\AutotypeHelper.exe"

# Ensure app subfolder in win-unpacked exists for AppxManifest relative path
if (!(Test-Path "$unpackedDir\app")) {
    New-Item -ItemType Directory -Path "$unpackedDir\app" -Force | Out-Null
}
Copy-Item "$unpackedDir\*.exe", "$unpackedDir\*.dll", "$unpackedDir\*.pak", "$unpackedDir\*.bin", "$unpackedDir\*.dat" "$unpackedDir\app\" -Force -ErrorAction SilentlyContinue
Copy-Item "$unpackedDir\resources", "$unpackedDir\locales" "$unpackedDir\app\" -Recurse -Force -ErrorAction SilentlyContinue

# Copy everything to installDir
Copy-Item -Path "$unpackedDir\*" -Destination $installDir -Recurse -Force
Copy-Item $helperSource (Join-Path $installDir "resources\AutotypeHelper.exe") -Force -ErrorAction SilentlyContinue
Copy-Item $helperSource (Join-Path $installDir "AutotypeHelper.exe") -Force -ErrorAction SilentlyContinue

# Also ensure installDir\app has the latest binaries
if (!(Test-Path "$installDir\app")) {
    New-Item -ItemType Directory -Path "$installDir\app" -Force | Out-Null
}
Copy-Item "$unpackedDir\*.exe", "$unpackedDir\*.dll", "$unpackedDir\*.pak", "$unpackedDir\*.bin", "$unpackedDir\*.dat" "$installDir\app\" -Force -ErrorAction SilentlyContinue
Copy-Item "$unpackedDir\resources", "$unpackedDir\locales" "$installDir\app\" -Recurse -Force -ErrorAction SilentlyContinue

# Re-register AppxPackage to installDir
$existingPkg = Get-AppxPackage -Name "*bitwardendesktop*"
if ($existingPkg) {
    Remove-AppxPackage $existingPkg.PackageFullName -ErrorAction SilentlyContinue
}
Add-AppxPackage -Register "$installDir\AppxManifest.xml"

Write-Host "Updated successfully! Starting Bitwarden..."
$aumid = "8bitSolutionsLLC.bitwardendesktop_h4e712dmw3xyy!bitwardendesktop"
Start-Process "explorer.exe" "shell:AppsFolder\$aumid"

