# Arquitectura del Sistema Web RRHH

## Visión General

Sistema Full Stack contenerizado con arquitectura reactiva en tiempo real para gestión de RRHH.

## Stack Tecnológico

### Backend
- **FastAPI** (Python 3.11): Framework asíncrono para APIs
- **SQLModel**: ORM asíncrono basado en SQLAlchemy y Pydantic
- **PostgreSQL 16**: Base de datos relacional
- **WebSockets**: Comunicación bidireccional en tiempo real
- **JWT**: Autenticación basada en tokens
- **Argon2**: Hash seguro de contraseñas

### Frontend
- **Angular 17**: Framework con Standalone Components
- **Signals**: Reactividad nativa de Angular
- **RxJS**: Programación reactiva
- **TailwindCSS**: Estilos (configurado en styles.css)

### Infraestructura
- **Docker & Docker Compose**: Contenedores
- **Nginx**: Reverse proxy y servidor web
- **Multi-stage builds**: Optimización de imágenes

## Arquitectura de Datos

### Flujo de Tiempo Real

```
PostgreSQL Trigger → pg_notify → Backend Listener → WebSocket → Frontend Signal
```

1. **Trigger en DB**: Cuando cambia el estado de una vacación o se publica noticia
2. **pg_notify**: PostgreSQL emite notificación
3. **Backend Listener**: WebSocketManager escucha y procesa
4. **WebSocket**: Distribuye mensaje al cliente correcto
5. **Frontend Signal**: Actualiza UI reactivamente

### Base de Datos

**Tablas principales:**
- `users`: Usuarios con roles (empleado, manager, rrhh)
- `vacation_requests`: Solicitudes de vacaciones con workflow de aprobación
- `user_vacation_balance`: Balance calculado en DB
- `news`: Noticias corporativas
- `complaints`: Denuncias anónimas con código único

**Funciones y Triggers:**
- `update_updated_at_column()`: Actualiza timestamps
- `notify_vacation_status_change()`: Notifica cambios de estado
- `notify_new_news()`: Notifica nuevas noticias
- `calculate_vacation_balance()`: Calcula balance (lógica en DB)
- `deduct_vacation_days()`: Descuenta días al aprobar

## Seguridad

### Autenticación
- JWT con expiración configurable
- OAuth2PasswordBearer para protección de endpoints
- Tokens almacenados en localStorage (frontend)

### Autorización
- Roles: `empleado`, `manager`, `rrhh`
- Guards en frontend y backend
- Endpoints protegidos por rol

### Protección
- Argon2 para hash de contraseñas
- Rate limiting en endpoints públicos (denuncias)
- CORS configurado desde variables de entorno
- HTTPS con certificados SSL
- Protección SQL mediante ORM (SQLModel)

## Módulos de Negocio

### 1. Autenticación
- Login con email/password
- JWT token generation
- Endpoint `/api/auth/me` para usuario actual

### 2. Gestión de Vacaciones
**Workflow:**
1. Empleado crea solicitud → Estado: `pending`
2. Manager aprueba → Estado: `approved_manager`
3. RRHH aprueba → Estado: `approved_rrhh` (se descuentan días)

**Lógica en DB:**
- Cálculo de balance en función `calculate_vacation_balance()`
- Descuento automático mediante trigger `deduct_vacation_days_trigger`

### 3. Noticias Corporativas
- RRHH publica noticias
- Todos los usuarios reciben notificación en tiempo real
- Broadcast a todos los clientes conectados

### 4. Canal de Denuncias
- **Público**: No requiere autenticación
- **Anónimo**: Solo código único (UUID)
- **Rate Limited**: Protección contra spam
- Consulta por código sin autenticación

## Configuración

### Variables de Entorno (.env)

Toda la configuración centralizada:
- Base de datos (credenciales, puerto)
- Backend (secret key, JWT expiration, CORS)
- Frontend (API URL, WebSocket URL)
- Nginx (puertos HTTP/HTTPS)
- Rate limiting

### Nginx

**Funciones:**
- Servir frontend estático
- Reverse proxy a backend (`/api`)
- Proxy WebSocket (`/ws`)
- Redirección HTTP → HTTPS
- Rate limiting por IP

## Optimizaciones

### Frontend "Thin Client"
- **NO** cálculos complejos en frontend
- **NO** validaciones complejas (solo UI básica)
- **SÍ** toda lógica en backend/DB
- Frontend solo muestra datos y envía formularios

### Base de Datos
- Índices en campos frecuentemente consultados
- Funciones almacenadas para cálculos
- Triggers para automatización
- NOTIFY/LISTEN para tiempo real eficiente

### Docker
- Multi-stage builds para reducir tamaño
- Volúmenes para persistencia
- Health checks para dependencias
- Networks aisladas

## Escalabilidad

### Horizontal
- Backend stateless (puede escalar horizontalmente)
- WebSocket manager por instancia (requiere sticky sessions o Redis pub/sub)
- Base de datos puede replicarse

### Vertical
- Optimización de queries
- Índices en DB
- Caching (futuro: Redis)

## Monitoreo y Logs

- Logs de Docker Compose
- Health check endpoint (`/health`)
- Errores en consola del backend
- WebSocket connection status en frontend

## Próximas Mejoras

1. **Redis**: Para WebSocket distribuido
2. **Caching**: Redis para queries frecuentes
3. **Email**: Notificaciones por correo
4. **Tests**: Unitarios y de integración
5. **CI/CD**: Pipeline de despliegue
6. **Monitoring**: Prometheus + Grafana

