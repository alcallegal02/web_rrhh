from sqlmodel import SQLModel, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import asyncpg
from typing import AsyncGenerator
import logging
logger = logging.getLogger(__name__)

from app.config import settings
from app.models.user import User
from app.models.vacation import VacationRequest, VacationAttachment
from app.models.leave_type import LeaveType

from app.models.complaint import Complaint, ComplaintAttachment
from app.models.convenio import ConvenioConfig
# Import AuditLog and UploadQuota - ensuring they are imported to register with SQLModel
# Note: If recursion errors occur, we might need to be careful with import order,
# but create_all usually handles registry if imports are done.
from app.models.audit import AuditLog
from app.models.upload import UploadQuota
from app.models.news import News, NewsAttachment
from app.models.organization import Department, Position
from app.models.holiday import Holiday
from app.models.policy import PermissionPolicy
# Ensure all models are imported so SQLModel.metadata.create_all works
from app.services.auth import get_password_hash
from sqlalchemy import text

# Async engine for SQLModel
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False, # echo=settings.ENVIRONMENT == "development", # Disabled to reduce noise per user request
    future=True
)

# Async session factory
AsyncSessionLocal = sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


import asyncio

async def init_db():
    """Initialize database tables and ensure admin user exists if enabled"""
    
    # 1. Wait for Database Connection
    max_retries = 10
    retry_delay = 2
    
    for i in range(max_retries):
        try:
            logger.info(f"Checking database connection (attempt {i+1}/{max_retries})...")
            # Create a dedicated connection for checking
            async with async_engine.connect() as conn:
                await conn.execute(select(1))
            logger.info("Database connection established.")
            break
        except Exception as e:
            if i == max_retries - 1:
                logger.error(f"Failed to connect to database after {max_retries} attempts: {e}")
                raise e
            logger.warning(f"Database connection failed, retrying in {retry_delay}s... Error: {e}")
            await asyncio.sleep(retry_delay)

    # 2. Create tables directly using SQLModel (No Migrations)
    try:
        logger.info("Creating database tables (direct creation)...")
        async with async_engine.begin() as conn:
            # Acquire an advisory lock to prevent race conditions when multiple workers start
            # 123456789 is an arbitrary 64-bit integer specific to this app's init
            await conn.execute(text("SELECT pg_advisory_xact_lock(123456789)"))
            
            # Create extensions first
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pg_trgm"'))
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"'))
            
            # Create all tables found in SQLModel.metadata (Only in Dev or if explicitly enabled)
            if settings.ENVIRONMENT == "development" or settings.DB_AUTO_MIGRATE:
                 await conn.run_sync(SQLModel.metadata.create_all)

            # --- REAL-TIME NOTIFICATIONS SETUP ---
            # 1. Generic Function
            await conn.execute(text("""
                CREATE OR REPLACE FUNCTION notify_event() RETURNS TRIGGER AS $$
                DECLARE
                    data json;
                    notification json;
                BEGIN
                    -- Convert row to JSON
                    IF (TG_OP = 'DELETE') THEN
                        data = row_to_json(OLD);
                    ELSE
                        data = row_to_json(NEW);
                    END IF;

                    -- Construct payload
                    notification = json_build_object(
                        'table', TG_TABLE_NAME,
                        'action', TG_OP,
                        'id', data->>'id'
                    );

                    -- Perform Notification
                    PERFORM pg_notify(TG_TABLE_NAME, notification::text);
                    
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;
            """))

            # 2. Apply Triggers to Core Tables
            # We use DO block to check strict existence before creating to avoid errors or duplication
            # (Postgres doesn't have CREATE TRIGGER IF NOT EXISTS in all versions, simple check is safer)
            tables = ["users", "vacation_requests", "news", "complaints", "holidays"]
            for table in tables:
                 await conn.execute(text(f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '{table}_notify_event') THEN
                            CREATE TRIGGER {table}_notify_event
                            AFTER INSERT OR UPDATE OR DELETE ON {table}
                            FOR EACH ROW EXECUTE PROCEDURE notify_event();
                        END IF;
                    END
                    $$;
                 """))
            
        logger.info("Database tables created successfully.")
        
    except Exception as e:
        logger.error(f"Failed to create tables: {e}")
        import traceback
        traceback.print_exc()
        raise e 

    # Connection check moved to start of function
    await ensure_admin_user()

    await ensure_admin_user()

    # Seed default policies if needed
    try:
        from app.db_seeder import seed_default_policies, seed_test_hierarchy
        async with AsyncSessionLocal() as session:
            await seed_default_policies(session)
            # Only seed test hierarchy in development or if explicitly requested
            if settings.ENVIRONMENT == "development" or settings.DB_AUTO_MIGRATE:
                await seed_test_hierarchy(session)
    except Exception as e:
        logger.error(f"Seeding failed: {e}")


# PostgreSQL connection for LISTEN/NOTIFY
async def get_pg_connection():
    """Get a raw asyncpg connection for LISTEN/NOTIFY"""
    # Parse DATABASE_URL to extract connection params
    db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(db_url)
    return conn


async def ensure_admin_user():
    """Create or update the admin user from environment variables"""
    if not getattr(settings, "ADMIN_AUTO_CREATE", False):
        return

    email = settings.ADMIN_EMAIL
    password = settings.ADMIN_PASSWORD
    full_name = settings.ADMIN_FULL_NAME
    role = (settings.ADMIN_ROLE or "superadmin").lower()

    if not email or not password:
        logging.warning("Admin user not created: ADMIN_EMAIL and ADMIN_PASSWORD must be set")
        return

    password_hash = get_password_hash(password)
    
    # Split full name
    full_name_str = full_name or "Admin RRHH"
    parts = full_name_str.split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else "SysAdmin"
    
    # Generate username from email if not provided (simple fallback)
    username = email.split("@")[0]

    # Use raw asyncpg to cast role to the enum type (user_role)
    db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(db_url)
    try:
        await conn.execute(
            """
            INSERT INTO users (email, username, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
            ON CONFLICT (username) DO UPDATE
            SET email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                role = EXCLUDED.role,
                is_active = TRUE,
                updated_at = NOW();
            """,
            email,
            username,
            password_hash,
            first_name,
            last_name,
            role,
        )
        logging.info("Admin user ensured via bootstrap: %s", email)
    finally:
        await conn.close()


