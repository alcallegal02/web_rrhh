#!/bin/bash
# Generate nginx config from template using environment variables

ENV_FILE=${1:-.env.dev}
TEMPLATE=${2:-nginx/nginx.conf.dev.template}
OUTPUT=${3:-nginx/nginx.conf.dev}

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file $ENV_FILE not found"
    exit 1
fi

if [ ! -f "$TEMPLATE" ]; then
    echo "Error: Template file $TEMPLATE not found"
    exit 1
fi

# Export variables from .env file
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Generate config using envsubst
envsubst '${NGINX_FRONTEND_HOST} ${NGINX_FRONTEND_PORT} ${NGINX_BACKEND_HOST} ${NGINX_BACKEND_PORT}' < "$TEMPLATE" > "$OUTPUT"

echo "Generated $OUTPUT from $TEMPLATE using $ENV_FILE"

