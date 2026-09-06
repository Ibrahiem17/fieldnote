<#
PowerShell script: cleanup-orphan-attachments.ps1
Purpose: dry-run listing of files under an attachments root and optional prune to delete files.
Usage (dry run):
  .\cleanup-orphan-attachments.ps1 -AttachmentsRoot "C:\path\to\attachments"
To actually delete files (prune):
  .\cleanup-orphan-attachments.ps1 -AttachmentsRoot "C:\path\to\attachments" -Prune

This script is intentionally conservative: it does not attempt to open the app's SQLite DB automatically. Instead it shows files present and lets you remove them manually with -Prune.
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$AttachmentsRoot = "./attachments",

    [switch]$Prune
)

Write-Host "Attachments root: $AttachmentsRoot"
if (-Not (Test-Path $AttachmentsRoot)) {
    Write-Host "Path does not exist: $AttachmentsRoot" -ForegroundColor Red
    exit 1
}

# Find all files under the attachments root
$files = Get-ChildItem -Path $AttachmentsRoot -Recurse -File | Select-Object -ExpandProperty FullName
Write-Host "Found $($files.Count) files under attachments root.`n"

# Heuristic: consider thumbnails under a /thumbs/ subfolder and original files elsewhere
$thumbs = $files | Where-Object { $_ -match "[\\/]thumbs[\\/]" }
$images = $files | Where-Object { $_ -notmatch "[\\/]thumbs[\\/]" }

Write-Host "Thumbnails: $($thumbs.Count)"
Write-Host "Other files: $($images.Count)`n"

Write-Host "Listing up to 100 sample files:`n"
$files | Select-Object -First 100 | ForEach-Object { Write-Host " - $_" }

if ($Prune) {
    Write-Host "\nPRUNE MODE: deleting files..." -ForegroundColor Yellow
    foreach ($f in $files) {
        try {
            Remove-Item -LiteralPath $f -Force
            Write-Host "Deleted: $f" -ForegroundColor Green
        } catch {
            Write-Host "Failed to delete: $f -> $_" -ForegroundColor Red
        }
    }
    Write-Host "Prune complete." -ForegroundColor Cyan
} else {
    Write-Host "\nDry run only. To delete the files listed above, rerun with the -Prune switch.`n" -ForegroundColor Yellow
}

Write-Host "Note: This script does not consult the database. For a DB-aware cleanup, provide an attachments list exported from the app (or run a custom script that queries the attachments table) and compare it to files listed here."