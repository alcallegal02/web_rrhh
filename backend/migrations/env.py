import os
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool

from alembic import context
from sqlmodel import SQLModel

# Import your models here so Alembic can see them
# It's crucial to import ALL models
from app.models.user import User
from app.models.vacation import VacationRequest, VacationAttachment
from app.models.leave_type import LeaveType
from app.models.policy import PermissionPolicy
from app.models.complaint import Complaint, ComplaintAttachment
from app.models.convenio import ConvenioConfig
from app.models.audit import AuditLog
from app.models.upload import UploadQuota
from app.models.news import News, NewsAttachment
from app.models.organization import Department, Position
from app.models.holiday import Holiday

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# target_metadata is the MetaData object of your models
target_metadata = SQLModel.metadata

# Retrieve DATABASE_URL from environment variable
# Check for both DATABASE_URL (standard) and POSTGRES connections
# If strictly relying on .env loading in app/config.py, we can reuse that
import sys
# Ensure the app directory is in the path
sys.path.append(os.getcwd())

# Try to get URL from environment first, or fall back to code config
db_url = os.getenv("DATABASE_URL")
    # Fallback: try to load from .env first, then .env.dev
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.dev")
    load_dotenv(env_path)
    db_url = os.getenv("DATABASE_URL")

# Fix asyncpg protocol
if db_url and db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

if not db_url:
    # Last resort fallback (user probably running locally without env logic)
    print("Warning: DATABASE_URL not found in environment")

config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio
    asyncio.run(run_migrations_online())
