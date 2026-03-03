# Script para crear el usuario administrador inicial desde variables de entorno
param(
    [string]$EnvFile = ".env.dev"
)

Write-Host "Creando usuario administrador desde variables de entorno..." -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path $EnvFile)) {
    Write-Host "Error: $EnvFile no encontrado" -ForegroundColor Red
    Write-Host "Por favor, crea el archivo desde .env.dev.example o .env.prod.example" -ForegroundColor Yellow
    exit 1
}

# Read all environment variables from .env file
$envVars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Check required variables
$requiredVars = @("ADMIN_EMAIL", "ADMIN_PASSWORD", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB")
$missingVars = @()
foreach ($var in $requiredVars) {
    if (-not $envVars.ContainsKey($var) -or [string]::IsNullOrWhiteSpace($envVars[$var])) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "Error: Faltan las siguientes variables de entorno:" -ForegroundColor Red
    $missingVars | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host "Por favor, configura estas variables en $EnvFile" -ForegroundColor Yellow
    exit 1
}

# Build DATABASE_URL
$dbUser = $envVars["POSTGRES_USER"]
$dbPassword = $envVars["POSTGRES_PASSWORD"]
$dbName = $envVars["POSTGRES_DB"]
$dbHost = if ($envVars.ContainsKey("POSTGRES_HOST")) { $envVars["POSTGRES_HOST"] } else { "postgres" }
$dbPort = if ($envVars.ContainsKey("POSTGRES_PORT")) { $envVars["POSTGRES_PORT"] } else { "5432" }

$databaseUrl = "postgresql+asyncpg://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}"

# Get container name
$projectName = if ($envVars.ContainsKey("COMPOSE_PROJECT_NAME")) { $envVars["COMPOSE_PROJECT_NAME"] } else { "web_rrhh" }
$containerName = "${projectName}_backend_dev"

# Set environment variables for Python script
$env:ADMIN_EMAIL = $envVars["ADMIN_EMAIL"]
$env:ADMIN_PASSWORD = $envVars["ADMIN_PASSWORD"]
$env:ADMIN_FULL_NAME = if ($envVars.ContainsKey("ADMIN_FULL_NAME")) { $envVars["ADMIN_FULL_NAME"] } else { "Admin RRHH" }
$env:ADMIN_ROLE = if ($envVars.ContainsKey("ADMIN_ROLE")) { $envVars["ADMIN_ROLE"] } else { "rrhh" }
$env:DATABASE_URL = $databaseUrl

# Run Python script in backend container or locally
Write-Host "Ejecutando script de creación de usuario..." -ForegroundColor Green

if (docker ps --format '{{.Names}}' | Select-String -Pattern $containerName) {
    Write-Host "Ejecutando en contenedor $containerName..." -ForegroundColor Cyan
    docker exec -e ADMIN_EMAIL=$env:ADMIN_EMAIL `
                -e ADMIN_PASSWORD=$env:ADMIN_PASSWORD `
                -e ADMIN_FULL_NAME=$env:ADMIN_FULL_NAME `
                -e ADMIN_ROLE=$env:ADMIN_ROLE `
                -e DATABASE_URL=$env:DATABASE_URL `
                $containerName python scripts/create-admin-user.py
} else {
    Write-Host "Contenedor no encontrado. Ejecutando localmente..." -ForegroundColor Yellow
    Write-Host "Asegúrate de tener Python 3.11+ y las dependencias instaladas" -ForegroundColor Yellow
    python scripts/create-admin-user.py
}

