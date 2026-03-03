# Multi-stage build for Angular frontend (Production)
ARG NODE_VERSION=22-alpine
ARG NGINX_VERSION=alpine

# Build stage
FROM node:${NODE_VERSION} AS builder

# Upgrade npm to latest to avoid version notice
RUN npm install -g npm@latest

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Install dependencies ignoring peer dep conflicts and lockfile mismatch
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build -- --configuration production

# Production stage with nginx
FROM nginxinc/nginx-unprivileged:alpine3.22-perl

# Copy built app from builder
COPY --from=builder --chown=nginx:nginx /app/dist/web-rrhh/browser /usr/share/nginx/html
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

COPY --chown=nginx:nginx nginx.global.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 8080

CMD ["/bin/sh", "-c", "ln -sf /dev/stdout /tmp/access.log && ln -sf /dev/stderr /tmp/error.log && nginx -g 'daemon off;'"]

