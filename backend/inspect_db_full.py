import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Ensure we can load app config
sys.path.append(os.getcwd())

async def inspect():
    # Use environment variable directly for the engine
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("DATABASE_URL not set")
        return

    # Replace postgresql+asyncpg:// if needed (Alembic uses it, SQLAlchemy needs it)
    engine = create_async_engine(db_url)

    async with engine.connect() as conn:
        for table in ['users', 'permission_policies', 'vacation_requests', 'notifications', 'alembic_version']:
            print(f"\n--- Table: {table} ---")
            try:
                # Check columns
                res = await conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' ORDER BY ordinal_position"))
                cols = [row[0] for row in res.fetchall()]
                if not cols:
                    print(f"Table '{table}' does NOT exist or has no columns.")
                    continue
                print(f"Columns: {', '.join(cols)}")

                # Sample data for versioning
                if table == 'alembic_version':
                    res = await conn.execute(text("SELECT version_num FROM alembic_version"))
                    versions = [row[0] for row in res.fetchall()]
                    print(f"Versions in table: {versions}")
                
            except Exception as e:
                print(f"Error inspecting {table}: {e}")

if __name__ == "__main__":
    asyncio.run(inspect())
