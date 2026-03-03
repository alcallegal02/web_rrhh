#!/bin/bash
# Start production environment

set -e

echo "Starting production environment..."

# Check if .env.prod exists
if [ ! -f ".env.prod" ]; then
    echo "ERROR: .env.prod file not found!"
    echo "Please create .env.prod from .env.prod.example and configure it"
    exit 1
fi

# Build frontend first
echo "Building frontend for production..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build frontend

# Generate nginx config
echo "Generating nginx configuration..."
./scripts/generate-nginx-config.sh .env.prod nginx/nginx.conf.prod.template nginx/nginx.conf.prod

# Start services
echo "Starting Docker Compose services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo "Production environment started!"
echo "Please configure your external proxy to point to this server"

