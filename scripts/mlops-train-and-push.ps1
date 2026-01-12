param(
    [switch]$SkipTrain
)

# Chemin du projet racine (dossier parent de 'scripts')
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

$envFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERREUR] Fichier .env introuvable à $envFile. Copie d'abord .env.example vers .env et renseigne tes clés." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Chargement des variables depuis .env..." -ForegroundColor Cyan
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^[#\s]') { return }
    if ($_ -notmatch '=') { return }
    $parts = $_ -split '=', 2
    $name = $parts[0]
    $value = $parts[1]
    if (-not [string]::IsNullOrWhiteSpace($name)) {
        Set-Item -Path "Env:$name" -Value $value
    }
}

if (-not $SkipTrain) {
    Write-Host "[INFO] Exécution du pipeline DVC (dvc repro)..." -ForegroundColor Cyan
    dvc repro
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERREUR] dvc repro a échoué." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "[INFO] Envoi des données et modèles vers le remote DVC (dvc push)..." -ForegroundColor Cyan
dvc push
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] dvc push a échoué." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "[SUCCÈS] Pipeline exécuté et artefacts poussés vers MinIO." -ForegroundColor Green
