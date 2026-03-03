#!/bin/bash
# Start development environment

set -e

echo "Starting development environment..."

# Check if .env.dev exists
if [ ! -f ".env.dev" ]; then
    echo "Creating .env.dev from .env.dev.example..."
    cp .env.dev.example .env.dev
    echo "Please edit .env.dev with your configuration"
    exit 1
fi

# Generate nginx config
echo "Generating nginx configuration..."
./scripts/generate-nginx-config.sh .env.dev nginx/nginx.conf.dev.template nginx/nginx.conf.dev

# Start services
echo "Starting Docker Compose services..."
docker compose -f docker-compose.dev.yml --env-file .env.dev up --build -d

echo "Development environment started!"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost/api/docs"

