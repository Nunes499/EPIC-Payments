$ErrorActionPreference = "Stop"

$path = "C:\EPIC_Payments\frontend\src\components\calendar\AnnualCalendar.tsx"

if (-not (Test-Path $path)) {
    throw "Não encontrei: $path"
}

$backup = "$path.backup-ficheiros-do-dia"
Copy-Item $path $backup -Force

$content = Get-Content $path -Raw -Encoding UTF8

$pattern = '(?s)<div className="annual-calendar-actions">.*?</div>\s*</div>\s*<div className="annual-calendar-grid">'

$replacement = @'
<button
            type="button"
            className="files-of-day-card"
            onClick={openCurrentDay}
          >
            <span
              className="files-of-day-watermark files-of-day-watermark-calendar"
              aria-hidden="true"
            >
              ▦
            </span>

            <span
              className="files-of-day-watermark files-of-day-watermark-plus"
              aria-hidden="true"
            >
              +
            </span>

            <span className="files-of-day-content">
              <span className="files-of-day-eyebrow">
                Acesso rápido
              </span>

              <strong>
                Ficheiros do dia
              </strong>

              <small>
                Abrir o dia de hoje e adicionar ficheiros
              </small>
            </span>
          </button>
        </div>

        <div className="annual-calendar-grid">
'@

$newContent = [regex]::Replace(
    $content,
    $pattern,
    $replacement,
    1
)

if ($newContent -eq $content) {
    throw "Não encontrei o bloco annual-calendar-actions. O ficheiro ficou intacto. Backup: $backup"
}

Set-Content -Path $path -Value $newContent -Encoding UTF8

Write-Host ""
Write-Host "OK - AnnualCalendar.tsx atualizado." -ForegroundColor Green
Write-Host "Backup criado em:" -ForegroundColor Yellow
Write-Host $backup
Write-Host ""
Write-Host "Agora execute: npx tsc --noEmit" -ForegroundColor Cyan
