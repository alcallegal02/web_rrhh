# Guía de Configuración - Web RRHH

## Estructura de Configuración

El proyecto está completamente configurado mediante variables de entorno, sin valores hardcodeados.

### Archivos de Configuración

#### Desarrollo
- `.env.dev` - Variables de entorno para desarrollo (crear desde `.env.dev.example`)
- `docker-compose.dev.yml` - Configuración Docker Compose para desarrollo
- `Dockerfile.dev` - Dockerfiles de desarrollo (backend y frontend)
- `nginx/nginx.conf.dev.template` - Plantilla de configuración Nginx para desarrollo

## Ejecución de la Aplicación

Para iniciar el entorno, simplemente utiliza Docker Compose:

```bash
# Iniciar todo
docker compose up -d

# Detener todo
docker compose down
```

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

