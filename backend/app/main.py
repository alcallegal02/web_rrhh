import logging

# Configure logging FIRST
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.database import init_db
from app.routers import (
    audit,
    auth,
    complaint,
    config,
    convenio,
    holiday,
    leave_types,
    news,
    orgchart,
    policies,
    upload,
    users,
    vacation,
    websocket,
)
from app.utils.brute_force import security_manager
from app.websocket.manager import websocket_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    logger.info("Starting up Web RRHH API...")
    # Startup
    await init_db()
    await websocket_manager.start_listening()
    yield
    # Shutdown
    logger.info("Shutting down Web RRHH API...")
    await websocket_manager.stop_listening()


app = FastAPI(
    title="Web RRHH API",
    description="Sistema de Gestión de Recursos Humanos",
    version="1.0.0",
    lifespan=lifespan
)

# Rate limiting
redis_url = f"redis://:{settings.REDIS_PASSWORD}@{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
limiter = Limiter(key_func=get_remote_address, storage_uri=redis_url)
app.state.limiter = limiter

async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=429,
        content={"detail": "Demasiados intentos. Por favor, espera un minuto antes de volver a intentarlo."}
    )

app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Validation Error at {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


# Security Headers Middleware
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Trusted Host Middleware (Layer 1 Security)
from fastapi.middleware.trustedhost import TrustedHostMiddleware

valid_hosts = [h for h in settings.allowed_hosts_list if h and h != "*"]
if valid_hosts:
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=valid_hosts
    )


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Brute-force block middleware
@app.middleware("http")
async def check_ip_block(request: Request, call_next):
    # Only check complaint routes
    if request.url.path.startswith("/api/complaint"):
        client_ip = request.client.host
        # Potential check for X-Forwarded-For if behind proxy
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0]

        is_blocked, minutes = security_manager.is_blocked(client_ip)
        if is_blocked:
            logger.info(f"Middleware BLOCKING IP {client_ip} for {minutes} more minutes.")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "detail": f"Acceso bloqueado temporalmente por seguridad. Por favor, reintente en {minutes} minutos.",
                    "is_blocked": True,
                    "retry_after": minutes
                }
            )
    
    return await call_next(request)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(vacation.router, prefix="/api/vacation", tags=["vacation"])
app.include_router(news.router, prefix="/api/news", tags=["news"])
app.include_router(complaint.router, prefix="/api/complaint", tags=["complaint"])
app.include_router(holiday.router, prefix="/api/holidays", tags=["holiday"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(convenio.router, prefix="/api", tags=["convenio"])
app.include_router(orgchart.router, prefix="/api", tags=["orgchart"])
app.include_router(leave_types.router, prefix="/api", tags=["leave-types"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(policies.router) # Prefix defined in router itself
app.include_router(websocket.router, tags=["websocket"])


@app.get("/")
async def root():
    return {"message": "Web RRHH API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}

