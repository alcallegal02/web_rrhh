import logging
from collections.abc import AsyncGenerator

import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, select

logger = logging.getLogger(__name__)

from sqlalchemy import text

from app.config import settings

# --- Centralized Model Registration ---
# We must import all models that define tables here so that SQLModel.metadata.create_all
# can discover them, especially those referenced via Foreign Keys (e.g., positions, departments).
from app.models.user import User, UserAttachment, UserManagerLink, UserRrhhLink
from app.models.organization import Department, Position
from app.models.news import News, NewsAttachment
from app.models.complaint import Complaint, ComplaintAttachment, ComplaintStatusLog
from app.models.holiday import Holiday
from app.models.vacation import VacationRequest, VacationAttachment
from app.models.audit import AuditLog
from app.models.leave_type import LeaveType
from app.models.policy import PermissionPolicy
from app.models.convenio import ConvenioConfig
from app.models.upload import UploadQuota

# Import password hash service for ensure_admin_user
from app.services.auth import get_password_hash

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
        
        # 3. Migrate columns to TIMESTAMPTZ if needed
        await migrate_timezones()
        
        # 4. Ensure new permission columns exist
        await migrate_new_columns()
        
    except Exception as e:
        logger.error(f"Failed to create tables: {e}")
        import traceback
        traceback.print_exc()
        raise e 

    # Connection check moved to start of function
    await ensure_admin_user()

    # Seed default policies if needed
    try:
        from app.db_seeder import seed_default_policies, seed_test_hierarchy
        async with AsyncSessionLocal() as session:
            await seed_default_policies(session)
            # Only seed test hierarchy if explicitly requested
            if settings.SEED_TEST_DATA:
                await seed_test_hierarchy(session)
    except Exception as e:
        logger.error(f"Seeding failed: {e}")


async def migrate_new_columns():
    """Add missing columns to existing tables (Manual Migration)"""
    logger.info("Checking for missing permission/notification columns...")
    
    # (Column name, Default value/Type)
    new_user_cols = [
        ("can_manage_complaints", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("can_manage_news", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("can_manage_holidays", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("notif_own_requests", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("notif_managed_requests", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("notif_complaints", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("notif_news", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("password_encrypted", "TEXT")
    ]
    
    async with async_engine.begin() as conn:
        for col_name, col_type in new_user_cols:
            try:
                # Add column if not exists
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                logger.info(f"Ensured column users.{col_name} exists.")
            except Exception as e:
                logger.warning(f"Failed to add column users.{col_name}: {e}")


async def migrate_timezones():
    """Manually alter columns to TIMESTAMPTZ to ensure timezone compatibility"""
    logger.info("Checking for required datetime migrations to TIMESTAMPTZ...")
    
    # List of (table, column) tuples that need to be TIMESTAMPTZ
    migrations = [
        ("users", "created_at"), ("users", "updated_at"), ("users", "contract_end_date"),
        ("user_attachments", "created_at"),
        ("complaints", "created_at"), ("complaints", "updated_at"),
        ("complaint_attachments", "created_at"),
        ("complaint_comments", "created_at"),
        ("complaint_status_logs", "created_at"),
        ("news", "created_at"), ("news", "updated_at"), ("news", "published_at"),
        ("news_attachments", "created_at"),
        ("news_carousel_images", "created_at"),
        ("vacation_requests", "created_at"), ("vacation_requests", "updated_at"),
        ("vacation_requests", "start_date"), ("vacation_requests", "end_date"),
        ("vacation_attachments", "created_at"),
        ("audit_logs", "created_at"),
        ("holidays", "date"), ("holidays", "created_at"),
        ("leave_types", "created_at"), ("leave_types", "updated_at"),
        ("permission_policies", "created_at"), ("permission_policies", "updated_at"),
        ("departments", "created_at"), ("departments", "updated_at"),
        ("positions", "created_at"), ("positions", "updated_at"),
    ]
    
    async with async_engine.begin() as conn:
        for table, column in migrations:
            try:
                # Check current type
                result = await conn.execute(text(f"""
                    SELECT data_type 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}' AND column_name = '{column}'
                """))
                current_type = result.scalar()
                
                if current_type == 'timestamp without time zone':
                    logger.info(f"Migrating {table}.{column} to TIMESTAMPTZ...")
                    await conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE TIMESTAMPTZ USING {column} AT TIME ZONE 'UTC'"))
                elif current_type is None:
                    # Column might not exist yet if table wasn't created, skip
                    continue
            except Exception as e:
                logger.warning(f"Failed to migrate {table}.{column}: {e}")


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
            INSERT INTO users (email, username, password_hash, first_name, last_name, role, is_active, can_manage_complaints, can_manage_news, can_manage_holidays, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, TRUE, TRUE, NOW(), NOW())
            ON CONFLICT (username) DO UPDATE
            SET email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                role = EXCLUDED.role,
                is_active = TRUE,
                can_manage_complaints = TRUE,
                can_manage_news = TRUE,
                can_manage_holidays = TRUE,
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


