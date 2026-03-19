# Media Fortress Dockerfile
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies for Pillow and su-exec
RUN apt-get update && apt-get install -y \
    gcc \
    zlib1g \
    zlib1g-dev \
    libjpeg62-turbo \
    libjpeg-dev \
    su-exec \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 mediauser && \
    useradd -u 1001 -g mediauser -m -s /bin/false -l mediauser

# Copy requirements
COPY requirements.txt .

# Install Python deps
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code and entrypoint
COPY . .
RUN chmod +x entrypoint.sh

# Expose port 8000
EXPOSE 8000

# Entrypoint gestiona permisos como root y cambia a mediauser antes de ejecutar el CMD
ENTRYPOINT ["./entrypoint.sh"]

# Comando de producción (sin reload)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
