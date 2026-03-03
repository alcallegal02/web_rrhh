# Multi-stage build for FastAPI backend (Production)
ARG PYTHON_VERSION=3.13-slim
FROM python:${PYTHON_VERSION} AS builder


WORKDIR /app

# Install system dependencies (as root)
RUN apt-get update && apt-get install -y \
    gcc \
    zlib1g-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user environment in builder
RUN groupadd -r appuser && useradd -r -m -g appuser -u 999 appuser

# Switch to non-root user for pip installation
USER appuser
COPY --chown=appuser:appuser requirements.txt .

# Configure path for user installs
ENV PATH=/home/appuser/.local/bin:$PATH

RUN pip install --upgrade pip && \
    pip install --no-cache-dir --user -r requirements.txt

# Final stage
FROM python:${PYTHON_VERSION}

WORKDIR /app

# Create the same non-root user
RUN groupadd -r appuser && useradd -r -m -g appuser -u 999 appuser

# Install runtime system dependencies for Pillow and others
RUN apt-get update && apt-get install -y \
    zlib1g \
    libjpeg62-turbo \
    && rm -rf /var/lib/apt/lists/*

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

