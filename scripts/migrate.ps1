# Helper script to run migrations
# Usage: ./migrate.ps1 [message]

param (
    [string]$Message = "Auto-generated migration"
)

Write-Host "Running Alembic Migration..." -ForegroundColor Green

# 1. Generate Migration with Message
docker compose -f docker-compose.dev.yml exec backend python -m alembic revision --autogenerate -m "$Message"

# 2. Apply Migration
if ($?) {
    Write-Host "Applying Migration..." -ForegroundColor Cyan
    docker compose -f docker-compose.dev.yml exec backend python -m alembic upgrade head
    Write-Host "Migration Applied Successfully!" -ForegroundColor Green
} else {
    Write-Host "Migration Generation Failed!" -ForegroundColor Red
}
