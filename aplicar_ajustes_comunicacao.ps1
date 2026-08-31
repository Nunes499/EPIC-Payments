param(
    [string]$ProjectRoot = "C:\EPIC_Payments"
)

$ErrorActionPreference = "Stop"

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

function Replace-Exact {
    param(
        [string]$Text,
        [string]$Old,
        [string]$New,
        [string]$Label
    )

    $count = ([regex]::Matches($Text, [regex]::Escape($Old))).Count
    if ($count -ne 1) {
        throw "Não foi possível aplicar '$Label'. Esperava 1 ocorrência e encontrei $count. Nenhum ficheiro será gravado."
    }

    return $Text.Replace($Old, $New)
}

function Replace-RegexOnce {
    param(
        [string]$Text,
        [string]$Pattern,
        [string]$Replacement,
        [string]$Label
    )

    $regex = [regex]::new($Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
    $matches = $regex.Matches($Text)
    if ($matches.Count -ne 1) {
        throw "Não foi possível aplicar '$Label'. Esperava 1 ocorrência e encontrei $($matches.Count). Nenhum ficheiro será gravado."
    }

    return $regex.Replace($Text, $Replacement, 1)
}

$communicationPath = Join-Path $ProjectRoot "frontend\src\app\comunicacao\page.tsx"
$processingPath = Join-Path $ProjectRoot "frontend\src\components\calendar\ProcessingWorkspace.tsx"

if (-not (Test-Path $communicationPath)) {
    throw "Não encontrei: $communicationPath"
}
if (-not (Test-Path $processingPath)) {
    throw "Não encontrei: $processingPath"
}

Write-Step "A ler os ficheiros atuais"
$communication = [System.IO.File]::ReadAllText($communicationPath)
$processing = [System.IO.File]::ReadAllText($processingPath)

# Trabalhamos em memória primeiro. Só gravamos no fim, se TODAS as alterações forem encontradas.
$newCommunication = $communication
$newProcessing = $processing

Write-Step "A retirar seleção e ações em massa da Comunicação"

$newCommunication = Replace-Exact $newCommunication @'
  MessageSquareText,
'@ @'
'@ "remover import MessageSquareText"

$newCommunication = Replace-Exact $newCommunication @'
  selected: boolean;
'@ @'
'@ "remover campo selected"

$newCommunication = Replace-Exact $newCommunication @'
    selected: false,
'@ @'
'@ "remover selected inicial"

$newCommunication = Replace-RegexOnce $newCommunication `
    '\r?\n\s*const selectedCount =\s*\r?\n\s*rows\.filter\(\s*\r?\n\s*\(row\) => row\.selected,\s*\r?\n\s*\)\.length;\s*\r?\n' `
    "`r`n" `
    "remover selectedCount"

$newCommunication = Replace-RegexOnce $newCommunication `
    '\r?\n\s*function toggleAll\(\) \{.*?\r?\n\s*\}\s*\r?\n\s*\r?\n\s*async function handleCreateReference' `
    "`r`n`r`n  async function handleCreateReference" `
    "remover toggleAll"

$newCommunication = Replace-Exact $newCommunication @'
                <span style={actionsSubtitleStyle}>
                  Confirme e ajuste os dados
                  antes do envio.
                  {selectedCount > 0
                    ? ` ${selectedCount} selecionado(s).`
                    : ""}
                </span>
'@ @'
                <span style={actionsSubtitleStyle}>
                  Confirme e ajuste os dados
                  antes do envio, um processo de cada vez.
                </span>
'@ "simplificar subtítulo da barra"

$newCommunication = Replace-RegexOnce $newCommunication `
    '\r?\n\s*<div style=\{actionsButtonsStyle\}>.*?</div>\s*\r?\n\s*</section>' `
    "`r`n            </section>" `
    "remover botões em massa"

$newCommunication = Replace-RegexOnce $newCommunication `
    '\r?\n\s*<th style=\{checkboxHeaderStyle\}>.*?</th>\s*\r?\n\s*<TableHeader>' `
    "`r`n                      <TableHeader>" `
    "remover checkbox do cabeçalho"

$newCommunication = Replace-RegexOnce $newCommunication `
    '\r?\n\s*<td style=\{checkboxCellStyle\}>.*?</td>\s*\r?\n\s*<td style=\{cellStyle\}>' `
    "`r`n                            <td style={cellStyle}>" `
    "remover checkbox das linhas"

Write-Step "A compactar a tabela para funcionar melhor a 100% de zoom"

$newCommunication = Replace-Exact $newCommunication @'
  padding: "30px 34px 55px",
'@ @'
  padding: "24px 20px 45px",
'@ "reduzir padding da página"

$newCommunication = Replace-Exact $newCommunication @'
const tableScrollStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: "1530px",
  borderCollapse: "collapse",
};
'@ @'
const tableScrollStyle: CSSProperties = {
  width: "100%",
  overflowX: "hidden",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderCollapse: "collapse",
};
'@ "retirar largura mínima e scroll horizontal"

$newCommunication = Replace-Exact $newCommunication @'
  padding: "12px 9px",
'@ @'
  padding: "11px 5px",
'@ "compactar cabeçalho"

$newCommunication = Replace-Exact $newCommunication @'
  padding: "10px 8px",
'@ @'
  padding: "9px 4px",
'@ "compactar células"

$newCommunication = Replace-Exact $newCommunication @'
                                    width: "82px",
'@ @'
                                    width: "68px",
'@ "compactar nº sócio"

$newCommunication = Replace-Exact $newCommunication @'
                                  minWidth: "185px",
'@ @'
                                  width: "120px",
'@ "compactar nome"

$newCommunication = Replace-Exact $newCommunication @'
                                    width: "48px",
'@ @'
                                    width: "40px",
'@ "compactar idade"

$newCommunication = Replace-Exact $newCommunication @'
                                  width: "120px",
'@ @'
                                  width: "90px",
'@ "compactar telemóvel"

$newCommunication = Replace-Exact $newCommunication @'
                                    width: "73px",
'@ @'
                                    width: "58px",
'@ "compactar valor"

$newCommunication = Replace-Exact $newCommunication @'
                                  width: "75px",
'@ @'
                                  width: "55px",
'@ "compactar entidade"

# Existem dois width 120px originais: telemóvel (já substituído acima) e referência.
$newCommunication = Replace-Exact $newCommunication @'
                                    width: "120px",
'@ @'
                                    width: "90px",
'@ "compactar referência"

$newCommunication = Replace-Exact $newCommunication @'
                                    minWidth: "205px",
'@ @'
                                    width: "110px",
'@ "compactar motivo"

$newCommunication = Replace-Exact $newCommunication @'
const rowActionsStyle: CSSProperties = {
  display: "flex",
  gap: "6px",
};
'@ @'
const rowActionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "5px",
};
'@ "empilhar ações por sócio"

$newCommunication = Replace-Exact $newCommunication @'
  padding: "0 9px",
'@ @'
  padding: "0 6px",
'@ "compactar botões individuais"

$newCommunication = Replace-Exact $newCommunication @'
  fontSize: "9px",
  fontWeight: 800,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const referenceCreatedButtonStyle
'@ @'
  fontSize: "8px",
  fontWeight: 800,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const referenceCreatedButtonStyle
'@ "reduzir texto dos botões"

# Limpeza de estilos que deixam de ser usados.
$newCommunication = Replace-RegexOnce $newCommunication `
    '\r?\nconst actionsButtonsStyle: CSSProperties = \{.*?\};\s*\r?\n\s*const secondaryButtonStyle: CSSProperties = \{.*?\};\s*\r?\n\s*const redButtonStyle: CSSProperties = \{.*?\};\s*\r?\n' `
    "`r`n" `
    "remover estilos de ações em massa"

$newCommunication = Replace-RegexOnce $newCommunication `
    '\r?\nconst checkboxHeaderStyle: CSSProperties = \{.*?\};\s*\r?\n' `
    "`r`n" `
    "remover estilo checkbox cabeçalho"

$newCommunication = Replace-RegexOnce $newCommunication `
    '\r?\nconst checkboxCellStyle: CSSProperties = \{.*?\};\s*\r?\n' `
    "`r`n" `
    "remover estilo checkbox linha"

Write-Step "A alterar o botão Comunicação para abrir uma janela separada"

$oldOpen = @'
    window.location.href =
      `/comunicacao?${params.toString()}`;
'@

$newOpen = @'
    const communicationUrl =
      `/comunicacao?${params.toString()}`;

    const popupWidth = Math.min(
      1180,
      Math.max(
        900,
        window.screen.availWidth - 120,
      ),
    );

    const popupHeight = Math.min(
      780,
      Math.max(
        650,
        window.screen.availHeight - 120,
      ),
    );

    const popupLeft = Math.max(
      20,
      Math.round(
        (window.screen.availWidth - popupWidth) / 2,
      ),
    );

    const popupTop = Math.max(
      20,
      Math.round(
        (window.screen.availHeight - popupHeight) / 2,
      ),
    );

    const communicationWindow =
      window.open(
        communicationUrl,
        `epicCommunication${communicationSourceState.file.id}`,
        [
          "popup=yes",
          `width=${popupWidth}`,
          `height=${popupHeight}`,
          `left=${popupLeft}`,
          `top=${popupTop}`,
          "resizable=yes",
          "scrollbars=yes",
        ].join(","),
      );

    if (communicationWindow) {
      communicationWindow.focus();
      return;
    }

    window.open(
      communicationUrl,
      "_blank",
    );
'@

$newProcessing = Replace-Exact $newProcessing $oldOpen $newOpen "abrir Comunicação em nova janela"

# Só agora gravamos os ficheiros.
Write-Step "A criar cópias de segurança"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$communicationBackup = "$communicationPath.backup-$timestamp"
$processingBackup = "$processingPath.backup-$timestamp"

Copy-Item $communicationPath $communicationBackup
Copy-Item $processingPath $processingBackup

Write-Host "Backup: $communicationBackup" -ForegroundColor DarkGray
Write-Host "Backup: $processingBackup" -ForegroundColor DarkGray

Write-Step "A gravar as alterações"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($communicationPath, $newCommunication, $utf8NoBom)
[System.IO.File]::WriteAllText($processingPath, $newProcessing, $utf8NoBom)

Write-Host ""
Write-Host "ALTERAÇÕES APLICADAS COM SUCESSO." -ForegroundColor Green
Write-Host ""
Write-Host "Foram alterados:" -ForegroundColor White
Write-Host " - $communicationPath"
Write-Host " - $processingPath"
Write-Host ""
Write-Host "Não foi feito git add, commit ou push." -ForegroundColor Yellow
Write-Host "Primeiro vamos testar e confirmar o resultado." -ForegroundColor Yellow
