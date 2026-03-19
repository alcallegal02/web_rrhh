
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
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    CORS_ORIGINS: str = "http://localhost,https://localhost"
    ALLOWED_HOSTS: str = "*" # Comma separated hosts

    
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
    
    # SMTP Configuration
    SMTP_HOST: str | None = None
    SMTP_PORT: int | None = None
    SMTP_USER: str | None = None
    SMTP_PASS: str | None = None
    SMTP_TLS: bool = True
    EMAIL_FROM_NAME: str | None = None
    EMAIL_FROM_ADDRESS: str | None = None
    
    # Brute-force Protection
    BRUTE_FORCE_MAX_ATTEMPTS: int = 3
    BRUTE_FORCE_BLOCK_MINUTES: int = 15
    BRUTE_FORCE_REDIRECT_URL: str = "https://www.inespasa.com/"
    
    # File uploads
    UPLOAD_DIR: str = "media_data"
    
    # Upload size limits (in MB, converted to bytes)
    # These defaults are overridden by environment variables (MAX_IMAGE_SIZE_MB, etc.)
    MAX_IMAGE_SIZE_MB: int = 10
    MAX_DOCUMENT_SIZE_MB: int = 10
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
    
    model_config = ConfigDict(env_file=".env", case_sensitive=True)


settings = Settings()

