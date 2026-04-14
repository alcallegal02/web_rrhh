
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DB_AUTO_MIGRATE: bool = False
    
    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str | None = None
    
    # Security
    SECRET_KEY: str
    ENCRYPTION_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    CORS_ORIGINS: str = "*"
    ALLOWED_HOSTS: str = "*" # Comma separated hosts
    
    # Frontend URL (for emails and redirects)
    FRONTEND_URL: str | None = None

    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 10

    # Admin bootstrap
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None
    ADMIN_FULL_NAME: str = "Admin RRHH"
    ADMIN_ROLE: str = "superadmin"
    ADMIN_AUTO_CREATE: bool = True
    SEED_TEST_DATA: bool = False
    
    # Auth/System SMTP Configuration
    SMTP_AUTH_HOST: str | None = None
    SMTP_AUTH_PORT: int | None = None
    SMTP_AUTH_USER: str | None = None
    SMTP_AUTH_PASS: str | None = None
    SMTP_AUTH_TLS: bool | None = None
    EMAIL_AUTH_FROM_NAME: str | None = None
    EMAIL_AUTH_FROM_ADDRESS: str | None = None

    # News SMTP Configuration
    SMTP_NEWS_HOST: str | None = None
    SMTP_NEWS_PORT: int | None = None
    SMTP_NEWS_USER: str | None = None
    SMTP_NEWS_PASS: str | None = None
    SMTP_NEWS_TLS: bool | None = None
    EMAIL_NEWS_FROM_NAME: str | None = None
    EMAIL_NEWS_FROM_ADDRESS: str | None = None

    # Vacation SMTP Configuration
    SMTP_VACATION_HOST: str | None = None
    SMTP_VACATION_PORT: int | None = None
    SMTP_VACATION_USER: str | None = None
    SMTP_VACATION_PASS: str | None = None
    SMTP_VACATION_TLS: bool | None = None
    EMAIL_VACATION_FROM_NAME: str | None = None
    EMAIL_VACATION_FROM_ADDRESS: str | None = None

    # Complaint SMTP Configuration
    SMTP_COMPLAINT_HOST: str | None = None
    SMTP_COMPLAINT_PORT: int | None = None
    SMTP_COMPLAINT_USER: str | None = None
    SMTP_COMPLAINT_PASS: str | None = None
    SMTP_COMPLAINT_TLS: bool | None = None
    EMAIL_COMPLAINT_FROM_NAME: str | None = None
    EMAIL_COMPLAINT_FROM_ADDRESS: str | None = None
    
    # Brute-force Protection
    BRUTE_FORCE_MAX_ATTEMPTS: int = 3
    BRUTE_FORCE_BLOCK_MINUTES: int = 15
    BRUTE_FORCE_REDIRECT_URL: str = "/"
    
    # File uploads
    UPLOAD_DIR: str = "media_data"
    
    # Upload size limits (in MB, converted to bytes)
    # These defaults are overridden by environment variables (MAX_IMAGE_SIZE_MB, etc.)
    MAX_IMAGE_SIZE_MB: int = 10
    MAX_DOCUMENT_SIZE_MB: int = 50
    MAX_COMPLAINT_PAYLOAD_MB: int = 20
    MAX_NEWS_PAYLOAD_MB: int = 30
    DAILY_UPLOAD_QUOTA_MB: int = 50
    
    ALLOWED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    
    @property
    def MAX_IMAGE_SIZE(self) -> int:
        """Maximum image size in bytes"""
        return self.MAX_IMAGE_SIZE_MB * 1024 * 1024
    
    @property
    def MAX_DOCUMENT_SIZE(self) -> int:
        """Maximum document size in bytes"""
        return self.MAX_DOCUMENT_SIZE_MB * 1024 * 1024
    
    @property
    def MAX_COMPLAINT_PAYLOAD(self) -> int:
        """Maximum total payload size for complaints in bytes"""
        return self.MAX_COMPLAINT_PAYLOAD_MB * 1024 * 1024
    
    @property
    def MAX_NEWS_PAYLOAD(self) -> int:
        """Maximum total payload size for news in bytes"""
        return self.MAX_NEWS_PAYLOAD_MB * 1024 * 1024
    
    @property
    def DAILY_UPLOAD_QUOTA(self) -> int:
        """Daily upload quota per IP in bytes"""
        return self.DAILY_UPLOAD_QUOTA_MB * 1024 * 1024
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        
    @property
    def allowed_hosts_list(self) -> list[str]:
        return [host.strip() for host in self.ALLOWED_HOSTS.split(",")]

    def get_smtp_settings(self, service: str) -> dict:
        """Get the SMTP settings for a specific service. No global fallback."""
        prefix = f"SMTP_{service.upper()}_"
        email_prefix = f"EMAIL_{service.upper()}_"
        
        # If service is 'default' or not provided, use 'auth'
        if service.lower() in ["default", "system"]:
            prefix = "SMTP_AUTH_"
            email_prefix = "EMAIL_AUTH_"

        return {
            "host": getattr(self, f"{prefix}HOST", None),
            "port": getattr(self, f"{prefix}PORT", None),
            "user": getattr(self, f"{prefix}USER", None),
            "password": getattr(self, f"{prefix}PASS", None),
            "tls": getattr(self, f"{prefix}TLS", True),
            "from_name": getattr(self, f"{email_prefix}FROM_NAME", None) or "Web RRHH",
            "from_address": getattr(self, f"{email_prefix}FROM_ADDRESS", None),
        }
    
    model_config = ConfigDict(env_file=".env", case_sensitive=True)


settings = Settings()

