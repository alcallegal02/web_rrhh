# Media Fortress Dockerfile
ARG PYTHON_VERSION=3.14-alpine
FROM python:${PYTHON_VERSION}

WORKDIR /app

# Install system dependencies for Pillow and su-exec
RUN apk add --no-cache \
    gcc \
    musl-dev \
    zlib-dev \
    libjpeg-turbo-dev \
    su-exec \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 mediauser && \
    adduser -u 1001 -G mediauser -s /bin/false -D mediauser

# Copy requirements
COPY requirements.txt .

# Install Python deps
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code and entrypoint
COPY . .
# Convertimos entrypoint a LF y lo movemos fuera de /app para que el volumen no lo sobrescriba
RUN sed -i 's/\r$//' entrypoint.sh && \
    chmod +x entrypoint.sh && \
    cp entrypoint.sh /usr/local/bin/entrypoint.sh

# Expose port 8000
EXPOSE 8000

# Entrypoint gestiona permisos como root y cambia a mediauser antes de ejecutar el CMD
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Comando de producción (sin reload)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
