# Start development environment

Write-Host "Starting development environment..." -ForegroundColor Green

# Check if .env.dev exists
if (-not (Test-Path ".env.dev")) {
    Write-Host "Creating .env.dev from .env.dev.example..." -ForegroundColor Yellow
    Copy-Item .env.dev.example .env.dev
    Write-Host "Please edit .env.dev with your configuration" -ForegroundColor Yellow
    exit 1
}

# Generate nginx config
Write-Host "Generating nginx configuration..." -ForegroundColor Green
powershell -ExecutionPolicy Bypass -File .\scripts\generate-nginx-config.ps1 -EnvFile ".env.dev" -Template "nginx/nginx.conf.dev.template" -Output "nginx/nginx.conf.dev"

# Start services
Write-Host "Starting Docker Compose services..." -ForegroundColor Green
docker compose -f docker-compose.dev.yml --env-file .env.dev up --build -d

Write-Host "Development environment started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost" -ForegroundColor Cyan
Write-Host "Backend API: http://localhost/api/docs" -ForegroundColor Cyan

