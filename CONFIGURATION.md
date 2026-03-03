# Guía de Configuración - Web RRHH

## Estructura de Configuración

El proyecto está completamente configurado mediante variables de entorno, sin valores hardcodeados.

### Archivos de Configuración

#### Desarrollo
- `.env.dev` - Variables de entorno para desarrollo (crear desde `.env.dev.example`)
- `docker-compose.dev.yml` - Configuración Docker Compose para desarrollo
- `Dockerfile.dev` - Dockerfiles de desarrollo (backend y frontend)
- `nginx/nginx.conf.dev.template` - Plantilla de configuración Nginx para desarrollo

#### Producción
- `.env.prod` - Variables de entorno para producción (crear desde `.env.prod.example`)
- `docker-compose.prod.yml` - Configuración Docker Compose para producción
- `Dockerfile.prod` - Dockerfiles de producción (backend y frontend)
- `nginx/nginx.conf.prod.template` - Plantilla de configuración Nginx para producción

## Variables de Entorno Principales

### Base de Datos
- `POSTGRES_DB` - Nombre de la base de datos
- `POSTGRES_USER` - Usuario de PostgreSQL
- `POSTGRES_PASSWORD` - Contraseña de PostgreSQL
- `POSTGRES_PORT` - Puerto de PostgreSQL
- `POSTGRES_VERSION` - Versión de la imagen PostgreSQL

### Backend
- `SECRET_KEY` - Clave secreta para JWT (mínimo 32 caracteres)
- `ALGORITHM` - Algoritmo JWT (por defecto: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Tiempo de expiración del token
- `CORS_ORIGINS` - Orígenes permitidos para CORS (separados por comas)
- `ENVIRONMENT` - Entorno (development/production)
- `BACKEND_PORT` - Puerto del backend
- `BACKEND_WORKERS` - Número de workers (solo producción)

### Frontend
- `API_URL` - URL de la API
- `WS_URL` - URL del WebSocket
- `FRONTEND_PORT` - Puerto del frontend (desarrollo)
- `NG_SERVE_HOST` - Host del servidor de desarrollo Angular
- `NG_SERVE_PORT` - Puerto del servidor de desarrollo Angular

### Nginx
- `NGINX_VERSION` - Versión de la imagen Nginx
- `HTTP_PORT` - Puerto HTTP
- `NGINX_FRONTEND_HOST` - Host del frontend (desarrollo)
- `NGINX_FRONTEND_PORT` - Puerto del frontend (desarrollo)
- `NGINX_BACKEND_HOST` - Host del backend
- `NGINX_BACKEND_PORT` - Puerto del backend

### Admin User Configuration
- `ADMIN_EMAIL` - Email del usuario administrador
- `ADMIN_PASSWORD` - Contraseña del usuario administrador
- `ADMIN_FULL_NAME` - Nombre completo del administrador
- `ADMIN_ROLE` - Rol del administrador (por defecto: rrhh)

### Docker Compose
- `COMPOSE_PROJECT_NAME` - Nombre del proyecto Docker Compose
- `NETWORK_NAME` - Nombre de la red Docker
- `RESTART_POLICY` - Política de reinicio (no/unless-stopped/always)

## Generación de Configuración Nginx

Los archivos de configuración de Nginx se generan automáticamente desde plantillas usando las variables de entorno.

### Desarrollo
```bash
# Windows
.\scripts\generate-nginx-config.ps1 -EnvFile ".env.dev" -Template "nginx/nginx.conf.dev.template" -Output "nginx/nginx.conf.dev"

# Linux/Mac
./scripts/generate-nginx-config.sh .env.dev nginx/nginx.conf.dev.template nginx/nginx.conf.dev
```

### Producción
```bash
# Windows
.\scripts\generate-nginx-config.ps1 -EnvFile ".env.prod" -Template "nginx/nginx.conf.prod.template" -Output "nginx/nginx.conf.prod"

# Linux/Mac
./scripts/generate-nginx-config.sh .env.prod nginx/nginx.conf.prod.template nginx/nginx.conf.prod
```

## Scripts de Inicio

### Desarrollo
```bash
# Windows
.\scripts\dev-start.ps1

# Linux/Mac
./scripts/dev-start.sh
```

Este script:
1. Verifica que existe `.env.dev`
2. Genera la configuración de Nginx
3. Inicia los servicios con Docker Compose

### Producción
```bash
# Windows
.\scripts\prod-start.ps1

# Linux/Mac
./scripts/prod-start.sh
```

Este script:
1. Verifica que existe `.env.prod`
2. Compila el frontend para producción
3. Genera la configuración de Nginx
4. Inicia los servicios con Docker Compose

## Personalización

### Cambiar Versiones
Edita las variables en `.env.dev` o `.env.prod`:
```bash
PYTHON_VERSION=3.11-slim
NODE_VERSION=20-alpine
POSTGRES_VERSION=16-alpine
NGINX_VERSION=alpine
```

### Cambiar Puertos
```bash
POSTGRES_PORT=5432
BACKEND_PORT=8000
FRONTEND_PORT=4200
HTTP_PORT=80
```

### Cambiar Nombres de Contenedores
```bash
COMPOSE_PROJECT_NAME=web_rrhh
```

### Configurar CORS
```bash
# Desarrollo
CORS_ORIGINS=http://localhost,https://localhost,http://localhost:4200

# Producción
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Configurar Usuario Administrador
```bash
# Desarrollo (.env.dev)
ADMIN_EMAIL=admin@rrhh.com
ADMIN_PASSWORD=admin123
ADMIN_FULL_NAME=Admin RRHH
ADMIN_ROLE=rrhh

# Producción (.env.prod) - IMPORTANTE: Cambiar contraseña
ADMIN_EMAIL=admin@rrhh.com
ADMIN_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD
ADMIN_FULL_NAME=Admin RRHH
ADMIN_ROLE=rrhh
```

## Mejores Prácticas

1. **Nunca commitees archivos `.env`** - Están en `.gitignore`
2. **Usa contraseñas fuertes en producción** - Cambia todas las contraseñas por defecto
3. **Revisa las variables antes de desplegar** - Especialmente `SECRET_KEY` y contraseñas
4. **Usa diferentes valores para dev y prod** - No compartas credenciales entre entornos
5. **Documenta cambios en variables** - Si agregas nuevas variables, actualiza los `.example`

