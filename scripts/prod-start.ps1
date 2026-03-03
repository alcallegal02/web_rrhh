# Start production environment

Write-Host "Starting production environment..." -ForegroundColor Green

# Check if .env.prod exists
if (-not (Test-Path ".env.prod")) {
    Write-Host "ERROR: .env.prod file not found!" -ForegroundColor Red
    Write-Host "Please create .env.prod from .env.prod.example and configure it" -ForegroundColor Yellow
    exit 1
}

# Build frontend first
Write-Host "Building frontend for production..." -ForegroundColor Green
docker compose -f docker-compose.prod.yml --env-file .env.prod build frontend

# Generate nginx config
Write-Host "Generating nginx configuration..." -ForegroundColor Green
powershell -ExecutionPolicy Bypass -File .\scripts\generate-nginx-config.ps1 -EnvFile ".env.prod" -Template "nginx/nginx.conf.prod.template" -Output "nginx/nginx.conf.prod"

# Start services
Write-Host "Starting Docker Compose services..." -ForegroundColor Green
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

Write-Host "Production environment started!" -ForegroundColor Green
Write-Host "Please configure your external proxy to point to this server" -ForegroundColor Cyan

