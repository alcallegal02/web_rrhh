ARG PYTHON_VERSION=3.14-alpine
FROM python:${PYTHON_VERSION} AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    musl-dev \
    zlib-dev \
    libjpeg-turbo-dev \
    postgresql-dev

# Create a non-root user env in builder
RUN addgroup -S appuser && adduser -S -G appuser -u 999 appuser

USER appuser
COPY --chown=appuser:appuser requirements.txt .

ENV PATH=/home/appuser/.local/bin:$PATH

RUN pip install --upgrade pip && \
    pip install --no-cache-dir --user -r requirements.txt

# Final stage
FROM python:${PYTHON_VERSION}

WORKDIR /app

# Create the same non-root user
RUN addgroup -S appuser && adduser -S -G appuser -u 999 appuser

# Install runtime system dependencies
RUN apk add --no-cache \
    zlib \
    libjpeg-turbo \
    libpq \
    libmagic

# Copy installed packages from builder (already owned by appuser)
COPY --from=builder --chown=appuser:appuser /home/appuser/.local /home/appuser/.local

# Configure path
ENV PATH=/home/appuser/.local/bin:$PATH

# Copy application code and set ownership
COPY --chown=appuser:appuser . .

# Expose port
EXPOSE 8000

# Switch to non-root user
USER appuser

# Run the application (command will be overridden by docker-compose)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

